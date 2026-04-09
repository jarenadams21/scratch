const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const { spawn } = require('child_process')

// Spawn the TypeScript compiler in watch mode alongside the server.
// stdio: 'inherit' pipes tsc output directly to this terminal.
const tsc = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' })
process.on('exit', () => tsc.kill())

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
}

http.createServer((req, res) => {
  const file = path.join(__dirname, req.url === '/' ? 'index.html' : req.url)
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' })
    res.end(data)
  })
}).listen(5173, () => console.log('http://localhost:5173'))
