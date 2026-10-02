// Boot: load and validate the content, run the on-device engine check, open the save, draw the first screen.
import { contentTexts, schemaTexts } from 'virtual:content';
import { loadContent } from '../sim/contentcheck.js';
import { engineCheck } from './engine-check.js';
import { createStore } from './store.js';
import { mountApp } from './app.js';

const root = document.getElementById('app');
const buildMeta = document.querySelector('meta[name="build"]'), build = buildMeta ? buildMeta.content : 'dev';
try {
  const content = loadContent(contentTexts, schemaTexts), saveSchema = JSON.parse(schemaTexts.save), check = engineCheck(content);
  let storage = null;
  try { storage = window.localStorage; storage.getItem('three-realms.probe'); } catch (e) { storage = null; }
  const store = createStore({
    content, saveSchema, build, storage, now: () => new Date().toISOString(),
    seed: () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; },
  });
  root.textContent = '';
  const app = mountApp({ root, store, content, build, engineCheck: check, storage });
  window.ThreeRealms = {
    ready: true, build, engineCheck: check, route: app.route, idle: app.idle, timeFrames: app.timeFrames, battleState: app.battleState,
    save: () => structuredClone(store.save), exportText: () => store.exportText(), stored: !!storage,
  };
} catch (e) {
  root.textContent = `The game could not start: ${e.message}`;
  window.ThreeRealms = { error: String(e.message), ready: true };
}
