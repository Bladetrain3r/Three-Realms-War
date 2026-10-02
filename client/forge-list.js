// The Forge's item list: filters, sorting, a checkbox per stash item, and bulk salvage by selection or by rule.
import { h } from './dom.js';
import { button } from './ui.js';
import { wornIds } from '../sim/game.js';
import { itemLine, matName } from './format.js';
import { listItems, matching, yieldOf, TIERS } from './forge-filter.js';

export const fstate = {
  selected: null, owner: 'all', tier: 'any', slot: 'any', realm: 'any', sortKey: 'id', desc: false,
  picked: new Set(), rule: { maxTier: 'fine', maxLevel: '', maxStar: '0', noSet: true }, confirm: false,
};
const SORT_LABELS = [['id', 'Newest last'], ['tier', 'Rarity'], ['ilvl', 'Item level'], ['star', 'Stars'], ['owner', 'Owner'], ['slot', 'Slot']];

export function itemsPanel(ctx) {
  const { store, content } = ctx, save = store.save, worn = wornIds(save), s = fstate;
  if (s.selected !== null && !save.items.some((x) => x.id === s.selected)) s.selected = null;
  for (const id of [...s.picked]) if (!save.items.some((x) => x.id === id) || worn[id] !== undefined) s.picked.delete(id);
  const owner = s.owner === 'all' || s.owner === 'stash' || s.owner === 'worn' ? s.owner : Number(s.owner);
  const rows = listItems(save, content, { owner, tier: s.tier, slot: s.slot, realm: s.realm }, { key: s.sortKey, desc: s.desc });
  const heroName = (id) => save.heroes.find((x) => x.id === id).name;
  const sel = (label, id, value, options, set) => h('label', null, `${label} `, h('select', { 'data-testid': id, onchange: (e) => { set(e.target.value); s.confirm = false; ctx.rerender(); } }, options.map(([v, t]) => h('option', { value: String(v), selected: String(value) === String(v) }, t))));

  const controls = h('div', { class: 'filters' },
    sel('Show', 'f-owner', s.owner, [['all', 'all items'], ['stash', 'stash only'], ['worn', 'worn only'], ...save.heroes.map((x) => [x.id, `worn by ${x.name}`])], (v) => { s.owner = v; }),
    sel('Rarity', 'f-tier', s.tier, [['any', 'any'], ...content.items.tiers.map((t) => [t.id, t.name])], (v) => { s.tier = v; }),
    sel('Slot', 'f-slot', s.slot, [['any', 'any'], ...content.items.slotOrder.map((t) => [t, t])], (v) => { s.slot = v; }),
    sel('Realm', 'f-realm', s.realm, [['any', 'any'], ...content.realms.map((r) => [r.id, r.name])], (v) => { s.realm = v; }),
    sel('Sort by', 'f-sort', s.sortKey, SORT_LABELS, (v) => { s.sortKey = v; }),
    h('label', null, h('input', { type: 'checkbox', checked: s.desc, 'data-testid': 'f-desc', onchange: (e) => { s.desc = e.target.checked; ctx.rerender(); } }), ' high to low'));

  const list = h('ul', { class: 'items', 'data-testid': 'item-list' }, rows.map((it) => h('li', { class: it.id === s.selected ? 'sel' : '' },
    worn[it.id] === undefined ? h('input', { type: 'checkbox', class: 'pick', checked: s.picked.has(it.id), 'aria-label': `select ${itemLine(it, content)}`, 'data-testid': `pick-${it.id}`, onchange: (e) => { e.target.checked ? s.picked.add(it.id) : s.picked.delete(it.id); s.confirm = false; ctx.rerender(); } }) : h('span', { class: 'pick' }),
    h('button', { type: 'button', 'data-testid': `item-${it.id}`, onclick: () => { s.selected = it.id; ctx.rerender(); } }, itemLine(it, content), worn[it.id] !== undefined ? ` — worn by ${heroName(worn[it.id])}` : '', it.held !== null ? ' — attempt pending' : ''))));

  // bulk salvage
  const shownStash = rows.filter((it) => worn[it.id] === undefined).map((it) => it.id);
  const r = s.rule, num = (v) => (v === '' ? undefined : Number(v));
  const rule = () => ({ maxTier: r.maxTier, maxLevel: num(r.maxLevel), maxStar: r.maxStar === 'any' ? undefined : Number(r.maxStar), noSet: r.noSet });
  const ruleSel = (label, id, key, options) => h('label', null, `${label} `, h('select', { 'data-testid': id, onchange: (e) => { r[key] = e.target.value; ctx.rerender(); } }, options.map(([v, t]) => h('option', { value: String(v), selected: String(r[key]) === String(v) }, t))));
  const picked = [...s.picked], gain = yieldOf(save, content, picked), gainText = Object.entries(gain).map(([m, n]) => `${n} ${matName(m)}`).join(', ') || 'nothing';
  const doSalvage = () => {
    const res = ctx.bulkSalvage(picked);
    s.confirm = false;
    if (res.ok) { s.picked.clear(); ctx.say(`Salvaged ${picked.length} item${picked.length === 1 ? '' : 's'}: ${gainText}.`, 'ok'); } else ctx.say(res.message, 'bad');
  };
  const bulk = h('details', { class: 'bulk', open: s.picked.size > 0 || s.confirm },
    h('summary', null, `Salvage in bulk${s.picked.size ? ` (${s.picked.size} selected)` : ''}`),
    h('p', { class: 'hint' }, 'Tick items in the list, or select by rule among the stash items now shown. Worn items and items with a pending attempt are never selected by the rule.'),
    h('div', { class: 'filters' },
      ruleSel('Rarity up to', 'r-tier', 'maxTier', content.items.tiers.map((t) => [t.id, t.name])),
      h('label', null, 'Item level up to ', h('input', { type: 'number', min: 1, max: 99, value: r.maxLevel, 'data-testid': 'r-level', style: 'width:4.5rem', onchange: (e) => { r.maxLevel = e.target.value; ctx.rerender(); } })),
      ruleSel('Stars up to', 'r-star', 'maxStar', [['any', 'any'], ...[0, 1, 2, 3, 4, 5].map((n) => [n, String(n)])]),
      h('label', null, h('input', { type: 'checkbox', checked: r.noSet, 'data-testid': 'r-noset', onchange: (e) => { r.noSet = e.target.checked; ctx.rerender(); } }), ' keep set pieces')),
    h('div', { class: 'row-buttons' },
      button('Select matching', () => { const m = new Set(matching(save, rule())); s.picked = new Set(shownStash.filter((id) => m.has(id))); s.confirm = false; ctx.rerender(); }, { id: 'select-matching' }),
      button('Select all shown', () => { s.picked = new Set(shownStash); s.confirm = false; ctx.rerender(); }, { id: 'select-shown' }),
      button('Select none', () => { s.picked.clear(); s.confirm = false; ctx.rerender(); }, { id: 'select-none' })),
    h('p', { 'data-testid': 'bulk-preview' }, `${picked.length} selected: gives ${gainText}.`),
    s.confirm ? h('p', null, `Salvage ${picked.length} item${picked.length === 1 ? '' : 's'} for ${gainText}? This cannot be undone. `, button('Yes, salvage', doSalvage, { id: 'confirm-salvage' }), button('Cancel', () => { s.confirm = false; ctx.rerender(); }, { id: 'cancel-salvage' }))
      : button(`Salvage ${picked.length} selected…`, () => { s.confirm = true; ctx.rerender(); }, { id: 'salvage-selected', disabled: picked.length === 0, title: picked.length === 0 ? 'nothing is selected' : '' }));
  return h('div', null, controls, h('p', { class: 'hint' }, `${rows.length} of ${save.items.length} items shown.`), list, bulk);
}
