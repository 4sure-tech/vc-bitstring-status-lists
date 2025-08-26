import {describe, expect, it} from 'vitest'
import {checkStatus, BitstreamStatusList} from '../src'
import {BitstringStatusListCredentialUnsigned, BitstringStatusListEntry, CredentialWithStatus} from '../src/types'

describe('checkStatus', () => {
    const createMockCredential = (
        statusPurpose = 'revocation',
        statusIndex = '0',
        statusSize?: number
    ): CredentialWithStatus => ({
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
            statusListCredential: 'https://example.com/status/1',
            ...(statusSize && {statusSize})
        } as BitstringStatusListEntry
    })

    const createStatusListCredential = async (
        statuses: number[] = [0],
        statusSize = 1,
        statusPurpose: string | string[] = 'revocation'
    ): Promise<BitstringStatusListCredentialUnsigned> => {
        const list = new BitstreamStatusList({statusSize})
        statuses.forEach((stat, idx) => {
            list.setStatus(idx, stat)
        })

        return {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            id: 'https://example.com/status/1',
            type: ['VerifiableCredential', 'BitstringStatusListCredential'],
            issuer: 'https://example.com/issuer',
            credentialSubject: {
                id: 'https://example.com/status/1#list',
                type: 'BitstringStatusList',
                statusPurpose,
                statusSize,
                encodedList: await list.encode()
            }
        }
    }

    it('should verify valid credential (status 0)', async () => {
        const credential = createMockCredential()
        const statusListCred = await createStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: async (url) => {
                return statusListCred
            }
        })
        expect(result.verified).toBe(true)
        expect(result.status).toBe(0)
        expect(result.error).toBeUndefined()
    })


    it('should verify revoked credential (status 1)', async () => {
        const credential = createMockCredential('revocation', '0')
        const statusListCred = await createStatusListCredential([1])

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => statusListCred
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(1)
    })

    it('should handle status messages in credential status entry', async () => {
        const credential = createMockCredential()
        ;(credential.credentialStatus as BitstringStatusListEntry).statusMessage = [
            {id: '0x0', message: 'Valid'},
            {id: '0x1', message: 'Revoked'}
        ]
        const statusListCred = await createStatusListCredential([1])

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => statusListCred
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(1)
        expect(result.statusMessage).toEqual({id: '0x1', message: 'Revoked'})
    })

    it('should handle array of credential statuses', async () => {
        const credential = {
            ...createMockCredential(),
            credentialStatus: [
                {
                    type: 'SomeOtherStatusType' as any,
                    statusPurpose: 'other',
                    statusListIndex: '0',
                    statusListCredential: 'https://example.com/other'
                },
                createMockCredential().credentialStatus
            ]
        } as CredentialWithStatus

        const statusListCred = await createStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => statusListCred
        })
        expect(result.verified).toBe(true)
        expect(result.status).toBe(0)
    })

    it('should reject credential without BitstringStatusListEntry', async () => {
        const credential = {
            ...createMockCredential(),
            credentialStatus: {
                statusPurpose: 'revocation',
                statusListIndex: '0',
                statusListCredential: 'https://example.com/status/1'
            } as any
        } as CredentialWithStatus

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => {
                throw new Error('Should not be called')
            }
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('No BitstringStatusListEntry found in credentialStatus')
    })

    it('should reject expired status list credential', async () => {
        const credential = createMockCredential()
        const base = await createStatusListCredential([0])
        const expired = {...base, validUntil: new Date(Date.now() - 86400000).toISOString()}

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => expired
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Status list credential has expired')
    })

    it('should reject not-yet-valid status list credential', async () => {
        const credential = createMockCredential()
        const base = await createStatusListCredential([0])
        const future = {...base, validFrom: new Date(Date.now() + 86400000).toISOString()}

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => future
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Status list credential is not yet valid')
    })

    it('should handle index out of bounds', async () => {
        const credential = createMockCredential('revocation', '132000')
        const statusListCred = await createStatusListCredential([0])

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => statusListCred
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toContain('credentialIndex 132000 exceeds buffer bounds')
    })

    it('should handle getStatusListCredential rejection', async () => {
        const credential = createMockCredential()

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => {
                throw new Error('Network error')
            }
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error?.message).toBe('Network error')
    })

    it('should handle invalid credential parameter', async () => {
        const result = await checkStatus({
            credential: null as any,
            getStatusListCredential: async () => {
                throw new Error('Should not be called')
            }
        })
        expect(result.verified).toBe(false)
        expect(result.status).toBe(-1)
        expect(result.error).toBeDefined()
    })

    it('should handle multi-bit status entries', async () => {
        const credential = createMockCredential('message', '0', 4)
        const statusListCred = await createStatusListCredential([12], 4, 'message')

        const result = await checkStatus({
            credential,
            getStatusListCredential: async () => statusListCred
        })
        expect(result.verified).toBe(true)
        expect(result.status).toBe(12)
    })

    describe('checkStatus W3C Compliance', () => {
        describe('statusPurpose validation', () => {
            it('should reject mismatched statusPurpose', async () => {
                const credential = createMockCredential('suspension')
                const statusListCred = await createStatusListCredential([0], 1, 'revocation')

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred
                })
                expect(result.verified).toBe(false)
                expect(result.error?.message).toContain('Status purpose')
            })

            it('should accept matching statusPurpose in array', async () => {
                const credential = createMockCredential('revocation')
                const statusListCred = await createStatusListCredential([0], 1, ['revocation', 'suspension'])

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred
                })
                expect(result.verified).toBe(true)
            })
        })

        describe('minimum bitstring length validation', () => {
            it('should accept lists that are automatically padded', async () => {
                const credential = createMockCredential('revocation', '0')
                const smallList = new BitstreamStatusList({statusSize: 1, initialSize: 10})
                smallList.setStatus(0, 0)

                const statusListCred = {
                    '@context': ['https://www.w3.org/ns/credentials/v2'],
                    id: 'https://example.com/status/1',
                    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
                    issuer: 'https://example.com/issuer',
                    credentialSubject: {
                        id: 'https://example.com/status/1#list',
                        type: 'BitstringStatusList',
                        statusPurpose: 'revocation',
                        statusSize: 1,
                        encodedList: await smallList.encode()
                    }
                }

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred as BitstringStatusListCredentialUnsigned
                })

                expect(result.verified).toBe(true)
                expect(result.status).toBe(0)
            })

            it('should accept lists meeting minimum length requirement', async () => {
                const credential = createMockCredential('revocation', '0')
                const statusListCred = await createStatusListCredential([0])


                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred
                })

                expect(result.verified).toBe(true)
                expect(result.status).toBe(0)
            })
        })

        describe('statusSize handling', () => {
            it('should handle statusSize mismatch gracefully', async () => {
                const credential = createMockCredential('revocation', '0', 4)
                const statusListCred = await createStatusListCredential([1], 1, 'revocation')

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred
                })

                expect(result.verified).toBe(false)
                expect(result.status).toBe(-1)
            })

            it('should handle default statusSize', async () => {
                const credential = createMockCredential('revocation', '0')
                const statusListCred = await createStatusListCredential([1])

                const result = await checkStatus({
                    credential,
                    getStatusListCredential: async () => statusListCred
                })

                expect(result.verified).toBe(false)
                expect(result.status).toBe(1)
            })
        })
    })
})