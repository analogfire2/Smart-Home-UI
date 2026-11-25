# Smart Home UI

A tiny, phone-first web UI for toggling smart home lights and switches, built to run on a Raspberry Pi 3.
Hubitat is the first integration; others plug in through a provider interface.

- Compact tiles; the icon glows when the device is on
- Sort: A–Z / on first / off first. Filter: All / On / Off. Search.
- Group by Hubitat room, with a per-room "all on / all off"
- Live updates over Server-Sent Events, optimistic toggles, settings remembered per phone
- Zero npm dependencies (Node 18+)

## Setup (Pi)

1. In Hubitat: **Apps > Add Built-In App > Maker API**. Select the devices to expose, note the **App ID** and **access token**.
2. On the Pi (Node 18+; `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs`):
   ```bash
   git clone <this repo> smart-home-ui && cd smart-home-ui
   cp config.example.json config.json   # edit host, appId, accessToken
   npm start
   ```
3. Open `http://<pi-ip>:8080` on your phone (Add to Home Screen for an app-like launch).
4. Autostart: edit paths in `deploy/smart-home-ui.service`, then
   `sudo cp deploy/smart-home-ui.service /etc/systemd/system/ && sudo systemctl enable --now smart-home-ui`.

Optional instant updates: in Maker API set *URL to POST device events to* = `http://<pi-ip>:8080/api/webhook/hubitat`. Without it the server polls every 5 s.

Try the UI without a hub: set `"providers":[{"type":"mock"}]`.

## Architecture

```
phone browser ──HTTP/SSE──> server.js ──> provider registry ──> hubitat.js  (Maker API)
                                                              ├─> (tplink / hue / ...)
```
Every provider returns normalized devices (`id, name, room, type, on, online`) and implements `list()` and `setPower()`
(see `src/providers/base.js`). Device ids are namespaced `provider:nativeId`, so several hubs/vendors coexist.
The UI only knows the normalized model. To add an integration: write `src/providers/<name>.js`, register it in `src/providers/index.js`, add an entry to `config.json`.

## Integration research notes

| Target | Best route |
|---|---|
| Hubitat | Maker API (documented REST, token auth, optional event POST). Chosen over the undocumented `/eventsocket` websocket for stability. Rooms: `room` field on newer firmware, else `/hub2/roomsList` (undocumented, so isolated and optional). |
| TP-Link Kasa | Local LAN protocol via the `tplink-smarthome-api` npm package; Tapo uses a different (KLAP) protocol, e.g. `tapo` packages. |
| Philips Hue | Local Hue Bridge CLIP v2 REST API (`/clip/v2/resource/light`, SSE event stream). |
| Alexa | No public local device-control API. Practical route: expose Alexa-linked devices through Hubitat or Home Assistant and let this app talk to that. |

Security: no authentication, intended for your LAN only. Don't port-forward it. Keep `config.json` (token) out of git (already ignored).

## Next steps
Dimmer sliders (`level` is already carried), color, scenes, PWA manifest, optional PIN.
