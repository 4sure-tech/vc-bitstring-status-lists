import {assertIsNonNegativeInteger, assertIsPositiveInteger} from "../utils/assertions";

const EXPAND_BLOCK_SIZE = 16384 // 16KB

interface BitEntry {
    credentialIndex: number
    statusSize: number
    startBit: number
}

export class BitManager {
    private entries: Map<number, BitEntry> = new Map()
    private bits: Uint8Array
    private nextBitPosition: number = 0

    constructor(options: { buffer?: Uint8Array; initialSize?: number } = {}) {
        if (options.buffer) {
            this.bits = new Uint8Array(options.buffer)
        } else {
            // Default to W3C minimum size (16KB)
            this.bits = new Uint8Array(options.initialSize || 16384)
        }
    }
    addEntry(credentialIndex: number, statusSize: number = 1): void {
        assertIsNonNegativeInteger(credentialIndex, 'credentialIndex')
        assertIsPositiveInteger(statusSize, 'statusSize')

        if (this.entries.has(credentialIndex)) {
            throw new TypeError(`Entry for credentialIndex ${credentialIndex} already exists`)
        }

        const entry: BitEntry = {
            credentialIndex,
            statusSize,
            startBit: this.nextBitPosition
        }

        this.entries.set(credentialIndex, entry)
        this.nextBitPosition += statusSize

        // Expand buffer if needed
        this.ensureBufferSize()
    }

    getStatus(credentialIndex: number): number {
        const entry = this.entries.get(credentialIndex)
        if (!entry) {
            throw new TypeError(`No entry found for credentialIndex ${credentialIndex}`)
        }

        const {startBit, statusSize} = entry
        let status = 0

        for (let i = 0; i < statusSize; i++) {
            const bitIndex = startBit + i
            const byteIndex = Math.floor(bitIndex / 8)
            const bitOffset = bitIndex % 8

            const bit = (this.bits[byteIndex] >> (7 - bitOffset)) & 1
            status |= bit << i
        }

        return status
    }

    setStatus(credentialIndex: number, status: number): void {
        const entry = this.entries.get(credentialIndex)
        if (!entry) {
            throw new TypeError(`No entry found for credentialIndex ${credentialIndex}`)
        }

        const {startBit, statusSize} = entry
        const maxValue = (1 << statusSize) - 1

        assertIsNonNegativeInteger(status, 'status')
        if (status > maxValue) {
            throw new TypeError(`Status ${status} exceeds maximum value ${maxValue} for ${statusSize} bits`)
        }

        for (let i = 0; i < statusSize; i++) {
            const bitIndex = startBit + i
            const byteIndex = Math.floor(bitIndex / 8)
            const bitOffset = bitIndex % 8

            const bit = (status >> i) & 1

            if (bit === 1) {
                this.bits[byteIndex] |= (1 << (7 - bitOffset))
            } else {
                this.bits[byteIndex] &= ~(1 << (7 - bitOffset))
            }
        }
    }

    private ensureBufferSize(): void {
        const requiredBytes = Math.ceil(this.nextBitPosition / 8)
        if (requiredBytes > this.bits.length) {
            // Expand in 16KB blocks to maintain W3C compliance and efficiency
            const blocksNeeded = Math.ceil(requiredBytes / EXPAND_BLOCK_SIZE)
            const newSize = blocksNeeded * EXPAND_BLOCK_SIZE

            const newBuffer = new Uint8Array(newSize)
            newBuffer.set(this.bits)
            this.bits = newBuffer
        }
    }
    toBuffer(): Uint8Array {
        const requiredBytes = Math.ceil(this.nextBitPosition / 8)
        return this.bits.slice(0, requiredBytes)
    }

    getEntries(): Map<number, BitEntry> {
        return new Map(this.entries)
    }
}