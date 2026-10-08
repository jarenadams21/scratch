import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_READING_SIZE,
  applyReadingSize,
  normalizedReadingSize,
  readLocalReadingSize,
} from '../src/lib/reading-preferences.js';

function installBrowserStubs(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set('harbinger-reading-v1', initialValue);
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}

test('normalizes unsupported values to the medium default', () => {
  assert.equal(normalizedReadingSize('small'), 'small');
  assert.equal(normalizedReadingSize('large'), 'large');
  assert.equal(normalizedReadingSize('oversized'), DEFAULT_READING_SIZE);
  assert.equal(normalizedReadingSize(null), DEFAULT_READING_SIZE);
});

test('applies and persists a reading-size choice', () => {
  const values = installBrowserStubs();
  assert.equal(applyReadingSize('large'), 'large');
  assert.equal(document.documentElement.dataset.readingSize, 'large');
  assert.equal(values.get('harbinger-reading-v1'), 'large');
  assert.equal(readLocalReadingSize(), 'large');
});

test('applies without persistence when requested', () => {
  const values = installBrowserStubs('small');
  assert.equal(applyReadingSize('large', false), 'large');
  assert.equal(document.documentElement.dataset.readingSize, 'large');
  assert.equal(values.get('harbinger-reading-v1'), 'small');
});

test('falls back safely when browser storage is unavailable', () => {
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.localStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(readLocalReadingSize(), DEFAULT_READING_SIZE);
  assert.equal(applyReadingSize('small'), 'small');
  assert.equal(document.documentElement.dataset.readingSize, 'small');
});
