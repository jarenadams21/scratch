const WORD_RX = /\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu;

const WORDY_PHRASES = Object.freeze([
  ['in order to', 'to'],
  ['due to the fact that', 'because'],
  ['at this point in time', 'now'],
  ['has the ability to', 'can'],
  ['have the ability to', 'can'],
  ['a large number of', 'many'],
  ['a number of', 'several'],
  ['for the purpose of', 'to'],
]);

function maskedText(value) {
  const chars = value.split('');
  const mask = (start, end) => {
    for (let i = start; i < end; i += 1) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  };
  const ranges = [
    /```[\s\S]*?```/g,
    /`[^`\n]*`/g,
    /https?:\/\/[^\s)]+/g,
  ];
  for (const pattern of ranges) {
    for (const match of value.matchAll(pattern)) mask(match.index, match.index + match[0].length);
  }
  for (const match of value.matchAll(/\]\([^)\n]+\)/g)) {
    mask(match.index + 1, match.index + match[0].length);
  }
  return chars.join('');
}

function excerptFor(value, start, end) {
  const left = Math.max(0, start - 42);
  const right = Math.min(value.length, end + 52);
  return {
    before: `${left ? '…' : ''}${value.slice(left, start).replace(/\s+/g, ' ')}`,
    match: value.slice(start, end),
    after: `${value.slice(end, right).replace(/\s+/g, ' ')}${right < value.length ? '…' : ''}`,
  };
}

function addIssue(issues, value, field, rule, category, start, end, message, detail, replacement = null) {
  issues.push({
    id: `${field}:${rule}:${start}:${end}`,
    field,
    rule,
    category,
    start,
    end,
    message,
    detail,
    replacement,
    original: value.slice(start, end),
    excerpt: excerptFor(value, start, end),
  });
}

function collectMatches(pattern, value, callback) {
  pattern.lastIndex = 0;
  for (const match of value.matchAll(pattern)) callback(match);
}

function reviewField(field, rawValue) {
  const issues = [];
  const value = String(rawValue || '');
  const masked = maskedText(value);

  collectMatches(/\b([\p{L}][\p{L}'’-]*)\s+\1\b/giu, masked, match => {
    const secondStart = match.index + match[1].length;
    addIssue(
      issues, value, field, 'repeated-word', 'grammar',
      secondStart, match.index + match[0].length,
      `Repeated word: “${match[1]}”.`,
      'Remove the accidental repetition.',
      '',
    );
  });

  collectMatches(/\b(could|should|would|might|must)\s+of\b/giu, masked, match => {
    const ofStart = match.index + match[0].toLowerCase().lastIndexOf('of');
    addIssue(
      issues, value, field, 'modal-of', 'grammar',
      ofStart, ofStart + 2,
      `Use “${match[1]} have,” not “${match[1]} of.”`,
      'The contracted form sounds like “of,” but the grammatical phrase uses “have.”',
      'have',
    );
  });

  collectMatches(/\balot\b/giu, masked, match => {
    addIssue(
      issues, value, field, 'a-lot', 'grammar',
      match.index, match.index + match[0].length,
      '“A lot” is written as two words.',
      'Separate the article from the noun.',
      match[0][0] === 'A' ? 'A lot' : 'a lot',
    );
  });

  collectMatches(/\bi\b/g, masked, match => {
    addIssue(
      issues, value, field, 'lowercase-i', 'grammar',
      match.index, match.index + 1,
      'Capitalize the pronoun “I.”',
      'Standalone first-person pronouns are capitalized.',
      'I',
    );
  });

  collectMatches(/[^\S\r\n]+([,.;!?])/g, masked, match => {
    const punctuationStart = match.index + match[0].lastIndexOf(match[1]);
    addIssue(
      issues, value, field, 'space-before-punctuation', 'mechanics',
      match.index, punctuationStart,
      'Remove the space before punctuation.',
      'Punctuation normally follows the preceding word directly.',
      '',
    );
  });

  collectMatches(/([,;!?])([\p{L}\p{N}])/gu, masked, match => {
    const start = match.index + 1;
    addIssue(
      issues, value, field, 'missing-space', 'mechanics',
      start, start + 1,
      `Add a space after “${match[1]}.”`,
      'The next word should begin after a space.',
      ` ${match[2]}`,
    );
  });

  collectMatches(/\.([\p{L}])/gu, masked, match => {
    const start = match.index + 1;
    addIssue(
      issues, value, field, 'missing-space', 'mechanics',
      start, start + 1,
      'Add a space after the period.',
      'The next word should begin after a space.',
      ` ${match[1]}`,
    );
  });

  collectMatches(/([,;:])\1+/g, masked, match => {
    addIssue(
      issues, value, field, 'duplicate-punctuation', 'mechanics',
      match.index, match.index + match[0].length,
      'Repeated punctuation may be accidental.',
      'Use one punctuation mark unless the repetition is intentional.',
      match[1],
    );
  });

  collectMatches(/(^|[.!?]["')\]]?\s+|\n{2,})([a-z])/gm, masked, match => {
    const start = match.index + match[0].lastIndexOf(match[2]);
    addIssue(
      issues, value, field, 'sentence-capitalization', 'mechanics',
      start, start + 1,
      'Capitalize the beginning of the sentence.',
      'Sentences should normally begin with a capital letter.',
      match[2].toUpperCase(),
    );
  });

  for (const [phrase, replacement] of WORDY_PHRASES) {
    const pattern = new RegExp(`\\b${phrase.replaceAll(' ', '\\s+')}\\b`, 'giu');
    collectMatches(pattern, masked, match => {
      const suggested = /^[A-Z]/.test(match[0])
        ? `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`
        : replacement;
      addIssue(
        issues, value, field, `wordy-${phrase.replaceAll(' ', '-')}`, 'clarity',
        match.index, match.index + match[0].length,
        `Consider the more direct “${suggested}.”`,
        'A shorter construction may make the sentence clearer.',
        suggested,
      );
    });
  }

  collectMatches(/\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+\s+){0,2}\w+(?:ed|en)\b/giu, masked, match => {
    addIssue(
      issues, value, field, 'passive-voice', 'clarity',
      match.index, match.index + match[0].length,
      'Possible passive construction.',
      'Confirm that the sentence clearly identifies who or what performs the action.',
    );
  });

  const sentencePattern = /[^.!?\n]+(?:[.!?]+|$)/g;
  collectMatches(sentencePattern, masked, match => {
    const words = match[0].match(WORD_RX) || [];
    if (words.length <= 40) return;
    const leading = match[0].search(/\S/);
    const start = match.index + Math.max(0, leading);
    const end = match.index + match[0].trimEnd().length;
    addIssue(
      issues, value, field, 'long-sentence', 'clarity',
      start, end,
      `Long sentence: ${words.length} words.`,
      'Consider dividing it so each sentence carries one principal idea.',
    );
  });

  const pairs = [
    ['(', ')', 'parentheses'],
    ['[', ']', 'brackets'],
    ['{', '}', 'braces'],
  ];
  for (const [open, close, label] of pairs) {
    const opens = [...masked].filter(char => char === open).length;
    const closes = [...masked].filter(char => char === close).length;
    if (opens !== closes) {
      addIssue(
        issues, value, field, `unmatched-${label}`, 'mechanics',
        0, Math.min(value.length, 1),
        `Check unmatched ${label}.`,
        `Found ${opens} opening and ${closes} closing ${label}.`,
      );
    }
  }

  const specificRanges = new Set(
    issues
      .filter(issue => issue.rule !== 'sentence-capitalization')
      .map(issue => `${issue.start}:${issue.end}:${issue.replacement}`),
  );
  return issues.filter(issue => (
    issue.rule !== 'sentence-capitalization'
    || !specificRanges.has(`${issue.start}:${issue.end}:${issue.replacement}`)
  ));
}

export function reviewWriting(draft = {}) {
  const title = String(draft.title || '');
  const content = String(draft.content || '');
  const issues = [
    ...reviewField('title', title),
    ...reviewField('content', content),
  ].sort((a, b) => {
    if (a.field !== b.field) return a.field === 'title' ? -1 : 1;
    return a.start - b.start || a.end - b.end;
  });
  const words = content.match(WORD_RX) || [];
  const sentences = maskedText(content).match(/[^.!?\n]+(?:[.!?]+|$)/g)
    ?.filter(sentence => sentence.match(WORD_RX)) || [];
  return {
    issues,
    stats: {
      words: words.length,
      sentences: sentences.length,
      minutes: words.length ? Math.max(1, Math.ceil(words.length / 220)) : 0,
    },
  };
}

export function applyWritingSuggestion(draft, issue) {
  if (!issue || issue.replacement === null) return draft;
  const field = issue.field === 'title' ? 'title' : 'content';
  const value = String(draft?.[field] || '');
  if (value.slice(issue.start, issue.end) !== issue.original) return draft;
  return {
    ...draft,
    [field]: `${value.slice(0, issue.start)}${issue.replacement}${value.slice(issue.end)}`,
  };
}
