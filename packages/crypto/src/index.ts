/**
 * ORBIT Crypto Package
 * - Signal Protocol (E2E encryption for DMs)
 * - libsodium AEAD (storage encryption)
 * - Ed25519 + X25519 keypairs (DID, portable identity)
 * - W3C DID generation
 * - WebAuthn helpers
 */

import { ed25519 } from '@noble/curves/ed25519';
import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import sodium from 'libsodium-wrappers';

let sodiumReady: Promise<void> | null = null;
async function ensureSodium() {
  if (!sodiumReady) sodiumReady = sodium.ready;
  return sodiumReady;
}

// ============================================================
// Utility: Base64 / Base64URL
// ============================================================
export const base64 = {
  encode: (bytes: Uint8Array): string =>
    typeof btoa === 'function'
      ? btoa(String.fromCharCode(...bytes))
      : Buffer.from(bytes).toString('base64'),
  decode: (str: string): Uint8Array => {
    if (typeof atob === 'function') {
      const bin = atob(str);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(str, 'base64'));
  },
};

export const base64url = {
  encode: (bytes: Uint8Array): string =>
    base64.encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (str: string): Uint8Array => {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
    return base64.decode(padded);
  },
};

// ============================================================
// Identity Keypairs
// ============================================================
export interface IdentityKeyPair {
  /** Ed25519 long-term identity (32 bytes public, 64 bytes private) */
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface X25519KeyPair {
  publicKey: Uint8Array;                // 32 bytes
  privateKey: Uint8Array;               // 32 bytes
}

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export function signEd25519(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function verifyEd25519(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  return ed25519.verify(signature, message, publicKey);
}

export function x25519SharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

// ============================================================
// W3C DID Generation
// ============================================================
export function generateDID(publicKey: Uint8Array, method: 'orbit' | 'key' = 'orbit'): string {
  const methodSpec = method === 'orbit' ? 'did:orbit:' : 'did:key:';
  if (method === 'key') {
    // Multicodec prefix for Ed25519: 0xed 0x01
    const multicodec = new Uint8Array([0xed, 0x01, ...publicKey]);
    return `did:key:z${base64url.encode(multicodec)}`;
  }
  // Orbit-native DID: hash of public key for compact form
  const fingerprint = sha256(publicKey).slice(0, 16);
  const fingerprintB32 = base64url.encode(fingerprint);
  return `did:orbit:${fingerprintB32}`;
}

export function didFromPublicKey(publicKeyB64: string, method: 'orbit' | 'key' = 'orbit'): string {
  return generateDID(base64.decode(publicKeyB64), method);
}

// ============================================================
// Signal Protocol (simplified X3DH + Double Ratchet)
// ============================================================

/** Signal Identity Key (long-term X25519 for E2E) */
export interface SignalIdentityKey {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** Signed Pre-Key (medium-term X25519) */
export interface SignedPreKey {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signature: Uint8Array;                // signed by IdentityKey
  createdAt: number;
}

/** One-Time Pre-Key */
export interface OneTimePreKey {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** Bundle published by recipient */
export interface PreKeyBundle {
  identityKey: Uint8Array;
  signedPreKey: { keyId: number; publicKey: Uint8Array; signature: Uint8Array };
  oneTimePreKey?: { keyId: number; publicKey: Uint8Array };
}

/** Per-thread Double Ratchet state */
export interface RatchetState {
  rootKey: Uint8Array;
  sendChainKey: Uint8Array;
  recvChainKey: Uint8Array;
  sendRatchetKey?: X25519KeyPair;
  recvRatchetKey?: Uint8Array;
  sendCounter: number;
  recvCounter: number;
  skippedKeys: Map<string, Uint8Array>;  // {ratchet_key+counter: message_key}
}

const KDF_INFO_ROOT = new TextEncoder().encode('ORBIT_RootKey');
const KDF_INFO_CHAIN = new TextEncoder().encode('ORBIT_ChainKey');
const KDF_INFO_MSG = new TextEncoder().encode('ORBIT_MsgKey');

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number = 32
): Promise<Uint8Array> {
  await ensureSodium();
  // libsodium crypto_kdf_derive_from_key signature:
  //   (subkey_length: number, subkey_id: number, ctx: string, key: Uint8Array)
  // subkey_id must be an unsigned integer or bigint (NOT a string — old code passed base64 string).
  // ctx must be <= 8 chars. info bytes → ASCII context, ikm truncated to 32 bytes is the master key.
  const ctx = (new TextDecoder().decode(info) + base64url.encode(ikm)).slice(0, 8);
  // Encode salt as a numeric subkey_id (first 4 bytes as uint32, fallback to 0).
  // With the current callers, salt is always a zero Uint8Array(32) so subkey_id is 0;
  // distinct masters (different ikm per derivation) already yield distinct subkeys.
  let subkeyId = 0;
  for (let i = 0; i < Math.min(salt.length, 4); i++) {
    subkeyId |= salt[i] << (i * 8);
  }
  subkeyId = subkeyId >>> 0; // coerce to unsigned 32-bit
  return sodium.crypto_kdf_derive_from_key(length, subkeyId, ctx, ikm.slice(0, 32));
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  // Use noble/hashes for HMAC
  // Simplified for demo; in production use libsodium crypto_auth_hmacsha256
  const blockSize = 64;
  let paddedKey = key;
  if (paddedKey.length > blockSize) paddedKey = sha256(paddedKey);
  if (paddedKey.length < blockSize) paddedKey = new Uint8Array([...paddedKey, ...new Uint8Array(blockSize - paddedKey.length)]);

  const oKey = new Uint8Array(blockSize);
  const iKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = paddedKey[i] ^ 0x5c;
    iKey[i] = paddedKey[i] ^ 0x36;
  }

  const inner = sha256(new Uint8Array([...iKey, ...data]));
  return sha256(new Uint8Array([...oKey, ...inner]));
}

export async function deriveInitialSession(
  aliceIdentity: SignalIdentityKey,
  aliceEphemeral: X25519KeyPair,
  bobBundle: PreKeyBundle
): Promise<RatchetState> {
  // Simplified X3DH:
  // DH1 = DH(aliceIdentity, bobSignedPreKey)
  // DH2 = DH(aliceEphemeral, bobIdentity)
  // DH3 = DH(aliceEphemeral, bobSignedPreKey)
  // DH4 = DH(aliceEphemeral, bobOneTimePreKey) [if provided]
  // SK = KDF(DH1 || DH2 || DH3 || DH4)

  const dh1 = x25519SharedSecret(aliceIdentity.privateKey, bobBundle.signedPreKey.publicKey);
  const dh2 = x25519SharedSecret(aliceEphemeral.privateKey, bobBundle.identityKey);
  const dh3 = x25519SharedSecret(aliceEphemeral.privateKey, bobBundle.signedPreKey.publicKey);

  const dhInputs = [dh1, dh2, dh3];
  if (bobBundle.oneTimePreKey) {
    dhInputs.push(x25519SharedSecret(aliceEphemeral.privateKey, bobBundle.oneTimePreKey.publicKey));
  }

  const concatenated = new Uint8Array(dhInputs.reduce((sum, dh) => sum + dh.length, 0));
  let offset = 0;
  for (const dh of dhInputs) {
    concatenated.set(dh, offset);
    offset += dh.length;
  }

  const rootKey = await hkdf(concatenated, new Uint8Array(32), KDF_INFO_ROOT);
  const sendChainKey = await hkdf(rootKey, new Uint8Array(32), KDF_INFO_CHAIN);

  return {
    rootKey,
    sendChainKey,
    recvChainKey: new Uint8Array(32),
    sendRatchetKey: aliceEphemeral,
    sendCounter: 0,
    recvCounter: 0,
    skippedKeys: new Map(),
  };
}

export async function encryptMessage(
  state: RatchetState,
  plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; ephemeralPublicKey?: Uint8Array; counter: number }> {
  await ensureSodium();

  // Derive message key from chain key
  const messageKey = await hkdf(state.sendChainKey, new Uint8Array(32), KDF_INFO_MSG);

  // Advance chain key
  const nextChainKey = await hkdf(state.sendChainKey, new Uint8Array(32), new TextEncoder().encode('next'));
  state.sendChainKey = nextChainKey;

  // Encrypt with XChaCha20-Poly1305
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    messageKey
  );

  // Prepend nonce to ciphertext
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);

