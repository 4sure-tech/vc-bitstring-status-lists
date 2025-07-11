import {assertIsNonNegativeInteger, assertIsPositiveInteger} from "../utils/assertions"
import {StatusRangeError} from "../status-list/errors";

const LIST_BLOCK_SIZE = 16384 // 16KB

/**
 * BitManager - Low-level bitstring manipulation for W3C Bitstring Status Lists
 *
 * Manages a packed bitstring where credentials are mapped to bit positions.
 * Each credential gets a fixed-width status entry at position: credentialIndex * statusSize.
 *
 * Features:
 * - Direct bit access without entry tracking
 * - Automatic buffer expansion in 16KB blocks
 * - MSB-first bit ordering within bytes
 * - Zero-initialized status values
 *
 * @example
 * ```typescript
 * const manager = new BitManager({ statusSize: 2 })
 * manager.setStatus(0, 3)  // Sets 2 bits at position 0
 * console.log(manager.getStatus(0))  // Returns 3
 * console.log(manager.getStatus(1))  // Returns 0 (unset)
 * ```
 */
export class BitManager {
    private bits: Uint8Array
    private readonly statusSize: number

    /**
     * Creates a new BitManager instance
     *
     * @param options.statusSize - Bits per credential status (default: 1, max: 31)
     * @param options.buffer - Existing buffer for decoding
     * @param options.initialSize - Initial buffer size in bytes (default: 16KB)
     */
    constructor(options: {
        statusSize?: number
        buffer?: Uint8Array
        initialSize?: number
    } = {}) {
        const {statusSize = 1, buffer, initialSize = LIST_BLOCK_SIZE} = options

        assertIsPositiveInteger(statusSize, 'statusSize')

        // Guard against JavaScript bitwise operation overflow (which is insane for this use case, but it's the real limit.)
        if (statusSize > 30) {
            throw new StatusRangeError(`statusSize ${statusSize} exceeds maximum supported value of 30 bits`)
        }

        this.statusSize = statusSize
        this.bits = buffer ? new Uint8Array(buffer) : new Uint8Array(initialSize)
    }

    /**
     * Gets the status value for a credential
     *
     * @param credentialIndex - Non-negative credential identifier
     * @returns Status value (0 to 2^statusSize - 1)
     */
    getStatus(credentialIndex: number): number {
        assertIsNonNegativeInteger(credentialIndex, 'credentialIndex')

        // Check if index exceeds reasonable bounds
        const maxIndex = Math.floor(this.bits.length * 8 / this.statusSize)
        if (credentialIndex >= maxIndex) {
            throw new StatusRangeError(`credentialIndex ${credentialIndex} exceeds buffer bounds`)
        }

        const startBit = credentialIndex * this.statusSize
        return this.readStatusBits(startBit)
    }

    /**
     * Sets the status value for a credential
     *
     * @param credentialIndex - Non-negative credential identifier
     * @param status - Status value (0 to 2^statusSize - 1)
     * @throws {StatusRangeError} If status exceeds maximum value for statusSize
     */
    setStatus(credentialIndex: number, status: number): void {
        assertIsNonNegativeInteger(credentialIndex, 'credentialIndex')
        assertIsNonNegativeInteger(status, 'status')

        const maxValue = (1 << this.statusSize) - 1
        if (status > maxValue) {
            throw new StatusRangeError(`Status ${status} exceeds maximum value ${maxValue} for ${this.statusSize} bits`)
        }

        const startBit = credentialIndex * this.statusSize
        this.writeStatusBits(startBit, status)
    }

    /**
     * Returns current buffer trimmed to actual data size
     *
     * @returns Copy of buffer containing only written data
     */
    toBuffer(): Uint8Array {
        // search backwards from the end for non-zero bytes
        let lastNonZeroByte = -1
        for (let i = this.bits.length - 1; i >= 0; i--) {
            if (this.bits[i] !== 0) {
                lastNonZeroByte = i
                break
            }
        }

        if (lastNonZeroByte === -1) {
            return new Uint8Array([])
        }

        return this.bits.slice(0, lastNonZeroByte + 1)
    }


    /**
     * Gets the uniform status size for all entries
     *
     * @returns Number of bits per status entry
     */
    getStatusSize(): number {
        return this.statusSize
    }


    /**
     * Gets the total buffer size in bytes
     *
     * @returns Buffer size in bytes
     */
    getBufferLength(): number {
        return this.bits.length
    }

    /**
     * Reads status bits from buffer starting at bit position
     *
     * @param startBit - Starting bit position
     * @returns Decoded status value
     */
    private readStatusBits(startBit: number): number {
        let status = 0

        for (let i = 0; i < this.statusSize; i++) {
            const bitIndex = startBit + i
            const byteIndex = Math.floor(bitIndex / 8)
            const bitOffset = bitIndex % 8

            if (byteIndex >= this.bits.length) {
                continue
            }

            const bit = (this.bits[byteIndex] >> (7 - bitOffset)) & 1
            // MSB of status value should be leftmost bit
            status |= bit << (this.statusSize - i - 1)
        }

        return status
    }

    /**
     * Writes status bits to buffer starting at bit position
     *
     * @param startBit - Starting bit position
     * @param status - Status value to write
     */
    private writeStatusBits(startBit: number, status: number): void {
        for (let i = 0; i < this.statusSize; i++) {
            const bitIndex = startBit + i
            const byteIndex = Math.floor(bitIndex / 8)
            const bitOffset = bitIndex % 8

            this.ensureBufferCanHold(byteIndex + 1)

            // MSB of status value should be leftmost bit
            const bit = (status >> (this.statusSize - i - 1)) & 1

            if (bit === 1) {
                this.bits[byteIndex] |= (1 << (7 - bitOffset))
            } else {
                this.bits[byteIndex] &= ~(1 << (7 - bitOffset))
            }
        }
    }

    /**
     * Ensures buffer can hold the specified number of bytes
     * Grows in bitstring-sized chunks for better memory efficiency
     *
     * @param requiredBytes - Minimum bytes needed
     */
    private ensureBufferCanHold(requiredBytes: number): void {
        if (requiredBytes > this.bits.length) {
            // Calculate growth in bitstring-sized chunks rather than fixed 16KB blocks
            const bitsNeeded = requiredBytes * 8
            const entriesNeeded = Math.ceil(bitsNeeded / this.statusSize)
            const optimalBits = entriesNeeded * this.statusSize
            const optimalBytes = Math.ceil(optimalBits / 8)

            // Still ensure minimum block size for reasonable growth
            const minGrowthBytes = Math.max(optimalBytes, LIST_BLOCK_SIZE)
            const blocksNeeded = Math.ceil(minGrowthBytes / LIST_BLOCK_SIZE)
            const newSize = blocksNeeded * LIST_BLOCK_SIZE

            const newBuffer = new Uint8Array(newSize)
            newBuffer.set(this.bits)
            this.bits = newBuffer
        }
    }
}
