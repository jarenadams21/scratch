import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssPath = new URL('../src/styles/journal.css', import.meta.url);

test('Small, Medium, and Large scale the complete interface typography', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /\[data-reading-size="small"\]\s*\{\s*--type-scale:\s*1;/);
  assert.match(css, /\[data-reading-size="medium"\]\s*\{\s*--type-scale:\s*1\.125;/);
  assert.match(css, /\[data-reading-size="large"\]\s*\{\s*--type-scale:\s*1\.25;/);

  const fixedSizes = [...css.matchAll(/font-size:\s*([^;]+);/g)]
    .map(match => match[1].trim())
    .filter(value => /px|clamp\(/.test(value));
  assert.ok(fixedSizes.length > 200);
  assert.equal(
    fixedSizes.every(value => value.includes('var(--type-scale)')),
    true,
    'every fixed font size should participate in the site-wide scale',
  );
});

test('text sizing does not change reader width or About alignment', async () => {
  const css = await readFile(cssPath, 'utf8');
  for (const size of ['small', 'medium', 'large']) {
    const block = css.match(new RegExp(`\\[data-reading-size="${size}"\\]\\s*\\{([^}]*)\\}`))?.[1] || '';
    assert.doesNotMatch(block, /reader-measure|margin|padding|width/);
  }
  assert.match(css, /--reader-measure:\s*720px;/);
  assert.match(css, /\.catalog-card-active\s+\.catalog-card-title,[\s\S]*?max-width:\s*720px;/);
});
