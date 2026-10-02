// The shell: header and navigation, routing by location.hash, a notice line, and the context passed to every screen.
import { h, clear } from './dom.js';
import { Art } from './art/index.js';
import { idle } from './ui.js';
import { hall } from './screens/hall.js';
import { hero } from './screens/hero.js';
import { forge } from './screens/forge.js';
import { delveBoard } from './screens/delve.js';
import { battle } from './screens/battle.js';
import { settings } from './screens/settings.js';

const NAV = [['hall', 'Hall'], ['forge', 'Forge'], ['delve', 'Delve'], ['battle', 'Battle'], ['settings', 'Settings']];
const SCREENS = { hall: (c) => hall(c), hero: (c, a) => hero(c, a), forge: (c) => forge(c), delve: (c) => delveBoard(c), battle: (c) => battle(c), settings: (c) => settings(c) };
const PREF_KEY = 'three-realms.prefs.v1';

function makePrefs(storage) {
  let data = {};
  try { data = JSON.parse(storage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { data = {}; }
  return { get: (k) => Boolean(data[k]), set(k, v) { data[k] = v; try { storage.setItem(PREF_KEY, JSON.stringify(data)); } catch (e) { /* ignored */ } } };
}

export function mountApp({ root, store, content, build, engineCheck, storage }) {
  const rs = document.documentElement.style; // the woodcut and vellum textures are generated, then handed to the stylesheet
  rs.setProperty('--vellum-url', `url(${Art.vellumURL()})`); rs.setProperty('--frame-url', `url(${Art.frameURL()})`); rs.setProperty('--hatch-url', `url(${Art.hatchURL()})`); rs.setProperty('--ink-url', `url(${Art.inkURL()})`); rs.setProperty('--rule-url', `url(${Art.ruleURL()})`);
  const prefs = makePrefs(storage || { getItem: () => null, setItem: () => {} });
  const notice = h('div', { id: 'notice', role: 'status', 'aria-live': 'polite', 'data-testid': 'notice' });
  const screen = h('main', { id: 'screen', tabindex: '-1' });
  const purse = h('p', { class: 'purse', 'data-testid': 'purse' });
  const nav = h('nav', { 'aria-label': 'screens' });
  root.append(h('header', { class: 'masthead' }, h('h1', { class: 'title' }, h('a', { href: '#/hall' }, 'Three Realms')), purse, nav), notice, screen,
    h('footer', null, h('small', null, `Build ${build}. Free to copy (MIT). Saved only in this browser.`)));

  const ctx = {
    store, content, build, engineCheck, prefs, battle: null,
    say(text, kind = 'ok') { notice.className = kind; notice.textContent = text; },
    rerender() { render(false); },
    attempt: (fn, ...a) => store.act(fn, ...a),
    run(fn, ...a) { const r = store.act(fn, ...a); if (!r.ok) ctx.say(r.message, 'bad'); return r; },
    start(opts) { const r = store.delve(opts); if (!r.ok) ctx.say(r.message, 'bad'); return r; },
    reducedMotion: () => prefs.get('reduced') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches),
  };

  const parse = () => { const m = /^#\/([a-z]+)(?:\/(\d+))?/.exec(location.hash); return m && SCREENS[m[1]] ? { name: m[1], arg: m[2] } : { name: 'hall', arg: undefined }; };
  function render(fresh) {
    const { name, arg } = parse(), y = window.scrollY;
    if (fresh) { notice.textContent = ''; notice.className = ''; if (store.problem) { ctx.say(store.problem, 'bad'); store.clearProblem(); } }
    const s = store.save;
    purse.textContent = `${s.currency.hacksilver} hacksilver · ${s.heroes.length} heroes · ${s.threads} Thread${s.threads === 1 ? '' : 's'}`;
    clear(nav);
    for (const [id, label] of NAV) nav.append(h('a', { href: `#/${id}`, 'aria-current': id === name || (name === 'hero' && id === 'hall') ? 'page' : null, 'data-testid': `nav-${id}` }, label));
    clear(screen);
    try { screen.append(SCREENS[name](ctx, arg)); } catch (e) { console.error(e); screen.append(h('div', { class: 'screen' }, h('h1', null, 'Something went wrong'), h('p', { 'data-testid': 'screen-error' }, `This screen could not be drawn: ${e.message}`))); }
    screen.dataset.screen = name;
    if (fresh) { window.scrollTo(0, 0); } else window.scrollTo(0, y);
  }
  window.addEventListener('hashchange', () => render(true));
  store.subscribe(() => render(false));
  render(true);

  // a small read-only window for tests and the curious
  return {
    ctx, render, idle,
    route: () => parse().name,
    timeFrames(n) { const v = ctx.battle; if (!v) return null; const out = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); v.draw(v.clock + i * 16); v.ctx.getImageData(0, 0, 1, 1); out.push(performance.now() - t0); } return out; },
    battleState() { const v = ctx.battle; return v ? { cursor: v.state.cursor, events: v.replay.events.length, done: v.done, over: v.state.over, outcome: v.state.outcome, log: v.state.log.length, hash: v.replay.hash, injured: v.replay.inputs.party.map((p) => p.injured), realm: v.replay.inputs.realm, level: v.replay.inputs.level } : null; },
    artReady: () => Boolean(Art),
  };
}
