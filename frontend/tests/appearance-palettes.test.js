import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appearance = readFileSync(
  new URL('../src/lib/appearance.js', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../src/styles/journal.css', import.meta.url),
  'utf8',
);
const backend = readFileSync(
  new URL('../../backend/db/content-db.js', import.meta.url),
  'utf8',
);
const paletteIds = [
  'ember',
  'rrl-olive',
  'mainsail',
  'summer-sea',
  'sailor-red',
  'night-sky',
  'tony-plum',
  'scarlette-pink',
  'industrial-charcoal',
  'maize',
  'hammond-khaki',
];

function paletteBlock(selector) {
  const start = styles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing ${selector}`);
  const end = styles.indexOf('}', start);
  return styles.slice(start, end);
}

function paletteHex(block, variable) {
  return block.match(new RegExp(`--${variable}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi)
    .map(channel => Number.parseInt(channel, 16) / 255)
    .map(channel => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('industrial textile palettes replace legacy sage and purple choices', () => {
  assert.match(appearance, /id: 'rrl-olive', name: 'RRL Olive', hex: '#68684F'/);
  assert.match(appearance, /id: 'tony-plum', name: 'Tony Plum', hex: '#27253D'/);
  assert.match(appearance, /id: 'scarlette-pink', name: 'Scarlette Pink', hex: '#C38F98'/);
  assert.match(appearance, /id: 'industrial-charcoal', name: 'industrial charcoal'/);
  assert.match(appearance, /moss: 'rrl-olive'/);
  assert.match(appearance, /'rrl-purple': 'tony-plum'/);
  assert.match(backend, /moss: 'rrl-olive'/);
  assert.match(backend, /'rrl-purple': 'tony-plum'/);
  assert.doesNotMatch(appearance, /name: 'Sage Green'/);
  assert.doesNotMatch(appearance, /name: 'RRL Purple'/);
});

test('Scarlette Pink preserves the supplied faded textile family', () => {
  const dark = paletteBlock('[data-palette="scarlette-pink"]');
  const light = paletteBlock('[data-theme="light"][data-palette="scarlette-pink"]');
  for (const color of ['#c38f98', '#95666f', '#dfc1c4', '#f0e0df']) {
    assert.match(dark, new RegExp(color));
  }
  for (const color of ['#c38f98', '#95666f', '#68474f', '#f5eeea']) {
    assert.match(light, new RegExp(color));
  }
  assert.match(appearance, /faded Oxford · rose wool sweater · blush nylon/);
});

test('Tony Plum retains its supplied family as a restrained archival ink', () => {
  const dark = paletteBlock('[data-palette="tony-plum"]');
  const light = paletteBlock('[data-theme="light"][data-palette="tony-plum"]');
  for (const color of ['#8b849c', '#514c5f', '#b2aabd']) {
    assert.match(dark, new RegExp(color));
  }
  for (const color of ['#27253d', '#514c5f', '#1e1c2e']) {
    assert.match(light, new RegExp(color));
  }
  assert.match(styles, /\[data-palette="tony-plum"\] \{ --palette-tint: #27253d; \}/);
});

test('Summer Sea uses its canonical selector and appearance updates browser chrome', () => {
  assert.match(styles, /\[data-palette="summer-sea"\]/);
  assert.match(styles, /\[data-theme="light"\]\[data-palette="summer-sea"\]/);
  assert.doesNotMatch(styles, /\[data-palette="blue"\]/);
  assert.match(appearance, /meta\[name="theme-color"\]/);
  assert.match(appearance, /getComputedStyle\(document\.body \|\| root\)\.backgroundColor/);
});

test('every palette has a profile, archival tint, and accessible control inks', () => {
  for (const id of paletteIds) {
    assert.match(
      appearance,
      new RegExp(`id: '${id}'[\\s\\S]{0,180}profile: '[^']+'`),
      `Missing profile for ${id}`,
    );
    assert.match(
      styles,
      new RegExp(`\\[data-palette="${id}"\\] \\{ --palette-tint: #[0-9a-f]{6}; \\}`),
      `Missing archival tint for ${id}`,
    );
    for (const theme of ['dark', 'light']) {
      const selector = theme === 'dark'
        ? `[data-palette="${id}"]`
        : `[data-theme="light"][data-palette="${id}"]`;
      const block = paletteBlock(selector);
      const accent = paletteHex(block, 'accent');
      const accentContrast = paletteHex(block, 'accent-contrast');
      assert.ok(accent && accentContrast, `Incomplete ${theme} ${id} control inks`);
      assert.ok(
        contrast(accent, accentContrast) >= 4.5,
        `${theme} ${id} accent controls must remain accessible`,
      );
    }
  }
});

test('all palettes resolve onto stable neutral reading surfaces', () => {
  const dark = paletteBlock(':root[data-palette]');
  const light = paletteBlock(':root[data-theme="light"][data-palette]');
  assert.match(dark, /#0d0d0d 96%, var\(--palette-tint\)/);
  assert.match(dark, /#171713 95%, var\(--palette-tint\)/);
  assert.match(light, /#eceadf 97%, var\(--palette-tint\)/);
  assert.match(light, /#f7f6ef 98%, var\(--palette-tint\)/);
  assert.ok(contrast('#e8e4d8', '#171713') >= 7);
  assert.ok(contrast('#aaa79e', '#171713') >= 4.5);
  assert.ok(contrast('#20231f', '#f7f6ef') >= 7);
  assert.ok(contrast('#484c45', '#f7f6ef') >= 4.5);
});
