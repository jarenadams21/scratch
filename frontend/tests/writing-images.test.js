import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const featureDb = readFileSync(
  new URL('../../backend/db/feature-db.js', import.meta.url),
  'utf8',
);
const server = readFileSync(
  new URL('../../backend/server.js', import.meta.url),
  'utf8',
);
const api = readFileSync(
  new URL('../src/lib/api.js', import.meta.url),
  'utf8',
);

test('writing images use durable keys and renderable URLs', () => {
  assert.match(featureDb, /presignWritingImagesInContent/);
  assert.match(featureDb, /imageKey\.startsWith\(`\$\{WRITING_IMAGE_PREFIX\}\//);
  assert.match(featureDb, /const imageUrl = await presignImageGet\(key\)/);
  assert.match(server, /content: await presignWritingImagesInContent\(entry\.content\)/);
  assert.match(api, /reader\.readAsDataURL\(file\)/);
  assert.match(api, /if \(!imageUrl\) throw new Error/);
});
