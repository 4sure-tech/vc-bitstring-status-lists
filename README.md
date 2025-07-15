# vc-bitstring-status-lists

A TypeScript library implementing the [W3C Bitstring Status List v1.0 specification](https://www.w3.org/TR/vc-bitstring-status-list/) for privacy‑preserving credential status
management in Verifiable Credentials.

## What is Bitstring Status List?

Think of the Bitstring Status List as a privacy‑preserving way to check whether a credential has been revoked or suspended. Instead of maintaining a public database of revoked
credentials (which would reveal sensitive information), the specification uses a compressed bitstring where each bit represents the status of a credential.

Here's how it works conceptually: imagine you have 100 000 credentials. Rather than listing "credential #1234 is revoked," you create a bitstring where position 1234 contains a bit
indicating the status. The entire bitstring is compressed and published, allowing anyone to check a credential's status without revealing which credentials they're checking.

## Key Features

This library provides a complete implementation of the W3C specification with the following capabilities:

* **Direct credential access** through the `BitManager` class, which handles low‑level bit operations without requiring explicit entry creation
* **Compressed storage** using gzip compression and base64url encoding, meeting the W3C requirement for minimum 16 KB bitstrings
* **Uniform status width** where all credentials in a status list use the same number of bits for their status values
* **Full W3C compliance** including proper validation, minimum bitstring sizes, and status purpose matching
* **TypeScript support** with comprehensive type definitions for all specification interfaces

## Installation

```bash
pnpm install @4sure-tech/vc-bitstring-status-lists   # or npm / yarn
```

---

# Quick Start

Let's walk through creating and using a status list step by step.

## 1 · Creating a Status List *in memory*

```ts
import {BitstreamStatusList} from "vc-bitstring-status-lists";

// Create a new status list with 1‑bit status values (0 = valid, 1 = revoked)
const statusList = new BitstreamStatusList({statusSize: 1});

// Set credential statuses directly using their indices
statusList.setStatus(0, 0); // Credential at index 0 is valid
statusList.setStatus(1, 1); // Credential at index 1 is revoked
statusList.setStatus(42, 1); // Credential at index 42 is revoked
```

The key insight here is that you **don't need to "add" entries first**. The system automatically handles any credential index you reference, creating the necessary bit positions as
needed.

## 2 · Publishing the Status List in a Credential

```ts
import {createStatusListCredential} from "vc-bitstring-status-lists";
import type {BitstringStatusListCredentialUnsigned} from "vc-bitstring-status-lists";

const statusListCredential: BitstringStatusListCredentialUnsigned =
    await createStatusListCredential({
        id: "https://example.com/status-lists/1",
        issuer: "https://example.com/issuer",
        statusPurpose: "revocation",
        statusSize: 1, // optional, 1 is default
        statusList: statusList, // Optional: pass a preset list — if omitted the library creates an empty (all‑zero) list
        validFrom: new Date("2025-07-01"),
        validUntil: new Date("2026-07-01"),
    });

console.log(
    statusListCredential.credentialSubject.encodedList /* → "u…" */
);
```

## 3 · Checking a Credential's Status

```ts
import {checkStatus} from "vc-bitstring-status-lists";

// A credential that references the status list
const credential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    id: "https://example.com/credential/456",
    type: ["VerifiableCredential"],
    issuer: "https://example.com/issuer",
    credentialSubject: {
        id: "did:example:123",
        type: "Person",
        name: "Alice",
    },
    credentialStatus: {
        type: "BitstringStatusListEntry",
        statusPurpose: "revocation",
        statusListIndex: "1", // This credential is at index 1 in the status list
        statusSize: 1,
        statusListCredential: "https://example.com/status-lists/1",
    },
};

const result = await checkStatus({
    credential,
    getStatusListCredential: async (url) => statusListCredential,
});

console.log(result); // { verified: false, status: 1 }
```

---

## Typical Issuer Workflow: *Create Empty → Update Later*  ⭐️ **(Most‑common use case)**

Most issuers first publish an **empty** status‑list credential when onboarding a new batch of credentials, and only update individual bits as real‑world events (revocations,
suspensions, etc.) occur.
The library makes this flow trivial.

### 1 · Create a *blank* Status List Credential

```ts
import {
    createStatusListCredential,
    BitstreamStatusList,
} from "vc-bitstring-status-lists";

// Omit the `statusList` option → the library creates a zero‑filled list for you
const blankStatusListCredential = await createStatusListCredential({
    id: "https://example.com/status-lists/2025-issuer-1",
    issuer: "https://example.com/issuer",
    statusPurpose: "revocation",
    // statusSize defaults to 1
});

// Publish `blankStatusListCredential` at the URL above (IPFS, HTTPS, etc.)
```

### 2 · Issue Verifiable Credentials that reference the list

Because all bits are `0`(valid) by default, you can safely reference the list immediately:

```ts
function issueCredential(holderDid: string, listIndex: number) {
    return {
        "@context": ["https://www.w3.org/ns/credentials/v2"],
        type: ["VerifiableCredential"],
        issuer: "https://example.com/issuer",
        credentialSubject: {id: holderDid},
        credentialStatus: {
            type: "BitstringStatusListEntry",
            statusPurpose: "revocation",
            statusListIndex: String(listIndex),
            statusSize: 1,
            statusListCredential: "https://example.com/status-lists/2025-issuer-1",
        },
    } satisfies Credential;
}
```

### 3 · Later: Update the Status of a Credential

When you need to revoke (or otherwise change) a credential, fetch the current status list, mutate the relevant bit, re‑encode, and re‑publish.

```ts
import {BitstreamStatusList} from "vc-bitstring-status-lists";

// 1. Fetch the existing credential (e.g. with `fetch`) and grab the encoded list string
const encoded = blankStatusListCredential.credentialSubject.encodedList;

// 2. Decode into a mutable BitstreamStatusList
const list = await BitstreamStatusList.decode({encodedList: encoded, statusSize: 1});

// 3. Change status → index 123 now revoked
list.setStatus(123, 1);

// 4. Re‑encode and splice back into the credential
blankStatusListCredential.credentialSubject.encodedList = await list.encode();

// 5. Re‑publish the **updated** credential at the same URL
```

*That’s it!*  The credential you changed will now fail verification, while all others continue to pass.

---

# Advanced Usage

### Multi‑bit Status Values

The specification supports more than just binary states. You can use multiple bits per credential to represent complex status information:

```ts
// Create a status list with 4 bits per credential (supports values 0‑15)
const statusList = new BitstreamStatusList({statusSize: 4});

// Set complex status values
statusList.setStatus(0, 12); // Binary: 1100 (could represent multiple flags)
statusList.setStatus(1, 3);  // Binary: 0011 (different status combination)

console.log(statusList.getStatus(0)); // → 12
```

### Status Messages

Attach human‑readable messages to status codes:

```ts
const credential = {
    // … other VC properties …
    credentialStatus: {
        type: "BitstringStatusListEntry",
        statusPurpose: "revocation",
        statusListIndex: "0",
        statusSize: 2, // Required for status values up to 0x2
        statusListCredential: "https://example.com/status-lists/1",
        statusMessage: [ // "statusMessage MAY be present if statusSize is 1, and MUST be present if statusSize is greater than 1
            {id: "0x0", message: "Credential is valid"},
            {id: "0x1", message: "Credential has been revoked"},
            {id: "0x2", message: "Credential is under review"},
        ],
    },
};
```

### Multiple `statusPurpose` Values (same list serves many purposes)

A single status list can be re‑used for several independent purposes—e.g. *revocation* **and** *suspension*—by declaring an **array** in the credential:

```ts
const multiPurposeListCredential = await createStatusListCredential({
    id: "https://example.com/status-lists/combo",
    issuer: "https://example.com/issuer",
    statusPurpose: [
        "revocation",   // bit = 1 ⇒ revoked
        "suspension",   // bit = 1 ⇒ suspended
        "kyc-level",    // bit‑pair ⇒ 0=low,1=mid,2=high,3=banned
    ],
    statusSize: 2, // enough bits to hold the largest purpose (kyc-level)
});
```

A credential can then choose which purpose applies to it:

```ts
const credentialSuspended = {
    credentialStatus: {
        type: "BitstringStatusListEntry",
        statusPurpose: "suspension",
        statusListIndex: "42",
        statusSize: 1,
        statusListCredential: multiPurposeListCredential.id,
    },
};
```

> **Tip:** When you pass an array to `statusPurpose`, each purpose gets its own contiguous *block* of bits in the list. Keep the `statusSize` large enough for the purpose that
> needs the most bits.

### Working with Existing Status Lists

```ts
// Decode a status list from an encoded string
const existing = await BitstreamStatusList.decode({
    encodedList: "u…", // from a credential
    statusSize: 1,
});

console.log(existing.getStatus(42)); // status of credential 42
existing.setStatus(100, 1);           // revoke credential 100

// Re‑encode for publishing
const updatedEncoded = await existing.encode();
```

---

# Understanding the Architecture

The library is built around several key components that work together to provide a complete W3C‑compliant implementation:

## BitManager Class

The `BitManager` is the foundation that handles all low‑level bit operations. It manages a growing buffer of bytes and provides methods to set and get multi‑bit values at specific
positions. Think of it as a specialized array where you can efficiently pack multiple small integers.

The key insight is that it calculates bit positions mathematically: credential index 42 with a 2‑bit status size occupies bits 84‑85 in the bitstring. This eliminates the need for
explicit entry management.

## BitstreamStatusList Class

The `BitstreamStatusList` wraps the `BitManager` and adds the W3C‑specific requirements like compression, encoding, and minimum size constraints. It ensures that the resulting
bitstring meets the specification's 16 KB minimum size requirement.

## Verification Functions

The `checkStatus` function implements the complete verification algorithm, including fetching the status list credential, validating time bounds, checking status purposes, and
extracting the actual status value.

---

# W3C Compliance Checklist

* **Minimum bitstring size**— Encoded status lists are padded to ≥ 16 KB (131 072 bits)
* **Compression**— gzip compression as required by the spec
* **Base64url encoding**— Proper encoding with the required "u" prefix
* **Status purpose validation**— Credential entries must match one of the list's declared purposes
* **Temporal validation**—`validFrom` / `validUntil` respected
* **Uniform status size**— Every credential in a list uses the same number of bits

---

# API Reference

## Core Classes

### `BitstreamStatusList`

```ts
class BitstreamStatusList {
    constructor(options?: { buffer?: Uint8Array; statusSize?: number; initialSize?: number });

    getStatus(credentialIndex: number): number;

    setStatus(credentialIndex: number, status: number): void;

    getStatusSize(): number;

    getLength(): number;

    encode(): Promise<string>;

    static decode(options: { encodedList: string; statusSize?: number }): Promise<BitstreamStatusList>;

    static getStatusListLength(encodedList: string, statusSize: number): number;
}
```

### `BitManager`

Low‑level bit manipulation class (typically used internally).

```ts
class BitManager {
    constructor(options: { statusSize?: number; buffer?: Uint8Array; initialSize?: number });

    getStatus(credentialIndex: number): number;

    setStatus(credentialIndex: number, status: number): void;

    getStatusSize(): number;

    getBufferLength(): number;

    toBuffer(): Uint8Array;
}
```

## High‑Level Functions

### `createStatusListCredential`

```ts
function createStatusListCredential(options: {
    id: string;
    issuer: string | IIssuer;
    statusSize?: number;
    statusList?: BitstreamStatusList;
    statusPurpose: string | string[];
    validFrom?: Date;
    validUntil?: Date;
    ttl?: number;
}): Promise<BitstringStatusListCredentialUnsigned>;
```

### `checkStatus`

```ts
function checkStatus(options: {
    credential: CredentialWithStatus;
    getStatusListCredential: (url: string) => Promise<BitstringStatusListCredentialUnsigned>;
}): Promise<VerificationResult>;
```

---

# Error Handling

```ts
try {
    const result = await checkStatus({credential, getStatusListCredential});
    if (!result.verified) {
        console.log("Verification failed:", result.error?.message);
        console.log("Status code:", result.status);
    }
} catch (err) {
    console.error("Status check failed:", err);
}
```

---

# Building & Testing

```bash
# Build the library
pnpm run build

# Run tests
pnpm test

# The build outputs both ESM and CommonJS formats
#  - dist/index.js  (ESM)
#  - dist/index.cjs (CommonJS)
#  - dist/index.d.ts (TypeScript definitions)
```

---

# Contributing

This library implements a W3C specification, so contributions should maintain strict compliance with
the [Bitstring Status List v1.0 specification](https://www.w3.org/TR/vc-bitstring-status-list/). When making changes, ensure that:

1. All existing tests continue to pass
2. New features include comprehensive test coverage
3. The implementation remains compatible with the W3C specification
4. Type definitions are updated for any API changes

---

# License

Licensed under the Apache License, Version 2.0.

---

# Related Resources

* [W3C Bitstring Status List v1.0 Specification](https://www.w3.org/TR/vc-bitstring-status-list/)
* [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
* [Verifiable Credentials Implementation Guide](https://www.w3.org/TR/vc-imp-guide/)
