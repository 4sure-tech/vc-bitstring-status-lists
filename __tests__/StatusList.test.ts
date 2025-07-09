import {beforeEach, describe, expect, it} from 'vitest'
import {StatusList} from '../src'

describe('StatusList', () => {
    let statusList: StatusList

    beforeEach(() => {
        statusList = new StatusList()
    })

    describe('constructor', () => {
        it('should create with default options', () => {
            const list = new StatusList()
            expect(list).toBeInstanceOf(StatusList)
        })

        it('should create with initial size', () => {
            const list = new StatusList({ initialSize: 2048 })
            expect(list).toBeInstanceOf(StatusList)
        })

        it('should create with buffer', () => {
            const buffer = new Uint8Array([0xFF, 0x00])
            const list = new StatusList({ buffer })
            expect(list).toBeInstanceOf(StatusList)
        })
    })

    describe('addEntry', () => {
        it('should add entry with default status size', () => {
            statusList.addEntry(0)
            expect(statusList.getStatus(0)).toBe(0)
        })

        it('should add entry with custom status size', () => {
            statusList.addEntry(0, 4)
            expect(statusList.getStatus(0)).toBe(0)
        })
    })

    describe('getStatus', () => {
        it('should return 0 for new entry', () => {
            statusList.addEntry(0)
            expect(statusList.getStatus(0)).toBe(0)
        })

        it('should return set status', () => {
            statusList.addEntry(0)
            statusList.setStatus(0, 1)
            expect(statusList.getStatus(0)).toBe(1)
        })
    })

    describe('setStatus', () => {
        it('should set status correctly', () => {
            statusList.addEntry(0)
            statusList.setStatus(0, 1)
            expect(statusList.getStatus(0)).toBe(1)
        })

        it('should set multi-bit status', () => {
            statusList.addEntry(0, 4)
            statusList.setStatus(0, 12)
            expect(statusList.getStatus(0)).toBe(12)
        })
    })

    describe('encode', () => {
        it('should encode empty list', async () => {
            const encoded = await statusList.encode()
            expect(encoded).toMatch(/^u/)
        })

        it('should encode list with entries', async () => {
            statusList.addEntry(0)
            statusList.addEntry(1)
            statusList.setStatus(0, 1)
            const encoded = await statusList.encode()
            expect(encoded).toMatch(/^u/)
            expect(encoded.length).toBeGreaterThan(1)
        })
    })

    describe('decode', () => {
        it('should decode encoded list', async () => {
            statusList.addEntry(0)
            statusList.addEntry(1)
            statusList.setStatus(0, 1)

            const encoded = await statusList.encode()
            const { buffer } = await StatusList.decode({ encodedList: encoded })

            expect(buffer).toBeInstanceOf(Uint8Array)
            expect(buffer.length).toBeGreaterThan(0)
        })

        it('should reject invalid prefix', async () => {
            await expect(StatusList.decode({ encodedList: 'invalid' }))
                .rejects.toThrow('encodedList must start with "u" prefix')
        })

        it('should reject non-string input', async () => {
            await expect(StatusList.decode({ encodedList: null as any }))
                .rejects.toThrow()
        })

        it('should handle round-trip encoding/decoding', async () => {
            statusList.addEntry(0, 4)
            statusList.addEntry(1, 2)
            statusList.setStatus(0, 10)
            statusList.setStatus(1, 3)

            const encoded = await statusList.encode()
            const { buffer } = await StatusList.decode({ encodedList: encoded })

            const decodedList = new StatusList({ buffer })
            decodedList.addEntry(0, 4)
            decodedList.addEntry(1, 2)

            expect(decodedList.getStatus(0)).toBe(10)
            expect(decodedList.getStatus(1)).toBe(3)
        })
    })
})

describe('StatusList W3C Compliance', () => {
    let statusList: StatusList

    beforeEach(() => {
        statusList = new StatusList()
    })

    describe('minimum 16KB requirement', () => {
        it('should pad to minimum 16KB on encode', async () => {
            statusList.addEntry(0)
            statusList.setStatus(0, 1)

            const encoded = await statusList.encode()
            const { buffer } = await StatusList.decode({ encodedList: encoded })

            expect(buffer.length).toBe(16384) // 16KB
        })

        it('should reject lists shorter than 16KB on decode', async () => {
            // Create a short buffer and manually compress/encode it
            const shortBuffer = new Uint8Array(1024) // 1KB
            const compressed = await import('pako').then(pako => pako.gzip(shortBuffer))
            const encoded = `u${await import('../src/utils/base64').then(b64 => b64.bytesToBase64url(compressed))}`

            await expect(StatusList.decode({ encodedList: encoded }))
                .rejects.toThrow('Status list must be at least 16384 bytes (16KB)')
        })

        it('should handle large buffers correctly', async () => {
            const list = new StatusList()
            // Add enough entries to exceed 16KB naturally
            for (let i = 0; i < 20000; i++) {
                list.addEntry(i)
            }

            const encoded = await list.encode()
            const { buffer } = await StatusList.decode({ encodedList: encoded })

            expect(buffer.length).toBeGreaterThanOrEqual(16384)
        })
    })
})
