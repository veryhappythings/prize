import { createServer } from 'node:http'
import { createReadStream, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(startPort, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : startPort
      server.close(() => resolve(port))
    })
    server.on('error', () => findAvailablePort(startPort + 1).then(resolve).catch(reject))
  })
}

export async function startServer(siteDir: string, preferredPort = 3000): Promise<void> {
  const port = await findAvailablePort(preferredPort)

  const server = createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index.html' : (req.url ?? '/index.html')
    const filePath = join(siteDir, urlPath.split('?')[0])

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const ext = extname(filePath)
    const mime = MIME[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    createReadStream(filePath).pipe(res)
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`\nServing at http://localhost:${port}\nPress Ctrl+C to stop.\n`)
  })

  const url = `http://localhost:${port}`
  try {
    const { default: open } = await import('open')
    await open(url)
  } catch {
    console.log(`Open your browser at: ${url}`)
  }

  // Keep alive
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      server.close()
      resolve()
    })
  })
}
