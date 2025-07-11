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
            expect(manager.toBuffer()).toEqual(new Uint8Array([0xFF, 0x00, 0xFF]))
        })

        it('should create with custom status size', () => {
            const manager = new BitManager({statusSize: 4})
            expect(manager.getStatusSize()).toBe(4)
        })
    })

    describe('getStatus', () => {
        it('should return 0 for unset credential', () => {
            expect(bitManager.getStatus(0)).toBe(0)
        })

        it('should return correct status for multi-bit entry', () => {
            const manager = new BitManager({statusSize: 4})
            manager.setStatus(0, 5)
            expect(manager.getStatus(0)).toBe(5)
        })

        it('should throw for negative credential index', () => {
            expect(() => bitManager.getStatus(-1)).toThrow()
        })

        it('should throw for index exceeding buffer bounds', () => {
            expect(() => bitManager.getStatus(132000)).toThrow('exceeds buffer bounds')
        })
    })

    describe('setStatus', () => {
        it('should set status for single bit', () => {
            bitManager.setStatus(0, 1)
            expect(bitManager.getStatus(0)).toBe(1)
        })

        it('should set status for multi-bit entry', () => {
            const manager = new BitManager({statusSize: 4})
            manager.setStatus(0, 15)
            expect(manager.getStatus(0)).toBe(15)
        })

        it('should throw for negative credential index', () => {
            expect(() => bitManager.setStatus(-1, 1)).toThrow()
        })

        it('should throw for negative status', () => {
            expect(() => bitManager.setStatus(0, -1)).toThrow()
        })

        it('should throw for status exceeding bit size', () => {
            const manager = new BitManager({statusSize: 2})
            expect(() => manager.setStatus(0, 4)).toThrow('Status 4 exceeds maximum value 3 for 2 bits')
        })

        it('should handle multiple entries independently', () => {
            const manager = new BitManager({statusSize: 2})
            manager.setStatus(0, 2)
            manager.setStatus(1, 1)
            expect(manager.getStatus(0)).toBe(2)
            expect(manager.getStatus(1)).toBe(1)
        })
    })

    describe('toBuffer', () => {
        it('should return empty buffer for no entries', () => {
            expect(bitManager.toBuffer()).toEqual(new Uint8Array([]))
        })

        it('should return correct buffer size for entries', () => {
            const manager = new BitManager({statusSize: 9})
            manager.setStatus(0, 1)
            const buffer = manager.toBuffer()
            expect(buffer.length).toBe(2)
        })

        it('should preserve bit patterns', () => {
            const manager = new BitManager({statusSize: 8})
            manager.setStatus(0, 0b10101010)
            const buffer = manager.toBuffer()
            expect(buffer[0]).toBe(0b10101010)
        })
    })
})