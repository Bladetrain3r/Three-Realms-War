// Expedition: choose a realm, level and provisions; walk the fogged map; enter sites floor by floor; bring the pack home.
import { h } from '../dom.js';
import { panel, button, realmTag } from '../ui.js';
import { expeditionMap, siteAt, TERRAIN_NAMES, moveCost, lairsFor } from '../../sim/index.js';
import { matName, injuryText } from '../format.js';

const SYMBOL = ['·', 'f', 'n', '~', '^'];
let setup = { realm: 'midgard', level: 1, provisions: 30 }, forced = new Set();

export function expedition(ctx) {
  const { store, content } = ctx, save = store.save;
  return save.expedition === null ? startScreen(ctx, save, content, store) : mapScreen(ctx, save, content, store);
}

function reportPanel(store, content) {
  const r = store.lastReturn;
  if (!r) return null;
  const mats = (r.materials || []).map((m) => `${m.n} ${matName(m.id)}`).join(', ');
  const title = r.ended === 'wiped' ? 'The party was lost' : r.ended === 'starved' || r.how === 'starved' ? 'Out of provisions: the party came home safely' : 'Home safe';
  return panel(title, r.ended === 'wiped'
    ? h('p', { class: 'warn', 'data-testid': 'report' }, `${(r.died || []).join(', ') || 'Everyone'} did not come back. The pack was lost with them.${r.rescued ? ' The hall took in a new level-1 hero.' : ''}`)
    : h('div', { 'data-testid': 'report' }, h('ul', { class: 'earned' }, h('li', null, `${r.xp} XP to each hero who returned`), h('li', null, `${r.hacksilver} hacksilver`), mats ? h('li', null, mats) : null, h('li', null, `${r.reputation} reputation`),
      h('li', null, `${r.items} item${r.items === 1 ? '' : 's'} added to the stash${r.droppedItems ? `, ${r.droppedItems} lost (stash full)` : ''}`),
      ...(r.legends || []).map((id) => h('li', { class: 'prize', 'data-testid': `beaten-${id}` }, `${content.legendById[id].name} is beaten${content.legendById[id].item ? `: ${content.legendById[id].item.name} is in your stash` : ''}`)), r.threads ? h('li', null, `${r.threads} Thread of the Norns`) : null, r.paragon ? h('li', null, `${r.paragon} Paragon Point${r.paragon === 1 ? '' : 's'}`) : null),
      r.levelUps && r.levelUps.length ? h('p', null, 'Level up: ', r.levelUps.map((l) => `${l.name} ${l.from}→${l.to}`).join(', ')) : null,
      (r.legends || []).some((id) => content.legendById[id].final) ? h('p', { class: 'victory', 'data-testid': 'victory' }, 'Chaos is beaten. The Yawning Void closes over its own name, and the three realms are quiet. That is the end of a core run; the world goes on.') : null));
}

function startScreen(ctx, save, content, store) {
  const x = content.tables.expedition;
  if (!content.realmById[setup.realm]) setup.realm = content.realms[0].id;
  setup.level = Math.max(1, Math.min(setup.level, save.unlocked[setup.realm]));
  const party = save.party.map((id) => save.heroes.find((q) => q.id === id));
  for (const id of [...forced]) if (!save.party.includes(id) || save.heroes.find((q) => q.id === id).injury === 0) forced.delete(id);
  const blocked = party.filter((q) => q.injury > 0 && !forced.has(q.id));
  const cost = setup.provisions * x.provisionCost;
  const why = blocked.length ? 'an injured hero is in the party' : save.currency.hacksilver <= 0 && cost > 0 ? 'you have no hacksilver for provisions' : save.currency.hacksilver < cost ? `provisions cost ${cost} (you have ${save.currency.hacksilver})` : '';
  const realmSel = h('select', { 'aria-label': 'realm', 'data-testid': 'x-realm', onchange: (e) => { setup.realm = e.target.value; ctx.rerender(); } }, content.realms.map((r) => h('option', { value: r.id, selected: setup.realm === r.id }, r.name)));
  const max = save.unlocked[setup.realm];
  const levelSel = h('select', { 'aria-label': 'expedition level', 'data-testid': 'x-level', onchange: (e) => { setup.level = Number(e.target.value); ctx.rerender(); } }, Array.from({ length: max }, (_, i) => h('option', { value: String(max - i), selected: setup.level === max - i }, `Level ${max - i}`)));
  const prov = h('input', { type: 'number', min: 0, max: x.provisionMax, value: setup.provisions, 'data-testid': 'x-provisions', 'aria-label': 'provisions', style: 'width:5rem', onchange: (e) => { setup.provisions = Math.max(0, Math.min(x.provisionMax, Math.floor(Number(e.target.value) || 0))); ctx.rerender(); } });
  const go = () => { const r = ctx.expStart({ realm: setup.realm, level: setup.level, provisions: setup.provisions, force: [...forced] }); if (r.ok) ctx.rerender(); };
  return h('div', { class: 'screen expedition' }, h('h1', null, 'Expedition'), reportPanel(store, content),
    panel('Set out', h('p', { class: 'hint' }, `A longer outing with permanent stakes. Walk a ${x.width} by ${x.height} map, enter sites, and bring the pack home. A hero who falls in a won fight faces a death save (${x.deathSaveBp / 100}% to die for good); a lost fight kills the whole party and the pack is lost. Walking home is free; running out of provisions sends you home safely.`),
      h('p', null, h('label', null, 'Realm ', realmSel), ' ', h('label', null, 'Level ', levelSel), ' ', realmTag(content, setup.realm)),
      (() => { const ids = lairsFor(save, content, setup.level); return ids.length ? h('p', { 'data-testid': 'x-lairs' }, `A legendary lair stands on this map: ${ids.map((id) => `${content.legendById[id].name} (${content.legendById[id].phases.length} phases)`).join(' and ')}. It is far from home and fights alone; its prize is yours only if you bring the pack home.`) : null; })(),
      h('p', null, h('label', null, 'Provisions ', prov), ` × ${x.provisionCost} hacksilver = ${cost}. A step costs 1 to ${x.moveCostForest}; a floor costs ${x.floorCost}. You have ${save.currency.hacksilver}.`),
      h('ol', { class: 'party-list' }, party.map((q) => h('li', { class: q.injury > 0 ? 'warn' : '' }, `${q.name} — ${content.heroById[q.class].name}, level ${q.level}, ${injuryText(q)} `,
        q.injury > 0 ? h('label', null, h('input', { type: 'checkbox', checked: forced.has(q.id), 'data-testid': `xforce-${q.id}`, onchange: (e) => { e.target.checked ? forced.add(q.id) : forced.delete(q.id); ctx.rerender(); } }), ' send anyway at half strength') : null))),
      h('p', null, button('Set out', go, { class: 'primary', id: 'x-start', disabled: Boolean(why), title: why }), why ? h('small', { class: 'why' }, why) : null)));
}

