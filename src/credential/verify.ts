/**
 * Verifying credential status logic
 */

import {StatusList} from '../status-list/StatusList'
import {BitstringStatusListEntry, CheckStatusOptions, StatusMessage, VerificationResult} from '../types'
import {assertIsObject} from '../utils/assertions'

export async function checkStatus(options: CheckStatusOptions): Promise<VerificationResult> {
    try {
        const {credential, getStatusListCredential} = options

        assertIsObject(credential, 'credential')

        if (!credential.credentialStatus) {
            return Promise.reject(new Error('No credentialStatus found in credential'))
        }

        // Extract BitstringStatusListEntry (handle both single and array)
        const statusEntries = Array.isArray(credential.credentialStatus)
            ? credential.credentialStatus
            : [credential.credentialStatus]

        const entry = statusEntries.find(e => e.type === 'BitstringStatusListEntry') as BitstringStatusListEntry
        if (!entry) {
            throw Error('No BitstringStatusListEntry found in credentialStatus')
        }

        // Get the status list credential (assumed to be verified)
        const listCredential = await getStatusListCredential(entry.statusListCredential)

        // Check validity period
        const now = new Date()
        if (listCredential.validFrom && new Date(listCredential.validFrom) > now) {
            throw new Error('Status list credential is not yet valid')
        }
        if (listCredential.validUntil && new Date(listCredential.validUntil) < now) {
            throw new Error('Status list credential has expired')
        }

        // Validate statusPurpose matches (W3C spec requirement)
        const listStatusPurpose = listCredential.credentialSubject.statusPurpose
        const purposes = Array.isArray(listStatusPurpose) ? listStatusPurpose : [listStatusPurpose]

        if (!purposes.includes(entry.statusPurpose)) {
            throw new Error(`Status purpose '${entry.statusPurpose}' does not match any purpose in status list credential: ${purposes.join(', ')}`)
        }

        // Decode the status list and get status
        const {buffer} = await StatusList.decode({
            encodedList: listCredential.credentialSubject.encodedList
        })

        // Verify minimum bitstring length (W3C spec requirement)
        const statusSize = entry.statusSize || 1
        const totalBits = buffer.length * 8
        const minEntries = 131072 / statusSize // 16KB in bits divided by statusSize

        if (totalBits / statusSize < minEntries) {
            throw new Error(`Status list length error: bitstring must support at least ${minEntries} entries for statusSize ${statusSize}`)
        }

        const statusIndex = parseInt(entry.statusListIndex, 10)
        const startBit = statusIndex * statusSize

        let status = 0
        for (let i = 0; i < statusSize; i++) {
            const bitIndex = startBit + i
            const byteIndex = Math.floor(bitIndex / 8)
            const bitOffset = bitIndex % 8

            if (byteIndex >= buffer.length) {
                throw Error(`Index ${statusIndex} with statusSize ${statusSize} exceeds buffer bounds`)
            }

            const bit = (buffer[byteIndex] >> (7 - bitOffset)) & 1
            status |= bit << i
        }

        // Find corresponding status message
        const statusHex = `0x${status.toString(16)}`
        let statusMessage: StatusMessage | undefined
        if (entry.statusMessage) {
            statusMessage = entry.statusMessage.find(msg => msg.id === statusHex)
        }

        // Determine verification result based on status purpose
        let verified = true
        if (entry.statusPurpose === 'revocation' || entry.statusPurpose === 'suspension') {
            verified = status === 0 // 0 means not revoked/suspended
        }

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
