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
  '.jsx':  'text/javascript',
  '.tsx':  'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.md':   'text/markdown',
}

http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url
  
  // Resolve config path to root config directory
  if (file.includes('/config/')) {
    file = path.join(__dirname, '..', file)
  } else if (file.includes('/types/')) {
    file = path.join(__dirname, '..', file)
  } else {
    file = path.join(__dirname, file)
  }
  
  fs.readFile(file, (err, data) => {
    if (err) { 
      res.writeHead(404)
      res.end('not found: ' + req.url)
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
