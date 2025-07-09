import * as u8a from 'uint8arrays'

export function bytesToBase64url(b: Uint8Array): string {
    return u8a.toString(b, 'base64url')
}

export function base64urlToBytes(s: string): Uint8Array {
    return u8a.fromString(s, 'base64url')
}