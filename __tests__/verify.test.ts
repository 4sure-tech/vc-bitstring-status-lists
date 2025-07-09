import {describe, expect, it, vi} from 'vitest'
import {BitstringStatusListCredentialUnsigned, checkStatus, CredentialWithStatus, StatusList} from '../src'


describe('checkStatus', () => {
    const createMockCredential = (statusPurpose: string = 'revocation', statusIndex: string = '0'): CredentialWithStatus => ({
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: 'https://example.com/credential/1',
        type: ['VerifiableCredential'],
        issuer: 'https://example.com/issuer',
        credentialSubject: {
            id: 'did:example:123',
            type: 'Person'
        },
        credentialStatus: {
            type: 'BitstringStatusListEntry',
            statusPurpose,
            statusListIndex: statusIndex,
            statusListCredential: 'https://example.com/status/1'
        }
    })

    const createMockStatusListCredential = async (statuses: number[] = [0]): Promise<BitstringStatusListCredentialUnsigned> => {
        const list = new StatusList()
        statuses.forEach((status, index) => {
            list.addEntry(index)
            list.setStatus(index, status)
        })

        return {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            id: 'https://example.com/status/1',
            type: ['VerifiableCredential', 'BitstringStatusListCredential'],
            issuer: 'https://example.com/issuer',
            credentialSubject: {
                id: 'https://example.com/status/1#list',
                type: 'BitstringStatusList',
                statusPurpose: 'revocation',
                encodedList: await list.encode()
            }
        }
    }

    it('should verify valid credential (status 0)', async () => {
        const credential = createMockCredential()
        const statusListCredential = await createMockStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(true)
        expect(result.status).toBe(0)
        expect(result.error).toBeUndefined()
    })

    it('should verify revoked credential (status 1)', async () => {
        const credential = createMockCredential('revocation', '0')
        const statusListCredential = await createMockStatusListCredential([1])

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(1)
    })

    it('should handle status messages in credential status entry', async () => {
        const credential: CredentialWithStatus = {
            ...createMockCredential(),
            credentialStatus: {
                type: 'BitstringStatusListEntry',
                statusPurpose: 'revocation',
                statusListIndex: '0',
                statusListCredential: 'https://example.com/status/1',
                statusMessage: [
                    {id: '0x0', message: 'Valid'},
                    {id: '0x1', message: 'Revoked'}
                ]
            }
        }

        const statusListCredential = await createMockStatusListCredential([1])

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(1)
        expect(result.statusMessage).toEqual({id: '0x1', message: 'Revoked'})
    })

    it('should handle array of credential statuses', async () => {
        const credential: CredentialWithStatus = {
            ...createMockCredential(),
            credentialStatus: [
                {
                    type: 'SomeOtherStatusType' as any,
                    statusPurpose: 'other',
                    statusListIndex: '0',
                    statusListCredential: 'https://example.com/other'
                },
                {
                    type: 'BitstringStatusListEntry',
                    statusPurpose: 'revocation',
                    statusListIndex: '0',
                    statusListCredential: 'https://example.com/status/1'
                }
            ]
        }

        const statusListCredential = await createMockStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(true)
        expect(result.status).toBe(0)
    })

    it('should reject credential without BitstringStatusListEntry', async () => {
        const credential: CredentialWithStatus = {
            ...createMockCredential(),
            credentialStatus: {
                statusPurpose: 'revocation',
                statusListIndex: '0',
                statusListCredential: 'https://example.com/status/1'
            } as any
        }

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn()
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('No BitstringStatusListEntry found in credentialStatus')
    })

    it('should reject expired status list credential', async () => {
        const credential = createMockCredential()
        const statusListCredential = {
            ...await createMockStatusListCredential([0]),
            validUntil: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        }

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Status list credential has expired')
    })

    it('should reject not-yet-valid status list credential', async () => {
        const credential = createMockCredential()
        const statusListCredential = {
            ...await createMockStatusListCredential([0]),
            validFrom: new Date(Date.now() + 86400000).toISOString() // 1 day in future
        }

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Status list credential is not yet valid')
    })

    it('should handle index out of bounds', async () => {
        const credential = createMockCredential('revocation', '132000')
        const statusListCredential = await createMockStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toContain('exceeds buffer bounds')
    })

    it('should handle getStatusListCredential rejection', async () => {
        const credential = createMockCredential()
        const getStatusListCredential = vi.fn().mockRejectedValue(new Error('Network error'))

        const result = await checkStatus({
            credential,
            getStatusListCredential
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Network error')
    })

    it('should handle invalid credential parameter', async () => {
        const result = await checkStatus({
            credential: null as any,
            getStatusListCredential: vi.fn()
        })

        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error).toBeDefined()
    })


    describe('checkStatus W3C Compliance', () => {
        describe('statusPurpose validation', () => {
            it('should reject mismatched statusPurpose', async () => {
                const credential = createMockCredential('suspension', '0') // Changed to 'suspension'

                // Status list credential has 'revocation' purpose
                const list = new StatusList()
                list.addEntry(0)
                list.setStatus(0, 0)

                const statusListCredential: BitstringStatusListCredentialUnsigned = {
                    '@context': ['https://www.w3.org/ns/credentials/v2'],
                    id: 'https://example.com/status/1',
                    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
                    issuer: 'https://example.com/issuer',
                    credentialSubject: {
                        id: 'https://example.com/status/1#list',
                        type: 'BitstringStatusList',
                        statusPurpose: 'revocation', // Different from credential's 'suspension'
                        encodedList: await list.encode()
                    }
                }

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
                })

                expect(result.verified).toBe(false)
                expect(result.error?.message).toContain('Status purpose')
            })

            it('should accept matching statusPurpose in array', async () => {
                const credential = createMockCredential('revocation')

                const list = new StatusList()
                list.addEntry(0)
                list.setStatus(0, 0)

                const statusListCredential: BitstringStatusListCredentialUnsigned = {
                    '@context': ['https://www.w3.org/ns/credentials/v2'],
                    id: 'https://example.com/status/1',
                    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
                    issuer: 'https://example.com/issuer',
                    credentialSubject: {
                        id: 'https://example.com/status/1#list',
                        type: 'BitstringStatusList',
                        statusPurpose: ['revocation', 'suspension'], // Array containing matching purpose
                        encodedList: await list.encode()
                    }
                }

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: vi.fn().mockResolvedValue(statusListCredential)
                })

                expect(result.verified).toBe(true)
            })
        })

        describe('minimum bitstring length validation', () => {
            it('should reject status lists that are too short', async () => {
                const credential = createMockCredential('revocation', '0')

                // Mock StatusList.decode to return short buffer directly
                const mockDecode = vi.spyOn(StatusList, 'decode').mockImplementation(async () => {
                    return { buffer: new Uint8Array(1024) } // 1KB - less than required 16KB
                })

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: vi.fn().mockResolvedValue({
                        credentialSubject: {
                            statusPurpose: 'revocation',
                            encodedList: 'mock-encoded-list'
                        }
                    } as any)
                })

                expect(result.verified).toBe(false)
                expect(result.error?.message).toContain('Status list length error')

                mockDecode.mockRestore()
            })
        })
    })
})

