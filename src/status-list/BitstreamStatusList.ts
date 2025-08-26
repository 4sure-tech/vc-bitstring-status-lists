/**
 * StatusList - High-level W3C Bitstring Status List implementation
 *
 * Provides a complete implementation of the W3C Bitstring Status List v1.0 specification.
 * Manages a compressed bitstring where each credential has a uniform-width status entry.
 *
 * Features:
 * - W3C compliant 16KB minimum bitstring size
 * - GZIP compression with multibase encoding (u-prefix)
 * - Uniform status size for all entries in a list
 * - Direct credential access without explicit entry creation
 * - Efficient ISIZE-based length calculation
 *
 * @example
 * ```typescript
 * // Create a status list for revocation (1-bit per credential)
 * const list = new StatusList({ statusSize: 1 })
 * list.setStatus(42, 1)  // Mark credential 42 as revoked
 *
 * const encoded = await list.encode()  // Get compressed, encoded string
 * const decoded = await StatusList.decode({ encodedList: encoded, statusSize: 1 })
 * console.log(decoded.getStatus(42))  // Returns 1
 * ```
 */

import {BitManager} from '../bit-manager/BitManager'
import {base64urlToBytes, bytesToBase64url} from '../utils/base64'
import {assertIsPositiveInteger, assertIsString} from '../utils/assertions'
import pako from 'pako'
import {MalformedValueError, StatusListLengthError} from "./errors";

/** W3C specification minimum bitstring size */
const MIN_BITSTRING_SIZE_BYTES = 16384 // 16KB (131,072 bits)
const MIN_BITSTRING_SIZE_BITS = 131072

export class BitstreamStatusList {
    private readonly bitManager: BitManager
    private readonly statusSize: number

    /**
     * Creates a new StatusList instance
     *
     * @param options.buffer - Existing bitstring buffer for decoding (uncompressed)
     * @param options.initialSize - Initial buffer size in bytes (default: 16KB)
     * @param options.statusSize - Uniform bit width for all entries (default: 1)
     */
    constructor(options: {
        buffer?: Uint8Array
        initialSize?: number
        statusSize?: number
    } = {}) {
        const {buffer, initialSize, statusSize = 1} = options
        assertIsPositiveInteger(statusSize, 'statusSize')

        this.statusSize = statusSize
        this.bitManager = new BitManager({statusSize, buffer, initialSize})
    }

    /**
     * Gets the status value for a credential
     *
     * @param credentialIndex - Credential identifier
     * @returns Status value (0 to 2^statusSize - 1)
     */
    getStatus(credentialIndex: number): number {
        return this.bitManager.getStatus(credentialIndex)
    }

    /**
     * Sets the status value for a credential
     *
     * @param credentialIndex - Credential identifier
     * @param status - Status value (0 to 2^statusSize - 1)
     */
    setStatus(credentialIndex: number, status: number): void {
        this.bitManager.setStatus(credentialIndex, status)
    }

    /**
     * Returns the uniform status size (bit width) for all entries
     */
    getStatusSize(): number {
        return this.statusSize
    }

    /**
     * Encodes the status list into a W3C compliant compressed string
     *
     * Process:
     * 1. Get current bitstring buffer
     * 2. Pad to minimum 16KB (W3C requirement)
     * 3. GZIP compress the padded buffer
     * 4. Base64url encode with 'u' prefix (multibase)
     *
     * @returns Promise resolving to u-prefixed compressed string
     */
    async encode(): Promise<string> {
        const buffer = this.bitManager.toBuffer()
        const paddedBuffer = this.padToMinimumSize(buffer)
        const compressed = pako.gzip(paddedBuffer)

        return `u${bytesToBase64url(compressed)}`
    }

