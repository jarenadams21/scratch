import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const featureDb = readFileSync(
  new URL('../../backend/db/feature-db.js', import.meta.url),
  'utf8',
);
const loaders = readFileSync(
  new URL('../src/lib/loaders.js', import.meta.url),
  'utf8',
);
const archive = readFileSync(
  new URL('../src/components/ArchiveView.js', import.meta.url),
  'utf8',
);
const login = readFileSync(
  new URL('../src/components/LoginForm.js', import.meta.url),
  'utf8',
);

test('legacy profiles use a neutral public byline instead of a privileged identity', () => {
  assert.match(featureDb, /DEFAULT_DISPLAY_NAME = 'Archive'/);
  assert.match(featureDb, /RESERVED_DISPLAY_NAMES/);
  assert.match(featureDb, /reserved system name/);
  assert.match(loaders, /function publicDisplayName/);
  assert.match(loaders, /'Archive'/);
  assert.match(archive, /publicDisplayName\(entry\.displayName\)/);
  assert.match(login, /ADMIN ACCESS/);
  assert.doesNotMatch(login, /OPERATOR ACCESS/);
});
