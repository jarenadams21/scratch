export const FORMATTING_COMMANDS = Object.freeze([
  { id: 'review', icon: '✓', label: 'Writing review', hint: 'Check grammar, mechanics, and clarity', keywords: 'spell grammar proofread edit' },
  { id: 'title', icon: 'H1', label: 'Title', hint: 'Name the central idea', keywords: 'heading headline' },
  { id: 'subtitle', icon: 'H3', label: 'Subtitle', hint: 'Add context beneath a title', keywords: 'deck subheading' },
  { id: 'section', icon: 'H2', label: 'Section heading', hint: 'Organize the argument', keywords: 'heading outline' },
  { id: 'bold', icon: 'B', label: 'Bold', hint: 'Give a phrase strong emphasis', keywords: 'strong emphasis' },
  { id: 'italic', icon: 'I', label: 'Italic', hint: 'Give a phrase subtle emphasis', keywords: 'emphasis' },
  { id: 'highlight', icon: 'H', label: 'Key idea highlight', hint: 'Mark the thesis or takeaway', keywords: 'mark thesis emphasis' },
  { id: 'quote', icon: '“', label: 'Quotation', hint: 'Set apart evidence or language', keywords: 'blockquote evidence' },
  { id: 'bullet', icon: '•', label: 'Outline bullets', hint: 'Arrange supporting points', keywords: 'unordered list outline' },
  { id: 'numbered', icon: '1.', label: 'Numbered sequence', hint: 'Order steps or priorities', keywords: 'ordered steps outline' },
  { id: 'checklist', icon: '☐', label: 'Action checklist', hint: 'Track follow-through', keywords: 'task todo' },
  { id: 'divider', icon: '—', label: 'Section break', hint: 'Separate major thoughts', keywords: 'divider rule break' },
  { id: 'code', icon: '</>', label: 'Code', hint: 'Inline or fenced code', keywords: 'snippet technical' },
  { id: 'link', icon: '↗', label: 'Link', hint: 'Add a labeled URL', keywords: 'url reference' },
]);

const installedEditors = new WeakSet();

