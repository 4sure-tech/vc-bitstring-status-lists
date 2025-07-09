/**
 * Status list encoding/decoding wrapper using BitManager
 * Handles gzip compression and base64url encoding as per W3C spec
 */

import {BitManager} from '../bit-manager/BitManager'
import {base64urlToBytes, bytesToBase64url} from '../utils/base64'
import {assertIsPositiveInteger, assertIsString} from '../utils/assertions'
import pako from 'pako'

// W3C spec requires minimum 16KB (131,072 bits)
const MIN_BITSTRING_SIZE_BYTES = 16384 // 16KB

export class StatusList {
    private bitManager: BitManager
    private readonly statusSize: number

    /**
     * @param options.buffer      existing bitstring buffer (uncompressed form)
     * @param options.initialSize initial byte-length to allocate
     * @param options.statusSize  uniform bit-width for every entry (default: 1)
     */
    constructor(options: { buffer?: Uint8Array; statusSize?: number } = {}) {
        const {buffer, statusSize = 1} = options
        assertIsPositiveInteger(statusSize, 'statusSize')

        this.statusSize = statusSize
        this.bitManager = new BitManager({buffer})
    }

    /** Always uses the list’s uniform statusSize */
    addEntry(credentialIndex: number): void {
        this.bitManager.addEntry(credentialIndex, this.statusSize)
    }

    getStatus(credentialIndex: number): number {
        return this.bitManager.getStatus(credentialIndex)
    }

    setStatus(credentialIndex: number, status: number): void {
        this.bitManager.setStatus(credentialIndex, status)
    }

    /** @returns the list-level bit-width */
    getStatusSize(): number {
        return this.statusSize
    }

    async encode(): Promise<string> {
        const buffer = this.bitManager.toBuffer()
        const padded = buffer.length >= MIN_BITSTRING_SIZE_BYTES
            ? buffer
            : Uint8Array.from({length: MIN_BITSTRING_SIZE_BYTES}, (_, i) => buffer[i] ?? 0)

        const compressed = pako.gzip(padded)
        return `u${bytesToBase64url(compressed)}`
    }

    static async decode(options: { encodedList: string }): Promise<{ buffer: Uint8Array }> {
        const {encodedList} = options
        assertIsString(encodedList, 'encodedList')
        if (!encodedList.startsWith('u')) {
            throw new TypeError('encodedList must start with "u" prefix')
        }

        const compressed = base64urlToBytes(encodedList.slice(1))
        const buffer = pako.ungzip(compressed)

        if (buffer.length < MIN_BITSTRING_SIZE_BYTES) {
            throw new TypeError(
                `Status list must be at least ${MIN_BITSTRING_SIZE_BYTES} bytes (16KB), got ${buffer.length}`
            )
        }

        return {buffer}
    }

    /**
     * Compute how many list entries are present by reading the gzip ISIZE
     * (uncompressed length) and dividing by the uniform statusSize.
     * @param encodedList u-prefixed, gzip-compressed base64url string
     * @param statusSize  uniform bit-width used when encoding
     */
    static getStatusListLength(encodedList: string, statusSize: number): number {
        assertIsString(encodedList, 'encodedList')
        assertIsPositiveInteger(statusSize, 'statusSize')
        if (!encodedList.startsWith('u')) {
            throw new TypeError('encodedList must start with "u" prefix')
        }

        const data = base64urlToBytes(encodedList.slice(1))
        if (data.length < 4) {
            throw new TypeError('Invalid gzip data: too short to contain ISIZE')
        }
        const offset = data.byteOffset + data.length - 4
        const view = new DataView(data.buffer, offset, 4)
        const uncompressedBytes = view.getUint32(0, true)

        // total bits = uncompressedBytes * 8
        // number of entries = totalBits / statusSize
        return Math.floor((uncompressedBytes * 8) / statusSize)
    }
}
