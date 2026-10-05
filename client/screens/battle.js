// Battle: plays the last delve's replay (1x, 4x, skip), keeps a text log beside it, and shows what the delve earned.
import { h, clear, download } from '../dom.js';
import { panel, button } from '../ui.js';
import { BattleView } from '../battle-view.js';
import { serializeReplay } from '../../sim/index.js';
import { itemLine, matName } from '../format.js';

export function battle(ctx) {
  const { store, content } = ctx, lb = store.lastBattle;
  if (!lb) return h('div', { class: 'screen' }, h('h1', null, 'The Battle'), h('p', null, 'No delve has been run yet. ', h('a', { href: '#/delve' }, 'Go to the Delve Board.')));
  const bg = h('canvas', { class: 'battle-canvas bg', 'aria-hidden': 'true' });
  const canvas = h('canvas', { class: 'battle-canvas fg', 'data-testid': 'battle-canvas', role: 'img', 'aria-label': 'the battle' });
  const stage = h('div', { class: 'stage' }, bg, canvas);
  const log = h('ol', { class: 'log', 'data-testid': 'log', 'aria-live': 'off' });
  const status = h('p', { class: 'hint', 'data-testid': 'battle-status' }, 'Painting the scene…');
  const summary = h('div', { 'data-testid': 'summary' });
  const units = h('div', { class: 'units', 'data-testid': 'units' }); // plain-text status of every unit: the canvas text is small on a phone
  const drawUnits = () => {
    clear(units);
    for (const side of ['hero', 'foe']) units.append(h('ul', { class: `unit-list ${side}`, 'aria-label': side === 'hero' ? 'your party' : 'the enemy' }, view.state.units.filter((u) => u.present && u.side === side).map((u) => h('li', { class: u.alive ? '' : 'down' },
      h('b', null, u.name), ` ${u.hp}/${u.maxHp}`, u.alive ? '' : ' (down)', Object.keys(u.statuses).length ? ` [${Object.entries(u.statuses).map(([k, d]) => `${k} ${d}`).join(', ')}]` : ''))));
  };
  const reduced = ctx.reducedMotion();
  const view = new BattleView(canvas, lb.replay, content, { reduced, bg });
  ctx.battle = view;

  const batch = store.lastBatch;
  const batchPanel = batch && batch.runs.length > 1 ? (() => {
    const t = batch.totals, why = { done: `all ${batch.requested} delves were run`, lost: 'it stopped after a lost delve', injury: 'it stopped because a party hero is injured', stopped: 'you stopped it' }[batch.stopped];
    const mats = Object.entries(t.materials).map(([id, n]) => `${n} ${matName(id)}`).join(', ');
    return panel(`Batch: ${t.delves} of ${batch.requested} delves`, h('p', { 'data-testid': 'batch-summary' }, `${t.wins} won; ${why}.`),
      h('ul', { class: 'earned' }, h('li', null, `${t.xp} XP to each party member in total`), h('li', null, `${t.hacksilver} hacksilver`), mats ? h('li', null, mats) : null, h('li', null, `${t.reputation} reputation`),
        t.items ? h('li', null, `${t.items} item${t.items === 1 ? '' : 's'} found`) : null, t.droppedItems ? h('li', { class: 'warn' }, `${t.droppedItems} lost: the stash was full`) : null, t.threads ? h('li', null, `${t.threads} Thread of the Norns`) : null,
        t.unlocked ? h('li', null, `Level ${t.unlocked.level} of ${content.realmById[t.unlocked.realm].name} is now open`) : null),
      t.levelUps.length ? h('p', null, 'Level ups: ', t.levelUps.map((l) => `${l.name} ${l.from}\u2192${l.to}`).join(', ')) : null,
      h('label', null, 'Watch run ', h('select', { 'data-testid': 'run-select', onchange: (e) => { store.selectRun(Number(e.target.value)); ctx.rerender(); } },
        batch.runs.map((r, i) => h('option', { value: String(i), selected: batch.index === i }, `${i + 1}: ${r.summary.outcome === 1 ? 'won' : 'lost'}`)))));
  })() : null;
  const names = (ids) => ids.map((id) => store.save.heroes.find((x) => x.id === id)).filter(Boolean).map((x) => x.name).join(', ');
  const floorSummary = () => {
    const s = lb.summary;
    clear(summary);
    summary.append(h('h2', null, s.outcome === 1 ? `Floor ${s.floor} cleared` : 'The party was lost'),
      s.outcome === 1 ? h('p', null, s.cleared ? 'The boss is down: the site is cleared.' : `${s.floors - s.floor} floor${s.floors - s.floor === 1 ? '' : 's'} remain. Descend, or retreat to the map.`) : h('p', { class: 'warn' }, 'Everyone who was not held back by a Thread is lost for good, and the pack with them.'));
    if (s.rewards) summary.append(h('ul', { class: 'earned' }, h('li', null, `Added to the pack: ${s.rewards.xp} XP, ${s.rewards.hacksilver} hacksilver, ${s.rewards.materials} common materials${s.rewards.heart ? `, ${s.rewards.heart} heart` : ''}`), s.rewards.items ? h('li', null, `${s.rewards.items} item${s.rewards.items === 1 ? '' : 's'} found`) : null, s.rewards.threads ? h('li', null, `${s.rewards.threads} Thread of the Norns`) : null, s.rewards.paragon ? h('li', null, `${s.rewards.paragon} Paragon Point${s.rewards.paragon === 1 ? '' : 's'}`) : null));
    if (s.died.length) summary.append(h('p', { class: 'warn', 'data-testid': 'x-died' }, `Lost for good: ${s.died.join(', ')}`));
    if (s.injured.length) summary.append(h('p', { class: 'warn' }, `Wounded and revived at 1 HP: ${names(s.injured)}`));
    if (s.threaded.length) summary.append(h('p', null, `Held back from death by a Thread of the Norns: ${names(s.threaded)}`));
    if (s.rescued) summary.append(h('p', null, 'The hall took in one new level-1 hero so you are never left without one.'));
    if (s.lostGear) summary.append(h('p', { class: 'warn' }, `${s.lostGear} piece${s.lostGear === 1 ? '' : 's'} of gear were lost: the stash was full.`));
    summary.append(h('p', { class: 'row-buttons' }, button('Back to the map', () => { location.hash = '#/expedition'; }, { id: 'to-map', class: 'primary' })));
  };
  const showSummary = () => {
    if (lb.kind === 'floor') return floorSummary();
    const s = lb.summary, after = store.save;
    clear(summary);
    summary.append(h('h2', null, s.outcome === 1 ? 'Delve won' : 'Delve lost'), h('p', null, `${s.cleared} of ${s.encounters} encounters cleared.`));
    if (s.outcome === 1) {
      summary.append(h('ul', { class: 'earned' },
        h('li', null, `${s.xp} XP to each party member`), h('li', null, `${s.hacksilver} hacksilver`),
        ...s.materials.map((m) => h('li', null, `${m.n} ${m.id.replace(/_/g, ' ')}`)), h('li', null, `${s.reputation} reputation`),
        ...s.items.map((id) => { const it = after.items.find((x) => x.id === id); return it ? h('li', null, `Found: ${itemLine(it, content)}`) : null; }),
        s.droppedItems ? h('li', { class: 'warn' }, `${s.droppedItems} item${s.droppedItems === 1 ? '' : 's'} lost: the stash is full`) : null,
        s.threads ? h('li', null, `${s.threads} Thread of the Norns`) : null,
        s.unlocked ? h('li', null, `Level ${s.unlocked.level} of ${content.realmById[s.unlocked.realm].name} is now open`) : null));
    }
    if (s.levelUps.length) summary.append(h('p', null, 'Level up: ', s.levelUps.map((l) => `${l.name} ${l.from}→${l.to}`).join(', ')));
    if (s.injured.length) summary.append(h('p', { class: 'warn' }, `Injured: ${names(s.injured)}`));
    if (s.healed.length) summary.append(h('p', null, `Recovered: ${names(s.healed)}`));
    summary.append(h('p', { class: 'row-buttons' }, button('Back to the board', () => { location.hash = '#/delve'; }, { id: 'to-board' }), button('To the Hall', () => { location.hash = '#/hall'; }, { id: 'to-hall' })));
  };
  let shown = 0, summarised = false;
  view.onChange = () => {
    drawUnits();
    for (; shown < view.state.log.length; shown++) log.append(h('li', null, view.state.log[shown].text));
    if (shown > 0) log.lastChild.scrollIntoView && log.scrollTo && log.scrollTo(0, log.scrollHeight);
    if (view.done && !summarised) { summarised = true; showSummary(); status.textContent = 'Finished.'; }
    if (!view.done) summarised = false;
  };
  const controls = h('div', { class: 'row-buttons controls' },
    button('Play', () => { view.play(view.speed); status.textContent = `Playing at ${view.speed}×`; }, { id: 'play' }),
    button('Pause', () => { view.pause(); status.textContent = 'Paused'; }, { id: 'pause' }),
    button('1×', () => view.play(1), { id: 'speed-1' }), button('4×', () => view.play(4), { id: 'speed-4' }),
    button('Skip to the end', () => view.skip(), { id: 'skip' }),
    button('Watch again', () => { shown = 0; clear(log); summarised = false; clear(summary); status.textContent = 'Playing'; view.restart(); }, { id: 'again' }),
    button('Save replay file', () => download(`three-realms-replay-${lb.replay.hash.slice(0, 12)}.json`, serializeReplay(lb.replay)), { id: 'export-replay' }));

  let last = null;
  const frame = (t) => {
    if (!canvas.isConnected) return; // left the screen
    view.tick(last === null ? 0 : Math.min(100, t - last)); last = t; view.draw(view.clock);
    requestAnimationFrame(frame);
  };
  view.ready.then(() => {
    if (!canvas.isConnected) return;
    if (reduced) { view.skip(); status.textContent = 'Reduced motion is on: showing the finished battle and the log.'; } else { view.play(1); status.textContent = 'Playing at 1×'; }
    requestAnimationFrame(frame); view.draw(view.clock); view.onChange();
  });
  return h('div', { class: 'screen battle' }, h('h1', null, `${content.realmById[lb.replay.inputs.realm].dungeon} — level ${lb.replay.inputs.level}`),
    batchPanel, stage, units, status, controls, summary, panel('Log', log),
    h('p', { class: 'hint hash', 'data-testid': 'replay-hash' }, `Replay hash ${lb.replay.hash}`));
}
