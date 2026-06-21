/**
 * ORBIT shared types — Auth (WebAuthn / passkeys)
 */

export interface WebAuthnRegistrationOptions {
  challenge: string;                                        // base64
  rp: {
    name: string;
    id: string;                                             // relying party ID (domain)
  };
  user: {
    id: string;
    name: string;                                           // username
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;                                            // -7 = ES256, -257 = RS256
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'required' | 'preferred' | 'discouraged';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: string[];
  }>;
}

export interface WebAuthnRegistrationCredential {
  id: string;
  rawId: string;                                            // base64
  type: 'public-key';
  response: {
    attestationObject: string;                               // base64
    clientDataJSON: string;                                 // base64
    transports?: string[];
  };
  clientExtensionResults?: Record<string, any>;
}
