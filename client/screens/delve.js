// Delve board: pick a realm and a level, check the party, go.
import { h } from '../dom.js';
import { panel, button, realmTag } from '../ui.js';
import { Art } from '../art/index.js';
import { injuryText } from '../format.js';
import { restCost } from '../../sim/index.js';

let chosen = { realm: 'midgard', level: 1 }, forced = new Set(), count = 1;
const COUNTS = [1, 3, 5, 10, 25, 50];

export function delveBoard(ctx) {
  const { store, content } = ctx, save = store.save;
  if (!content.realmById[chosen.realm]) chosen.realm = content.realms[0].id;
  chosen.level = Math.max(1, Math.min(chosen.level, save.unlocked[chosen.realm]));
  const party = save.party.map((id) => save.heroes.find((x) => x.id === id));
  for (const id of [...forced]) if (!save.party.includes(id) || save.heroes.find((x) => x.id === id).injury === 0) forced.delete(id);

  const realms = h('div', { class: 'realm-cards', role: 'radiogroup', 'aria-label': 'realm' }, content.realms.map((r) => {
    const thumb = h('canvas', { width: 240, height: 135, class: 'thumb', role: 'img', 'aria-label': `${r.name} landscape` });
    setTimeout(() => { try { thumb.getContext('2d').drawImage(Art.backdrop(r.id), 0, 0, 240, 135); thumb.dataset.painted = '1'; } catch (e) { /* placeholder stays */ } }, 0);
    return h('label', { class: `realm-card ${r.id}${chosen.realm === r.id ? ' on' : ''}` },
      h('input', { type: 'radio', name: 'realm', value: r.id, checked: chosen.realm === r.id, 'data-testid': `realm-${r.id}`, onchange: () => { chosen.realm = r.id; ctx.rerender(); } }),
      thumb, h('b', null, r.name), h('span', null, r.dungeon), h('small', null, `Open to level ${save.unlocked[r.id]} · reputation ${save.reputation[r.id]} · drops ${r.material.replace(/_/g, ' ')}`));
  }));

  const max = save.unlocked[chosen.realm];
  const levelSel = h('select', { 'aria-label': 'delve level', 'data-testid': 'level', onchange: (e) => { chosen.level = Number(e.target.value); ctx.rerender(); } },
    Array.from({ length: max }, (_, i) => h('option', { value: String(max - i), selected: chosen.level === max - i }, `Level ${max - i}`)));

  const rows = party.map((hero, i) => h('li', { class: hero.injury > 0 ? 'warn' : '' }, `${i + 1}. ${hero.name} — ${content.heroById[hero.class].name}, level ${hero.level}, ${injuryText(hero)} `,
    hero.injury > 0 ? h('label', null, h('input', { type: 'checkbox', checked: forced.has(hero.id), 'data-testid': `force-${hero.id}`, onchange: (e) => { e.target.checked ? forced.add(hero.id) : forced.delete(hero.id); ctx.rerender(); } }), ' send anyway at half strength') : null));
  const blocked = party.filter((x) => x.injury > 0 && !forced.has(x.id));

  const go = async () => {
    const opts = { realm: chosen.realm, level: chosen.level, force: [...forced] };
    const r = count > 1 ? await ctx.startBatch(opts, count) : ctx.start(opts);
    if (r.ok) location.hash = '#/battle';
  };
  const busy = store.busy;
  const rc = restCost(save, content), anyHurt = save.heroes.some((x) => x.injury > 0);
  const restWhy = save.currency.hacksilver <= 0 ? (save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve` : 'you have no hacksilver') : !anyHurt ? 'nobody is injured' : '';
  const countSel = h('select', { 'aria-label': 'how many delves', 'data-testid': 'count', onchange: (e) => { count = Number(e.target.value); ctx.rerender(); } }, COUNTS.map((n) => h('option', { value: String(n), selected: count === n }, n === 1 ? 'once' : `${n} times`)));
  return h('div', { class: 'screen delve' }, h('h1', null, 'The Delve Board'),
    busy ? panel('Delving\u2026', h('p', { 'data-testid': 'busy', role: 'status' }, `Run ${busy.i + 1} of ${busy.n}, ${busy.ms / 1000} seconds each. The party cannot be changed until it is done.`), button(busy.stop ? 'Stopping after this run\u2026' : 'Stop after this run', () => store.stopBatch(), { id: 'stop-batch', disabled: busy.stop })) : null,
    panel('Realm', realms),
    panel('Level and party', h('p', null, h('label', null, 'Delve level ', levelSel), ' ', realmTag(content, chosen.realm), ` — ${content.realmById[chosen.realm].dungeon}`),
      h('ol', { class: 'party-list' }, rows),
      blocked.length ? h('p', { class: 'warn', 'data-testid': 'blocked' }, `${blocked.map((x) => x.name).join(', ')} ${blocked.length === 1 ? 'is' : 'are'} injured. Rest by sitting out delves, pay for a rest, or tick the box to send at half strength.`) : null,
      h('p', null, h('label', null, 'Delve ', countSel), ' ', button(count > 1 ? `Descend \u00d7${count}` : 'Descend', go, { class: 'primary', id: 'descend', disabled: blocked.length > 0 || Boolean(busy), title: busy ? 'the party is out delving' : blocked.length ? 'an injured hero is in the party' : '' }),
        h('small', null, count > 1 ? ' The batch stops at a loss or an injury. Every run can be watched afterwards.' : ' The result is decided the moment you go; the battle screen plays it back.')),
      h('p', null, button(`Rest the roster (${rc.cost} hacksilver)`, () => ctx.rest(), { id: 'rest', disabled: Boolean(restWhy), title: restWhy || `${rc.healthy} fit at 10 and ${rc.wounded} injured at 30; every injury counter drops by one` }),
        h('small', null, restWhy ? ` ${restWhy}.` : ` ${rc.healthy} fit \u00d7 10 + ${rc.wounded} injured \u00d7 30; every injury counter drops by one. You can overspend into debt, but cannot rest or recruit while in debt.`))));
}
