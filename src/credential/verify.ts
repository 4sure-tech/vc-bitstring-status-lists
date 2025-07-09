/**
 * W3C Bitstring Status List credential verification logic
 *
 * Implements the complete W3C Bitstring Status List v1.0 verification algorithm
 * including status purpose validation, temporal validity checks, and minimum
 * bitstring length requirements.
 */

import {BitstreamStatusList} from '../status-list/BitstreamStatusList'
import {BitstringStatusListEntry, CheckStatusOptions, StatusMessage, VerificationResult} from '../types'
import {assertIsObject} from '../utils/assertions'

/** W3C minimum bitstring size in bits */
const MIN_BITSTRING_SIZE_BITS = 131072 // 16KB * 8

/**
 * Checks the status of a credential against its referenced status list
 *
 * Implements the W3C Bitstring Status List verification algorithm:
 * 1. Validates credential structure and extracts BitstringStatusListEntry
 * 2. Retrieves and validates the status list credential
 * 3. Checks temporal validity (validFrom/validUntil)
 * 4. Validates status purpose matching
 * 5. Verifies minimum bitstring length requirements
 * 6. Decodes status list and retrieves credential status
 * 7. Determines verification result based on status purpose
 *
 * @example
 * ```typescript
 * const result = await checkStatus({
 *   credential: someCredentialWithStatus,
 *   getStatusListCredential: async (url) => {
 *     const response = await fetch(url)
 *     return response.json()
 *   }
 * })
 *
 * if (result.verified) {
 *   console.log('Credential is valid')
 * } else {
 *   console.log('Credential failed:', result.error?.message)
 * }
 * ```
 *
 * @param options.credential - The credential to check status for
 * @param options.getStatusListCredential - Function to retrieve status list credential by URL
 * @returns Promise resolving to verification result with status details
 */
export async function checkStatus(options: CheckStatusOptions): Promise<VerificationResult> {
    try {
        const {credential, getStatusListCredential} = options

        // Validate input credential structure
        assertIsObject(credential, 'credential')

        if (!credential.credentialStatus) {
            return Promise.reject(new Error('No credentialStatus found in credential'))
        }

        // Extract BitstringStatusListEntry from credential status
        const entry = extractBitstringStatusEntry(credential.credentialStatus)
        if (!entry) {
            throw new Error('No BitstringStatusListEntry found in credentialStatus')
        }

        // Retrieve the status list credential
        const listCredential = await getStatusListCredential(entry.statusListCredential)

        // Validate temporal constraints
        validateTemporalValidity(listCredential)

        // Validate status purpose matching (W3C requirement)
        validateStatusPurposeAndSize(entry, listCredential)

        // Decode status list and validate minimum size
        const statusSize = entry.statusSize || 1
        const statusList = await BitstreamStatusList.decode({
            encodedList: listCredential.credentialSubject.encodedList,
            statusSize
        })


        // Verify W3C minimum bitstring length requirement
        validateMinimumBitstringLength(listCredential.credentialSubject.encodedList, statusSize)

        // Retrieve the actual status value
        const statusIndex = parseInt(entry.statusListIndex, 10)
        const status = statusList.getStatus(statusIndex)

        // Find corresponding status message if available
        const statusMessage = findStatusMessage(entry, status)

        // Determine verification result based on status purpose
        const verified = determineVerificationResult(entry.statusPurpose, status)

        return {
            verified,
            status,
            statusMessage
        }

    } catch (error) {
        return {
            verified: false,
            status: -1,
            error: error instanceof Error ? error : new Error(String(error))
        }
    }
}

/**
 * Extracts BitstringStatusListEntry from credential status
 * Handles both single entry and array of entries
 */
function extractBitstringStatusEntry(
    credentialStatus: any
): BitstringStatusListEntry | null {
    const statusEntries = Array.isArray(credentialStatus)
        ? credentialStatus
        : [credentialStatus]

    return statusEntries.find(entry => entry.type === 'BitstringStatusListEntry') || null
}

/**
 * Validates temporal validity of the status list credential
 * Checks validFrom and validUntil against current time
 */
function validateTemporalValidity(listCredential: any): void {
    const now = new Date()

    if (listCredential.validFrom && new Date(listCredential.validFrom) > now) {
        throw new Error('Status list credential is not yet valid')
    }

    if (listCredential.validUntil && new Date(listCredential.validUntil) < now) {
        throw new Error('Status list credential has expired')
    }
}

/**
 * Validates that the entry's statusPurpose matches the list credential's purpose(s)
 * Implements W3C specification requirement for purpose matching
 */
function validateStatusPurposeAndSize(
    entry: BitstringStatusListEntry,
    listCredential: any
): void {
    const listStatusPurpose = listCredential.credentialSubject.statusPurpose
    const purposes = Array.isArray(listStatusPurpose) ? listStatusPurpose : [listStatusPurpose]

    if (!purposes.includes(entry.statusPurpose)) {
        throw new Error(
            `Status purpose '${entry.statusPurpose}' does not match any purpose in status list credential: ${purposes.join(', ')}`
        )
    }

    const statusSize = entry.statusSize || 1
    if ( listCredential.credentialSubject.statusSize !== statusSize) {
        throw new Error(`StatusSize mismatch: expected ${statusSize}, got from credentialSubject ${listCredential.credentialSubject.statusSize}`)
    }

}

/**
 * Validates that the bitstring meets W3C minimum length requirements
 * Uses efficient ISIZE-based calculation to avoid full decompression
 */
function validateMinimumBitstringLength(encodedList: string, statusSize: number): void {
    const totalEntries = BitstreamStatusList.getStatusListLength(encodedList, statusSize)
    const minEntries = MIN_BITSTRING_SIZE_BITS / statusSize

    if (totalEntries < minEntries) {
        throw new Error(
            `Status list length error: bitstring must support at least ${minEntries} entries for statusSize ${statusSize}`
        )
    }
}

/**
 * Finds the corresponding status message for a given status value
 * Returns undefined if no matching message found
 */
function findStatusMessage(
    entry: BitstringStatusListEntry,
    status: number
): StatusMessage | undefined {
    if (!entry.statusMessage) {
        return undefined
    }

    const statusHex = `0x${status.toString(16)}`
    return entry.statusMessage.find(msg => msg.id === statusHex)
}

/**
 * Determines the verification result based on status purpose and value
 *
 * For 'revocation' and 'suspension': 0 = valid, non-zero = invalid
 * For other purposes: defaults to valid (assumes status is informational)
 */
function determineVerificationResult(statusPurpose: string, status: number): boolean {
    if (statusPurpose === 'revocation' || statusPurpose === 'suspension') {
        return status === 0 // 0 means not revoked/suspended
    }

    // For other purposes (e.g., 'message'), default to valid
    // The status value provides information but doesn't affect validity
    return true
}