// errors.ts
export class BitstringStatusListError extends Error {
    public readonly type: string
    public readonly code: string

    constructor(type: string, code: string, message: string) {
        super(message)
        this.name = 'BitstringStatusListError'
        this.type = `https://www.w3.org/ns/credentials/status-list#${type}`
        this.code = code
    }
}

export class StatusListLengthError extends BitstringStatusListError {
    constructor(message: string) {
        super('STATUS_LIST_LENGTH_ERROR', 'STATUS_LIST_LENGTH_ERROR', message)
    }
}

export class StatusRangeError extends BitstringStatusListError {
    constructor(message: string) {
        super('RANGE_ERROR', 'RANGE_ERROR', message)
    }
}

export class MalformedValueError extends BitstringStatusListError {
    constructor(message: string) {
        super('MALFORMED_VALUE_ERROR', 'MALFORMED_VALUE_ERROR', message)
    }
}

export class StatusRetrievalError extends BitstringStatusListError {
    constructor(message: string) {
        super('STATUS_RETRIEVAL_ERROR', 'STATUS_RETRIEVAL_ERROR', message)
    }
}

export class StatusVerificationError extends BitstringStatusListError {
    constructor(message: string) {
        super('STATUS_VERIFICATION_ERROR', 'STATUS_VERIFICATION_ERROR', message)
    }
}
