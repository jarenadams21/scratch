import { createElement } from '../engine/main.js';
import { CanvasArtboard, canvasFrame } from '../components/CanvasArtboard.js';
import { openLightbox } from '../components/Lightbox.js';

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function safeImageUrl(value) {
  const source = String(value || '').trim();
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(source)) return source;
  if (source.startsWith('blob:')) return source;
  return safeUrl(source);
}

function normalizedImage(image) {
  const imageUrl = safeImageUrl(image.url);
  const decorative = image.decorative === 'true' || image.decorative === '1';
  if (!imageUrl || (!decorative && !image.alt)) return null;
  return {
    imageUrl,
    imageKey: image.key || '',
    alt: decorative ? '' : image.alt,
    decorative,
    caption: image.caption || '',
  };
}

function parseImageDirective(lines) {
  const image = {};
  for (const line of lines) {
    const match = line.match(/^([a-z]+):\s*(.*)$/i);
    if (match) image[match[1].toLowerCase()] = match[2].trim();
  }
  return normalizedImage(image);
}

function parseCompactImageDirective(line) {
  const match = line.trim().match(/^:::image\s+(.+?)\s+:::$/);
  if (!match) return null;
  const image = {};
  for (const field of match[1].split(/\s+/)) {
    const separator = field.indexOf('=');
    if (separator < 1) continue;
    const key = field.slice(0, separator).toLowerCase();
    try {
      image[key] = decodeURIComponent(field.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return normalizedImage(image);
}

const TEXT_BOX_MARKER = /^:::text-box\s+id=([a-zA-Z0-9_-]{1,120})\s+:::$/;

export function splitCanvasContent(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [{ id: 'text', lines: [], order: 0 }];
  const images = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const textBox = lines[lineIndex].trim().match(TEXT_BOX_MARKER);
    if (textBox) {
      sections.push({ id: textBox[1], lines: [], order: lineIndex });
      continue;
    }
    const compact = parseCompactImageDirective(lines[lineIndex]);
    if (compact) {
      images.push({
        id: compact.imageKey || `line-${lineIndex}`,
        image: compact,
        order: lineIndex,
        range: { startLine: lineIndex, endLine: lineIndex },
      });
      continue;
    }
    if (lines[lineIndex].trim() === ':::image') {
      const fields = [];
      let closingIndex = lineIndex + 1;
      while (closingIndex < lines.length && lines[closingIndex].trim() !== ':::') {
        fields.push(lines[closingIndex]);
        closingIndex += 1;
      }
      if (closingIndex < lines.length) {
        const image = parseImageDirective(fields);
        if (image) {
          images.push({
            id: image.imageKey || `line-${lineIndex}`,
            image,
            order: lineIndex,
            range: { startLine: lineIndex, endLine: closingIndex },
          });
        }
        lineIndex = closingIndex;
        continue;
      }
    }
    sections[sections.length - 1].lines.push(lines[lineIndex]);
  }
  const texts = sections
    .map(section => ({ id: section.id, text: section.lines.join('\n').trim(), order: section.order }))
    .filter(section => section.text);
  return {
    text: texts.map(section => section.text).join('\n\n'),
    texts,
    images,
  };
}

function defaultCanvasFrames(content) {
  const ordered = [
    ...content.texts.map(section => ({
      id: `text:${section.id}`,
      type: 'text',
      order: section.order,
      height: Math.min(88, 12 + (Math.ceil(section.text.length / 240) * 10)),
    })),
    ...content.images.map(item => ({
      id: `image:${item.id}`,
      type: 'image',
      order: item.order,
      height: 34,
    })),
  ].sort((a, b) => a.order - b.order);
  const frames = new Map();
  let page = 0;
  let cursor = 5;
  for (const item of ordered) {
    if (cursor + item.height > 95) {
      page += 1;
      cursor = 5;
    }
    frames.set(item.id, {
      x: item.type === 'text' ? 6 : 12,
      y: cursor,
      width: item.type === 'text' ? 88 : 76,
      height: item.height,
      page,
    });
    cursor += item.height + 5;
  }
  return frames;
}

function canvasImageNode(image) {
  const element = createElement('img', {
    src: image.imageUrl,
    alt: image.decorative ? '' : image.alt,
    loading: 'lazy',
    decoding: 'async',
    ...(image.decorative ? { role: 'presentation' } : {}),
  });
  return createElement('figure', { className: 'canvas-image' },
    image.decorative
      ? element
      : createElement('button', {
          type: 'button',
          onClick: event => openLightbox(
            { url: image.imageUrl, alt: image.alt, caption: image.caption },
            event.currentTarget,
          ),
          'aria-label': `Enlarge image: ${image.alt}`,
        }, element),
    image.caption ? createElement('figcaption', null, image.caption) : null
  );
}

export function renderCanvasMarkdown(value, layout = null, options = {}) {
  const content = splitCanvasContent(value);
  const stored = layout && typeof layout === 'object' ? layout : {};
  const defaults = defaultCanvasFrames(content);
  const objects = [];
    content.texts.forEach((section, index) => {
      const frame = canvasFrame(
        stored.texts?.[section.id]
          || (section.id === 'text' ? stored.text : null)
          || defaults.get(`text:${section.id}`),
        index,
        'text',
      );
      objects.push({
        id: section.id,
        type: 'text',
        label: 'TEXT',
        frame,
        content: createElement('div', { className: 'reading-content canvas-text' },
          ...renderMarkdown(section.text)
        ),
        flowContent: createElement('div', { className: 'reading-content canvas-flow-text' },
          ...renderMarkdown(section.text)
        ),
      });
    });
    objects.push(...content.images.map((item, index) => ({
      id: item.id,
      type: 'image',
      label: 'IMAGE',
      frame: canvasFrame(
        stored.images?.[item.id] || defaults.get(`image:${item.id}`),
        index + content.texts.length,
        'image',
      ),
      content: canvasImageNode(item.image),
    })));
  return createElement(CanvasArtboard, {
    objects,
    editable: options.editable === true,
    label: options.label || 'Composed writing canvas',
    onChange: (id, frame) => options.onLayoutChange?.(id, frame),
  });
}

function imageNode(image, key) {
  const imageElement = createElement('img', {
    src: image.imageUrl,
    alt: image.alt,
    loading: 'lazy',
    decoding: 'async',
    ...(image.decorative ? { role: 'presentation' } : {}),
  });
  return createElement('figure', {
    key,
    className: 'content-image content-image-row content-image-center',
  },
    image.decorative
      ? imageElement
      : createElement('button', {
          type: 'button',
          className: 'editorial-image-trigger',
          onClick: event => openLightbox(
            { url: image.imageUrl, alt: image.alt, caption: image.caption },
            event.currentTarget,
          ),
          'aria-label': `Enlarge image: ${image.alt}`,
        }, imageElement),
    image.caption
      ? createElement('figcaption', null, ...inlineMarkdown(image.caption, `${key}-caption`))
      : null
  );
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (TEXT_BOX_MARKER.test(line.trim())) continue;
    const compactImage = parseCompactImageDirective(line);
    if (compactImage) {
      flushParagraph();
      flushList();
      const imageKey = `image-${key++}`;
      nodes.push(imageNode(compactImage, imageKey));
      continue;
    }
    if (line.trim() === ':::image') {
      flushParagraph();
      flushList();
      const fields = [];
      let closingIndex = lineIndex + 1;
      while (closingIndex < lines.length && lines[closingIndex].trim() !== ':::') {
        fields.push(lines[closingIndex]);
        closingIndex += 1;
      }
      if (closingIndex < lines.length) {
        const image = parseImageDirective(fields);
        if (image) {
          const imageKey = `image-${key++}`;
          nodes.push(imageNode(image, imageKey));
        }
        lineIndex = closingIndex;
        continue;
      }
    }
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
    .replace(/^:::text-box\s+id=[a-zA-Z0-9_-]{1,120}\s+:::\s*$/gm, '')
    .replace(/^:::image\s+.+\s+:::\s*$/gm, '')
    .replace(/^:::image\s*\n[\s\S]*?^:::\s*$/gm, '')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?|```/g, ''))
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/(\*\*|__|==|`|\*|_)/g, '')
    .trim();
}
