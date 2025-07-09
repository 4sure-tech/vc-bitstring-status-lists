import {assertIsNonNegativeInteger, assertIsPositiveInteger} from "../utils/assertions"

const EXPAND_BLOCK_SIZE = 16384 // 16KB

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
     * @param options.statusSize - Bits per credential status (default: 1)
     * @param options.buffer - Existing buffer for decoding
     * @param options.initialSize - Initial buffer size in bytes (default: 16KB)
     */
    constructor(options: {
        statusSize?: number
        buffer?: Uint8Array
        initialSize?: number
    } = {}) {
        const {statusSize = 1, buffer, initialSize = 16384} = options

        assertIsPositiveInteger(statusSize, 'statusSize')
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
            throw new TypeError(`credentialIndex ${credentialIndex} exceeds buffer bounds`)
        }

        const startBit = credentialIndex * this.statusSize
        return this.readStatusBits(startBit)
    }

    /**
     * Sets the status value for a credential
     *
     * @param credentialIndex - Non-negative credential identifier
     * @param status - Status value (0 to 2^statusSize - 1)
     * @throws {TypeError} If status exceeds maximum value for statusSize
     */
    setStatus(credentialIndex: number, status: number): void {
        assertIsNonNegativeInteger(credentialIndex, 'credentialIndex')
        assertIsNonNegativeInteger(status, 'status')

        const maxValue = (1 << this.statusSize) - 1
        if (status > maxValue) {
            throw new TypeError(`Status ${status} exceeds maximum value ${maxValue} for ${this.statusSize} bits`)
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
        // Find highest credential index that's been set
        let maxCredentialIndex = -1
        for (let i = 0; i < this.bits.length * 8; i += this.statusSize) {
            const credentialIndex = i / this.statusSize
            if (this.readStatusBits(i) !== 0) {
                maxCredentialIndex = credentialIndex
            }
        }

        if (maxCredentialIndex === -1) {
            return new Uint8Array([])
        }

        const requiredBits = (maxCredentialIndex + 1) * this.statusSize
        const requiredBytes = Math.ceil(requiredBits / 8)
        return this.bits.slice(0, requiredBytes)
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
            status |= bit << i
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

            const bit = (status >> i) & 1

            if (bit === 1) {
                this.bits[byteIndex] |= (1 << (7 - bitOffset))
            } else {
                this.bits[byteIndex] &= ~(1 << (7 - bitOffset))
            }
        }
    }

    /**
     * Ensures buffer can hold the specified number of bytes
     *
     * @param requiredBytes - Minimum bytes needed
     */
    private ensureBufferCanHold(requiredBytes: number): void {
        if (requiredBytes > this.bits.length) {
            const blocksNeeded = Math.ceil(requiredBytes / EXPAND_BLOCK_SIZE)
            const newSize = blocksNeeded * EXPAND_BLOCK_SIZE

            const newBuffer = new Uint8Array(newSize)
            newBuffer.set(this.bits)
            this.bits = newBuffer
        }
    }
}
