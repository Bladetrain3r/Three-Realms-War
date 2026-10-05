// Runbook validation (DESIGN.md 9.4). Refusals carry a code (E01 to E09), the rule number from 1, and a reason.

const KEYS_RULE = ['when', 'do', 'target'];

function err(errors, code, rule, message) { errors.push({ code, rule, message }); }
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const extraKeys = (o, allowed) => Object.keys(o).filter((k) => !allowed.includes(k));

function checkArg(errors, rule, name, value, type, kit, content) {
  const where = `rule ${rule}: argument "${name}"`;
  const T = content.runbook.argTypes[type];
  if (T.values) {
    if (typeof value !== 'string' || !T.values.includes(value)) err(errors, 'E06', rule, `${where} must be one of ${T.values.join(', ')}`);
    return;
  }
  if (T.of === 'statuses') {
    if (typeof value !== 'string' || !content.statusById[value]) err(errors, 'E06', rule, `${where} is not a known status`);
    return;
  }
  if (T.of === 'skills') {
    if (typeof value !== 'string' || !content.skillById[value]) err(errors, 'E06', rule, `${where} is not a known skill`);
    else if (!kit.includes(value)) err(errors, 'E07', rule, `${where}: "${value}" is not in this hero's kit`);
    return;
  }
  if (!Number.isInteger(value) || value < T.min || value > T.max || (T.step && value % T.step !== 0)) {
    err(errors, 'E05', rule, `${where} must be an integer from ${T.min} to ${T.max}${T.step ? ` in steps of ${T.step}` : ''}`);
  }
}

// input: JSON text or a parsed object. kit: the skill ids the hero may use (class skills plus granted set skills).
export function validateRunbook(input, kit, content) {
  const errors = [];
  let rb = input;
  if (typeof input === 'string') {
    try { rb = JSON.parse(input); } catch (e) { return { ok: false, errors: [{ code: 'E01', rule: 0, message: 'not valid JSON' }] }; }
  }
  if (!isObj(rb) || rb.v !== content.runbook.version || !Array.isArray(rb.rules)) {
    return { ok: false, errors: [{ code: 'E01', rule: 0, message: 'a runbook is an object {"v":1,"rules":[...]}' }] };
  }
  for (const k of extraKeys(rb, ['v', 'rules'])) err(errors, 'E09', 0, `unknown field "${k}"`);
  if (rb.rules.length > content.runbook.maxRules) err(errors, 'E02', 0, `more than ${content.runbook.maxRules} rules`);

  rb.rules.forEach((rule, idx) => {
    const n = idx + 1;
    if (!isObj(rule)) return err(errors, 'E09', n, `rule ${n} must be an object`);
    for (const k of extraKeys(rule, KEYS_RULE)) err(errors, 'E09', n, `rule ${n}: unknown field "${k}"`);
    if (!Array.isArray(rule.when) || rule.when.length < 1 || rule.when.length > content.runbook.maxClauses) {
      err(errors, 'E03', n, `rule ${n}: "when" needs 1 to ${content.runbook.maxClauses} clauses`);
    } else {
      for (const cl of rule.when) {
        if (!isObj(cl) || typeof cl.c !== 'string') { err(errors, 'E04', n, `rule ${n}: a clause needs a "c" condition id`); continue; }
        const def = content.runbook.conditions.find((x) => x.id === cl.c);
        if (!def) { err(errors, 'E04', n, `rule ${n}: unknown condition "${cl.c}"`); continue; }
        const argNames = Object.keys(def.args);
        for (const k of extraKeys(cl, ['c', ...argNames])) err(errors, 'E09', n, `rule ${n}: unknown field "${k}" on condition ${cl.c}`);
        for (const a of argNames) {
          if (cl[a] === undefined) err(errors, 'E05', n, `rule ${n}: condition ${cl.c} needs argument "${a}"`);
          else checkArg(errors, n, a, cl[a], def.args[a], kit, content);
        }
      }
    }
    const a = rule.do;
    if (!isObj(a) || typeof a.a !== 'string') return err(errors, 'E04', n, `rule ${n}: "do" needs an action id`);
    const adef = content.runbook.actions.find((x) => x.id === a.a);
    if (!adef) return err(errors, 'E04', n, `rule ${n}: unknown action "${a.a}"`);
    for (const k of extraKeys(a, ['a', ...Object.keys(adef.args)])) err(errors, 'E09', n, `rule ${n}: unknown field "${k}" on action ${a.a}`);
    let kind = a.a === 'basic' ? 'enemy' : null; // what the target selector must be valid for
    let skillOk = true; // a bad skill is reported once; its selector cannot be judged
    if (a.a === 'skill') {
      if (a.skill === undefined) { err(errors, 'E05', n, `rule ${n}: action skill needs argument "skill"`); skillOk = false; }
      else {
        const before = errors.length;
        checkArg(errors, n, 'skill', a.skill, 'skill', kit, content);
        skillOk = errors.length === before;
        const sk = content.skillById[a.skill];
        if (skillOk && (sk.target === 'enemy' || sk.target === 'ally')) kind = sk.target;
      }
    }
    if (!skillOk) return;
    if (kind === null) {
      if (rule.target !== null) err(errors, 'E08', n, `rule ${n}: this action takes no target selector (use null)`);
    } else {
      const sel = content.runbook.selectors.find((x) => x.id === rule.target);
      if (!sel) err(errors, 'E08', n, `rule ${n}: "${rule.target}" is not a selector`);
      else if (!sel.for.includes(kind)) err(errors, 'E08', n, `rule ${n}: selector "${rule.target}" is not valid for a ${kind} target`);
    }
  });
  return { ok: errors.length === 0, errors };
}
