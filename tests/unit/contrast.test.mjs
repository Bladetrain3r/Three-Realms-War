import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('client/style.css', 'utf8');
const token = (name) => { const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css); assert.ok(m, `--${name} missing from style.css`); return m[1].toLowerCase(); };
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('contrast: the palette tokens in style.css are the ones DESIGN section 16 names', () => {
  const design = readFileSync('DESIGN.md', 'utf8');
  for (const [name, hex] of [['vellum', '#e9dcb9'], ['vellum-shade', '#cdb98a'], ['walnut', '#2a1d12'], ['umber', '#5b3a1e'], ['midgard', '#b8442a'], ['asgard', '#c8962e'], ['helheim', '#4d8c88'], ['hp', '#9e2b25']]) {
    assert.equal(token(name), hex, name); assert.ok(design.includes(hex), `${hex} is not in DESIGN.md`);
  }
});

test('contrast: every text and background pair the stylesheet uses reaches WCAG 4.5:1', () => {
  const pairs = [
    ['walnut', 'vellum', 'body text'], ['walnut', 'vellum-shade', 'text on panels and selected rows'], ['umber', 'vellum', 'hints'], ['umber', 'vellum-shade', 'hints on shaded panels'],
    ['vellum', 'walnut', 'buttons and the current tab'], ['warn', 'vellum', 'warnings and refusals'], ['warn', 'vellum-shade', 'a bad notice'], ['heal', 'vellum', 'ok messages'], ['heal', 'vellum-shade', 'an ok notice'],
  ];
  for (const [fg, bg, what] of pairs) { const r = ratio(token(fg), token(bg)); assert.ok(r >= 4.5, `${what}: ${fg} on ${bg} is ${r.toFixed(2)}:1`); }
});

test('contrast: the check can fail (a pale grey on vellum is refused by the same arithmetic)', () => {
  assert.ok(ratio('#aaaaaa', token('vellum')) < 4.5);
  assert.ok(ratio('#000000', '#ffffff') > 20.9 && ratio('#000000', '#ffffff') < 21.1);
});
