// Core Classes
export {BitManager} from './bit-manager/BitManager'
export {StatusList} from './status-list/StatusList'

// High-Level Functions
export {createStatusListCredential} from './credential/create'
export {checkStatus} from './credential/verify'

// Types
export type {
    StatusMessage,
    BitstringStatusListEntry,
    BitstringStatusListCredentialSubject,
    BitstringStatusListCredentialUnsigned,
    IIssuer,
    CredentialStatus,
    CredentialWithStatus,
    CheckStatusOptions,
    VerificationResult,
    AdditionalClaims
} from './types'
