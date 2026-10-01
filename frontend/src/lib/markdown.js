import { createElement } from '../engine/main.js';

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function nextInlineToken(value) {
  const patterns = [
    { type: 'code', rx: /`([^`\n]+)`/ },
    { type: 'link', rx: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/ },
    { type: 'highlight', rx: /==([^=\n]+)==/ },
    { type: 'bold', rx: /\*\*([^*\n]+)\*\*/ },
    { type: 'bold', rx: /__([^_\n]+)__/ },
    { type: 'italic', rx: /\*([^*\n]+)\*/ },
    { type: 'italic', rx: /_([^_\n]+)_/ },
    { type: 'url', rx: /https?:\/\/[^\s<]+/ },
  ];
  let found = null;
  for (const pattern of patterns) {
    const match = pattern.rx.exec(value);
    if (!match || (found && match.index >= found.match.index)) continue;
    found = { ...pattern, match };
  }
  return found;
}

export function inlineMarkdown(value, keyPrefix = 'inline') {
  const nodes = [];
  let source = String(value || '');
  let index = 0;
  while (source) {
    const token = nextInlineToken(source);
    if (!token) {
      nodes.push(source);
      break;
    }
    if (token.match.index > 0) nodes.push(source.slice(0, token.match.index));
    const key = `${keyPrefix}-${index++}`;
    const content = token.match[1] || token.match[0];
    if (token.type === 'code') nodes.push(createElement('code', { key }, content));
    else if (token.type === 'bold') nodes.push(createElement('strong', { key }, content));
    else if (token.type === 'italic') nodes.push(createElement('em', { key }, content));
    else if (token.type === 'highlight') nodes.push(createElement('mark', { key }, content));
    else if (token.type === 'link') {
      const href = safeUrl(token.match[2]);
      nodes.push(href
        ? createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, token.match[1])
        : token.match[0]);
    } else {
      const href = safeUrl(token.match[0]);
      nodes.push(href
        ? createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, token.match[0])
        : token.match[0]);
    }
    source = source.slice(token.match.index + token.match[0].length);
  }
  return nodes;
}

function paragraphNode(lines, key) {
  const children = [];
  lines.forEach((line, index) => {
    if (index) children.push(createElement('br', { key: `${key}-br-${index}` }));
    children.push(...inlineMarkdown(line, `${key}-${index}`));
  });
  return createElement('p', { key }, ...children);
}

export function renderMarkdown(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const nodes = [];
  let paragraph = [];
  let list = null;
  let code = null;
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(paragraphNode(paragraph, `p-${key++}`));
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    nodes.push(createElement(list.type, { key: `list-${key++}` }, ...list.items));
    list = null;
  };
  const appendListItem = (type, children) => {
    flushParagraph();
    if (list?.type !== type) {
      flushList();
      list = { type, items: [] };
    }
    list.items.push(createElement('li', { key: `li-${key}-${list.items.length}` }, ...children));
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flushParagraph();
      flushList();
      if (code) {
        nodes.push(createElement('pre', { key: `pre-${key++}` },
          createElement('code', null, code.lines.join('\n'))
        ));
        code = null;
      } else {
        code = { language: fence[1].trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.+)$/);
    const divider = line.match(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/);

    if (divider) {
      flushParagraph();
      flushList();
      nodes.push(createElement('hr', { key: `hr-${key++}` }));
    } else if (heading) {
      flushParagraph();
      flushList();
      nodes.push(createElement(`h${heading[1].length}`, { key: `h-${key++}` },
        ...inlineMarkdown(heading[2], `heading-${key}`)
      ));
    } else if (task) {
      appendListItem('ul', [
        createElement('input', {
          key: `check-${key}`,
          type: 'checkbox',
          disabled: true,
          checked: task[1].toLowerCase() === 'x',
        }),
        ...inlineMarkdown(task[2], `task-${key}`),
      ]);
    } else if (bullet) {
      appendListItem('ul', inlineMarkdown(bullet[1], `bullet-${key}`));
    } else if (numbered) {
      appendListItem('ol', inlineMarkdown(numbered[1], `numbered-${key}`));
    } else if (quote) {
      flushParagraph();
      flushList();
      nodes.push(createElement('blockquote', { key: `quote-${key++}` },
        ...inlineMarkdown(quote[1], `quote-inline-${key}`)
      ));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  if (code) {
    nodes.push(createElement('pre', { key: `pre-${key++}` },
      createElement('code', null, code.lines.join('\n'))
    ));
  }
  flushParagraph();
  flushList();
  return nodes;
}

export function plainText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?|```/g, ''))
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/(\*\*|__|==|`|\*|_)/g, '')
    .trim();
}
