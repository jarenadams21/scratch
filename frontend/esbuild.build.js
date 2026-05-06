import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/engine/main.tsx'],
  bundle: false,
  outdir: 'src/engine',
  format: 'esm',
  target: 'es2017',
  jsxFactory: 'engine.createElement',
  jsxFragment: 'engine.Fragment',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  logLevel: 'info',
});
