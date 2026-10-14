import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourceView = readFileSync(
  new URL('../src/components/SourcesView.js', import.meta.url),
  'utf8',
);
const sourceCss = readFileSync(
  new URL('../src/styles/journal.css', import.meta.url),
  'utf8',
);

test('source search preserves focus, caret, and scroll through reconciliation', () => {
  assert.match(sourceView, /focus\(\{ preventScroll: true \}\)/);
  assert.match(sourceView, /setSelectionRange/);
  assert.match(sourceView, /sourceScrollNode\.scrollTop = pendingScrollTop/);
  assert.match(sourceView, /preserveSearch: true/);
});

test('source rows use arrow navigation to select and retain focus', () => {
  assert.match(sourceView, /selectedSourceId: nextId/);
  assert.match(sourceView, /focusRowId: nextId/);
  assert.match(sourceView, /onKeyDown: handleSearchKeyDown/);
  assert.match(sourceView, /ARROWS SELECT · ENTER INSPECTS/);
});

test('source ordering uses a themed accessible menu instead of a native select', () => {
  assert.doesNotMatch(sourceView, /createElement\('select'/);
  assert.match(sourceView, /role: 'menuitemradio'/);
  assert.match(sourceView, /aria-haspopup': 'menu'/);
  assert.match(sourceCss, /\.source-sort-menu/);
  assert.match(sourceCss, /var\(--source-accent\)/);
});
