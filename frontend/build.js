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

// Copy src directory (entire reorganized structure)
const srcDist = path.join(distDir, 'src');

// Function to recursively copy directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css'))) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied src/${path.relative(path.join(__dirname, 'src'), srcPath)}`);
    }
  }
}

console.log('Copying source files...');
copyDir(path.join(__dirname, 'src'), srcDist);

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