  return {
    ciphertext: result,
    ephemeralPublicKey: state.sendRatchetKey?.publicKey,
    counter: state.sendCounter++,
  };
}

export async function decryptMessage(
  state: RatchetState,
  ciphertext: Uint8Array,
  ephemeralPublicKey?: Uint8Array
): Promise<Uint8Array> {
  await ensureSodium();

  const nonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = ciphertext.slice(0, nonceLength);
  const body = ciphertext.slice(nonceLength);

  const messageKey = await hkdf(state.recvChainKey, new Uint8Array(32), KDF_INFO_MSG);

  const nextChainKey = await hkdf(state.recvChainKey, new Uint8Array(32), new TextEncoder().encode('next'));
  state.recvChainKey = nextChainKey;
  state.recvCounter++;

  return new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, body, null, nonce, messageKey));
}

// ============================================================
// Storage Encryption (for sensitive data at rest)
// ============================================================
export async function encryptAtRest(plaintext: string, key: Uint8Array): Promise<string> {
  await ensureSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    new TextEncoder().encode(plaintext),
    null,
    null,
    nonce,
    key
  );
  return base64.encode(new Uint8Array([...nonce, ...ciphertext]));
}

export async function decryptAtRest(encrypted: string, key: Uint8Array): Promise<string> {
  await ensureSodium();
  const bytes = base64.decode(encrypted);
  const nonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = bytes.slice(0, nonceLength);
  const body = bytes.slice(nonceLength);
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, body, null, nonce, key);
  return new TextDecoder().decode(plaintext);
}

// ============================================================
// Hashing
// ============================================================
export async function sha256Hash(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return base64.encode(sha256(bytes));
}

// ============================================================
// Random
// ============================================================
export async function randomBytes(length: number): Promise<Uint8Array> {
  await ensureSodium();
  return sodium.randombytes_buf(length);
}

export async function generateId(): Promise<string> {
  const bytes = await randomBytes(16);
  return base64url.encode(bytes);
}

export function generateHandle(): string {
  // Generates a random 12-char handle suffix
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'user_';
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ============================================================
// Domain extraction (for portable identity)
// ============================================================
export function isValidDomain(domain: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain);
}

export function extractDomainFromHandle(handle: string): string | null {
  const match = handle.match(/^@?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}
