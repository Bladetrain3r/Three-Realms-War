// The runbook form: rules built from menus, so most mistakes cannot be typed; whatever is saved still goes through the
// validator, which gives the reason when it refuses. A raw-JSON box sits beside it for pasting and for experts.
import { h, clear } from './dom.js';
import { button } from './ui.js';
import { validateRunbook, setRunbook, kitOf } from '../sim/index.js';
import { clone } from '../sim/game.js';

const WORDS = {
  always: 'always', self_hp_below: 'my HP is below', self_hp_above: 'my HP is at or above', ally_hp_below: 'an ally is below', enemy_hp_below: 'an enemy is below',
  enemies_at_least: 'at least this many enemies', allies_alive_at_most: 'at most this many allies alive', self_has: 'I have', self_lacks: 'I lack', ally_lacks: 'an ally lacks',
  enemy_has: 'an enemy has', enemy_lacks: 'an enemy lacks', skill_ready: 'this skill is ready', round_at_least: 'round is at least', enemy_row_alive: 'an enemy stands in the', enemy_weak_to: 'an enemy is weak to',
};
const SEL = { lowest_hp_pct: 'lowest HP %', lowest_hp: 'lowest HP', highest_hp: 'highest HP', fastest: 'fastest', strongest: 'strongest', back_first: 'back row first', self: 'myself' };
const ACT = { skill: 'use a skill', basic: 'basic attack', brace: 'brace' };

