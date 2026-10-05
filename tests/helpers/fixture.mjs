// Real saves from playtests, read as the client reads them (additive defaults filled in).
import { readFileSync } from 'node:fs';
import { fillDefaults } from '../../sim/save.js';

export const loadFixture = (name) => fillDefaults(JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')));
