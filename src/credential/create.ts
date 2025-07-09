/**
 * High-level functions for creating status list credentials
 */

import {StatusList} from '../status-list/StatusList'
import {BitstringStatusListCredentialSubject, BitstringStatusListCredentialUnsigned, IIssuer, StatusMessage} from '../types'

export async function createStatusListCredential(options: {
    list: StatusList
    id: string
    issuer: string | IIssuer
    validFrom?: string
    validUntil?: string
    statusPurpose: string | string[]
    statusMessage?: StatusMessage[]
    ttl?: number
}): Promise<BitstringStatusListCredentialUnsigned> {
    const {list, id, issuer, validFrom, validUntil, statusPurpose, ttl} = options

    const encodedList = await list.encode()

    const credentialSubject = {
        id: `${id}#list`,
        type: 'BitstringStatusList',
        statusPurpose,
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
        ...(validFrom && {validFrom}),
        ...(validUntil && {validUntil})
    }
}
