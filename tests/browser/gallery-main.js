// Art gallery entry (bundled for the browser by shoot-gallery.mjs). Exposes the art engine on window.Art for screenshots and tests.
import { createRng } from '../../sim/prng.js';
import { loadContent } from '../../sim/contentcheck.js';
import { contentTexts, schemaTexts } from 'virtual:content';
import * as figures from '../../client/art/figures.js';
import * as paper from '../../client/art/paper.js';
import * as backdrop from '../../client/art/backdrop.js';
import * as woodcut from '../../client/art/woodcut.js';
import * as runes from '../../client/art/runes.js';
import { Art as ArtIndex } from '../../client/art/index.js';

const content = loadContent(contentTexts, schemaTexts);
window.Art = { createRng, content, figures, paper, backdrop, woodcut, runes, index: ArtIndex };
window.galleryReady = true;
