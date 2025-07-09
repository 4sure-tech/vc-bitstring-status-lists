import {describe, expect, it} from 'vitest'
import {BitstreamStatusList, createStatusListCredential} from '../src'

describe('createStatusListCredential', () => {
    it('should create basic credential', async () => {
        const credential = await createStatusListCredential({
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
        const issuer = {id: 'https://example.com/issuer', name: 'Test Issuer'}

        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer,
            statusPurpose: 'revocation',
            statusSize: 2
        })

        expect(credential.issuer).toEqual(issuer)
    })

    it('should create credential with validity period', async () => {
        const validFrom = new Date('2024-01-01T00:00:00Z')
        const validUntil = new Date('2024-12-31T23:59:59Z')

        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation',
            statusSize: 3,
            validFrom,
            validUntil
        })

        expect(credential.validFrom).toBe('2024-01-01T00:00:00.000Z')
        expect(credential.validUntil).toBe('2024-12-31T23:59:59.000Z')
    })

    it('should create credential with multiple status purposes', async () => {
        const statusPurpose = ['revocation', 'suspension']

        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose
        })

        expect(credential.credentialSubject.statusPurpose).toEqual(statusPurpose)
    })

    it('should create credential with TTL', async () => {
        const ttl = 86400000 // 24 hours

        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation',
            ttl
        })

        expect(credential.credentialSubject.ttl).toBe(ttl)
    })

    it('should create credential with custom statusSize', async () => {
        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'message',
            statusSize: 4
        })

        expect(credential.credentialSubject.encodedList).toMatch(/^u/)
    })

    it('should create empty status list by default', async () => {
        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation'
        })

        // Verify the encoded list can be decoded
        const statusList = await BitstreamStatusList.decode({
            encodedList: credential.credentialSubject.encodedList,
            statusSize: 1
        })

        expect(statusList.getStatusSize()).toBe(1)
    })

    it('should create credential with existing status list', async () => {
        // Create a status list with some data
        const existingList = new BitstreamStatusList({statusSize: 2})
        existingList.setStatus(0, 1)
        existingList.setStatus(5, 3)

        const credential = await createStatusListCredential({
            id: 'https://example.com/status/1',
            issuer: 'https://example.com/issuer',
            statusPurpose: 'revocation',
            statusSize: 2,
            statusList: existingList
        })

        // Decode and verify the status list contains the existing data
        const decoded = await BitstreamStatusList.decode({
            encodedList: credential.credentialSubject.encodedList,
            statusSize: 2
        })

        expect(decoded.getStatus(0)).toBe(1)
        expect(decoded.getStatus(5)).toBe(3)
    })
})
