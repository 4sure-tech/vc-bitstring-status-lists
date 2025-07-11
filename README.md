# vc-bitstring-status-lists

A TypeScript library implementing the [W3C Bitstring Status List v1.0 specification](https://www.w3.org/TR/vc-bitstring-status-list/) for privacy-preserving credential status management in Verifiable Credentials.

## What is Bitstring Status List?

Think of the Bitstring Status List as a privacy-preserving way to check whether a credential has been revoked or suspended. Instead of maintaining a public database of revoked credentials (which would reveal sensitive information), the specification uses a compressed bitstring where each bit represents the status of a credential.

Here's how it works conceptually: imagine you have 100,000 credentials. Rather than listing "credential #1234 is revoked," you create a bitstring where position 1234 contains a bit indicating the status. The entire bitstring is compressed and published, allowing anyone to check a credential's status without revealing which credentials they're checking.

## Key Features

This library provides a complete implementation of the W3C specification with the following capabilities:

- **Direct credential access** through the `BitManager` class, which handles low-level bit operations without requiring explicit entry creation
- **Compressed storage** using gzip compression and base64url encoding, meeting the W3C requirement for minimum 16KB bitstrings
- **Uniform status width** where all credentials in a status list use the same number of bits for their status values
- **Full W3C compliance** including proper validation, minimum bitstring sizes, and status purpose matching
- **TypeScript support** with comprehensive type definitions for all specification interfaces

## Installation

```bash
pnpm install vc-bitstring-status-lists # or npm / yarn
```

## Quick Start

Let's walk through creating and using a status list step by step:

### 1. Creating a Status List

```typescript
import { BitstreamStatusList, createStatusListCredential } from 'vc-bitstring-status-lists'

// Create a new status list with 1-bit status values (0 = valid, 1 = revoked)
const statusList = new BitstreamStatusList({ statusSize: 1 })

// Set credential statuses directly using their indices
statusList.setStatus(0, 0) // Credential at index 0 is valid
statusList.setStatus(1, 1) // Credential at index 1 is revoked  
statusList.setStatus(42, 1) // Credential at index 42 is revoked
```

The key insight here is that you don't need to "add" entries first. The system automatically handles any credential index you reference, creating the necessary bit positions as needed.

### 2. Publishing the Status List

```typescript
// Create a verifiable credential containing the status list
const statusListCredential = await createStatusListCredential({
  id: 'https://example.com/status-lists/1',
  issuer: 'https://example.com/issuer',
  statusPurpose: 'revocation',
  statusList: statusList, // Pass your configured status list
  validFrom: new Date('2024-01-01'),
  validUntil: new Date('2024-12-31')
})

// The credential now contains a compressed, encoded bitstring
console.log(statusListCredential.credentialSubject.encodedList)
// Output: "u..." (compressed and base64url-encoded bitstring)
```

### 3. Checking Credential Status

```typescript
import { checkStatus } from 'vc-bitstring-status-lists'

// A credential that references the status list
const credential = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  id: 'https://example.com/credential/456',
  type: ['VerifiableCredential'],
  issuer: 'https://example.com/issuer',
  credentialSubject: {
    id: 'did:example:123',
    type: 'Person',
    name: 'Alice'
  },
  credentialStatus: {
    type: 'BitstringStatusListEntry',
    statusPurpose: 'revocation',
    statusListIndex: '1', // This credential is at index 1 in the status list
    statusListCredential: 'https://example.com/status-lists/1'
  }
}

// Check the credential's status
const result = await checkStatus({
  credential,
  getStatusListCredential: async (url) => {
    // In practice, you'd fetch this from the URL
    return statusListCredential
  }
})

console.log(result)
// Output: { verified: false, status: 1 } (credential is revoked)
```

## Advanced Usage

### Multi-bit Status Values

The specification supports more than just binary states. You can use multiple bits per credential to represent complex status information:

```typescript
// Create a status list with 4 bits per credential (supports values 0-15)
const statusList = new BitstreamStatusList({ statusSize: 4 })

// Set complex status values
statusList.setStatus(0, 12) // Binary: 1100, could represent multiple flags
statusList.setStatus(1, 3)  // Binary: 0011, different status combination

// Retrieve the status
const status = statusList.getStatus(0) // Returns: 12
```

This approach is particularly useful when you need to track multiple aspects of a credential's status simultaneously, such as revocation status, verification level, and processing state.

### Status Messages

You can provide human-readable messages for different status values:

```typescript
const credential = {
  // ... other properties
  credentialStatus: {
    type: 'BitstringStatusListEntry',
    statusPurpose: 'revocation',
    statusListIndex: '0',
    statusListCredential: 'https://example.com/status-lists/1',
    statusMessage: [
      { id: '0x0', message: 'Credential is valid' },
      { id: '0x1', message: 'Credential has been revoked' },
      { id: '0x2', message: 'Credential is under review' }
    ]
  }
}
```

### Multiple Status Purposes

A single status list can serve multiple purposes:

```typescript
const statusListCredential = await createStatusListCredential({
  statusList: statusList,
  id: 'https://example.com/status-lists/1',
  issuer: 'https://example.com/issuer',
  statusPurpose: ['revocation', 'suspension'] // Multiple purposes
})
```

### Working with Existing Status Lists

You can decode and work with existing status lists:

```typescript
// Decode a status list from an encoded string
const existingStatusList = await BitstreamStatusList.decode({
  encodedList: 'u...', // The encoded bitstring from a credential
  statusSize: 1
})

// Check or modify statuses
console.log(existingStatusList.getStatus(42)) // Get status of credential 42
existingStatusList.setStatus(100, 1) // Revoke credential 100

// Re-encode for publishing
const updatedEncoded = await existingStatusList.encode()
```

## Understanding the Architecture

The library is built around several key components that work together to provide a complete W3C-compliant implementation:

### BitManager Class

The `BitManager` is the foundation that handles all low-level bit operations. It manages a growing buffer of bytes and provides methods to set and get multi-bit values at specific positions. Think of it as a specialized array where you can efficiently pack multiple small integers.

The key insight is that it calculates bit positions mathematically: credential index 42 with a 2-bit status size would occupy bits 84-85 in the bitstring. This eliminates the need for explicit entry management.

### BitstreamStatusList Class

The `BitstreamStatusList` wraps the `BitManager` and adds the W3C-specific requirements like compression, encoding, and minimum size constraints. It ensures that the resulting bitstring meets the specification's 16KB minimum size requirement.

This class handles the complex process of GZIP compression and multibase encoding that the W3C specification requires, while providing a simple interface for credential status management.

### Verification Functions

The `checkStatus` function implements the complete verification algorithm, including fetching the status list credential, validating time bounds, checking status purposes, and extracting the actual status value.

## W3C Compliance

This library implements all requirements from [the W3C Bitstring Status List v1.0 specification.](https://www.w3.org/TR/vc-bitstring-status-list):

- **Minimum bitstring size**: All encoded status lists are padded to at least 16KB (131,072 bits)
- **Compression**: Uses gzip compression as required by the specification
- **Base64url encoding**: Proper encoding with the required "u" prefix
- **Status purpose validation**: Ensures that credential entries match the status list's declared purposes
- **Temporal validation**: Checks `validFrom` and `validUntil` dates on status list credentials
- **Uniform status size**: All credentials in a status list use the same number of bits for their status

## API Reference

### Core Classes

#### `BitstreamStatusList`

The main class for creating and managing status lists.

```typescript
class BitstreamStatusList {
  constructor(options?: { buffer?: Uint8Array; statusSize?: number; initialSize?: number })
  getStatus(credentialIndex: number): number
  setStatus(credentialIndex: number, status: number): void
  getStatusSize(): number
  getLength(): number
  encode(): Promise<string>
  static decode(options: { encodedList: string; statusSize?: number }): Promise<BitstreamStatusList>
  static getStatusListLength(encodedList: string, statusSize: number): number
}
```

#### `BitManager`

Low-level bit manipulation class (typically used internally).

```typescript
class BitManager {
  constructor(options: { statusSize?: number; buffer?: Uint8Array; initialSize?: number })
  getStatus(credentialIndex: number): number
  setStatus(credentialIndex: number, status: number): void
  getStatusSize(): number
  getBufferLength(): number
  toBuffer(): Uint8Array
}
```

### High-Level Functions

#### `createStatusListCredential`

Creates a verifiable credential containing a status list.

```typescript
function createStatusListCredential(options: {
  id: string
  issuer: string | IIssuer
  statusSize?: number
  statusList?: BitstreamStatusList
  statusPurpose: string | string[]
  validFrom?: Date
  validUntil?: Date
  ttl?: number
}): Promise<BitstringStatusListCredentialUnsigned>
```

#### `checkStatus`

Verifies a credential's status against its referenced status list.

```typescript
function checkStatus(options: {
  credential: CredentialWithStatus
  getStatusListCredential: (url: string) => Promise<BitstringStatusListCredentialUnsigned>
}): Promise<VerificationResult>
```

## Error Handling

The library provides comprehensive error handling with descriptive messages:

```typescript
try {
  const result = await checkStatus({ credential, getStatusListCredential })
  if (!result.verified) {
    console.log('Verification failed:', result.error?.message)
    console.log('Status code:', result.status)
  }
} catch (error) {
  console.error('Status check failed:', error)
}
```

## Building and Testing

The project uses modern TypeScript tooling:

```bash
# Build the library
pnpm run build

# Run tests
pnpm test

# The build outputs both ESM and CommonJS formats
# - dist/index.js (ESM)
# - dist/index.cjs (CommonJS)
# - dist/index.d.ts (TypeScript definitions)
```

## Contributing

This library implements a W3C specification, so contributions should maintain strict compliance with the [Bitstring Status List v1.0 specification](https://www.w3.org/TR/vc-bitstring-status-list/). When making changes, ensure that:

1. All existing tests continue to pass
2. New features include comprehensive test coverage
3. The implementation remains compatible with the W3C specification
4. Type definitions are updated for any API changes

## License

Licensed under the Apache License, Version 2.0.

## Related Resources

- [W3C Bitstring Status List v1.0 Specification](https://www.w3.org/TR/vc-bitstring-status-list/)
- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [Verifiable Credentials Implementation Guide](https://www.w3.org/TR/vc-imp-guide/)