export function installFormatter(textarea, menu, options = {}) {
  if (!textarea || !menu || installedEditors.has(textarea)) return;
  installedEditors.add(textarea);
  const onChange = typeof options === 'function' ? options : options.onChange;
  const onReview = typeof options === 'object' ? options.onReview : null;

  let matches = [...FORMATTING_COMMANDS];
  let activeIndex = 0;
  let slashRange = null;

  const notify = () => {
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    if (onChange) onChange();
  };

  const replaceRange = (start, end, replacement, selectionStart, selectionEnd = selectionStart) => {
    const value = textarea.value;
    textarea.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + selectionStart, start + selectionEnd);
    notify();
  };

  const formatSelection = (commandId) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const inline = {
      bold: ['**', '**', 'important'],
      italic: ['*', '*', 'emphasis'],
      highlight: ['==', '==', 'highlight'],
    };

    if (inline[commandId]) {
      const [before, after, placeholder] = inline[commandId];
      const content = selected || placeholder;
      replaceRange(start, end, `${before}${content}${after}`, before.length, before.length + content.length);
      return;
    }
    if (commandId === 'link') {
      const label = selected || 'link text';
      const replacement = `[${label}](https://)`;
      const urlStart = label.length + 3;
      replaceRange(start, end, replacement, urlStart, urlStart + 8);
      return;
    }
    if (commandId === 'code') {
      const multiline = selected.includes('\n');
      const content = selected || 'code';
      const before = multiline ? '```\n' : '`';
      const after = multiline ? '\n```' : '`';
      replaceRange(start, end, `${before}${content}${after}`, before.length, before.length + content.length);
      return;
    }
    if (commandId === 'divider') {
      replaceRange(start, end, selected ? `\n---\n${selected}` : '\n---\n', 5, selected ? 5 + selected.length : 5);
      return;
    }

    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    const followingBreak = textarea.value.indexOf('\n', end);
    const lineEnd = followingBreak === -1 ? textarea.value.length : followingBreak;
    const block = textarea.value.slice(lineStart, lineEnd);
    const prefixes = {
      title: '# ',
      subtitle: '### ',
      section: '## ',
      bullet: '- ',
      numbered: '1. ',
      checklist: '- [ ] ',
      quote: '> ',
    };
    const prefix = prefixes[commandId];
    if (!prefix) return;
    const replacement = block.split('\n').map((line, index) => {
      if (['title', 'subtitle', 'section'].includes(commandId)) {
        return `${prefix}${line.replace(/^#{1,6}\s+/, '')}`;
      }
      if (commandId === 'numbered') return `${index + 1}. ${line.replace(/^\s*\d+\.\s+/, '')}`;
      return `${prefix}${line}`;
    }).join('\n');
    replaceRange(lineStart, lineEnd, replacement, prefix.length, replacement.length);
  };

  const closeMenu = () => {
    slashRange = null;
    activeIndex = 0;
    menu.classList.remove('visible');
    menu.replaceChildren();
  };

  const choose = (commandId) => {
    if (!slashRange) return;
    if (commandId === 'review') {
      const { start, end } = slashRange;
      textarea.value = `${textarea.value.slice(0, start)}${textarea.value.slice(end)}`;
      closeMenu();
      notify();
      if (onReview) onReview();
      return;
    }
    const { start, end } = slashRange;
    textarea.value = `${textarea.value.slice(0, start)}${textarea.value.slice(end)}`;
    textarea.setSelectionRange(start, start);
    closeMenu();
    formatSelection(commandId);
  };

  const renderMenu = () => {
    menu.replaceChildren(...matches.map((command, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === activeIndex ? 'slash-option active' : 'slash-option';
      button.dataset.command = command.id;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');

      const icon = document.createElement('span');
      icon.textContent = command.icon;
      const copy = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = command.label;
      const hint = document.createElement('small');
      hint.textContent = command.hint;
      copy.append(label, hint);
      button.append(icon, copy);
      button.addEventListener('click', () => choose(command.id));
      return button;
    }));
    menu.classList.toggle('visible', matches.length > 0);
    requestAnimationFrame(() => menu.querySelector('.active')?.scrollIntoView({ block: 'nearest' }));
  };

  const updateMenu = () => {
    const caret = textarea.selectionStart;
    const beforeCaret = textarea.value.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\n)[ \t]*\/([a-z]*)$/i);
    if (!match) return closeMenu();
    const query = match[1].toLowerCase();
    matches = FORMATTING_COMMANDS.filter(command =>
      `${command.id} ${command.label} ${command.keywords}`.toLowerCase().includes(query)
    );
    activeIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));
    slashRange = { start: caret - query.length - 1, end: caret };
    renderMenu();
  };

  const indent = (event) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    const followingBreak = textarea.value.indexOf('\n', end);
    const lineEnd = followingBreak === -1 ? textarea.value.length : followingBreak;
    const block = textarea.value.slice(lineStart, lineEnd);
    event.preventDefault();
    if (start === end && !event.shiftKey) {
      replaceRange(start, end, '  ', 2);
      return;
    }
    const replacement = block.split('\n')
      .map(line => event.shiftKey ? line.replace(/^ {1,2}/, '') : `  ${line}`)
      .join('\n');
    replaceRange(lineStart, lineEnd, replacement, 0, replacement.length);
  };

  const continueBlock = (event) => {
    const caret = textarea.selectionStart;
    if (caret !== textarea.selectionEnd) return;
    const lineStart = textarea.value.lastIndexOf('\n', caret - 1) + 1;
    const line = textarea.value.slice(lineStart, caret);
    const list = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(\[[ xX]\]\s+)?(.*)$/);
    const quote = line.match(/^(\s*>\s?)(.*)$/);
    if (list) {
      event.preventDefault();
      if (!list[5].trim()) return replaceRange(lineStart, caret, '', 0);
      const marker = /^\d+\.$/.test(list[2]) ? `${Number.parseInt(list[2], 10) + 1}.` : list[2];
      const continuation = `\n${list[1]}${marker}${list[3]}${list[4] ? '[ ] ' : ''}`;
      replaceRange(caret, caret, continuation, continuation.length);
    } else if (quote) {
      event.preventDefault();
      if (!quote[2].trim()) replaceRange(lineStart, caret, '', 0);
      else replaceRange(caret, caret, `\n${quote[1]}`, quote[1].length + 1);
    }
  };

  textarea.addEventListener('input', updateMenu);
  textarea.addEventListener('keydown', (event) => {
    if (menu.classList.contains('visible')) {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
        event.preventDefault();
        activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        renderMenu();
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && matches[activeIndex]) {
        event.preventDefault();
        choose(matches[activeIndex].id);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
    }
    if (event.key === 'Tab') indent(event);
    else if (event.key === 'Enter' && !event.shiftKey) continueBlock(event);
  });
}