function mapScreen(ctx, save, content, store) {
  const ex = save.expedition, x = content.tables.expedition, map = expeditionMap(ex, content), here = ex.site === null ? siteAt(map, ex.x, ex.y) : map.sites[ex.site];
  const seen = (i) => ex.seen[i] === '1';
  const adj = (cx, cy) => Math.abs(cx - ex.x) + Math.abs(cy - ex.y) === 1;
  const step = (cx, cy) => { const r = ctx.expMove(cx, cy); if (r.ok) ctx.rerender(); };
  const cells = [];
  for (let cy = 0; cy < map.height; cy++) for (let cx = 0; cx < map.width; cx++) {
    const i = cy * map.width + cx, t = map.terrain[i], site = siteAt(map, cx, cy), isMe = cx === ex.x && cy === ex.y, ok = seen(i) && moveCost(t, x) > 0 && adj(cx, cy) && ex.site === null;
    const name = !seen(i) ? 'unexplored' : TERRAIN_NAMES[t];
    const lair = site && site.lair && seen(i) ? content.legendById[site.lair] : null;
    const label = lair ? `${name}, the lair of ${lair.name} (level ${site.level})${ex.floors[site.id] >= site.floors ? ' (beaten)' : ''}${isMe ? ', the party is here' : ''}` : `${name}${site && seen(i) ? `, site of level ${site.level} with ${site.floors} floors${ex.floors[site.id] >= site.floors ? ' (cleared)' : ex.floors[site.id] > 0 ? ` (${ex.floors[site.id]} done)` : ''}` : ''}${isMe ? ', the party is here' : ''}${cx === map.start.x && cy === map.start.y ? ', the start' : ''}`;
    cells.push(h('button', { type: 'button', class: `cell t${seen(i) ? t : 'x'}${site && seen(i) ? ' site' : ''}${lair ? ' lair' : ''}${isMe ? ' me' : ''}${ok ? ' go' : ''}`, disabled: !ok, 'aria-label': `${label} (${cx}, ${cy})`, title: ok ? `step here: costs ${moveCost(t, x)}` : label, 'data-testid': `cell-${cx}-${cy}`,
      onclick: () => step(cx, cy) }, isMe ? '@' : !seen(i) ? '' : lair ? '★' : site ? '◆' : cx === map.start.x && cy === map.start.y ? 'H' : SYMBOL[t]));
  }
  const grid = h('div', { class: 'map', role: 'group', 'aria-label': 'expedition map', style: `grid-template-columns: repeat(${map.width}, 1.9rem)`, 'data-testid': 'map' }, cells);
  setTimeout(() => { const me = grid.querySelector('.me'); if (me && me.scrollIntoView) me.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
  const dpad = h('div', { class: 'dpad', 'aria-label': 'move' }, [['▲', 0, -1, 'north'], ['◀', -1, 0, 'west'], ['▶', 1, 0, 'east'], ['▼', 0, 1, 'south']].map(([g, dx, dy, name]) => {
    const tx = ex.x + dx, ty = ex.y + dy, inb = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height, c = inb ? moveCost(map.terrain[ty * map.width + tx], x) : 0;
    return button(g, () => step(tx, ty), { id: `go-${name}`, disabled: ex.site !== null || c === 0, title: c ? `${name}: costs ${c}` : `${name}: blocked` });
  }));
  const hpText = (id, i) => { const q = save.heroes.find((z) => z.id === id); return `${q.name} (${content.heroById[q.class].name}) ${ex.hp[i] < 0 ? 'full HP' : `${ex.hp[i]} HP`}${q.injury > 0 ? ', injured' : ''}${q.thread ? ', Thread' : ''}`; };
  const pk = ex.pack, mats = Object.entries(pk.materials).map(([id, n]) => `${n} ${matName(id)}`).join(', ');
  let siteBox;
  if (here && seen(here.y * map.width + here.x)) {
    const done = ex.floors[here.id], full = done >= here.floors;
    const lg = here.lair ? content.legendById[here.lair] : null;
    siteBox = lg ? panel(`Lair of ${lg.name}: level ${here.level}`, h('p', { 'data-testid': 'lair-box' }, `${lg.name} fights alone, in ${lg.phases.length} phases (${lg.phases.map((p) => p.name).join(', ')}). ${lg.item ? `Its prize is ${lg.item.name}, a Legendary ${lg.item.slot}, found nowhere else.` : 'Beating it is the end of a core run.'} Entering costs ${x.floorCost} provisions; a lost fight kills the party and the pack.`),
      h('div', { class: 'row-buttons' }, full ? h('small', null, `${lg.name} is beaten.`) : button(`Challenge ${lg.name}`, () => { const r = ctx.expFloor(); if (r.ok) location.hash = '#/battle'; }, { class: 'primary', id: 'x-floor', disabled: ex.provisions < x.floorCost, title: ex.provisions < x.floorCost ? 'not enough provisions: you would be sent home' : '' }))) :
      panel(`Site: level ${here.level}, ${here.floors} floors`, h('p', null, `${done} of ${here.floors} floors cleared. Each floor has ${x.encountersPerFloor} fights${done === here.floors - 1 ? '; this one ends with the boss' : ''}. Entering a floor costs ${x.floorCost} provisions.`),
      h('div', { class: 'row-buttons' },
        full ? h('small', null, 'This site is cleared.') : button(ex.site === null ? `Enter floor ${done + 1}` : `Descend to floor ${done + 1}`, () => { const r = ctx.expFloor(); if (r.ok) location.hash = '#/battle'; }, { class: 'primary', id: 'x-floor', disabled: ex.provisions < x.floorCost, title: ex.provisions < x.floorCost ? 'not enough provisions: you would be sent home' : '' }),
        ex.site !== null ? button('Retreat to the map', () => { const r = ctx.expRetreat(); if (r.ok) ctx.rerender(); }, { id: 'x-retreat' }) : null));
  }
  const home = () => { const r = ctx.expHome(); if (r.ok) ctx.rerender(); };
  return h('div', { class: 'screen expedition' }, h('h1', null, `Expedition — ${content.realmById[ex.realm].name}, level ${ex.level}`),
    h('p', { 'data-testid': 'x-status' }, `Provisions ${ex.provisions} of ${ex.bought} · steps ${ex.steps} · ${ex.site !== null ? 'inside a site' : 'on the map'}`),
    siteBox,
    h('div', { class: 'two' }, panel('Map', h('div', { class: 'map-wrap' }, grid), h('p', { class: 'hint' }, 'H is home, @ is the party, ◆ a site, ★ a legendary lair, f forest, n hills, ~ water, ^ peaks. Click a neighbouring cell or use the arrows. Fog hides what is more than 2 cells away.'), dpad),
      h('div', null, panel('Party', h('ul', { 'data-testid': 'x-party' }, ex.party.map((id, i) => h('li', null, hpText(id, i))))),
        panel('Pack (banked only if you get home)', h('ul', { class: 'earned', 'data-testid': 'x-pack' }, h('li', null, `${pk.xp} XP`), h('li', null, `${pk.hacksilver} hacksilver`), mats ? h('li', null, mats) : null, h('li', null, `${pk.items.length} item${pk.items.length === 1 ? '' : 's'}`), pk.threads ? h('li', null, `${pk.threads} Thread`) : null, pk.paragon ? h('li', null, `${pk.paragon} Paragon Point${pk.paragon === 1 ? '' : 's'}`) : null, ...pk.legends.map((id) => h('li', { class: 'prize' }, `${content.legendById[id].name} beaten`)), h('li', null, `${pk.reputation} reputation`)),
          button('Return home with the pack', home, { id: 'x-home', disabled: ex.site !== null, title: ex.site !== null ? 'retreat from the site first' : 'banks the pack; walking home is free' })))));
}
