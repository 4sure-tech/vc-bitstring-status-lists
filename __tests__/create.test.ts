import {describe, expect, it} from 'vitest'
import {createStatusListCredential, StatusList} from '../src'

describe('createStatusListCredential', () => {
    it('should create basic credential', async () => {
        const list = new StatusList()
        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation'
        })

        expect(credential).toMatchObject({
            '@context': [
                'https://www.w3.org/ns/credentials/v2',
                'https://www.w3.org/ns/credentials/status/v1'
            ],
            id: 'https://example.com/status/1',
            type: ['VerifiableCredential', 'BitstringStatusListCredential'],
            issuer: 'https://example.com/issuer',
            credentialSubject: {
                id: 'https://example.com/status/1#list',
                type: 'BitstringStatusList',
                statusPurpose: 'revocation',
                encodedList: expect.stringMatching(/^u/)
            }
        })
    })

    it('should create credential with issuer object', async () => {
        const list = new StatusList()
        const issuer = {id: 'https://example.com/issuer', name: 'Test Issuer'}

        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer,
            statusPurpose: 'revocation'
        })

        expect(credential.issuer).toEqual(issuer)
    })

    it('should create credential with validity period', async () => {
        const list = new StatusList()
        const validFrom = '2024-01-01T00:00:00Z'
        const validUntil = '2024-12-31T23:59:59Z'

        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation',
            validFrom,
            validUntil
        })

        expect(credential.validFrom).toBe(validFrom)
        expect(credential.validUntil).toBe(validUntil)
    })

    it('should create credential with multiple status purposes', async () => {
        const list = new StatusList()
        const statusPurpose = ['revocation', 'suspension']

        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose
        })

        expect(credential.credentialSubject.statusPurpose).toEqual(statusPurpose)
    })

    it('should create credential with TTL', async () => {
        const list = new StatusList()
        const ttl = 86400000 // 24 hours

        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation',
            ttl
        })

        expect(credential.credentialSubject.ttl).toBe(ttl)
    })

    it('should create credential with populated status list', async () => {
        const list = new StatusList()
        list.addEntry(0)
        list.addEntry(1)
        list.setStatus(0, 1)

        const credential = await createStatusListCredential({
            statusList: list,
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation'
        })

        expect(credential.credentialSubject.encodedList).toMatch(/^u/)
    })
})
