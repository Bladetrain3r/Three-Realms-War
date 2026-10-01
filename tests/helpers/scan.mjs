// A static scan of sim/ source for constructs that can break determinism (DESIGN.md section 3, "Banned in sim/").

// Replace comments and string/template contents with spaces so patterns only match real code.
export function stripCode(src) {
  let out = '', i = 0;
  const stack = []; // template-literal nesting: 'tpl' while inside the text part, 'expr' inside ${ }
  const blank = (c) => (c === '\n' ? '\n' : ' ');
  while (i < src.length) {
    const c = src[i], n = src[i + 1], top = stack[stack.length - 1];
    if (top === 'tpl') {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === '`') { stack.pop(); out += ' '; i++; continue; }
      if (c === '$' && n === '{') { stack.push('expr'); out += '  '; i += 2; continue; }
      out += blank(c); i++; continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; for (; i < end; i++) out += blank(src[i]); continue; }
    if (c === '"' || c === "'") {
      out += ' '; i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') { out += '  '; i += 2; } else { out += blank(src[i]); i++; } }
      out += ' '; i++; continue;
    }
    if (c === '`') { stack.push('tpl'); out += ' '; i++; continue; }
    if (top === 'expr') {
      if (c === '{') { stack.push('expr'); }
      if (c === '}') { stack.pop(); if (stack[stack.length - 1] === 'tpl') { out += ' '; i++; continue; } }
    }
    out += c; i++;
  }
  return out;
}

const RULES = [
  ['random or clock or timers', /\bMath\.random\b|\bDate\b|\bperformance\b|\bsetTimeout\b|\bsetInterval\b|\bsetImmediate\b|\bqueueMicrotask\b|\brequestAnimationFrame\b/],
  ['node, DOM or storage globals', /\bprocess\b|\brequire\b|\bglobalThis\b|\bwindow\b|\bdocument\b|\bnavigator\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\b|\bXMLHttpRequest\b|\bcrypto\b|\bBuffer\b/],
  ['dynamic import', /\bimport\s*\(/],
  ['floating-point or locale Math', /\bMath\.(round|floor|ceil|trunc|sqrt|cbrt|pow|exp\w*|log\w*|sin\w*|cos\w*|tan\w*|atan\w*|asin\w*|acos\w*|hypot|fround|sign)\b|\bparseFloat\b|\btoFixed\b|\btoLocale\w*|\bIntl\b/],
  ['for-in loop', /\bfor\s*\(\s*(?:const|let|var)?\s*[\w$]+\s+in\s/],
  ['Map or Set (iterable, order-dependent; WeakMap cannot be iterated and is allowed)', /\bMap\b|\bSet\b/],
  ['decimal literal', /(?<![\w.])\d+\.\d+/],
];
// Allowed only in these files, which were reviewed: canonical JSON sorts keys; the validators walk parsed external JSON
// and only report errors (their key order is the file's, never an input to the simulation).
const OBJECT_ITERATION_OK = ['canon.js', 'runbook.js', 'schema.js', 'contentcheck.js'];
// .sort( is allowed only where the comparator is a reviewed total order.
const SORT_OK = ['canon.js', 'combat.js'];

export function scanSource(file, src) {
  const code = stripCode(src), found = [];
  const line = (idx) => code.slice(0, idx).split('\n').length;
  for (const [name, re] of RULES) { const m = re.exec(code); if (m) found.push(`${file}:${line(m.index)} ${name}: ${m[0]}`); }
  if (!OBJECT_ITERATION_OK.includes(file)) { const m = /\bObject\.(keys|values|entries)\b/.exec(code); if (m) found.push(`${file}:${line(m.index)} object iteration: ${m[0]}`); }
  { const m = /\.sort\(\s*\)/.exec(code); if (m) found.push(`${file}:${line(m.index)} sort without a comparator`); }
  if (!SORT_OK.includes(file)) { const m = /\.sort\(/.exec(code); if (m) found.push(`${file}:${line(m.index)} unreviewed sort`); }
  if (file !== 'arith.js') { const m = /\//.exec(code); if (m) found.push(`${file}:${line(m.index)} division or regex outside arith.js`); }
  for (const m of src.matchAll(/^\s*(?:import|export)[^\n]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
    if (!m[1].startsWith('./')) found.push(`${file} import of a non-local module: ${m[1]}`);
  }
  return found;
}
