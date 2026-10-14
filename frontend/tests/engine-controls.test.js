import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const engine = readFileSync(
  new URL('../src/engine/main.tsx', import.meta.url),
  'utf8',
);

test('select values synchronize after option children commit', () => {
  assert.match(engine, /function syncSelectValue\(fiber\)/);
  assert.match(engine, /dom\.tagName !== "SELECT"/);
  assert.match(engine, /hasOwnProperty\.call\(fiber\.props, "value"\)/);
  assert.match(engine, /fiber\.effectTag === "PLACEMENT"[\s\S]*?"defaultValue"/);
  assert.match(engine, /commitWork\(fiber\.child\)\s+syncSelectValue\(fiber\)\s+commitWork\(fiber\.sibling\)/);
});
