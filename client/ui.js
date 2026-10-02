// Shared widgets: painted portraits (drawn lazily, one at a time, so the page stays responsive), panels, and key/value rows.
import { h } from './dom.js';
import { Art } from './art/index.js';

let queue = [], running = false, waiters = [];
function pump() {
  if (running) return; running = true;
  const step = () => {
    const job = queue.shift();
    if (!job) { running = false; const w = waiters; waiters = []; w.forEach((f) => f()); return; }
    try { job(); } catch (e) { /* a failed portrait leaves its placeholder */ }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}
export const idle = () => new Promise((res) => { if (!running && queue.length === 0) res(); else waiters.push(res); });

// A canvas that fills with the sprite when the queue reaches it. `get` returns the sprite canvas.
export function portrait(get, w, hgt, label, flip = false) {
  const cv = h('canvas', { width: w, height: hgt, class: 'portrait', role: 'img', 'aria-label': label });
  queue.push(() => {
    const spr = get(), ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (flip) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(spr, 0, 0, w, hgt); cv.dataset.painted = '1';
  });
  pump();
  return cv;
}
export const heroPortrait = (cls, w = 100) => portrait(() => Art.hero(cls), w, Math.round(w * 1.3), cls.name);
export const monsterPortrait = (m, w = 100) => portrait(() => Art.monster(m), w, Math.round(w * 1.3), m.name, true);

export function panel(title, ...kids) {
  return h('section', { class: 'panel' }, title ? h('h2', null, title) : null, ...kids);
}
export function kv(rows) { // [[label, value]]
  return h('dl', { class: 'kv' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}
export function bar(cur, max, cls = '') {
  const pct = max > 0 ? Math.min(100, Math.floor((cur * 100) / max)) : 0;
  return h('div', { class: `bar ${cls}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': cur }, h('i', { style: `width:${pct}%` }));
}
export function button(label, onclick, opts = {}) {
  return h('button', { type: 'button', class: opts.class || '', disabled: opts.disabled, title: opts.title, 'data-testid': opts.id, onclick }, label);
}
export const realmTag = (content, realm) => h('span', { class: `realm ${realm}` }, h('i', { class: 'rune' }), content.realmById[realm].name);
