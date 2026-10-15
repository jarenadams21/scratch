import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';
import { createEdition, currentUserEmail, deleteEdition, updateEdition } from '../lib/api.js';
import { editionsLoader } from '../lib/loaders.js';
import { formatCompactDate } from '../lib/format.js';
import { plainText, renderCanvasMarkdown, renderMarkdown } from '../lib/markdown.js';
import {
  blocksForEdition,
  editionNumber,
  editionWordCount,
  entriesForEdition,
  entryReadingMinutes,
  entryWordCount,
  isLongformEntry,
} from '../lib/editions.js';

let editionsScrollNode = null;
let pendingScrollTop = null;
let pendingReturnEntryId = null;
let pendingReaderFocus = false;
let pendingManagerFocus = false;
let restoreScheduled = false;
let shortcutsInstalled = false;
let editionSelectorToggleNode = null;

function scheduleRestore() {
  if (restoreScheduled || typeof requestAnimationFrame === 'undefined') return;
  restoreScheduled = true;
  requestAnimationFrame(() => {
    restoreScheduled = false;
    if (editionsScrollNode && pendingScrollTop != null) {
      editionsScrollNode.scrollTop = pendingScrollTop;
      pendingScrollTop = null;
    }
    if (pendingReturnEntryId) {
      editionsScrollNode
        ?.querySelector(`[data-edition-entry="${CSS.escape(pendingReturnEntryId)}"]`)
        ?.focus({ preventScroll: true });
      pendingReturnEntryId = null;
    }
    if (pendingReaderFocus) {
      document.querySelector('.edition-reader-close')?.focus({ preventScroll: true });
      pendingReaderFocus = false;
    }
    if (pendingManagerFocus) {
      document.querySelector('.edition-manager input[name="number"]')?.focus({ preventScroll: true });
      pendingManagerFocus = false;
    }
  });
}

function closeReader() {
  const id = AppState.editionReadingEntryId;
  pendingScrollTop = editionsScrollNode?.scrollTop ?? null;
  pendingReturnEntryId = id;
  updateState({ editionReadingEntryId: null });
}

function installShortcuts() {
  if (shortcutsInstalled || typeof document === 'undefined') return;
  shortcutsInstalled = true;
  document.addEventListener('keydown', event => {
    if (AppState.currentView !== 'editions') return;
    if (AppState.editionReadingEntryId && event.key === 'Escape') {
      event.preventDefault();
      closeReader();
    } else if (AppState.editionEditorOpen && event.key === 'Escape') {
      event.preventDefault();
      updateState({
        editionEditorOpen: false,
        editionEditingId: null,
        editionDraft: null,
        editionDraftEntryIds: [],
        editionDraftBlocks: [],
      });
    } else if (AppState.editionSelectorOpen && event.key === 'Escape') {
      event.preventDefault();
      updateState({ editionSelectorOpen: false });
      requestAnimationFrame(() => editionSelectorToggleNode?.focus({ preventScroll: true }));
    }
  });
  document.addEventListener('pointerdown', event => {
    if (
      AppState.currentView === 'editions'
      && AppState.editionSelectorOpen
      && !event.target?.closest?.('.edition-selector')
    ) {
      updateState({ editionSelectorOpen: false });
    }
  });
}

function openReader(entryId) {
  pendingScrollTop = editionsScrollNode?.scrollTop ?? null;
  pendingReaderFocus = true;
  updateState({ editionReadingEntryId: entryId });
}

function sourceList(entry) {
  const sources = (entry.sourceIds || [])
    .map(id => (AppState.sources || []).find(source => source.id === id))
    .filter(Boolean);
  if (!sources.length) return null;
  return createElement('section', { className: 'edition-reader-sources' },
    createElement('div', { className: 'edition-section-label' }, 'DOCUMENTARY RECORD'),
    createElement('ol', null,
      ...sources.map(source => createElement('li', { key: source.id },
        createElement('a', {
          href: source.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        }, source.title),
        createElement('span', null,
          [source.creator, source.publication, source.publishedAt].filter(Boolean).join(' · ')
        )
      ))
    )
  );
}

