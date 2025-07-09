/**
 * High-level functions for creating status list credentials
 */

import {StatusList} from '../status-list/StatusList'
import {BitstringStatusListCredentialSubject, BitstringStatusListCredentialUnsigned, IIssuer} from '../types'

export async function createStatusListCredential(options: {
    id: string
    issuer: string | IIssuer
    statusSize?: number
    statusPurpose: string | string[]
    validFrom?: Date
    validUntil?: Date
    ttl?: number
}): Promise<BitstringStatusListCredentialUnsigned> {
    const { id, issuer, statusSize ,validFrom, validUntil, statusPurpose, ttl} = options

    const encodedList = await new StatusList({statusSize}).encode()

    const credentialSubject = {
        id: `${id}#list`,
        type: 'BitstringStatusList',
        statusPurpose,
        statusSize: statusSize ?? 1,
        encodedList,
        ...(ttl && {ttl})
    } satisfies BitstringStatusListCredentialSubject

    return {
        '@context': [
            'https://www.w3.org/ns/credentials/v2',
            'https://www.w3.org/ns/credentials/status/v1'
        ],
        id,
        type: ['VerifiableCredential', 'BitstringStatusListCredential'],
        issuer,
        credentialSubject,
        ...(validFrom && {validFrom: validFrom.toISOString()}),
        ...(validUntil && {validUntil: validUntil.toISOString()})
    }
}
