import * as esbuild from 'esbuild';
import fs from 'fs';

console.log('🔨 Building with esbuild (custom JSX, no React)...\n');

// Build main.tsx
await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: false,
  outdir: 'src',
  format: 'esm',
  target: 'es2017',
  jsxFactory: 'engine.createElement',
  jsxFragment: 'engine.Fragment',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
  logLevel: 'info',
});

console.log('✅ Build complete - custom engine.createElement (no React)\n');
