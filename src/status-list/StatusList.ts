/**
 * Status list encoding/decoding wrapper using BitManager
 * Handles gzip compression and base64url encoding as per W3C spec
 */

import {BitManager} from '../bit-manager/BitManager'
import {base64urlToBytes, bytesToBase64url} from '../utils/base64'
import {assertIsString} from '../utils/assertions'
import pako from 'pako'

// W3C spec requires minimum 16KB (131,072 bits)
const MIN_BITSTRING_SIZE_BYTES = 16384 // 16KB

export class StatusList {
    private bitManager: BitManager

    constructor(options: { buffer?: Uint8Array; initialSize?: number } = {}) {
        this.bitManager = new BitManager(options)
    }

    addEntry(credentialIndex: number, statusSize: number = 1): void {
        this.bitManager.addEntry(credentialIndex, statusSize)
    }

    getStatus(credentialIndex: number): number {
        return this.bitManager.getStatus(credentialIndex)
    }

    setStatus(credentialIndex: number, status: number): void {
        this.bitManager.setStatus(credentialIndex, status)
    }

    async encode(): Promise<string> {
        const buffer = this.bitManager.toBuffer()

        // Pad to minimum 16KB as required by W3C spec
        const paddedBuffer = this.padToMinimumSize(buffer)

        const compressed = pako.gzip(paddedBuffer)
        const encoded = bytesToBase64url(compressed)
        return `u${encoded}`
    }

    private padToMinimumSize(buffer: Uint8Array): Uint8Array {
        if (buffer.length >= MIN_BITSTRING_SIZE_BYTES) {
            return buffer
        }

        const paddedBuffer = new Uint8Array(MIN_BITSTRING_SIZE_BYTES)
        paddedBuffer.set(buffer)
        return paddedBuffer
    }

    static async decode(options: { encodedList: string }): Promise<{ buffer: Uint8Array }> {
        const {encodedList} = options
        assertIsString(encodedList, 'encodedList')

        if (!encodedList.startsWith('u')) {
            return Promise.reject(new TypeError('encodedList must start with "u" prefix'))
        }

        const base64urlString = encodedList.slice(1)
        const compressed = base64urlToBytes(base64urlString)
        const buffer = pako.ungzip(compressed)

        // Verify minimum size requirement
        if (buffer.length < MIN_BITSTRING_SIZE_BYTES) {
            return Promise.reject(new TypeError(`Status list must be at least ${MIN_BITSTRING_SIZE_BYTES} bytes (16KB), got ${buffer.length} bytes`))
        }

        return {buffer}
    }
}