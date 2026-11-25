'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { create } = require('./providers');

const cfgPath = process.env.CONFIG || path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const providers = new Map();
for (const pc of config.providers) { const p = create(pc); providers.set(p.id, p); }

let devices = new Map();      // id -> device
const sseClients = new Set();

function broadcast(list) {
  const msg = `data: ${JSON.stringify(list)}\n\n`;
  for (const c of sseClients) c.write(msg);
}

async function refresh() {
  const next = new Map();
  await Promise.all([...providers.values()].map(async p => {
    try { for (const d of await p.list()) next.set(d.id, d); }
    catch (e) {
      console.error(`[${p.id}] ${e.message}`);
      for (const d of devices.values()) if (d.provider === p.id) next.set(d.id, { ...d, online: false });
    }
  }));
  const changed = [];
  for (const [id, d] of next) if (JSON.stringify(devices.get(id)) !== JSON.stringify(d)) changed.push(d);
  devices = next;
  if (changed.length) broadcast(changed);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PUB = path.join(__dirname, '..', 'public');
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/api/devices') return json(res, 200, [...devices.values()]);
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': hi\n\n'); sseClients.add(res);
      req.on('close', () => sseClients.delete(res)); return;
    }
    let m;
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/devices\/(.+)\/power$/))) {
      const id = decodeURIComponent(m[1]); const dev = devices.get(id);
      if (!dev) return json(res, 404, { error: 'unknown device' });
      const { on } = await readBody(req);
      await providers.get(dev.provider).setPower(id.slice(dev.provider.length + 1), !!on);
      dev.on = !!on; broadcast([dev]); return json(res, 200, dev);
    }
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/webhook\/([^/]+)$/))) {
      const p = providers.get(m[1]); const upd = p?.handleWebhook?.(await readBody(req));
      if (upd) { for (const d of upd) devices.set(d.id, d); broadcast(upd); }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET') {
      const file = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
      if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) { console.error(e); json(res, 502, { error: e.message }); }
}).listen(config.port || 8080, '0.0.0.0', async () => {
  console.log(`Smart Home UI on :${config.port || 8080}`);
  await refresh();
  setInterval(refresh, config.pollIntervalMs || 5000);
});
