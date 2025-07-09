/**
 * Runtime type guards and assertion utilities
 * Throws descriptive TypeError exceptions on validation failure
 */

export function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new TypeError(message)
    }
}

export function assertIsNumber(value: any, name: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new TypeError(`${name} must be a number, got ${typeof value}`)
    }
}

export function assertIsPositiveInteger(value: any, name: string): void {
    assertIsNumber(value, name)
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive integer, got ${value}`)
    }
}

export function assertIsNonNegativeInteger(value: any, name: string): void {
    assertIsNumber(value, name)
    if (!Number.isInteger(value) || value < 0) {
        throw new TypeError(`${name} must be a non-negative integer, got ${value}`)
    }
}

export function assertIsString(value: any, name: string): void {
    if (typeof value !== 'string') {
        throw new TypeError(`${name} must be a string, got ${typeof value}`)
    }
}

export function assertIsObject(value: any, name: string): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object, got ${typeof value}`)
    }
}

export function assertIsUint8Array(value: any, name: string): void {
    if (!(value instanceof Uint8Array)) {
        throw new TypeError(`${name} must be a Uint8Array, got ${typeof value}`)
    }
}
