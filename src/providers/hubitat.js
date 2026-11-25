'use strict';
const { Provider } = require('./base');

/**
 * Hubitat via the built-in "Maker API" app (Apps > Add Built-In App > Maker API).
 *   GET  http://HUB/apps/api/APPID/devices/all?access_token=TOKEN
 *   GET  http://HUB/apps/api/APPID/devices/ID/on|off?access_token=TOKEN
 * Rooms: newer Maker API builds include a "room" field per device. If absent we
 * fall back to the hub's /hub2/roomsList endpoint (undocumented but stable).
 * Optional push: set Maker API "URL to POST device events to" to
 *   http://<pi>:8080/api/webhook/<providerId>   for instant updates.
 */
class HubitatProvider extends Provider {
  constructor(cfg) {
    super(cfg);
    for (const k of ['host', 'appId', 'accessToken'])
      if (!cfg[k]) throw new Error(`hubitat provider: missing "${k}"`);
    this.base = `http://${cfg.host}/apps/api/${cfg.appId}`;
    this.roomByDevice = new Map();
    this.cache = new Map(); // nativeId -> device
  }

  async _get(path, params = '') {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${this.base}${path}${sep}access_token=${this.cfg.accessToken}${params}`,
      { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Hubitat ${res.status} ${path}`);
    return res.json();
  }

  async _loadRooms() {
    try {
      const res = await fetch(`http://${this.cfg.host}/hub2/roomsList`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const rooms = await res.json();
      this.roomByDevice.clear();
      for (const r of rooms) for (const id of r.deviceIds || []) this.roomByDevice.set(String(id), r.name);
    } catch { /* rooms are optional */ }
  }

  _normalize(d) {
    const caps = (d.capabilities || []).filter(c => typeof c === 'string');
    if (!caps.includes('Switch')) return null;
    const attrs = d.attributes || {};
    const on = (Array.isArray(attrs) ? attrs.find(a => a.name === 'switch')?.currentValue : attrs.switch) === 'on';
    const lvl = Array.isArray(attrs) ? attrs.find(a => a.name === 'level')?.currentValue : attrs.level;
    const isLight = caps.includes('Light') || caps.includes('SwitchLevel') || caps.includes('ColorControl') || /light|lamp/i.test(d.type || d.name || '');
    const isOutlet = caps.includes('Outlet') || /outlet|plug/i.test(d.type || '');
    const room = d.room || this.roomByDevice.get(String(d.id)) || null;
    return {
      id: `${this.id}:${d.id}`, provider: this.id,
      name: d.label || d.name || `Device ${d.id}`,
      room, type: isLight ? 'light' : isOutlet ? 'outlet' : 'switch',
      on, ...(lvl != null && !isNaN(lvl) ? { level: Number(lvl) } : {}),
      online: (attrs.healthStatus ?? 'online') !== 'offline',
    };
  }

  async list() {
    if (!this.roomByDevice.size) await this._loadRooms();
    const all = await this._get('/devices/all');
    this.cache.clear();
    for (const d of all) {
      const n = this._normalize(d);
      if (n) this.cache.set(String(d.id), n);
    }
    return [...this.cache.values()];
  }

  async setPower(nativeId, on) {
    await this._get(`/devices/${nativeId}/${on ? 'on' : 'off'}`);
  }

  /** Maker API event POST: {content:{name,value,deviceId,...}} */
  handleWebhook(body) {
    const c = body?.content || body;
    if (!c || c.name !== 'switch') return null;
    const dev = this.cache.get(String(c.deviceId));
    if (!dev) return null;
    dev.on = c.value === 'on';
    return [dev];
  }
}
module.exports = { HubitatProvider };
