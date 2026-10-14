import assert from 'node:assert/strict';
import test from 'node:test';

import {
  indexedSources,
  sourceDomain,
  sourceFilterCounts,
  sourceRecordCodes,
  sourceUsageMap,
  sourceYear,
} from '../src/lib/source-index.js';

const sources = [
  {
    id: 'later',
    type: 'website',
    title: 'A Vernacular Web',
    creator: 'Olia Lialina',
    publication: 'Teleportacia',
    publishedAt: '2005',
    description: 'Early personal websites and linking culture.',
    url: 'https://art.teleportacia.org/observation/vernacular/',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'first',
    type: 'pdf',
    title: 'Profiles in Courage',
    creator: 'John F. Kennedy',
    publishedAt: '1956',
    filename: 'profiles-in-courage.pdf',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const entries = [
  { title: 'The Personal Website', sourceIds: ['later'] },
  { title: 'Public Responsibility', sourceIds: ['later', 'first'] },
];

test('derives compact archival source metadata', () => {
  assert.equal(sourceDomain(sources[0]), 'art.teleportacia.org');
  assert.equal(sourceDomain(sources[1]), 'profiles-in-courage.pdf');
  assert.equal(sourceYear(sources[0]), 2005);
  assert.deepEqual([...sourceRecordCodes(sources).entries()], [
    ['first', 'SRC-001'],
    ['later', 'SRC-002'],
  ]);
});

test('counts source formats and citation states', () => {
  const usage = sourceUsageMap(entries);
  assert.equal(usage.get('later'), 2);
  assert.deepEqual(sourceFilterCounts(sources, usage), {
    all: 2,
    website: 1,
    pdf: 1,
    cited: 2,
    uncited: 0,
  });
});

test('searches metadata and linked writing titles', () => {
  assert.deepEqual(
    indexedSources({ sources, entries, query: 'olia linking' }).map(source => source.id),
    ['later'],
  );
  assert.deepEqual(
    indexedSources({ sources, entries, query: 'public responsibility' }).map(source => source.id),
    ['later', 'first'],
  );
});

test('filters and sorts the index without mutating source data', () => {
  assert.deepEqual(
    indexedSources({ sources, entries, filter: 'pdf' }).map(source => source.id),
    ['first'],
  );
  assert.deepEqual(
    indexedSources({ sources, entries, sort: 'used' }).map(source => source.id),
    ['later', 'first'],
  );
  assert.deepEqual(sources.map(source => source.id), ['later', 'first']);
});
