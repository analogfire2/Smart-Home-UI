'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { HubitatProvider } = require('../src/providers/hubitat');

test('hubitat normalizes devices', () => {
  const p = new HubitatProvider({ id: 'h', host: 'x', appId: '1', accessToken: 't' });
  p.roomByDevice.set('5', 'Den');
  const d = p._normalize({ id: '5', label: 'Lamp', capabilities: ['Switch', 'SwitchLevel'], attributes: { switch: 'on', level: 40 } });
  assert.deepEqual(d, { id: 'h:5', provider: 'h', name: 'Lamp', room: 'Den', type: 'light', on: true, level: 40, online: true });
  assert.equal(p._normalize({ id: '6', capabilities: ['Sensor'] }), null);
});

test('server serves and toggles mock devices', async () => {
  const cfg = path.join(os.tmpdir(), `shui-${process.pid}.json`);
  fs.writeFileSync(cfg, JSON.stringify({ port: 18080, providers: [{ type: 'mock' }] }));
  const srv = spawn('node', ['src/server.js'], { env: { ...process.env, CONFIG: cfg }, stdio: 'ignore' });
  try {
    await new Promise(r => setTimeout(r, 800));
    const list = await (await fetch('http://localhost:18080/api/devices')).json();
    assert.equal(list.length, 24);
    const d = list[0];
    const r = await (await fetch(`http://localhost:18080/api/devices/${encodeURIComponent(d.id)}/power`, { method: 'POST', body: JSON.stringify({ on: !d.on }) })).json();
    assert.equal(r.on, !d.on);
    assert.equal((await fetch('http://localhost:18080/')).status, 200);
  } finally { srv.kill(); fs.unlinkSync(cfg); }
});
