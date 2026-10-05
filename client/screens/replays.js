// Replays: load a replay file (from "Save replay file" on the Battle screen, or from someone else), check it, and watch it.
import { h } from '../dom.js';
import { panel, button } from '../ui.js';

export function replays(ctx) {
  const { store } = ctx;
  const inp = h('textarea', { rows: 5, 'data-testid': 'replay-text', 'aria-label': 'replay file text', spellcheck: 'false', placeholder: 'Paste the text of a replay file here, or choose a file.' });
  const msg = h('div', { class: 'msg', role: 'status', 'data-testid': 'replay-msg' });
  const say = (text, kind, list) => { msg.className = `msg ${kind}`; msg.replaceChildren(h('p', null, text), list ? h('ul', null, list.slice(0, 8).map((e) => h('li', null, `${e.key}: ${e.message}`))) : ''); };
  const load = (text) => {
    const r = store.viewReplay(text);
    if (r.ok) location.hash = '#/battle'; else say(`This replay was refused (${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}):`, 'bad', r.errors);
  };
  const file = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'replay file', 'data-testid': 'replay-file', onchange: async (e) => { const f = e.target.files[0]; if (f) { inp.value = await f.text(); load(inp.value); } } });
  return h('div', { class: 'screen replays' }, h('h1', null, 'Replays'),
    panel('Watch a replay file', h('p', { class: 'hint' }, 'A replay holds everything needed to see a battle again: the seed, the fighters and every event. Loading one never touches your save. The game checks the file first: it recomputes the battle from the inputs and tells you whether every event matches.'),
      h('p', { class: 'hint' }, 'To make a file: win or lose any delve or expedition fight, then press "Save replay file" on the Battle screen.'),
      file, inp, h('div', { class: 'row-buttons' }, button('Watch', () => load(inp.value), { id: 'replay-load', class: 'primary' })), msg));
}
