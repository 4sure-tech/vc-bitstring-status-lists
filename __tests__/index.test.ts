import { describe, it, expect } from 'vitest'
import * as index from '../src/index'

describe('index exports', () => {
    it('should export BitManager', () => {
        expect(index.BitManager).toBeDefined()
        expect(typeof index.BitManager).toBe('function')
    })

    it('should export StatusList', () => {
        expect(index.BitstreamStatusList).toBeDefined()
        expect(typeof index.BitstreamStatusList).toBe('function')
    })

    it('should export createStatusListCredential', () => {
        expect(index.createStatusListCredential).toBeDefined()
        expect(typeof index.createStatusListCredential).toBe('function')
    })

    it('should export checkStatus', () => {
        expect(index.checkStatus).toBeDefined()
        expect(typeof index.checkStatus).toBe('function')
    })

    it('should have all expected exports', () => {
        const expectedExports = [
            'BitManager',
            'BitstreamStatusList',
            'createStatusListCredential',
            'checkStatus'
        ]

        expectedExports.forEach(exportName => {
            expect(index).toHaveProperty(exportName)
        })
    })
})
