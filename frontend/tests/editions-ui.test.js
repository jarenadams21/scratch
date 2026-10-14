import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const editionsView = readFileSync(
  new URL('../src/components/EditionsView.js', import.meta.url),
  'utf8',
);
const editionsCss = readFileSync(
  new URL('../src/styles/journal.css', import.meta.url),
  'utf8',
);
const appView = readFileSync(
  new URL('../src/components/App.js', import.meta.url),
  'utf8',
);
const formatter = readFileSync(
  new URL('../src/lib/formatter.js', import.meta.url),
  'utf8',
);
const markdown = readFileSync(
  new URL('../src/lib/markdown.js', import.meta.url),
  'utf8',
);
const imageDialog = readFileSync(
  new URL('../src/components/ImageInsertDialog.js', import.meta.url),
  'utf8',
);
const editorView = readFileSync(
  new URL('../src/components/EditorView.js', import.meta.url),
  'utf8',
);
const api = readFileSync(
  new URL('../src/lib/api.js', import.meta.url),
  'utf8',
);
const lightbox = readFileSync(
  new URL('../src/components/Lightbox.js', import.meta.url),
  'utf8',
);
const canvasArtboard = readFileSync(
  new URL('../src/components/CanvasArtboard.js', import.meta.url),
  'utf8',
);

test('Editions is a first-class public navigation destination', () => {
  assert.match(appView, /switchView\('editions'\)/);
  assert.match(appView, /'EDITIONS'/);
  assert.match(appView, /createElement\(EditionsView, \{ isAdmin \}\)/);
});

test('Edition navigation keeps owner controls in two quiet rows', () => {
  assert.doesNotMatch(editionsView, /SEQUENCED WRITING/);
  assert.doesNotMatch(editionsView, /edition-admin-bar/);
  assert.match(editionsView, /className: 'edition-cover-admin'/);
  assert.match(editionsView, /\}, 'EDIT'\)/);
});

test('long papers open in an accessible focused reader with return continuity', () => {
  assert.match(editionsView, /className: 'edition-reader-overlay'/);
  assert.match(editionsView, /'aria-modal': 'true'/);
  assert.match(editionsView, /editionReadingEntryId/);
  assert.match(editionsView, /pendingScrollTop/);
  assert.match(editionsView, /focus\(\{ preventScroll: true \}\)/);
  assert.match(editionsCss, /@keyframes edition-reader-in/);
  assert.match(editionsCss, /prefers-reduced-motion: reduce/);
});

test('owner manager stays focused on selecting and ordering compositions', () => {
  assert.match(editionsView, /editionDraftBlocks/);
  assert.match(editionsView, /editionDraft: draftForEdition\(edition\)/);
  assert.match(editionsView, /function changeDraftField/);
  assert.match(editionsView, /AppState\.editionDraft\[field\] = value/);
  assert.match(editionsView, /value: draft\.title/);
  assert.match(editionsView, /visibility: draft\.visibility/);
  assert.match(editionsView, /Move .* earlier/);
  assert.match(editionsView, /Move .* later/);
  assert.match(editionsView, /PUBLISH THIS EDITION/);
  assert.match(editionsView, /READING ORDER/);
  assert.match(editionsView, /SELECT PIECES OR SOURCES BELOW/);
  assert.match(editionsView, /toggleSource/);
  assert.match(editionsView, /EditionSource/);
  assert.doesNotMatch(editionsView, /\}, 'TRANSMISSION'\)/);
  assert.doesNotMatch(editionsView, /\+ TEXT/);
  assert.doesNotMatch(editionsView, /\+ DIVIDER/);
  assert.doesNotMatch(editionsView, /\+ IMAGE/);
  assert.doesNotMatch(editionsView, /openImageInsert/);
  assert.doesNotMatch(editionsView, /block\.type === 'image'/);
  assert.doesNotMatch(editionsView, /installFormatter/);
  assert.doesNotMatch(editionsView, /CanvasArtboard/);
});

