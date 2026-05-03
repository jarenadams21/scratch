import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('📦 Building Harbinger for production...\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy index.html
fs.copyFileSync(
  path.join(__dirname, 'index.html'),
  path.join(distDir, 'index.html')
);
console.log('✓ Copied index.html');

// Copy src directory (JS files - TypeScript already compiled)
const srcDist = path.join(distDir, 'src');
fs.mkdirSync(srcDist, { recursive: true });

// Copy compiled JS files and CSS
const srcFiles = [
  'main.js',
  'harbinger.js',
  'api.js',
  'flags-runtime.js',
  'journal-messages.js',
  'mock-data.js',
  'journal.css'
];

srcFiles.forEach(file => {
  const srcPath = path.join(__dirname, 'src', file);
  const destPath = path.join(srcDist, file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ Copied src/${file}`);
  } else {
    console.warn(`⚠ Missing: src/${file}`);
  }
});

// Copy config files (for runtime access)
const configDist = path.join(distDir, 'config');
fs.mkdirSync(configDist, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, '..', 'config', 'flags.json'),
  path.join(configDist, 'flags.json')
);
console.log('✓ Copied config/flags.json');

console.log('\n✅ Build complete: frontend/dist/');
console.log('   Test with: npx serve dist -p 8080');
