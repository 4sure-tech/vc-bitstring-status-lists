/**
 * Central type definitions for the Bitstring Status List library
 * Based on W3C Bitstring Status List v1.0 specification
 */
export type BitstringStatusPurpose = 'revocation' | 'suspension' | 'refresh' | 'message' | string

export interface BitstringStatusListEntry {
    id?: string // Optional identifier for the status list entry
    type: 'BitstringStatusListEntry'
    statusPurpose: 'revocation' | 'suspension' | 'message' | string
    statusListIndex: string // Index as a string integer >= 0
    statusListCredential: string // URL pointing to the BitstringStatusListCredential
    statusSize?: number // Optional size of status entry in bits, defaults to 1
    statusMessage?: StatusMessage[] // Optional array of status messages
    statusReference?: string | string[] // Optional reference URLs
}

export interface BitstringStatusListCredentialSubject {
    id: string // The ID of the credential subject
    type: 'BitstringStatusList'
    statusPurpose: 'revocation' | 'suspension' | 'message' | string | string[] // Can be array for multiple purposes
    encodedList: string // The u-prefixed, compressed, base64url-encoded string
    ttl?: number // Optional time to live in milliseconds
}

export type AdditionalClaims = Record<string, any>

export type BitstringStatusListCredentialUnsigned = AdditionalClaims & {
    '@context': string[]
    id: string
    issuer: string | IIssuer
    type: string[]
    credentialSubject: BitstringStatusListCredentialSubject
    validFrom?: string
    validUntil?: string
}

export interface IIssuer {
    id: string

    [x: string]: any
}

export type CredentialStatus = BitstringStatusListEntry | BitstringStatusListEntry[]

type CredentialSubject = {
    id: string
    type: string
    [key: string]: any
};

export interface CredentialWithStatus {
    '@context': string[]
    id: string
    type: string[]
    issuer: string | IIssuer
    validFrom?: string
    validUntil?: string
    credentialStatus?: CredentialStatus
    credentialSubject: CredentialSubject
}

export interface CheckStatusOptions {
    credential: CredentialWithStatus
    getStatusListCredential: (url: string) => Promise<BitstringStatusListCredentialUnsigned>
}

export interface VerificationResult {
    verified: boolean
    status: number // The numeric status code found
    statusMessage?: StatusMessage // The corresponding message object if found
    error?: Error
}

export interface StatusMessage {
    id: string // The hex status code (e.g., "0x0", "0x1")
    message: string // The human-readable description of the status
}
