'use strict';
/**
 * Provider contract. Every integration (Hubitat, TP-Link, Hue, Alexa...)
 * implements this and returns *normalized* devices, so the server and UI never
 * know vendor specifics.
 *
 * Normalized device:
 *   { id: "<providerId>:<nativeId>", provider, name, room: string|null,
 *     type: "light"|"switch"|"outlet"|"other", on: boolean, level?: 0-100,
 *     online: boolean }
 *
 * Methods:
 *   async init()                      optional, one-time setup
 *   async list()          -> Device[] full snapshot
 *   async setPower(nativeId, on)      turn device on/off
 *   handleWebhook?(body)  -> Device[] | null   optional push updates
 */
class Provider {
  constructor(cfg) { this.cfg = cfg; this.id = cfg.id || cfg.type; }
  async init() {}
  async list() { throw new Error('not implemented'); }
  async setPower() { throw new Error('not implemented'); }
}
module.exports = { Provider };
