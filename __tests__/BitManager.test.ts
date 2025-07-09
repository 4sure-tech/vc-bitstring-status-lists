import {beforeEach, describe, expect, it} from 'vitest'
import {BitManager} from '../src'

describe('BitManager', () => {
    let bitManager: BitManager

    beforeEach(() => {
        bitManager = new BitManager({})
    })

    describe('constructor', () => {
        it('should create with default size', () => {
            const manager = new BitManager({})
            expect(manager.toBuffer()).toBeInstanceOf(Uint8Array)
        })

        it('should create with custom initial size', () => {
            const manager = new BitManager({initialSize: 2048})
            expect(manager.toBuffer()).toBeInstanceOf(Uint8Array)
        })

        it('should create with existing buffer', () => {
            const buffer = new Uint8Array([0xFF, 0x00, 0xFF])
            const manager = new BitManager({buffer})
            expect(manager.toBuffer()).toEqual(new Uint8Array([]))
        })
    })

    describe('addEntry', () => {
        it('should add entry with default status size', () => {
            bitManager.addEntry(0)
            const entries = bitManager.getEntries()
            expect(entries.has(0)).toBe(true)
            expect(entries.get(0)?.statusSize).toBe(1)
        })

        it('should add entry with custom status size', () => {
            bitManager.addEntry(0, 4)
            const entries = bitManager.getEntries()
            expect(entries.get(0)?.statusSize).toBe(4)
        })

        it('should assign consecutive bit positions', () => {
            bitManager.addEntry(0, 2)
            bitManager.addEntry(1, 3)
            const entries = bitManager.getEntries()
            expect(entries.get(0)?.startBit).toBe(0)
            expect(entries.get(1)?.startBit).toBe(2)
        })

        it('should throw for duplicate credential index', () => {
            bitManager.addEntry(0)
            expect(() => bitManager.addEntry(0)).toThrow('Entry for credentialIndex 0 already exists')
        })

        it('should throw for negative credential index', () => {
            expect(() => bitManager.addEntry(-1)).toThrow()
        })

        it('should throw for zero status size', () => {
            expect(() => bitManager.addEntry(0, 0)).toThrow()
        })

        it('should throw for negative status size', () => {
            expect(() => bitManager.addEntry(0, -1)).toThrow()
        })
    })

    describe('getStatus', () => {
        it('should return 0 for new entry', () => {
            bitManager.addEntry(0)
            expect(bitManager.getStatus(0)).toBe(0)
        })

        it('should throw for non-existent entry', () => {
            expect(() => bitManager.getStatus(0)).toThrow('No entry found for credentialIndex 0')
        })

        it('should return correct status for multi-bit entry', () => {
            bitManager.addEntry(0, 4)
            bitManager.setStatus(0, 5)
            expect(bitManager.getStatus(0)).toBe(5)
        })
    })

    describe('setStatus', () => {
        it('should set status for single bit', () => {
            bitManager.addEntry(0)
            bitManager.setStatus(0, 1)
            expect(bitManager.getStatus(0)).toBe(1)
        })

        it('should set status for multi-bit entry', () => {
            bitManager.addEntry(0, 4)
            bitManager.setStatus(0, 15)
            expect(bitManager.getStatus(0)).toBe(15)
        })

        it('should throw for non-existent entry', () => {
            expect(() => bitManager.setStatus(0, 1)).toThrow('No entry found for credentialIndex 0')
        })

        it('should throw for negative status', () => {
            bitManager.addEntry(0)
            expect(() => bitManager.setStatus(0, -1)).toThrow()
        })

        it('should throw for status exceeding bit size', () => {
            bitManager.addEntry(0, 2)
            expect(() => bitManager.setStatus(0, 4)).toThrow('Status 4 exceeds maximum value 3 for 2 bits')
        })

        it('should handle multiple entries independently', () => {
            bitManager.addEntry(0, 2)
            bitManager.addEntry(1, 3)
            bitManager.setStatus(0, 2)
            bitManager.setStatus(1, 5)
            expect(bitManager.getStatus(0)).toBe(2)
            expect(bitManager.getStatus(1)).toBe(5)
        })
    })

    describe('toBuffer', () => {
        it('should return empty buffer for no entries', () => {
            expect(bitManager.toBuffer()).toEqual(new Uint8Array([]))
        })

        it('should return correct buffer size for entries', () => {
            bitManager.addEntry(0, 9)
            const buffer = bitManager.toBuffer()
            expect(buffer.length).toBe(2)
        })

        it('should preserve bit patterns', () => {
            bitManager.addEntry(0, 8)
            bitManager.setStatus(0, 0b10101010)
            const buffer = bitManager.toBuffer()
            expect(buffer[0]).toBe(0b01010101) // Corrected: LSB first in BitManager
        })
    })

    describe('getEntries', () => {
        it('should return empty map for no entries', () => {
            expect(bitManager.getEntries().size).toBe(0)
        })

        it('should return copy of entries map', () => {
            bitManager.addEntry(0)
            const entries = bitManager.getEntries()
            entries.clear()
            expect(bitManager.getEntries().size).toBe(1)
        })
    })
})
