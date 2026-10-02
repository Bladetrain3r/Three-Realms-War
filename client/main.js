// Boot. (R17 skeleton: loads and validates the content, runs the engine check. The screens arrive in later rounds.)
import { contentTexts, schemaTexts } from 'virtual:content';
import { loadContent } from '../sim/contentcheck.js';
import { engineCheck } from './engine-check.js';

const out = document.getElementById('status');
try {
  const content = loadContent(contentTexts, schemaTexts);
  const check = engineCheck(content);
  out.textContent = `Three Realms: ${content.heroes.length} classes, ${content.roster.length} monsters loaded. Engine check ${check.ok ? 'passed' : 'FAILED'} (${check.actual.slice(0, 12)}).`;
  window.ThreeRealms = { engineCheck: check, ready: true };
} catch (e) {
  out.textContent = `The game could not start: ${e.message}`;
  window.ThreeRealms = { error: String(e.message), ready: true };
}
