const http = require('http')

const prefixes = [
  '/v1.56/services',
  '/v1.56/nodes',
  '/v1.56/version',
  '/v1.56/networks',
  '/v1.56/tasks',
  '/_ping'
]

const server = http.createServer((req, res) => {
    if (process.env.LOG) {
      console.log(new Date().toISOString(), req.method, req.url)
    }

    if (req.method != 'GET' || !prefixes.some(prefix => req.url.startsWith(prefix))) {
      console.log(new Date().toISOString(), 'FORBIDDEN', req.method, req.url)
      res.statusCode = 403
      res.end('Forbidden: ' + req.method + ' ' + req.url)
      return
    }

    const options = {
        socketPath: '/var/run/docker.sock',
        method: req.method,
        path: req.url,
        headers: req.headers,
    }

    const proxy = http.request(options, (targetRes) => {
        res.writeHead(targetRes.statusCode, targetRes.headers)
        targetRes.pipe(res, { end: true })
    })

    proxy.on('error', (err) => {
        console.log(new Date().toISOString(), 'Proxy error:', err)
        res.statusCode = 500
        res.end('Server error')
    })

    req.pipe(proxy, { end: true })
})

server.listen(2375, '0.0.0.0', () => {
    console.log('Server running on port 2375')
})
