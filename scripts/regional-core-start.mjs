import http from 'node:http';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 10000);
const region = String(process.env.RACKETBUDDY_REGION || '').toUpperCase();
const required = ['DATABASE_URL', 'AUTH_SECRET'];
const missing = required.filter((name) => !process.env[name]);

if (!['US', 'EU'].includes(region)) missing.push('RACKETBUDDY_REGION');

if (missing.length) {
  console.error(`Regional core is not activated. Missing: ${[...new Set(missing)].join(', ')}`);
  const server = http.createServer((req, res) => {
    res.writeHead(503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-racketbuddy-core-region': region || 'unconfigured',
    });
    res.end(JSON.stringify({ ok: false, setupRequired: true, region: region || null }));
  });
  server.listen(port, '0.0.0.0');
} else {
  console.log(`Starting RacketBuddy ${region} regional core on port ${port}`);
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}
