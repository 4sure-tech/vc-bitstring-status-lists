# vc-bitstring-status-lists# vc-bitstring-status-lists

A TypeScript library implementing the [W3C Bitstring Status List v1.0 specification](https://www.w3.org/TR/vc-bitstring-status-list/) for privacy-preserving credential status management in Verifiable Credentials.

## What is Bitstring Status List?

Think of the Bitstring Status List as a privacy-preserving way to check whether a credential has been revoked or suspended. Instead of maintaining a public database of revoked credentials (which would reveal sensitive information), the specification uses a compressed bitstring where each bit represents the status of a credential.

Here's how it works conceptually: imagine you have 100,000 credentials. Rather than listing "credential #1234 is revoked," you create a bitstring where position 1234 contains a bit indicating the status. The entire bitstring is compressed and published, allowing anyone to check a credential's status without revealing which credentials they're checking.

## Key Features

This library provides a complete implementation of the W3C specification with the following capabilities:

- **Efficient bit manipulation** through the `BitManager` class, which handles the low-level operations of setting and getting status bits
- **Compressed storage** using gzip compression and base64url encoding, meeting the W3C requirement for minimum 16KB bitstrings
- **Multiple status support** beyond simple revocation/suspension, including custom status messages and multi-bit status values
- **Full W3C compliance** including proper validation, minimum bitstring sizes, and status purpose matching
- **TypeScript support** with comprehensive type definitions for all specification interfaces

## Installation

```bash
pnpm install vc-bitstring-status-lists (or npm / yarn)
```

## Quick Start

Let's walk through creating and using a status list step by step:

### 1. Creating a Status List

```typescript
import { StatusList, createStatusListCredential } from 'vc-bitstring-status-lists'

// Create a new status list
const statusList = new StatusList()

// Add credentials to track (each gets assigned a sequential index)
statusList.addEntry(0) // First credential at index 0
statusList.addEntry(1) // Second credential at index 1
statusList.addEntry(2) // Third credential at index 2

// Set some statuses (0 = valid, 1 = revoked for 'revocation' purpose)
statusList.setStatus(0, 0) // Valid
statusList.setStatus(1, 1) // Revoked
statusList.setStatus(2, 0) // Valid
```
<div style="display: flex; align-items: center; background-color: rgb(233, 242, 254); padding: 12px 16px; border-radius: 6px; font-family: sans-serif; font-size: 14px;">
  <div style="margin-right: 12px; color: #1a73e8;">
    <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-6h2v6zm0-8h-2V7h2v4z"/>
    </svg>
  </div>
  <div style="color: rgb(41, 42, 46)">
    All new entries have status 0 - Valid by default
  </div>
</div>


### 2. Publishing the Status List

```typescript
// Create a verifiable credential containing the status list
const statusListCredential = await createStatusListCredential({
  list: statusList,
  id: 'https://example.com/status-lists/1',
  issuer: 'https://example.com/issuer',
  statusPurpose: 'revocation',
  validFrom: '2024-01-01T00:00:00Z',
  validUntil: '2024-12-31T23:59:59Z'
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
    statusListIndex: '1', // This credential is at index 1
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
const statusList = new StatusList()

// Add credential with 4 bits of status information (supports values 0-15)
statusList.addEntry(0, 4)

// Set a complex status
statusList.setStatus(0, 12) // Binary: 1100, could represent multiple flags

// Get the status
const status = statusList.getStatus(0) // Returns: 12
```

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
  list: statusList,
  id: 'https://example.com/status-lists/1',
  issuer: 'https://example.com/issuer',
  statusPurpose: ['revocation', 'suspension'] // Multiple purposes
})
```

## Understanding the Architecture

The library is built around several key components that work together:

### BitManager Class

The `BitManager` is the foundation that handles all low-level bit operations. It manages a growing buffer of bytes and provides methods to set and get multi-bit values at specific positions. Think of it as a specialized array where you can efficiently pack multiple small integers.

### StatusList Class

The `StatusList` wraps the `BitManager` and adds the W3C-specific requirements like compression, encoding, and minimum size constraints. It ensures that the resulting bitstring meets the specification's 16KB minimum size requirement.

### Verification Functions

The `checkStatus` function implements the complete verification algorithm, including fetching the status list credential, validating time bounds, checking status purposes, and extracting the actual status value.

## W3C Compliance

This library implements all requirements from the W3C Bitstring Status List v1.0 specification:

- **Minimum bitstring size**: All encoded status lists are padded to at least 16KB (131,072 bits)
- **Compression**: Uses gzip compression as required by the specification
- **Base64url encoding**: Proper encoding with the required "u" prefix
- **Status purpose validation**: Ensures that credential entries match the status list's declared purposes
- **Temporal validation**: Checks `validFrom` and `validUntil` dates on status list credentials

## API Reference

### Core Classes

#### `StatusList`

The main class for creating and managing status lists.

```typescript
class StatusList {
  constructor(options?: { buffer?: Uint8Array; initialSize?: number })
  addEntry(credentialIndex: number, statusSize?: number): void
  getStatus(credentialIndex: number): number
  setStatus(credentialIndex: number, status: number): void
  encode(): Promise<string>
  static decode(options: { encodedList: string }): Promise<{ buffer: Uint8Array }>
}
```

#### `BitManager`

Low-level bit manipulation class (typically used internally).

```typescript
class BitManager {
  constructor(options: { buffer?: Uint8Array; initialSize?: number })
  addEntry(credentialIndex: number, statusSize?: number): void
  getStatus(credentialIndex: number): number
  setStatus(credentialIndex: number, status: number): void
  toBuffer(): Uint8Array
  getEntries(): Map<number, BitEntry>
}
```

### High-Level Functions

#### `createStatusListCredential`

Creates a verifiable credential containing a status list.

```typescript
function createStatusListCredential(options: {
  list: StatusList
  id: string
  issuer: string | IIssuer
  validFrom?: string
  validUntil?: string
  statusPurpose: string | string[]
  statusMessage?: StatusMessage[]
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
