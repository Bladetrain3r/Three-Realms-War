// A reader for the small YAML subset used by checks/balance.yaml: nested maps by two-space indentation, `key: value`,
// flow lists `[a, b]`, scalars (integers, decimals, true/false, null, bare or quoted strings), and # comments. Nothing else.
// Anything outside the subset is refused with its line number, so a typo cannot silently become data.

function scalar(text, line) {
  const t = text.trim();
  if (t === '') throw new Error(`line ${line}: empty value`);
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t)) return t.slice(1, -1);
  if (/^[A-Za-z_][A-Za-z0-9_.\-]*$/.test(t)) return t;
  throw new Error(`line ${line}: cannot read value "${t}"`);
}

function flowList(text, line) {
  const t = text.trim();
  if (!t.endsWith(']')) throw new Error(`line ${line}: unterminated list`);
  const inner = t.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((x) => scalar(x, line));
}

function stripComment(raw) {
  let out = '', q = null;
  for (const c of raw) {
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '#') break;
    out += c;
  }
  return out.replace(/\s+$/, '');
}

export function parseYaml(text) {
  const rows = [];
  text.split('\n').forEach((raw, i) => {
    if (raw.includes('\t')) throw new Error(`line ${i + 1}: tabs are not allowed`);
    const body = stripComment(raw);
    if (body.trim() === '') return;
    const indent = body.length - body.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`line ${i + 1}: indentation must be a multiple of two spaces`);
    rows.push({ indent, text: body.trim(), line: i + 1 });
  });
  const root = {}, stack = [{ indent: -1, obj: root }];
  for (const r of rows) {
    const m = /^([A-Za-z_][A-Za-z0-9_.\-]*):(?:\s+(.*))?$/.exec(r.text);
    if (!m) throw new Error(`line ${r.line}: expected "key: value" or "key:", got "${r.text}"`);
    while (stack.length > 1 && stack[stack.length - 1].indent >= r.indent) stack.pop();
    const top = stack[stack.length - 1];
    if (r.indent > top.indent + 2 && top.indent !== -1) throw new Error(`line ${r.line}: indented too far`);
    if (Object.prototype.hasOwnProperty.call(top.obj, m[1])) throw new Error(`line ${r.line}: duplicate key "${m[1]}"`);
    if (m[2] === undefined) {
      const child = {};
      top.obj[m[1]] = child;
      stack.push({ indent: r.indent, obj: child });
    } else top.obj[m[1]] = m[2].trim().startsWith('[') ? flowList(m[2], r.line) : scalar(m[2], r.line);
  }
  return root;
}
