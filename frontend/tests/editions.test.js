import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entriesForEdition,
  editionNumber,
  entryWordCount,
  entryReadingMinutes,
  isLongformEntry,
  editionWordCount,
  blocksForEdition,
} from '../src/lib/editions.js';

test('resolves ordered public transmitted entries without mutating input', () => {
  const edition = { entryIds: ['b', 'missing', 'a', 'draft', 'private'] };
  const entries = [
    { entryId: 'a', content: 'one', visibility: 'public' },
    { entryId: 'b', content: 'two', visibility: 'public' },
    { entryId: 'draft', status: 'draft', content: 'three', visibility: 'public' },
    { entryId: 'private', content: 'four', visibility: 'admins' },
  ];

  assert.deepEqual(entriesForEdition(edition, entries).map(entry => entry.entryId), ['b', 'a']);
  assert.deepEqual(edition.entryIds, ['b', 'missing', 'a', 'draft', 'private']);
  assert.deepEqual(
    entriesForEdition(edition, entries, { includePrivate: true }).map(entry => entry.entryId),
    ['b', 'a', 'private'],
  );
});

test('normalizes legacy entry lists into stable Edition blocks', () => {
  assert.deepEqual(blocksForEdition({ entryIds: ['a', 'b'] }), [
    { id: 'entry-1-a', type: 'entry', entryId: 'a' },
    { id: 'entry-2-b', type: 'entry', entryId: 'b' },
  ]);
  const blocks = [
    { id: 'entry-a', type: 'entry', entryId: 'a' },
    { id: 'source-a', type: 'source', sourceId: 'source-a' },
    { id: 'legacy-text', type: 'text', content: 'Opening' },
    { id: 'legacy-image', type: 'image', imageUrl: 'https://example.com/image.jpg' },
    { id: 'legacy-divider', type: 'divider', style: 'rule' },
  ];
  assert.deepEqual(blocksForEdition({ blocks }), blocks.slice(0, 2));
  assert.notEqual(blocksForEdition({ blocks }), blocks);
});

test('calculates labels and reading measures', () => {
  const longEntry = { content: Array.from({ length: 900 }, () => 'word').join(' ') };
  const shortEntry = { content: 'A short transmission.' };

  assert.equal(editionNumber({ number: 'VII' }, 0), 'VII');
  assert.equal(editionNumber({}, 2), '003');
  assert.equal(entryWordCount(shortEntry), 3);
  assert.equal(entryReadingMinutes(longEntry), 5);
  assert.equal(isLongformEntry(longEntry), true);
  assert.equal(isLongformEntry(shortEntry), false);
  assert.equal(editionWordCount([longEntry, shortEntry]), 903);
});