function PaperReader({ entry, edition, sequence }) {
  const index = sequence.findIndex(item => item.entryId === entry.entryId);
  const onBackdrop = event => {
    if (event.target === event.currentTarget) closeReader();
  };
  const onKeyDown = event => {
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button, a[href]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  return createElement('div', {
    className: 'edition-reader-overlay',
    role: 'presentation',
    onClick: onBackdrop,
  },
    createElement('article', {
      className: 'edition-reader',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'edition-reader-title',
      onKeyDown,
    },
      createElement('header', { className: 'edition-reader-header' },
        createElement('div', null,
          createElement('div', { className: 'edition-section-label' },
            `ISSUE ${edition.number || ''} / FOLIO ${String(index + 1).padStart(2, '0')}`
          ),
          createElement('h1', { id: 'edition-reader-title' }, entry.title || 'Untitled'),
          createElement('div', { className: 'edition-reader-meta' },
            formatCompactDate(entry.createdAt),
            ' · ',
            `${entryWordCount(entry).toLocaleString()} WORDS`,
            ' · ',
            `${entryReadingMinutes(entry)} MIN READ`
          )
        ),
        createElement('button', {
          type: 'button',
          className: 'edition-reader-close',
          onClick: closeReader,
          'aria-label': 'Close focused paper',
        }, 'CLOSE')
      ),
      createElement('div', { className: 'edition-reader-rule' }),
      entry.canvasLayout
        ? renderCanvasMarkdown(entry.content, entry.canvasLayout, { label: `Layout for ${entry.title || 'paper'}` })
        : createElement('div', { className: 'reading-content edition-reader-content' },
            ...renderMarkdown(entry.content)
          ),
      sourceList(entry),
      createElement('footer', { className: 'edition-reader-footer' },
        createElement('span', null, 'END OF DOCUMENT'),
        createElement('button', { type: 'button', onClick: closeReader }, 'RETURN TO ISSUE')
      )
    )
  );
}

function LongformThreshold({ entry, index }) {
  const preview = plainText(entry.content);
  return createElement('button', {
    type: 'button',
    className: 'edition-paper-threshold',
    onClick: () => openReader(entry.entryId),
    'data-edition-entry': entry.entryId,
  },
    createElement('span', { className: 'edition-folio' }, String(index + 1).padStart(2, '0')),
    createElement('span', { className: 'edition-paper-copy' },
      createElement('span', { className: 'edition-section-label' }, 'PAPER'),
      createElement('strong', null, entry.title || 'Untitled'),
      createElement('span', { className: 'edition-paper-preview' },
        preview.slice(0, 180) + (preview.length > 180 ? '…' : '')
      ),
      createElement('span', { className: 'edition-paper-meta' },
        `${entryWordCount(entry).toLocaleString()} WORDS · ${entryReadingMinutes(entry)} MIN · ${(entry.sourceIds || []).length} SOURCES`
      )
    ),
    createElement('span', { className: 'edition-paper-open', 'aria-hidden': 'true' }, 'OPEN ↗')
  );
}

function InlineTransmission({ entry, index }) {
  const sourceCount = (entry.sourceIds || []).length;
  return createElement('article', {
    className: 'edition-transmission',
    'data-edition-entry': entry.entryId,
    tabIndex: 0,
  },
    createElement('header', { className: 'edition-transmission-header' },
      createElement('span', { className: 'edition-folio' }, String(index + 1).padStart(2, '0')),
      createElement('div', null,
        createElement('h2', null, entry.title || 'Untitled'),
        createElement('div', { className: 'edition-transmission-date' },
          formatCompactDate(entry.createdAt),
          sourceCount
            ? ` · ${sourceCount} SOURCE${sourceCount === 1 ? '' : 'S'}`
            : ''
        )
      )
    ),
    entry.canvasLayout
      ? renderCanvasMarkdown(entry.content, entry.canvasLayout, { label: `Layout for ${entry.title || 'transmission'}` })
      : createElement('div', { className: 'reading-content edition-transmission-content' },
          ...renderMarkdown(entry.content)
        )
  );
}

function EditionCover({ edition, index, entries, sourceCount, isAdmin, onEdit }) {
  return createElement('header', { className: 'edition-cover' },
    createElement('div', { className: 'edition-cover-index' },
      createElement('div', { className: 'edition-cover-register' },
        createElement('span', null, `ISSUE ${editionNumber(edition, index)}`),
        createElement('span', null, formatCompactDate(edition.createdAt))
      ),
      isAdmin
        ? createElement('div', { className: 'edition-cover-admin' },
            createElement('span', null, edition.visibility === 'public' ? 'PUBLIC' : 'DRAFT'),
            createElement('button', { type: 'button', onClick: onEdit }, 'EDIT')
          )
        : null
    ),
    createElement('h1', null, edition.title),
    edition.subtitle ? createElement('p', { className: 'edition-subtitle' }, edition.subtitle) : null,
    edition.description ? createElement('p', { className: 'edition-description' }, edition.description) : null,
    createElement('div', { className: 'edition-cover-meta' },
      createElement('span', null, `${entries.length} PIECE${entries.length === 1 ? '' : 'S'}`),
      sourceCount
        ? createElement('span', null, `${sourceCount} SOURCE${sourceCount === 1 ? '' : 'S'}`)
        : null,
      createElement('span', null, `${editionWordCount(entries).toLocaleString()} WORDS`)
    )
  );
}

function newBlockId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftForEdition(edition) {
  return {
    number: String(edition?.number || ''),
    title: String(edition?.title || ''),
    subtitle: String(edition?.subtitle || ''),
    description: String(edition?.description || ''),
    visibility: edition?.visibility === 'public' ? 'public' : 'draft',
  };
}

function changeDraftField(field, value) {
  if (!AppState.editionDraft) AppState.editionDraft = draftForEdition(null);
  AppState.editionDraft[field] = value;
}

function changeDraftBlocks(next) {
  const supported = next.filter(block => block.type === 'entry' || block.type === 'source');
  updateState({
    editionDraftBlocks: supported,
    editionDraftEntryIds: supported.filter(block => block.type === 'entry').map(block => block.entryId),
  });
}

function EditionManager() {
  const editing = (AppState.editions || []).find(item => item.id === AppState.editionEditingId) || null;
  const draft = AppState.editionDraft || draftForEdition(editing);
  if (!AppState.editionDraft) AppState.editionDraft = draft;
  const blocks = (AppState.editionDraftBlocks || [])
    .filter(block => block.type === 'entry' || block.type === 'source');
  const selectedEntryIds = blocks.filter(block => block.type === 'entry').map(block => block.entryId);
  const selectedSourceIds = blocks.filter(block => block.type === 'source').map(block => block.sourceId);
  const eligibleEntries = (AppState.entries || [])
    .filter(entry => {
      const author = entry.author
        || (typeof entry.pk === 'string' && entry.pk.startsWith('USER#') ? entry.pk.slice(5) : null);
      return entry.status !== 'draft'
        && entry.visibility !== 'admins'
        && (!author || author === currentUserEmail());
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const eligibleSources = [...(AppState.sources || [])]
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  const close = () => updateState({
    editionEditorOpen: false,
    editionEditingId: null,
    editionDraft: null,
    editionDraftEntryIds: [],
    editionDraftBlocks: [],
  });
  const toggleEntry = id => changeDraftBlocks(
    selectedEntryIds.includes(id)
      ? blocks.filter(block => block.type !== 'entry' || block.entryId !== id)
      : [...blocks, { id: newBlockId('entry'), type: 'entry', entryId: id }]
  );
  const toggleSource = id => changeDraftBlocks(
    selectedSourceIds.includes(id)
      ? blocks.filter(block => block.type !== 'source' || block.sourceId !== id)
      : [...blocks, { id: newBlockId('source'), type: 'source', sourceId: id }]
  );
  const move = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    changeDraftBlocks(next);
  };
  const removeBlock = id => changeDraftBlocks(blocks.filter(block => block.id !== id));
  const save = async event => {
    event.preventDefault();
    const value = {
      number: draft.number,
      title: draft.title,
      subtitle: draft.subtitle,
      description: draft.description,
      visibility: draft.visibility,
      blocks,
      entryIds: blocks.filter(block => block.type === 'entry').map(block => block.entryId),
    };
    try {
      if (editing) await updateEdition(editing.id, value);
      else await createEdition(value);
      close();
      editionsLoader.reload();
    } catch (error) {
      alert(`Could not save edition: ${error.message}`);
    }
  };
  const remove = async () => {
    if (!editing || !confirm(`Delete “${editing.title}”? The transmissions will remain in the Archive.`)) return;
    try {
      await deleteEdition(editing.id);
      close();
      updateState({ selectedEditionId: null });
      editionsLoader.reload();
    } catch (error) {
      alert(`Could not delete edition: ${error.message}`);
    }
  };
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  return createElement('div', {
    className: 'edition-manager-overlay',
    role: 'presentation',
    onClick: event => { if (event.target === event.currentTarget) close(); },
  },
    createElement('form', {
      className: 'edition-manager',
      onSubmit: save,
      onKeyDown: trapFocus,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'edition-manager-title',
    },
      createElement('header', null,
        createElement('div', null,
          createElement('div', { className: 'edition-section-label' }, editing ? 'MAGAZINE EDITOR' : 'NEW ISSUE'),
          createElement('h2', { id: 'edition-manager-title' }, editing ? editing.title : 'Create an Issue')
        ),
        createElement('button', { type: 'button', onClick: close, 'aria-label': 'Close zine editor' }, 'CLOSE')
      ),
      createElement('div', { className: 'edition-manager-fields' },
        createElement('label', null,
          createElement('span', null, 'ISSUE NUMBER / LABEL'),
          createElement('input', {
            name: 'number',
            maxLength: 24,
            value: draft.number,
            onInput: event => changeDraftField('number', event.target.value),
          })
        ),
        createElement('label', null,
          createElement('span', null, 'TITLE'),
          createElement('input', {
            name: 'title',
            maxLength: 160,
            required: true,
            value: draft.title,
            onInput: event => changeDraftField('title', event.target.value),
          })
        ),
        createElement('label', null,
          createElement('span', null, 'SUBTITLE'),
          createElement('input', {
            name: 'subtitle',
            maxLength: 240,
            value: draft.subtitle,
            onInput: event => changeDraftField('subtitle', event.target.value),
          })
        ),
        createElement('label', { className: 'edition-manager-description' },
          createElement('span', null, 'EDITORIAL NOTE'),
          createElement('textarea', {
            name: 'description',
            maxLength: 1200,
            rows: 4,
            value: draft.description,
            onInput: event => changeDraftField('description', event.target.value),
          })
        ),
        createElement('label', { className: 'edition-publish-toggle' },
          createElement('input', {
            type: 'checkbox',
            name: 'published',
            checked: draft.visibility === 'public',
            onChange: event => changeDraftField(
              'visibility',
              event.target.checked ? 'public' : 'draft',
            ),
          }),
          createElement('span', null, 'PUBLISH THIS ISSUE')
        )
      ),
      createElement('section', { className: 'edition-sequence-builder' },
        createElement('div', { className: 'edition-manager-section-heading' },
        createElement('div', null,
          createElement('span', { className: 'edition-section-label' }, 'READING ORDER'),
          createElement('strong', null, `${blocks.length} ITEM${blocks.length === 1 ? '' : 'S'}`)
        )
        ),
        blocks.length
          ? createElement('ol', { className: 'edition-selected-entries' },
              ...blocks
                .map((block, index) => ({ block, index }))
                .map(({ block, index }) => {
                const record = block.type === 'entry'
                  ? eligibleEntries.find(item => item.entryId === block.entryId)
                  : eligibleSources.find(item => item.id === block.sourceId);
                const label = record?.title || `Unavailable ${block.type}`;
                return createElement('li', {
                  key: block.id,
                  className: `edition-block-editor edition-block-editor-${block.type}`,
                },
                createElement('span', { className: 'edition-selected-index' }, String(index + 1).padStart(2, '0')),
                createElement('div', { className: 'edition-block-editor-body' },
                  createElement('span', { className: 'edition-section-label' },
                    block.type === 'entry' ? 'PIECE' : 'SOURCE'
                  ),
                  createElement('strong', { className: 'edition-selected-title' }, label)
                ),
                createElement('span', { className: 'edition-selected-actions' },
                  createElement('button', {
                    type: 'button',
                    onClick: () => move(index, -1),
                    disabled: index === 0,
                    'aria-label': `Move ${label} earlier`,
                  }, '↑'),
                  createElement('button', {
                    type: 'button',
                    onClick: () => move(index, 1),
                    disabled: index === blocks.length - 1,
                    'aria-label': `Move ${label} later`,
                  }, '↓'),
                  createElement('button', {
                    type: 'button',
                    onClick: () => removeBlock(block.id),
                    'aria-label': `Remove ${label} from issue`,
                    title: 'Remove block',
                  }, 'DEL')
                )
              );})
            )
          : createElement('div', { className: 'edition-manager-empty' }, 'SELECT PIECES OR SOURCES BELOW'),
        createElement('div', { className: 'edition-pool-label' }, 'PIECES'),
        createElement('div', { className: 'edition-entry-pool' },
          ...eligibleEntries.map(entry => {
            const selected = selectedEntryIds.includes(entry.entryId);
            return createElement('button', {
              key: entry.entryId,
              type: 'button',
              className: selected ? 'selected' : '',
              onClick: () => toggleEntry(entry.entryId),
              'aria-pressed': selected ? 'true' : 'false',
            },
              createElement('span', null, selected ? '✓' : '+'),
              createElement('strong', null, entry.title || 'Untitled'),
              createElement('small', null, formatCompactDate(entry.createdAt))
            );
          })
        ),
        createElement('div', { className: 'edition-pool-label' }, 'SOURCES'),
        eligibleSources.length
          ? createElement('div', { className: 'edition-entry-pool edition-source-pool' },
              ...eligibleSources.map(source => {
                const selected = selectedSourceIds.includes(source.id);
                return createElement('button', {
                  key: source.id,
                  type: 'button',
                  className: selected ? 'selected' : '',
                  onClick: () => toggleSource(source.id),
                  'aria-pressed': selected ? 'true' : 'false',
                },
                  createElement('span', null, selected ? '✓' : '+'),
                  createElement('strong', null, source.title || 'Untitled source'),
                  createElement('small', null, source.type === 'pdf' ? 'PDF' : 'WEB')
                );
              })
            )
          : createElement('div', { className: 'edition-manager-empty edition-source-empty' }, 'SOURCE LIBRARY EMPTY')
      ),
      createElement('footer', null,
        editing
          ? createElement('button', { type: 'button', className: 'edition-delete', onClick: remove }, 'DELETE ISSUE')
          : createElement('span', null),
        createElement('div', null,
          createElement('button', { type: 'button', onClick: close }, 'CANCEL'),
          createElement('button', { type: 'submit', className: 'edition-save' }, editing ? 'SAVE ISSUE' : 'CREATE ISSUE')
        )
      )
    )
  );
}

function EditionSource({ source, index }) {
  const byline = [source.creator, source.publication, source.publishedAt].filter(Boolean).join(' · ');
  return createElement('article', { className: 'edition-source-record' },
    createElement('span', { className: 'edition-folio' }, String(index + 1).padStart(2, '0')),
    createElement('div', { className: 'edition-source-record-body' },
      createElement('span', { className: 'edition-section-label' }, 'SOURCE'),
      createElement('h2', null, source.title || 'Untitled source'),
      byline ? createElement('p', { className: 'edition-source-byline' }, byline) : null,
      source.description ? createElement('p', { className: 'edition-source-description' }, source.description) : null,
      createElement('a', {
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }, source.type === 'pdf' ? 'OPEN DOCUMENT ↗' : 'VISIT ORIGINAL ↗')
    )
  );
}

function EditionSequenceBlock({ block, index, entries, sources }) {
  if (block.type === 'source') {
    const source = sources.find(item => item.id === block.sourceId);
    return source ? createElement(EditionSource, { source, index }) : null;
  }
  const entry = entries.find(item => item.entryId === block.entryId);
  if (!entry) return null;
  return isLongformEntry(entry)
    ? createElement(LongformThreshold, { key: block.id, entry, index })
    : createElement(InlineTransmission, { key: block.id, entry, index });
}

function EditionSelector({ editions, selected }) {
  const selectedIndex = Math.max(0, editions.findIndex(edition => edition.id === selected?.id));
  const open = AppState.editionSelectorOpen;
  const focusOption = direction => {
    requestAnimationFrame(() => {
      const options = [...(document.querySelectorAll('.edition-selector-option') || [])];
      if (!options.length) return;
      const target = direction === 'last' ? options.length - 1 : selectedIndex;
      options[Math.max(0, target)]?.focus({ preventScroll: true });
    });
  };
  const onToggleKeyDown = event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    updateState({ editionSelectorOpen: true });
    focusOption(event.key === 'ArrowUp' ? 'last' : 'selected');
  };
  const onOptionKeyDown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...event.currentTarget.closest('[role="listbox"]')
      .querySelectorAll('.edition-selector-option')];
    const current = options.indexOf(event.currentTarget);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length;
    options[next]?.focus({ preventScroll: true });
    options[next]?.scrollIntoView?.({ block: 'nearest' });
  };
  const choose = edition => updateState({
    selectedEditionId: edition.id,
    editionReadingEntryId: null,
    editionSelectorOpen: false,
  });

  return createElement('nav', { className: 'edition-selector', 'aria-label': 'Choose an issue' },
    createElement('button', {
      type: 'button',
      className: 'edition-selector-toggle',
      onClick: () => updateState({ editionSelectorOpen: !open }),
      onKeyDown: onToggleKeyDown,
      'aria-haspopup': 'listbox',
      'aria-expanded': open ? 'true' : 'false',
      ref: node => { editionSelectorToggleNode = node; },
    },
      createElement('span', { className: 'edition-selector-register' },
        createElement('small', null, 'CURRENT ISSUE'),
        createElement('strong', null, `ISSUE ${editionNumber(selected, selectedIndex)}`)
      ),
      createElement('span', { className: 'edition-selector-title' }, selected?.title || 'Untitled'),
      createElement('span', { className: 'edition-selector-count' },
        `${String(editions.length).padStart(2, '0')} TOTAL`
      ),
      createElement('span', { className: 'edition-selector-mark', 'aria-hidden': 'true' }, open ? '−' : '+')
    ),
    open
      ? createElement('div', {
          className: 'edition-selector-menu',
          role: 'listbox',
          'aria-label': 'Available issues',
        },
          ...editions.map((edition, index) => {
            const active = edition.id === selected?.id;
            return createElement('button', {
              key: edition.id,
              type: 'button',
              className: `edition-selector-option${active ? ' active' : ''}`,
              role: 'option',
              'aria-selected': active ? 'true' : 'false',
              onClick: () => choose(edition),
              onKeyDown: onOptionKeyDown,
            },
              createElement('span', { className: 'edition-selector-option-index' },
                editionNumber(edition, index)
              ),
              createElement('span', { className: 'edition-selector-option-copy' },
                createElement('small', null, `ISSUE ${editionNumber(edition, index)}`),
                createElement('strong', null, edition.title || 'Untitled')
              ),
              createElement('span', { className: 'edition-selector-option-meta' },
                edition.visibility === 'draft' ? 'DRAFT' : formatCompactDate(edition.createdAt)
              )
            );
          })
        )
      : null
  );
}

