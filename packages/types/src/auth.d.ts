export interface WebAuthnRegistrationOptions {
    challenge: string;
    rp: {
        name: string;
        id: string;
    };
    user: {
        id: string;
        name: string;
        displayName: string;
    };
    pubKeyCredParams: Array<{
        type: 'public-key';
        alg: number;
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
    rawId: string;
    type: 'public-key';
    response: {
        attestationObject: string;
        clientDataJSON: string;
        transports?: string[];
    };
    clientExtensionResults?: Record<string, any>;
}