test('Compose separates editable canvas from locked final preview', () => {
  assert.match(editorView, /showVisualMode\('canvas'\)/);
  assert.match(editorView, /showVisualMode\('preview'\)/);
  assert.match(editorView, /\+ TEXT BOX/);
  assert.match(editorView, /insertTextBoxMarker/);
  assert.match(editorView, /editable: true/);
  assert.match(editorView, /editable: false/);
  assert.match(editorView, /FINAL PREVIEW/);
  assert.match(formatter, /id: 'textbox'/);
  assert.match(markdown, /:::text-box/);
  assert.match(markdown, /stored\.texts/);
  assert.match(markdown, /defaultCanvasFrames/);
  assert.match(markdown, /order: lineIndex/);
  assert.match(canvasArtboard, /canvas-page-label/);
  assert.match(canvasArtboard, /syncReaderPage/);
  assert.match(canvasArtboard, /canvas-flow-continuation/);
});

test('shared image insertion requires accessible metadata and renders structured figures', () => {
  assert.match(formatter, /id: 'image'/);
  assert.match(formatter, /onImage/);
  assert.match(imageDialog, /decorative/);
  assert.match(imageDialog, /Describe the image/);
  assert.match(imageDialog, /UPLOAD & INSERT/);
  assert.doesNotMatch(imageDialog, /WRAP TEXT/);
  assert.doesNotMatch(imageDialog, /ISOLATED ROW/);
  assert.doesNotMatch(imageDialog, />ALIGNMENT</);
  assert.match(markdown, /:::image/);
  assert.match(markdown, /createElement\('figure'/);
  assert.match(markdown, /loading: 'lazy'/);
  assert.match(markdown, /decoding: 'async'/);
  assert.match(imageDialog, /return `:::image \$\{attributes\} :::`/);
  assert.match(api, /URL\.createObjectURL\(file\)/);
  assert.match(markdown, /parseCompactImageDirective/);
  assert.match(markdown, /source\.startsWith\('blob:'\)/);
  assert.match(markdown, /editorial-image-trigger/);
  assert.match(canvasArtboard, /onPointerDown/);
  assert.match(canvasArtboard, /bottom-right/);
  assert.match(canvasArtboard, /intersects/);
  assert.match(canvasArtboard, /ArrowLeft/);
  assert.doesNotMatch(editionsView, /ImageLayoutFrame/);
  assert.match(markdown, /renderCanvasMarkdown/);
  assert.match(lightbox, /event\.key === 'Escape'/);
  assert.match(lightbox, /returnFocusNode/);
  assert.match(editionsCss, /\.canvas-artboard\s*\{[\s\S]*?aspect-ratio: 5 \/ 7/);
  assert.match(editionsCss, /\.canvas-artboard\s*\{[\s\S]*?background: transparent/);
  assert.match(editionsCss, /\.canvas-object\s*\{[\s\S]*?position: absolute/);
});

test('Edition typography follows the global reading scale', () => {
  const start = editionsCss.indexOf('/* ─── Editions');
  const end = editionsCss.indexOf('/* ─── Viewport-safe navigation', start);
  const editionCss = editionsCss.slice(start, end);
  assert.match(editionCss, /var\(--type-scale\)/);
  assert.match(editionCss, /var\(--accent\)/);
  assert.match(editionCss, /var\(--paper\)/);
  assert.match(editionCss, /var\(--sheet\)/);
  assert.match(editionCss, /ui-monospace, SFMono-Regular/);
  assert.match(editionCss, /'Arial Narrow', 'Helvetica Neue Condensed'/);
  assert.doesNotMatch(editionCss, /Georgia/);
  assert.doesNotMatch(editionCss, /border-radius:\s*50%/);
  assert.doesNotMatch(editionCss, /radial-gradient/);
});
