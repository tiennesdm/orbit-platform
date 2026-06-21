export type DID = string;
export type Handle = string;
export type ISO8601 = string;
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export interface UserPublicKeys {
    identityKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    oneTimePreKeys: string[];
}
export interface User {
    id: string;
    did: DID;
    username: string;
    handle: Handle;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    email?: string;
    emailVerified: boolean;
    phoneNumber?: string;
    phoneVerified: boolean;
    portableIdentity?: {
        publicKeys: UserPublicKeys;
        encryptedPrivateKey: string;
        recoveryPhraseHash: string;
    };
    aiAgent: {
        enabled: boolean;
        autonomyLevel: 'ask' | 'suggest' | 'auto';
        memoryEnabled: boolean;
        dailyDigestEnabled: boolean;
    };
    privacy: {
        profileVisibility: 'public' | 'followers' | 'private';
        showActivityStatus: boolean;
        showReadReceipts: boolean;
        allowDms: 'everyone' | 'followers' | 'nobody';
    };
    usageStats: {
        lastActiveAt: ISO8601;
        dailyMinutesUsed: number;
        weeklyMinutesUsed: number;
        monthlyMinutesUsed: number;
        streakDays: number;
    };
    status: UserStatus;
    createdAt: ISO8601;
    updatedAt: ISO8601;
}
export interface AuthSession {
    userId: string;
    did: DID;
    accessToken: string;
    refreshToken: string;
    expiresAt: ISO8601;
    deviceId: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: ISO8601;
}