export function EditionsView({ isAdmin = false }) {
  installShortcuts();
  const allEditions = AppState.editions || [];
  const editions = isAdmin ? allEditions : allEditions.filter(edition => edition.visibility === 'public');
  const selected = editions.find(edition => edition.id === AppState.selectedEditionId)
    || editions.find(edition => edition.visibility === 'public')
    || editions[0]
    || null;
  const selectedIndex = selected ? editions.findIndex(edition => edition.id === selected.id) : 0;
  const sequence = selected
    ? entriesForEdition(selected, AppState.entries || [], { includePrivate: isAdmin })
    : [];
  const publicationBlocks = selected ? blocksForEdition(selected) : [];
  const editionSources = AppState.sources || [];
  const sourceCount = publicationBlocks.filter(block => (
    block.type === 'source' && editionSources.some(source => source.id === block.sourceId)
  )).length;
  const readingEntry = sequence.find(entry => entry.entryId === AppState.editionReadingEntryId) || null;
  const openManager = edition => {
    pendingManagerFocus = true;
    updateState({
      editionEditorOpen: true,
      editionEditingId: edition?.id || null,
      editionDraft: draftForEdition(edition),
      editionDraftEntryIds: [...(edition?.entryIds || [])],
      editionDraftBlocks: edition ? blocksForEdition(edition).map(block => ({ ...block })) : [],
    });
  };

  return createElement('div', {
    className: 'editions-view',
    ref: node => {
      editionsScrollNode = node;
      scheduleRestore();
    },
  },
    createElement('div', { className: 'editions-shell' },
      createElement('header', { className: 'editions-index-header' },
        createElement('h1', null, 'ZINES'),
        isAdmin
          ? createElement('button', { type: 'button', onClick: () => openManager(null) }, '+ NEW')
          : null
      ),
      editions.length > 1
        ? createElement(EditionSelector, { editions, selected })
        : null,
      AppState.editionsLoading
        ? createElement('div', { className: 'editions-empty' }, 'LOADING ISSUE INDEX…')
        : !selected
          ? createElement('div', { className: 'editions-empty' },
              createElement('strong', null, 'NO ISSUES PUBLISHED'),
              createElement('p', null, 'The Archive remains available while the first zine issue is assembled.'),
              isAdmin
                ? createElement('button', { type: 'button', onClick: () => openManager(null) }, 'CREATE THE FIRST ISSUE')
                : null
            )
          : createElement('main', { className: 'edition-publication' },
              createElement(EditionCover, {
                edition: selected,
                index: selectedIndex,
                entries: sequence,
                sourceCount,
                isAdmin,
                onEdit: () => openManager(selected),
              }),
              publicationBlocks.length
                ? createElement('div', { className: 'edition-sequence' },
                    ...publicationBlocks.map((block, index) => createElement(EditionSequenceBlock, {
                      key: block.id,
                      block,
                      index,
                      entries: sequence,
                      sources: editionSources,
                    }))
                  )
                : createElement('div', { className: 'editions-empty edition-empty-sequence' },
                    'THIS ISSUE HAS NO AVAILABLE PIECES.'
                  ),
              createElement('footer', { className: 'edition-colophon' },
                createElement('span', null, `END / ISSUE ${editionNumber(selected, selectedIndex)}`),
                createElement('span', null, selected.updatedAt ? `REV ${formatCompactDate(selected.updatedAt)}` : '')
              )
            )
    ),
    readingEntry ? createElement(PaperReader, {
      entry: readingEntry,
      edition: selected,
      sequence,
    }) : null,
    AppState.editionEditorOpen && isAdmin ? createElement(EditionManager) : null
  );
}
