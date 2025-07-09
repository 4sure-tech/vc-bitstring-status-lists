import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  tsconfig: './tsconfig.tsup.json',
  dts: true,
  target: ['es2022'],
  platform: 'neutral',
  cjsInterop: false,
  experimentalDts: false,
  shims: true,
  sourcemap: true,
  splitting: false,
  outDir: 'dist',
  clean: true,
  skipNodeModulesBundle: true
})