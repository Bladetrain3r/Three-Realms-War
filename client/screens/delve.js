// Delve board: pick a realm and a level, check the party, go.
import { h } from '../dom.js';
import { panel, button, realmTag } from '../ui.js';
import { Art } from '../art/index.js';
import { injuryText } from '../format.js';

let chosen = { realm: 'midgard', level: 1 }, forced = new Set();

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

  const go = () => {
    const r = ctx.start({ realm: chosen.realm, level: chosen.level, force: [...forced] });
    if (r.ok) location.hash = '#/battle';
  };
  return h('div', { class: 'screen delve' }, h('h1', null, 'The Delve Board'),
    panel('Realm', realms),
    panel('Level and party', h('p', null, h('label', null, 'Delve level ', levelSel), ' ', realmTag(content, chosen.realm), ` — ${content.realmById[chosen.realm].dungeon}`),
      h('ol', { class: 'party-list' }, rows),
      blocked.length ? h('p', { class: 'warn', 'data-testid': 'blocked' }, `${blocked.map((x) => x.name).join(', ')} ${blocked.length === 1 ? 'is' : 'are'} injured. Rest by sitting out delves, or tick the box to send at half strength.`) : null,
      h('p', null, button('Descend', go, { class: 'primary', id: 'descend', disabled: blocked.length > 0, title: blocked.length ? 'an injured hero is in the party' : '' }), h('small', null, ' The result is decided the moment you go; the battle screen plays it back.'))));
}
