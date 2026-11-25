'use strict';
const ICONS = {
  light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  switch: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M12 7v4"/>',
  outlet: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9v2M15 9v2M10 16h4"/>',
  other: '<circle cx="12" cy="12" r="8"/>',
};
const $ = s => document.querySelector(s);
const devices = new Map();
const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { } };
const pinned = new Set(); // tiles toggled while filtered stay visible until the filter is clicked again
const state = { filter: store('filter') || 'all', sort: store('sort') || 'name', group: store('group') || 'room', q: '' };

for (const k of ['sort', 'group']) { $('#' + k).value = state[k]; $('#' + k).onchange = e => { state[k] = e.target.value; store(k, state[k]); render(); }; }
$('#q').oninput = e => { state.q = e.target.value.toLowerCase(); render(); };
document.querySelectorAll('#filter button').forEach(b => b.onclick = () => { pinned.clear(); state.filter = b.dataset.v; store('filter', state.filter); render(); });

function cmp(a, b) {
  const byName = a.name.localeCompare(b.name, undefined, { numeric: true });
  if (state.sort === 'on') return (b.on - a.on) || byName;
  if (state.sort === 'off') return (a.on - b.on) || byName;
  return byName;
}
const sizeCls = n => n.length > 26 ? 'xs' : n.length > 14 ? 'sm' : '';
const tile = d => `<div class="tile ${d.on ? 'on' : ''} ${d.online ? '' : 'off-line'} ${sizeCls(d.name)}" data-id="${d.id}" title="${d.name}">
  <svg viewBox="0 0 24 24">${ICONS[d.type] || ICONS.other}</svg><span>${d.name.replace(/</g, '&lt;')}</span></div>`;

function render() {
  document.querySelectorAll('#filter button').forEach(b => b.classList.toggle('act', b.dataset.v === state.filter));
  let list = [...devices.values()].filter(d =>
    (state.filter === 'all' || (state.filter === 'on') === d.on || pinned.has(d.id)) && (!state.q || (d.name + (d.room || '')).toLowerCase().includes(state.q)));
  $('#count').textContent = `${list.filter(d => d.on).length}/${list.length} on`;
  list.sort(cmp);
  let html = '';
  if (state.group === 'room') {
    const g = {};
    for (const d of list) (g[d.room || 'No room'] ||= []).push(d);
    for (const room of Object.keys(g).sort((a, b) => a === 'No room' ? 1 : b === 'No room' ? -1 : a.localeCompare(b))) {
      const on = g[room].filter(d => d.on).length;
      html += `<h2>${room.replace(/</g, '&lt;')} <button data-room="${room.replace(/"/g, '&quot;')}">${on}/${g[room].length} on · ${on ? 'all off' : 'all on'}</button></h2><div class="grid">${g[room].map(tile).join('')}</div>`;
    }
  } else html = `<div class="grid">${list.map(tile).join('')}</div>`;
  $('#main').innerHTML = html;
}

async function power(d, on) {
  if (state.filter !== 'all') pinned.add(d.id);
  d.on = on; render();   // optimistic
  try {
    const r = await fetch(`/api/devices/${encodeURIComponent(d.id)}/power`, { method: 'POST', body: JSON.stringify({ on }) });
    if (!r.ok) throw new Error((await r.json()).error);
  } catch (e) { d.on = !on; render(); toast('Failed: ' + e.message); }
}
$('#main').onclick = e => {
  const t = e.target.closest('.tile'), rb = e.target.closest('[data-room]');
  if (t) { const d = devices.get(t.dataset.id); power(d, !d.on); }
  else if (rb) {
    const ds = [...devices.values()].filter(d => (d.room || 'No room') === rb.dataset.room);
    const on = !ds.some(d => d.on); ds.forEach(d => power(d, on));
  }
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; setTimeout(() => (t.hidden = true), 3000); }

const merge = list => { for (const d of list) devices.set(d.id, d); render(); };
async function load() { try { merge(await (await fetch('/api/devices')).json()); } catch { toast('Server unreachable'); } }
load();
const es = new EventSource('/api/events');
es.onmessage = e => merge(JSON.parse(e.data));
es.onopen = load; // resync after reconnect