export function runbookEditor(ctx, hero) {
  const { store, content } = ctx;
  const byId = Object.create(null); for (const it of store.save.items) byId[it.id] = it;
  const kit = kitOf(hero, byId, content);
  let rb = clone(hero.runbook);
  const root = h('div', { class: 'runbook', 'data-testid': 'runbook' });
  const msg = h('div', { class: 'msg', role: 'status', 'data-testid': 'runbook-msg' });
  const raw = h('textarea', { rows: 10, 'data-testid': 'runbook-json', spellcheck: 'false', 'aria-label': 'runbook as JSON' });

  const argValues = (type) => {
    const T = content.runbook.argTypes[type];
    if (T.values) return T.values.map((v) => [v, v]);
    if (T.of === 'statuses') return content.statuses.map((s) => [s.id, s.id]);
    if (T.of === 'skills') return kit.map((s) => [s, content.skillById[s].name]);
    const out = []; for (let v = T.min; v <= T.max; v += T.step || 1) out.push([v, T.step ? `${v}%` : `${v}`]);
    return out;
  };
  const defaultFor = (type) => { const v = argValues(type); return v.length ? v[0][0] : null; };
  const sel = (options, value, onchange, id, label) => h('select', { 'aria-label': label, 'data-testid': id, onchange }, options.map(([v, t]) => h('option', { value: String(v), selected: String(v) === String(value) }, t)));
  const parse = (type, s) => (typeof content.runbook.argTypes[type].min === 'number' ? Number(s) : s);

  const kindOf = (rule) => {
    if (rule.do.a === 'basic') return 'enemy';
    if (rule.do.a === 'skill') { const sk = content.skillById[rule.do.skill]; return sk && (sk.target === 'enemy' || sk.target === 'ally') ? sk.target : null; }
    return null;
  };
  const fixTarget = (rule) => {
    const kind = kindOf(rule);
    if (kind === null) { rule.target = null; return; }
    const ok = content.runbook.selectors.filter((s) => s.for.includes(kind)).map((s) => s.id);
    if (!ok.includes(rule.target)) rule.target = ok[0];
  };

  function clauseRow(rule, ci, ri) {
    const cl = rule.when[ci], def = content.runbook.conditions.find((x) => x.id === cl.c);
    const row = h('div', { class: 'clause' });
    row.append(sel(content.runbook.conditions.map((c) => [c.id, WORDS[c.id] || c.id]), cl.c, (e) => {
      const nd = content.runbook.conditions.find((x) => x.id === e.target.value), n = { c: nd.id };
      for (const [a, t] of Object.entries(nd.args)) n[a] = defaultFor(t);
      rule.when[ci] = n; draw();
    }, `cond-${ri}-${ci}`, `rule ${ri + 1} condition ${ci + 1}`));
    for (const [a, t] of Object.entries(def.args)) row.append(sel(argValues(t), cl[a], (e) => { cl[a] = parse(t, e.target.value); }, `arg-${ri}-${ci}-${a}`, `${a}`));
    if (rule.when.length > 1) row.append(button('−', () => { rule.when.splice(ci, 1); draw(); }, { title: 'remove this condition', id: `rm-clause-${ri}-${ci}` }));
    return row;
  }

  function ruleBox(rule, ri) {
    const box = h('fieldset', { class: 'rule', 'data-testid': `rule-${ri}` }, h('legend', null, `Rule ${ri + 1}`));
    const bar = h('div', { class: 'row-buttons' },
      button('▲', () => { [rb.rules[ri - 1], rb.rules[ri]] = [rb.rules[ri], rb.rules[ri - 1]]; draw(); }, { disabled: ri === 0, title: 'move up (rules are tried top to bottom)', id: `up-${ri}` }),
      button('▼', () => { [rb.rules[ri + 1], rb.rules[ri]] = [rb.rules[ri], rb.rules[ri + 1]]; draw(); }, { disabled: ri === rb.rules.length - 1, title: 'move down', id: `down-${ri}` }),
      button('Delete', () => { rb.rules.splice(ri, 1); draw(); }, { id: `del-${ri}` }));
    box.append(bar, h('div', { class: 'when' }, h('b', null, 'When'), rule.when.map((_, ci) => clauseRow(rule, ci, ri)),
      button('+ condition', () => { rule.when.push({ c: 'always' }); draw(); }, { disabled: rule.when.length >= content.runbook.maxClauses, title: rule.when.length >= content.runbook.maxClauses ? `at most ${content.runbook.maxClauses} conditions` : '', id: `add-clause-${ri}` })));
    const act = h('div', { class: 'do' }, h('b', null, 'Do'));
    act.append(sel(content.runbook.actions.map((a) => [a.id, ACT[a.id]]), rule.do.a, (e) => {
      rule.do = e.target.value === 'skill' ? { a: 'skill', skill: kit[0] } : { a: e.target.value }; fixTarget(rule); draw();
    }, `action-${ri}`, `rule ${ri + 1} action`));
    if (rule.do.a === 'skill') act.append(sel(argValues('skill'), rule.do.skill, (e) => { rule.do.skill = e.target.value; fixTarget(rule); draw(); }, `skill-${ri}`, `rule ${ri + 1} skill`));
    const kind = kindOf(rule);
    if (kind) {
      const opts = content.runbook.selectors.filter((s) => s.for.includes(kind)).map((s) => [s.id, SEL[s.id] || s.id]);
      act.append(h('span', null, `on the ${kind} with`), sel(opts, rule.target, (e) => { rule.target = e.target.value; }, `target-${ri}`, `rule ${ri + 1} target`));
    }
    box.append(act);
    return box;
  }

  function say(text, kind, list) {
    clear(msg); msg.className = `msg ${kind}`; msg.append(h('p', null, text));
    if (list && list.length) msg.append(h('ul', null, list.map((e) => h('li', null, `${e.code ? e.code + ': ' : ''}${e.message}`))));
  }
  function draw() {
    clear(root);
    root.append(h('p', { class: 'hint' }, 'Rules are tried from the top; the first whose conditions all hold is used. If none holds the hero attacks.'),
      ...rb.rules.map(ruleBox),
      h('div', { class: 'row-buttons' },
        button('+ rule', () => { rb.rules.push({ when: [{ c: 'always' }], do: { a: 'basic' }, target: 'lowest_hp' }); draw(); }, { disabled: rb.rules.length >= content.runbook.maxRules, title: rb.rules.length >= content.runbook.maxRules ? `at most ${content.runbook.maxRules} rules` : '', id: 'add-rule' }),
        button('Check', () => { const v = validateRunbook(rb, kit, content); v.ok ? say('This runbook is valid.', 'ok') : say('This runbook is refused:', 'bad', v.errors); }, { id: 'check-runbook' }),
        button('Save runbook', () => save(rb), { class: 'primary', id: 'save-runbook' }),
        button('Revert', () => { rb = clone(store.save.heroes.find((x) => x.id === hero.id).runbook); say('Reverted to the saved runbook.', 'ok'); draw(); }, { id: 'revert-runbook' })),
      msg,
      h('details', { open: false }, h('summary', null, 'Raw JSON'),
        raw, h('div', { class: 'row-buttons' },
          button('Show form as JSON', () => { raw.value = JSON.stringify(rb, null, 1); }, { id: 'show-json' }),
          button('Apply JSON', () => applyJson(raw.value), { id: 'apply-json' }))));
  }
  function save(book) {
    const r = ctx.attempt(setRunbook, hero.id, book);
    if (r.ok) ctx.say('Runbook saved.', 'ok'); else say(`Refused: ${r.message}`, 'bad', r.details);
    return r;
  }
  function applyJson(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { say('Refused: this is not valid JSON.', 'bad', [{ code: 'E01', message: 'not valid JSON' }]); return; }
    save(parsed);
  }
  draw();
  return root;
}
