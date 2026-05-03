import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Spawn esbuild in watch mode for custom JSX transformation
// No React semantics - pure custom engine.createElement
const builder = spawn('node', ['esbuild.watch.js'], { stdio: 'inherit' })
process.on('exit', () => builder.kill())

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.jsx':  'text/javascript',
  '.tsx':  'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.md':   'text/markdown',
}

http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url
  
  // All files are served from frontend directory
  file = path.join(__dirname, file)
  
  fs.readFile(file, (err, data) => {
    if (err) { 
      res.writeHead(404)
      res.end('not found: ' + req.url)
      console.error('[Server] 404:', req.url, '-> tried:', file)
      return 
    }
    const ext = path.extname(file)
    res.writeHead(200, { 
      'Content-Type': MIME[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(data)
  })
}).listen(8080, () => {
  console.log('🎨 Frontend: http://localhost:8080')
  console.log('   Watching TypeScript files for changes...')
})
