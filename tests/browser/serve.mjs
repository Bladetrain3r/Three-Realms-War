// A tiny static server for the browser tests: serves the repo's sim/, content/ and tests/browser/, plus generated inputs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { repoPath } from '../helpers/design.mjs';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };
const ALLOWED = ['/sim/', '/content/', '/tests/browser/', '/client/'];

export function startServer(routes = {}) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (routes[path]) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(routes[path]()); return; }
      const clean = normalize(path);
      if (clean.includes('..') || !ALLOWED.some((p) => clean.startsWith(p))) { res.writeHead(404); res.end('not found'); return; }
      try {
        const body = await readFile(join(repoPath(), clean));
        res.writeHead(200, { 'content-type': TYPES[extname(clean)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}
