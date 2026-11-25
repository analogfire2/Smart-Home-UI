'use strict';
/** Registry: add a new integration by dropping a file here and listing it. */
const registry = {
  hubitat: require('./hubitat').HubitatProvider,
  mock: require('./mock').MockProvider,
  // tplink: require('./tplink').TpLinkProvider,   // e.g. via tplink-smarthome-api / Kasa
  // hue:    require('./hue').HueProvider,         // Hue Bridge CLIP v2 API
  // alexa:  not directly supported by Amazon; bridge via Hubitat or Home Assistant
};
function create(cfg) {
  const P = registry[cfg.type];
  if (!P) throw new Error(`Unknown provider type "${cfg.type}"`);
  return new P(cfg);
}
module.exports = { create };
