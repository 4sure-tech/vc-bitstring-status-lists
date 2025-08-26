// Core Classes
export {BitManager} from './bit-manager/BitManager'
export {BitstreamStatusList} from './status-list/BitstreamStatusList'

// High-Level Functions
export {createStatusListCredential} from './credential/create'
export {checkStatus} from './credential/verify'

// Types
export type {
    StatusMessage,
    BitstringStatusPurpose,
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
