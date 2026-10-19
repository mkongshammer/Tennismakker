import http from 'node:http';
import https from 'node:https';

// The US gateway must reach the US data core, not proxy back to the EU website.
const upstream = new URL(process.env.UPSTREAM_URL || 'https://racketbuddy-us-core.onrender.com');
const region = String(process.env.RACKETBUDDY_REGION || 'US').toUpperCase();
const port = Number(process.env.PORT || 10000);

if (!['http:', 'https:'].includes(upstream.protocol)) {
  throw new Error('UPSTREAM_URL must be http(s).');
}

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function forwardedHeaders(req, target) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || hopByHop.has(key.toLowerCase())) continue;
    headers[key] = value;
  }

  const priorForwardedFor = req.headers['x-forwarded-for'];
  const remote = req.socket.remoteAddress;
  if (!priorForwardedFor && remote) headers['x-forwarded-for'] = remote;
  headers.host = target.host;
  headers['x-forwarded-host'] = req.headers.host || '';
  headers['x-forwarded-proto'] = 'https';
  headers['x-racketbuddy-region'] = region.toLowerCase();
  // The US gateway is only selected for the US market. This gives the
  // existing country detector an unambiguous edge hint while preserving
  // x-forwarded-for for auditing and fallback IP detection.
  if (region === 'US') headers['x-geo-country'] = 'US';
  return headers;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-racketbuddy-edge-region': region.toLowerCase(),
    });
    res.end(JSON.stringify({ ok: true, region, upstream: upstream.hostname }));
    return;
  }

  let target;
  try {
    target = new URL(req.url || '/', upstream);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  const client = target.protocol === 'https:' ? https : http;
  const proxyReq = client.request(target, {
    method: req.method,
    headers: forwardedHeaders(req, target),
    timeout: 60_000,
  }, (proxyRes) => {
    const headers = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value == null || hopByHop.has(key.toLowerCase())) continue;
      headers[key] = value;
    }
    headers['x-racketbuddy-edge-region'] = region.toLowerCase();
    res.writeHead(proxyRes.statusCode || 502, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Upstream timeout')));
  proxyReq.on('error', (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    res.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-racketbuddy-edge-region': region.toLowerCase(),
    });
    res.end(JSON.stringify({ error: 'Regional upstream unavailable.' }));
  });

  req.pipe(proxyReq);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(port, '0.0.0.0', () => {
  console.log(`RacketBuddy ${region} regional gateway listening on ${port}, upstream ${upstream.origin}`);
  const healthUrl = new URL('/api/health', upstream);
  fetch(healthUrl, {
    headers: {
      'x-racketbuddy-region': region.toLowerCase(),
      ...(region === 'US' ? { 'x-geo-country': 'US' } : {}),
    },
  }).then(response => {
    console.log(`Regional upstream health check: ${response.status} ${healthUrl.origin}`);
  }).catch(error => {
    console.error(`Regional upstream health check failed: ${error.message}`);
  });
});
