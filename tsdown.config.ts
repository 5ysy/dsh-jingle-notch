import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/dashboard.ts', 'src/commands.ts'],
    format: 'esm',
    dts: true,
    outDir: 'lib',
    clean: true,
    platform: 'node',
    fixedExtension: false,
  },
  {
    entry: { 'overlay/preload': 'src/overlay/preload.ts' },
    format: 'cjs', dts: false, outDir: 'lib', platform: 'node',
    deps: { neverBundle:['electron'] }, fixedExtension: true,
  },
  {
    // The Electron main script for the notch overlay. It imports only
    // `node:module` (Electron resolves at runtime through createRequire), so
    // it bundles and typechecks without the electron package installed.
    entry: { 'overlay/main': 'src/overlay/main.ts' },
    format: 'esm',
    dts: false,
    outDir: 'lib',
    platform: 'node',
    fixedExtension: false,
  },
])
