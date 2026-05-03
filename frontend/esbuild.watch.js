import * as esbuild from 'esbuild';

// Custom esbuild configuration for Harbinger
// No React - pure custom vdom engine

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  bundle: false,  // Don't bundle - keep files separate for dev
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

await ctx.watch();
console.log('👁️  Watching for changes...');
