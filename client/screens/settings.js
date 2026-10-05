// Settings: export, import, reset, preferences, and what this build is.
import { h, download } from '../dom.js';
import { panel, button, kv } from '../ui.js';

let confirmReset = false;

export function settings(ctx) {
  const { store, content } = ctx, check = ctx.engineCheck;
  const out = h('textarea', { rows: 5, readonly: true, 'data-testid': 'export-text', 'aria-label': 'exported save', spellcheck: 'false' });
  const inp = h('textarea', { rows: 5, 'data-testid': 'import-text', 'aria-label': 'save to import', spellcheck: 'false', placeholder: 'Paste an exported save here, or choose a file.' });
  const msg = h('div', { class: 'msg', role: 'status', 'data-testid': 'import-msg' });
  const say = (text, kind, list) => { msg.className = `msg ${kind}`; msg.replaceChildren(h('p', null, text), list ? h('ul', null, list.slice(0, 8).map((e) => h('li', null, `${e.key}: ${e.message}`))) : ''); };
  const doImport = (text) => {
    const r = store.importText(text);
    if (r.ok) ctx.say('Save imported.', 'ok'); else say(`This save was refused (${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}):`, 'bad', r.errors);
  };
  const file = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'save file', 'data-testid': 'import-file', onchange: async (e) => { const f = e.target.files[0]; if (f) { inp.value = await f.text(); say('File loaded. Press Import to use it.', 'ok'); } } });
  return h('div', { class: 'screen settings' }, h('h1', null, 'Settings'),
    panel('Save', h('p', { class: 'hint' }, 'The game saves in this browser after every action. Export a copy before clearing browser data or moving to another device.'),
      h('div', { class: 'row-buttons' }, button('Show save text', () => { out.value = store.exportText(); }, { id: 'show-export' }), button('Download save file', () => download('three-realms-save.json', store.exportText()), { id: 'download-save' })), out,
      h('h3', null, 'Import'), file, inp, h('div', { class: 'row-buttons' }, button('Import', () => doImport(inp.value), { id: 'import' })), msg),
    panel('Preferences', h('label', null, h('input', { type: 'checkbox', checked: ctx.prefs.get('reduced'), 'data-testid': 'pref-reduced', onchange: (e) => { ctx.prefs.set('reduced', e.target.checked); } }), ' Reduce motion: show a finished battle and its log instead of animating (also follows your system setting).')),
    panel('Activity timer', h('label', null, h('input', { type: 'checkbox', checked: !ctx.prefs.get('noTimer'), 'data-testid': 'pref-timer', onchange: (e) => { ctx.prefs.set('noTimer', !e.target.checked); } }), ' Bulk delves take 2 seconds per run and the party is busy until they finish. Turn off to resolve a batch at once (for testing or simulation).')),
    panel('Start over', confirmReset
      ? h('p', null, 'This erases the current game. ', button('Yes, erase and start again', () => { confirmReset = false; store.reset(); ctx.say('A new game was started.', 'ok'); location.hash = '#/hall'; }, { id: 'confirm-reset' }), button('Keep playing', () => { confirmReset = false; ctx.rerender(); }, { id: 'cancel-reset' }))
      : h('p', null, button('Reset the game…', () => { confirmReset = true; ctx.rerender(); }, { id: 'reset' }))),
    panel('About', kv([['Game', 'Three Realms (working title)'], ['Build', ctx.build], ['Licence', 'MIT, free to copy and change'], ['Content', `${content.heroes.length} classes, ${content.roster.length} monsters, ${content.realms.length} realms`],
      ['Engine check', check ? `${check.ok ? 'passed' : 'FAILED'} — a fixed delve replayed on this device gave hash ${check.actual.slice(0, 16)}… (expected ${check.expected.slice(0, 16)}…)` : 'not run']]),
      h('p', { class: 'hint' }, 'Nothing leaves your browser: there is no server, no account and no tracking. Every battle is decided by a deterministic simulation; the replay you watch is the result, not an animation of it.')));
}
