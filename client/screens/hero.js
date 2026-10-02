// Hero: stats, equipment, Thread of the Norns, dismissing, and the runbook editor.
import { h } from '../dom.js';
import { panel, kv, bar, button, heroPortrait, realmTag } from '../ui.js';
import { equip, dismiss, assignThread, unassignThread } from '../../sim/index.js';
import { wornIds } from '../../sim/game.js';
import { canEquip } from '../../sim/hero.js';
import { xpToNext } from '../../sim/progress.js';
import { heroSheet, itemLine, itemMainText, itemLineTexts, injuryText } from '../format.js';
import { runbookEditor } from '../runbook-editor.js';

let confirmDismiss = null;

export function hero(ctx, id) {
  const { store, content } = ctx, save = store.save, hero = save.heroes.find((x) => x.id === Number(id));
  if (!hero) return h('div', { class: 'screen' }, h('h1', null, 'No such hero'), h('p', null, 'That hero is not on the roster. ', h('a', { href: '#/hall' }, 'Back to the Hall.')));
  const cls = content.heroById[hero.class], sheet = heroSheet(hero, save, content), worn = wornIds(save);
  const need = xpToNext(hero.level, content.tables.progress);

  const slotRow = (slot) => {
    const cur = hero.slots[slot] === null ? null : save.items.find((x) => x.id === hero.slots[slot]);
    const options = save.items.filter((it) => it.slot === slot && (worn[it.id] === undefined || worn[it.id] === hero.id));
    const select = h('select', { 'aria-label': `${slot} item`, 'data-testid': `slot-${slot}`, onchange: (e) => { const v = e.target.value; ctx.run(equip, hero.id, slot, v === '' ? null : Number(v)); } },
      h('option', { value: '' }, '(empty)'),
      options.map((it) => {
        const bad = !canEquip(hero, it, content);
        return h('option', { value: String(it.id), selected: cur && cur.id === it.id, disabled: bad && !(cur && cur.id === it.id) }, `${itemLine(it, content)}${bad ? ' — too high a level' : ''}`);
      }));
    return h('tr', null, h('th', { scope: 'row' }, slot), h('td', null, select),
      h('td', { class: 'num' }, cur ? [itemMainText(cur, content), ...itemLineTexts(cur, content).map((t) => h('div', { class: 'line' }, t))] : '—'));
  };

  const stats = h('table', { class: 'stats', 'data-testid': 'stats' }, h('thead', null, h('tr', null, h('th', null, 'Stat'), h('th', { class: 'num' }, 'Final'))),
    h('tbody', null,
      ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD'].map((s) => h('tr', null, h('th', { scope: 'row' }, s), h('td', { class: 'num', 'data-testid': `stat-${s}` }, sheet.stats[s]))),
      h('tr', null, h('th', { scope: 'row' }, 'Max HP'), h('td', { class: 'num', 'data-testid': 'stat-HP' }, sheet.maxHp)),
      h('tr', null, h('th', { scope: 'row' }, 'Crit'), h('td', { class: 'num' }, `${sheet.crit / 100}% × ${(10000 + sheet.critDmg) / 10000}`))));

  const thread = save.threads > 0 || hero.thread
    ? (hero.thread ? button('Release the Thread', () => ctx.run(unassignThread, hero.id), { id: 'unthread' }) : button(`Bind a Thread of the Norns (${save.threads} held)`, () => ctx.run(assignThread, hero.id), { id: 'thread' }))
    : h('small', null, 'No Thread of the Norns held.');

  const dis = confirmDismiss === hero.id
    ? h('span', null, 'Dismiss for good? ', button('Yes, dismiss', () => { confirmDismiss = null; const r = ctx.run(dismiss, hero.id); if (r.ok) location.hash = '#/hall'; }, { id: 'confirm-dismiss' }), button('Keep', () => { confirmDismiss = null; ctx.rerender(); }, { id: 'keep' }))
    : button('Dismiss…', () => { confirmDismiss = hero.id; ctx.rerender(); }, { id: 'dismiss', disabled: save.heroes.length <= 1, title: save.heroes.length <= 1 ? 'the last hero cannot be dismissed' : '' });

  return h('div', { class: 'screen hero' },
    h('p', null, h('a', { href: '#/hall' }, '← The Hall')),
    h('header', { class: 'hero-head' }, heroPortrait(cls, 130),
      h('div', null, h('h1', { 'data-testid': 'hero-name' }, hero.name), h('p', null, `${cls.name} · ${cls.role} · level ${hero.level} `, realmTag(content, cls.realm)),
        h('p', { class: hero.injury > 0 ? 'warn' : '' }, injuryText(hero)),
        hero.level < content.tables.stats.levelCap ? h('div', null, bar(hero.xp, need, 'xp'), h('small', null, `XP ${hero.xp} / ${need}`)) : null,
        h('p', null, thread, ' ', dis))),
    h('div', { class: 'two' }, panel('Stats', stats, hero.injury > 0 ? h('p', { class: 'hint' }, 'These are the unhurt numbers; a hero sent injured fights at half.') : null),
      panel('Equipment', h('table', { class: 'equip' }, h('tbody', null, content.items.slotOrder.map(slotRow))), h('p', { class: 'hint' }, `A hero may wear items up to ${content.items.levelSlack} levels above their own. Upgrade in the Forge.`))),
    panel('Skills', h('ul', { class: 'skills' }, sheet.unit.skills.map((s) => { const d = content.skillById[s]; return h('li', null, h('b', null, d.name), ` — ${d.type}, ${d.range}${d.cooldown ? `, cooldown ${d.cooldown}` : ''}`); }))),
    panel('Runbook', runbookEditor(ctx, hero)));
}
