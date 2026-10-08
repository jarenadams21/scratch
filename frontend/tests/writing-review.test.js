import assert from 'node:assert/strict';
import test from 'node:test';

import { FORMATTING_COMMANDS } from '../src/lib/formatter.js';
import {
  applyWritingSuggestion,
  reviewWriting,
} from '../src/lib/writing-review.js';

function findIssue(content, rule) {
  return reviewWriting({ content }).issues.find(issue => issue.rule === rule);
}

test('finds safe grammar and mechanics corrections', () => {
  assert.equal(findIssue('This is is a test.', 'repeated-word')?.replacement, '');
  assert.equal(findIssue('You should of checked it.', 'modal-of')?.replacement, 'have');
  assert.equal(findIssue('alot can change.', 'a-lot')?.replacement, 'a lot');
  assert.equal(findIssue('i wrote this.', 'lowercase-i')?.replacement, 'I');
  assert.equal(findIssue('This is wrong.It continues.', 'missing-space')?.replacement, ' I');
  assert.equal(findIssue('This is fine. this is not.', 'sentence-capitalization')?.replacement, 'T');
  assert.equal(findIssue('This is wrong  , truly.', 'space-before-punctuation')?.replacement, '');
  assert.equal(findIssue('This is strange,, indeed.', 'duplicate-punctuation')?.replacement, ',');
});

test('finds advisory clarity and delimiter notes', () => {
  assert.equal(findIssue('In order to improve, we worked.', 'wordy-in-order-to')?.replacement, 'To');
  assert.equal(findIssue('The draft was written by me.', 'passive-voice')?.replacement, null);
  assert.equal(findIssue('This (needs help.', 'unmatched-parentheses')?.replacement, null);

  const longSentence = `${Array.from({ length: 41 }, (_, index) => `word${index}`).join(' ')}.`;
  assert.match(findIssue(longSentence, 'long-sentence')?.message || '', /41 words/);
});

test('does not inspect Markdown code, link targets, or URLs as prose', () => {
  const content = [
    '`this is is code`',
    '```',
    'i should of remain untouched',
    '```',
    '[reference](https://example.com/a,b)',
    'https://example.com/this,is',
  ].join('\n');
  assert.deepEqual(reviewWriting({ content }).issues, []);
});

test('preserves UTF-16 offsets when prose includes emoji', () => {
  const content = 'Signal 🚢 this is is repeated.';
  const issue = findIssue(content, 'repeated-word');
  assert.equal(content.slice(issue.start, issue.end), ' is');
  assert.equal(applyWritingSuggestion({ title: '', content }, issue).content, 'Signal 🚢 this is repeated.');
});

test('applies suggestions only when the reviewed text is unchanged', () => {
  const draft = { title: '', content: 'This is is a test.' };
  const issue = reviewWriting(draft).issues[0];
  assert.equal(applyWritingSuggestion(draft, issue).content, 'This is a test.');
  assert.deepEqual(
    applyWritingSuggestion({ ...draft, content: 'This was is a test.' }, issue),
    { ...draft, content: 'This was is a test.' },
  );
});

test('reports draft statistics and exposes review in slash commands', () => {
  const result = reviewWriting({ content: 'One sentence. Two sentences.' });
  assert.equal(result.stats.words, 4);
  assert.equal(result.stats.sentences, 2);
  assert.equal(result.stats.minutes, 1);
  assert.equal(FORMATTING_COMMANDS[0].id, 'review');
});
