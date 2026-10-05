// Hall: the party in formation, the whole roster, and recruiting.
import { h } from '../dom.js';
import { panel, button, heroPortrait, bar, realmTag } from '../ui.js';
import { setParty, recruit, restCost, legendStatus } from '../../sim/index.js';
import { recruitLevel, recruitCost, recruitKitLevel } from '../../sim/progress.js';
import { topLevel } from '../../sim/game.js';
import { injuryText } from '../format.js';
import { xpToNext } from '../../sim/progress.js';

export function hall(ctx) {
  const { store, content } = ctx, save = store.save;
  const byId = (id) => save.heroes.find((x) => x.id === id);
  const card = (hero, extra) => {
    const cls = content.heroById[hero.class], need = xpToNext(hero.level, content.tables.progress);
    return h('article', { class: `hero-card${hero.injury > 0 ? ' injured' : ''}`, 'data-testid': `hero-${hero.id}` },
      heroPortrait(cls, 84),
      h('div', { class: 'body' },
        h('h3', null, h('a', { href: `#/hero/${hero.id}`, 'data-testid': `open-${hero.id}` }, hero.name)),
        h('p', null, `${cls.name} · level ${hero.level} · ${cls.row} row`, ' ', realmTag(content, cls.realm)),
        h('p', { class: hero.injury > 0 ? 'warn' : '' }, injuryText(hero)),
        hero.level < content.tables.stats.levelCap ? h('div', null, bar(hero.xp, need, 'xp'), h('small', null, `XP ${hero.xp} / ${need}`)) : h('small', null, 'at the level cap'),
        extra));
  };
  const act = (fn, ...a) => { const r = ctx.run(fn, ...a); return r; };
  const move = (i, d) => { const p = save.party.slice(), j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; act(setParty, p); };

  const partyList = h('div', { class: 'party', 'data-testid': 'party' }, save.party.map((id, i) => {
    const hero = byId(id);
    return h('div', { class: 'slot' }, h('h3', null, `${i + 1}. ${i < 2 ? 'Front row' : 'Back row'}`),
      card(hero, h('div', { class: 'row-buttons' },
        button('◀', () => move(i, -1), { disabled: i === 0, title: 'swap with the slot before', id: `left-${hero.id}` }),
        button('▶', () => move(i, 1), { disabled: i === save.party.length - 1, title: 'swap with the slot after', id: `right-${hero.id}` }),
        button('Bench', () => act(setParty, save.party.filter((x) => x !== id)), { disabled: save.party.length === 1, title: save.party.length === 1 ? 'a party needs at least one hero' : 'take out of the party', id: `bench-${hero.id}` }))));
  }));

  const benched = save.heroes.filter((x) => !save.party.includes(x.id));
  const bench = benched.length ? h('div', { class: 'cards' }, benched.map((hero) => card(hero, button('Add to party', () => act(setParty, save.party.concat([hero.id])), { disabled: save.party.length >= 4, title: save.party.length >= 4 ? 'the party is full' : '', id: `add-${hero.id}` })))) : h('p', null, 'Everyone is in the party.');

  const lvl = recruitLevel(topLevel(save), content.tables.recruit), rep = content.tables.progress.rep.known;
  const classes = content.heroes.filter((c) => c.rarity === 'common' || c.rarity === 'rare');
  const recruits = h('div', { class: 'cards' }, classes.map((cls) => {
    const cost = recruitCost(lvl, cls.rarity === 'rare', content.tables.recruit);
    const locked = cls.rarity === 'rare' && save.reputation[cls.realm] < rep;
    const full = save.heroes.length >= content.tables.recruit.rosterMax;
    const poor = save.currency.hacksilver < cost;
    const why = save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve` : locked ? `needs ${rep} reputation in ${content.realmById[cls.realm].name} (you have ${save.reputation[cls.realm]})` : full ? 'the roster is full' : poor ? `costs ${cost} hacksilver (you have ${save.currency.hacksilver})` : '';
    return h('article', { class: 'hero-card', 'data-testid': `recruit-${cls.id}` }, heroPortrait(cls, 72),
      h('div', { class: 'body' }, h('h3', null, cls.name), h('p', null, `${cls.role} · ${cls.row} row · ${cls.attack}`, ' ', realmTag(content, cls.realm)),
        h('p', null, `Level ${lvl} · ${cost} hacksilver${cls.rarity === 'rare' ? ' · rare' : ''}`),
        button('Recruit', () => act(recruit, cls.id), { disabled: Boolean(why), title: why, id: `do-recruit-${cls.id}` }),
        why ? h('small', { class: 'why' }, why) : null));
  }));

  const rc = restCost(save, content), hurt = save.heroes.filter((x) => x.injury > 0).length;
  const restWhy = save.currency.hacksilver <= 0 ? (save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve` : 'you have no hacksilver') : !hurt ? 'nobody is injured' : '';
  const restPanel = panel('Rest', h('p', { class: 'hint' }, `Idle time costs ${content.tables.injury.restCost} hacksilver per hero, ${content.tables.injury.restCostWounded} per injured hero. One rest takes one off every injury counter. Right now: ${rc.cost} hacksilver.${save.currency.hacksilver < 0 ? ` You are ${-save.currency.hacksilver} in debt.` : ''}`),
    button(`Rest the roster (${rc.cost})`, () => ctx.rest(), { id: 'rest', disabled: Boolean(restWhy), title: restWhy }), restWhy ? h('small', { class: 'why' }, restWhy) : null);
  const lg = legendStatus(save, content), L = content.tables.legend;
  const legendsPanel = panel('Legends', h('p', { class: 'hint' }, `Legendary bosses lair on expeditions, one at a time (the lowest you have not beaten, from the level shown). Each guards one item found nowhere else. Beat ${lg.needed} of the ${lg.legends.length - 1} and the final boss stirs on a level-${L.chaosFrom} expedition.`),
    h('ul', { 'data-testid': 'legends' }, lg.legends.map((l) => h('li', { class: l.beaten ? 'prize' : '', 'data-testid': `legend-${l.id}` }, l.final ? `${l.name}: ${l.beaten ? 'beaten' : lg.chaosOpen ? `stirs on level-${L.chaosFrom} expeditions` : `sleeps (beat ${lg.needed} legends first)`}`
      : `${l.name}: ${l.beaten ? `beaten (${content.legendById[l.id].item.name} is yours)` : `from expedition level ${l.from}`}`))),
    h('p', { 'data-testid': 'legend-progress' }, `${lg.beaten} of ${lg.needed} needed legends beaten.`),
    lg.won ? h('p', { class: 'victory', 'data-testid': 'won' }, 'Chaos is beaten: you have finished a core run. The realms go on.') : null);
  return h('div', { class: 'screen hall' },
    h('h1', null, 'The Hall'),
    panel('Party', h('p', { class: 'hint' }, 'Slots 1 and 2 stand in the front row, 3 and 4 in the back. Up to four heroes.'), partyList),
    panel(`Roster (${save.heroes.length} of ${content.tables.recruit.rosterMax})`, bench),
    restPanel, legendsPanel,
    panel('Recruit', h('p', { class: 'hint' }, `New recruits arrive at level ${lvl} with a Plain kit at level ${recruitKitLevel(lvl, content.tables.recruit)}. Level them in the dungeons (a benched hero within ${content.tables.progress.restXpGap} levels of your best earns half xp) or train them on the hero screen. You have ${save.currency.hacksilver} hacksilver.`), recruits));
}