    /**
     * Decodes a W3C compliant status list string into a StatusList instance
     *
     * @param options.encodedList - u-prefixed, gzip-compressed base64url string
     * @param options.statusSize - Uniform bit width used during encoding (default: 1)
     * @returns Promise resolving to new StatusList instance
     * @throws {MalformedValueError} If format is invalid
     * @throws {StatusListLengthError} If size requirements not met
     */
    static async decode(options: {
        encodedList: string
        statusSize?: number
    }): Promise<BitstreamStatusList> {
        const {encodedList, statusSize = 1} = options

        assertIsString(encodedList, 'encodedList')
        assertIsPositiveInteger(statusSize, 'statusSize')

        // Validate multibase prefix
        if (!encodedList.startsWith('u')) {
            throw new MalformedValueError('encodedList must start with lowercase "u" prefix')
        }

        // Validate base64url alphabet and no padding
        const base64urlPart = encodedList.slice(1)
        if (!/^[A-Za-z0-9_-]+$/.test(base64urlPart)) {
            throw new MalformedValueError('encodedList contains invalid base64url characters or padding')
        }

        let compressed: Uint8Array
        let buffer: Uint8Array

        try {
            // Decode multibase
            compressed = base64urlToBytes(base64urlPart)
            // Decompress
            buffer = pako.ungzip(compressed)
        } catch (error) {
            throw new MalformedValueError(`Failed to decode or decompress encodedList: ${error.message}`)
        }

        // Enforce W3C minimum size requirement
        if (buffer.length < MIN_BITSTRING_SIZE_BYTES) {
            throw new StatusListLengthError(
                `Status list must be at least ${MIN_BITSTRING_SIZE_BYTES} bytes (16KB), got ${buffer.length}`
            )
        }

        // W3C spec step 9: validate minimum entries based on statusSize
        const totalBits = buffer.length * 8
        const availableEntries = Math.floor(totalBits / statusSize)
        const minimumEntries = Math.floor(MIN_BITSTRING_SIZE_BITS / statusSize)

        if (availableEntries < minimumEntries) {
            throw new StatusListLengthError(
                `Status list must support at least ${minimumEntries} entries for statusSize ${statusSize}, got ${availableEntries}`
            )
        }

        return new BitstreamStatusList({buffer, statusSize})
    }

    /**
     * Gets the maximum number of entries this decoded status list can hold
     *
     * @returns Maximum number of entries based on current buffer size
     */
    getLength(): number {
        const totalBits = this.bitManager.getBufferLength() * 8
        return Math.floor(totalBits / this.statusSize)
    }

    /**
     * Efficiently calculates the maximum number of entries in an encoded status list
     * Uses GZIP ISIZE field to determine uncompressed size without full decompression
     *
     * @param encodedList - u-prefixed, gzip-compressed base64url string
     * @param statusSize - Uniform bit width used during encoding
     * @returns Maximum number of entries (uncompressed_bits / statusSize)
     * @throws {MalformedValueError} If format is invalid
     */
    static getStatusListLength(encodedList: string, statusSize: number): number {
        assertIsString(encodedList, 'encodedList')
        assertIsPositiveInteger(statusSize, 'statusSize')

        // Validate multibase prefix
        if (!encodedList.startsWith('u')) {
            throw new MalformedValueError('encodedList must start with lowercase "u" prefix')
        }

        // Validate base64url alphabet and no padding
        const base64urlPart = encodedList.slice(1)
        if (!/^[A-Za-z0-9_-]+$/.test(base64urlPart)) {
            throw new MalformedValueError('encodedList contains invalid base64url characters or padding')
        }

        let compressed: Uint8Array
        try {
            compressed = base64urlToBytes(base64urlPart)
        } catch (error) {
            throw new MalformedValueError(`Failed to decode base64url: ${error.message}`)
        }

        if (compressed.length < 4) {
            throw new MalformedValueError('Invalid gzip data: too short to contain ISIZE field')
        }

        // Read ISIZE (last 4 bytes of gzip data, little-endian)
        const isizeOffset = compressed.byteOffset + compressed.length - 4
        const view = new DataView(compressed.buffer, isizeOffset, 4)
        const uncompressedBytes = view.getUint32(0, true)

        // Convert bytes to total available entries
        const totalBits = uncompressedBytes * 8
        return Math.floor(totalBits / statusSize)
    }

    /**
     * Pads buffer to W3C minimum size requirement (16KB)
     *
     * @param buffer - Source buffer to pad
     * @returns Padded buffer (original if already >= 16KB)
     */
    private padToMinimumSize(buffer: Uint8Array): Uint8Array {
        if (buffer.length >= MIN_BITSTRING_SIZE_BYTES) {
            return buffer
        }

        return Uint8Array.from({length: MIN_BITSTRING_SIZE_BYTES}, (_, i) => buffer[i] || 0)
    }
}
