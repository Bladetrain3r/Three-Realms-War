// Forge: upgrade with the mulligan, salvage, and Threads of the Norns.
import { h } from '../dom.js';
import { panel, kv, button } from '../ui.js';
import { upgradeAttempt, acceptAttempt, undoAttempt, salvage, buyThread } from '../../sim/index.js';
import { wornIds } from '../../sim/game.js';
import { upgradeCost, salvageValue } from '../../sim/items.js';
import { itemLine, itemTitle, itemMainText, itemLineTexts, itemSetText, pct, stars, matName } from '../format.js';

let selected = null, filter = 'all';

export function forge(ctx) {
  const { store, content } = ctx, save = store.save, worn = wornIds(save);
  const items = save.items.filter((it) => filter === 'all' || (filter === 'worn') === (worn[it.id] !== undefined));
  if (selected !== null && !save.items.some((x) => x.id === selected)) selected = null;
  const heroName = (id) => save.heroes.find((x) => x.id === id).name;

  const list = h('ul', { class: 'items', 'data-testid': 'item-list' }, items.map((it) => h('li', { class: it.id === selected ? 'sel' : '' },
    h('button', { type: 'button', 'data-testid': `item-${it.id}`, onclick: () => { selected = it.id; ctx.rerender(); } }, itemLine(it, content), worn[it.id] !== undefined ? ` — worn by ${heroName(worn[it.id])}` : '', it.held !== null ? ' — attempt pending' : ''))));

  const filt = h('select', { 'aria-label': 'filter items', 'data-testid': 'item-filter', onchange: (e) => { filter = e.target.value; ctx.rerender(); } },
    [['all', 'All items'], ['stash', 'Stash'], ['worn', 'Worn']].map(([v, t]) => h('option', { value: v, selected: filter === v }, t)));

  let detail = h('p', { class: 'hint' }, 'Choose an item to upgrade or salvage.');
  if (selected !== null) {
    const it = save.items.find((x) => x.id === selected), tier = content.tierById[it.tier], realm = content.realmById[it.realm], cost = upgradeCost(it, content);
    const odds = it.star < tier.maxStar ? content.items.starSuccessBp[it.star] : 0;
    const have = save.materials[realm.material], haveRare = save.materials[realm.rareMaterial];
    const why = it.held !== null ? 'accept or undo the pending attempt first' : it.star >= tier.maxStar ? `a ${tier.name} item stops at ${tier.maxStar} stars`
      : have < cost.common || haveRare < cost.rare ? `needs ${cost.common} ${matName(realm.material)}${cost.rare ? ` and ${cost.rare} ${matName(realm.rareMaterial)}` : ''} (you have ${have}${cost.rare ? ` and ${haveRare}` : ''})` : '';
    const pending = it.held !== null ? h('div', { class: 'pending', 'data-testid': 'pending' }, h('h3', null, it.star > it.heldStar ? `Success: ${stars(it.heldStar, tier.maxStar)} → ${stars(it.star, tier.maxStar)}` : 'No star gained'),
      h('p', null, 'Bonus lines were rerolled.'), h('p', null, 'Before: ', it.held.length ? it.held.map(([k, raw]) => `${raw / 100}% ${content.items.lines[k].id}`).join(', ') : 'none (a Plain item has no lines)'), h('p', null, 'Now: ', itemLineTexts(it, content).join(', ') || 'none'),
      h('div', { class: 'row-buttons' }, button('Keep this', () => ctx.run(acceptAttempt, it.id), { id: 'accept' }),
        button('Undo (mulligan)', () => ctx.run(undoAttempt, it.id), { disabled: it.mulligan < 1, title: it.mulligan < 1 ? 'the mulligan for this star is spent' : 'restore the old lines; the materials are not refunded', id: 'undo' }))) : null;
    detail = h('div', { class: 'item-detail', 'data-testid': 'item-detail' },
      h('h3', null, itemTitle(it, content)),
      kv([['Item level', it.ilvl], ['Stars', `${stars(it.star, tier.maxStar)} (${it.star} of ${tier.maxStar})`], ['Main', itemMainText(it, content)], ['Bonus lines', itemLineTexts(it, content).join(', ') || 'none'], ['Set', itemSetText(it, content) || 'none'],
        ['Worn by', worn[it.id] !== undefined ? heroName(worn[it.id]) : 'nobody (stash)']]),
      it.star < tier.maxStar ? h('p', null, `Next attempt: ${pct(odds)} to gain a star, costs ${cost.common} ${matName(realm.material)}${cost.rare ? ` + ${cost.rare} ${matName(realm.rareMaterial)}` : ''}. Every attempt costs, success or not.`) : h('p', null, 'At the top star for its tier.'),
      pending,
      h('div', { class: 'row-buttons' }, button('Upgrade', () => ctx.run(upgradeAttempt, it.id), { disabled: Boolean(why), title: why, id: 'upgrade' }),
        button(`Salvage (+${salvageValue(it)} ${matName(realm.material)})`, () => ctx.run(salvage, it.id), { disabled: worn[it.id] !== undefined, title: worn[it.id] !== undefined ? 'take the item off first' : '', id: 'salvage' })),
      why ? h('small', { class: 'why' }, why) : null);
  }

  const mats = kv([...content.realms.flatMap((r) => [[r.material.replace(/_/g, ' '), save.materials[r.material]], [r.rareMaterial.replace(/_/g, ' '), save.materials[r.rareMaterial]]]), ['hacksilver', save.currency.hacksilver], ['Threads of the Norns', save.threads]]);
  const threads = h('div', { class: 'row-buttons' }, content.realms.map((r) => {
    const need = content.tables.progress.threadHearts, rep = content.tables.progress.rep.honoured;
    const why = save.reputation[r.id] < rep ? `needs ${rep} reputation in ${r.name} (you have ${save.reputation[r.id]})` : save.materials[r.rareMaterial] < need ? `costs ${need} ${r.rareMaterial.replace(/_/g, ' ')} (you have ${save.materials[r.rareMaterial]})` : '';
    return button(`Buy (${r.name})`, () => ctx.run(buyThread, r.id), { disabled: Boolean(why), title: why, id: `thread-${r.id}` });
  }));

  return h('div', { class: 'screen forge' }, h('h1', null, 'The Forge'),
    h('div', { class: 'two' }, panel('Items', filt, list), panel('Upgrade', detail)),
    h('div', { class: 'two' }, panel('Materials', mats), panel('Threads of the Norns', h('p', { class: 'hint' }, 'A Thread, bound to one hero (in the Hero screen), saves them once from permanent death and is then used up. It does nothing for injuries. Hearts and reputation buy them.'), threads)));
}
