import {beforeEach, describe, expect, it} from 'vitest'
import {BitstreamStatusList} from '../src'

describe('StatusList', () => {
    let statusList: BitstreamStatusList

    beforeEach(() => {
        statusList = new BitstreamStatusList({statusSize: 1})
    })

    describe('constructor', () => {
        it('should create with default options', () => {
            const list = new BitstreamStatusList()
            expect(list).toBeInstanceOf(BitstreamStatusList)
            expect(list.getStatusSize()).toBe(1) // default
        })

        it('should create with initial size', () => {
            const list = new BitstreamStatusList({initialSize: 2048})
            expect(list).toBeInstanceOf(BitstreamStatusList)
        })

        it('should create with buffer', () => {
            const buffer = new Uint8Array([0xFF, 0x00])
            const list = new BitstreamStatusList({buffer})
            expect(list).toBeInstanceOf(BitstreamStatusList)
        })

        it('should create with custom statusSize', () => {
            const list = new BitstreamStatusList({statusSize: 4})
            expect(list.getStatusSize()).toBe(4)
        })
    })


    describe('getStatus', () => {
        it('should return 0 for new entry', () => {
            expect(statusList.getStatus(0)).toBe(0)
        })

        it('should return set status', () => {
            statusList.setStatus(0, 1)
            expect(statusList.getStatus(0)).toBe(1)
        })
    })

    describe('setStatus', () => {
        it('should set status correctly', () => {
            statusList.setStatus(0, 1)
            expect(statusList.getStatus(0)).toBe(1)
        })

        it('should set multi-bit status', () => {
            const list = new BitstreamStatusList({statusSize: 4})
            list.setStatus(0, 12)
            expect(list.getStatus(0)).toBe(12)
        })
    })

    describe('getStatusSize', () => {
        it('should return the uniform statusSize', () => {
            expect(statusList.getStatusSize()).toBe(1)

            const list4 = new BitstreamStatusList({statusSize: 4})
            expect(list4.getStatusSize()).toBe(4)
        })
    })

    describe('encode', () => {
        it('should encode empty list', async () => {
            const encoded = await statusList.encode()
            expect(encoded).toMatch(/^u/)
        })

        it('should encode list with entries', async () => {
            statusList.setStatus(0, 1)
            statusList.setStatus(1, 1)
            const encoded = await statusList.encode()
            expect(encoded).toMatch(/^u/)
            expect(encoded.length).toBeGreaterThan(1)
        })
    })

    describe('decode', () => {
        it('should decode encoded list into a StatusList instance', async () => {
            statusList.setStatus(0, 1)
            statusList.setStatus(1, 0)

            const encoded = await statusList.encode()
            const decoded = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 1})

            expect(decoded).toBeInstanceOf(BitstreamStatusList)
            expect(decoded.getStatusSize()).toBe(1)

            expect(decoded.getStatus(0)).toBe(1)
            expect(decoded.getStatus(1)).toBe(0)
        })

        it('should return correct length for decoded instance', async () => {
            const list = new BitstreamStatusList({statusSize: 2})
            list.setStatus(0, 1)
            list.setStatus(100, 2)

            const encoded = await list.encode()
            const decoded = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 2})

            const length = decoded.getLength()
            expect(length).toBe(65536) // (16384 * 8) / 2
        })

        it('should handle round-trip encoding/decoding (uniform statusSize)', async () => {
            const list4 = new BitstreamStatusList({statusSize: 4})
            list4.setStatus(0, 10)
            list4.setStatus(1, 3)

            const encoded = await list4.encode()
            const decoded = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 4})

            expect(decoded.getStatus(0)).toBe(10)
            expect(decoded.getStatus(1)).toBe(3)
            expect(decoded.getStatusSize()).toBe(4)
        })

        it('should preserve statusSize when decoding', async () => {
            const list = new BitstreamStatusList({statusSize: 8})
            list.setStatus(0, 255)

            const encoded = await list.encode()
            const decoded = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 8})

            expect(decoded.getStatusSize()).toBe(8)
            expect(decoded.getStatus(0)).toBe(255)
        })
    })

    describe('getStatusListLength', () => {
        it('should compute correct number of entries', async () => {
            const list = new BitstreamStatusList({statusSize: 2})
            list.setStatus(0, 0)
            list.setStatus(1, 0)
            list.setStatus(2, 0)

            const encoded = await list.encode()
            const length = BitstreamStatusList.getStatusListLength(encoded, 2)

            // With 16KB minimum and 2-bit statusSize: (16384 * 8) / 2 = 65536 entries
            expect(length).toBe(65536)
        })

        it('should handle different statusSizes', async () => {
            const list = new BitstreamStatusList({statusSize: 4})
            const encoded = await list.encode()

            const length = BitstreamStatusList.getStatusListLength(encoded, 4)
            // With 16KB minimum and 4-bit statusSize: (16384 * 8) / 4 = 32768 entries
            expect(length).toBe(32768)
        })
    })

    describe('StatusList W3C Compliance', () => {
        describe('minimum 16KB requirement', () => {
            it('should pad to minimum 16KB on encode', async () => {
                statusList.setStatus(0, 1)

                const encoded = await statusList.encode()
                const length = BitstreamStatusList.getStatusListLength(encoded, 1)

                // Should have at least 131072 bits / 1 bit per entry = 131072 entries
                expect(length).toBeGreaterThanOrEqual(131072)
            })

            it('should reject lists shorter than 16KB on decode', async () => {
                const shortBuffer = new Uint8Array(1024)
                const compressed = await import('pako').then(pako => pako.gzip(shortBuffer))
                const {bytesToBase64url} = await import('../src/utils/base64')
                const encoded = `u${bytesToBase64url(compressed)}`

                await expect(
                    BitstreamStatusList.decode({encodedList: encoded, statusSize: 1})
                ).rejects.toThrow('Status list must be at least')
            })

            it('should handle large buffers correctly', async () => {
                const list = new BitstreamStatusList({statusSize: 1})
                // Add many entries to exceed 16KB naturally
                for (let i = 0; i < 150000; i++) {
                    list.setStatus(i, 0)
                }

                const encoded = await list.encode()
                const length = BitstreamStatusList.getStatusListLength(encoded, 1)
                expect(length).toBeGreaterThanOrEqual(131072)

                const decoded = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 1})
                expect(() => decoded.getStatus(200000)).toThrow('exceeds buffer bounds')
            })
        })
    })
})
