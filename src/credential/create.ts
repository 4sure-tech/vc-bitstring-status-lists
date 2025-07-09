/**
 * High-level credential creation functions for W3C Bitstring Status Lists
 *
 * Provides convenient functions to create compliant BitstringStatusListCredentials
 * according to the W3C Bitstring Status List v1.0 specification.
 */

import {BitstreamStatusList} from '../status-list/BitstreamStatusList'
import {BitstringStatusListCredentialSubject, BitstringStatusListCredentialUnsigned, IIssuer} from '../types'
import * as console from "node:console";

/**
 * Creates a W3C compliant BitstringStatusListCredential with an empty status list
 *
 * The created credential contains an empty status list that can be referenced by
 * other credentials through their credentialStatus.statusListCredential property.
 * Individual credential statuses are managed separately by updating the status list
 * and republishing the credential.
 *
 * @example
 * ```typescript
 * // Create a revocation list for single-bit status (revoked/not revoked)
 * const credential = await createStatusListCredential({
 *   id: 'https://issuer.example/status/1',
 *   issuer: 'https://issuer.example',
 *   statusPurpose: 'revocation'
 * })
 *
 * // Create a message list with 4-bit status codes
 * const messageList = await createStatusListCredential({
 *   id: 'https://issuer.example/status/messages',
 *   issuer: { id: 'https://issuer.example', name: 'Example Issuer' },
 *   statusPurpose: 'message',
 *   statusSize: 4,
 *   validUntil: new Date('2025-12-31')
 * })
 * ```
 *
 * @param options.id - Unique identifier for the status list credential
 * @param options.issuer - Issuer identifier (string) or issuer object with id
 * @param options.statusSize - Uniform bit width for status entries (default: 1)
 * @param options.statusPurpose - Purpose(s) of the status list (e.g., 'revocation', 'suspension')
 * @param options.validFrom - Optional start of validity period
 * @param options.validUntil - Optional end of validity period
 * @param options.ttl - Optional time-to-live in milliseconds
 * @returns Promise resolving to unsigned BitstringStatusListCredential
 */
export async function createStatusListCredential(options: {
    id: string
    issuer: string | IIssuer
    statusSize?: number
    statusList?: BitstreamStatusList
    statusPurpose: string | string[]
    validFrom?: Date
    validUntil?: Date
    ttl?: number
}): Promise<BitstringStatusListCredentialUnsigned> {
    const {
        id,
        issuer,
        statusSize = 1,
        statusList,
        statusPurpose,
        validFrom,
        validUntil,
        ttl
    } = options

    // Create empty status list with specified statusSize
    const encodedList = await (statusList ?? new BitstreamStatusList({statusSize})).encode()

    // Build credential subject according to W3C spec
    const credentialSubject: BitstringStatusListCredentialSubject = {
        id: `${id}#list`,
        type: 'BitstringStatusList',
        statusPurpose,
        encodedList,
        ...(ttl && {ttl})
    }
console.log('credentialSubject', JSON.stringify(credentialSubject))
    // Build the complete credential with W3C contexts
    const credential: BitstringStatusListCredentialUnsigned = {
        '@context': [
            'https://www.w3.org/ns/credentials/v2',           // Core VC context
            'https://www.w3.org/ns/credentials/status/v1'     // Status list context
        ],
        id,
        type: ['VerifiableCredential', 'BitstringStatusListCredential'],
        issuer,
        credentialSubject,
        ...(validFrom && {validFrom: validFrom.toISOString()}),
        ...(validUntil && {validUntil: validUntil.toISOString()})
    }

    return credential
}