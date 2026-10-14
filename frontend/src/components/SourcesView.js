import { createElement } from '../engine/main.js';
import {
  createSource, deleteSource, isLoggedIn, updateSource, uploadSourcePdf,
} from '../lib/api.js';
import { formatFileSize, formatShortDate } from '../lib/format.js';
import {
  indexedSources,
  linkedEntriesForSource,
  SOURCE_INDEX_FILTERS,
  SOURCE_INDEX_SORTS,
  sourceDomain,
  sourceFilterCounts,
  sourceRecordCodes,
  sourceUsageMap,
} from '../lib/source-index.js';
import { AppState, updateState } from '../lib/state.js';

let searchInputNode = null;
let shortcutsInstalled = false;

function installSourceShortcuts() {
  if (shortcutsInstalled || typeof document === 'undefined') return;
  shortcutsInstalled = true;
  document.addEventListener('keydown', event => {
    if (AppState.currentView !== 'sources') return;
    const target = event.target;
    const isTyping = target?.matches?.('input, textarea, select')
      || target?.isContentEditable;
    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      searchInputNode?.focus();
    } else if (event.key === 'Escape' && target === searchInputNode && AppState.sourceQuery) {
      event.preventDefault();
      updateState({ sourceQuery: '' });
    }
  });
}

function sourceUsageCount(id) {
  return (AppState.entries || []).filter(entry => (entry.sourceIds || []).includes(id)).length;
}

function sourceByline(source) {
  return [source.creator, source.publication, source.publishedAt].filter(Boolean).join(' · ');
}

function openSourceEditor(source) {
  updateState({
    sourceEditorOpen: true,
    sourceEditingId: source.id,
    sourceDraftType: source.type,
  });
}

function selectLinkedEntry(entry) {
  updateState({
    currentView: 'archive',
    selectedEntry: entry,
    archiveMode: entry.status === 'draft' ? 'drafts' : 'published',
    archiveShelfId: null,
  });
}

function SourceIndexRow({ source, code, uses, selected }) {
  const byline = sourceByline(source);
  const moveFocus = event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const list = event.currentTarget.closest('ol');
    const buttons = [...(list?.querySelectorAll('.source-index-row') || [])];
    const current = buttons.indexOf(event.currentTarget);
    if (current < 0) return;
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(current + 1, buttons.length - 1)
          : Math.max(current - 1, 0);
    buttons[next]?.focus();
  };
  return createElement('li', { className: selected ? 'source-index-item selected' : 'source-index-item' },
    createElement('button', {
      type: 'button',
      className: 'source-index-row',
      onClick: () => updateState({ selectedSourceId: source.id }),
      onKeyDown: moveFocus,
      'aria-current': selected ? 'true' : 'false',
      'aria-label': `${source.title}, ${source.type === 'pdf' ? 'PDF' : 'website'}, cited by ${uses} ${uses === 1 ? 'piece' : 'pieces'}`,
    },
      createElement('span', { className: 'source-index-code' }, code),
      createElement('span', { className: 'source-index-main' },
        createElement('strong', null, source.title),
        byline
          ? createElement('span', { className: 'source-index-byline' }, byline)
          : createElement('span', { className: 'source-index-byline' }, sourceDomain(source))
      ),
      createElement('span', { className: `source-kind source-kind-${source.type}` },
        source.type === 'pdf' ? 'PDF' : 'WEB'
      ),
      createElement('span', { className: 'source-index-uses' },
        String(uses).padStart(2, '0')
      ),
      createElement('span', { className: 'source-index-arrow', 'aria-hidden': 'true' }, '→')
    )
  );
}

function SourceRecordDetail({ source, code, linkedEntries, isAdmin }) {
  if (!source) return createElement('aside', { className: 'source-record-detail empty' },
    createElement('span', { className: 'source-record-empty-mark', 'aria-hidden': 'true' }, '⌁'),
    createElement('p', null, 'Select a record to inspect its source note and linked writing.')
  );

  const domain = sourceDomain(source);
  const facts = [
    ['FORMAT', source.type === 'pdf' ? 'PDF DOCUMENT' : 'WEBSITE'],
    source.creator ? ['CREATOR', source.creator] : null,
    source.publication ? ['PUBLICATION', source.publication] : null,
    source.publishedAt ? ['PUBLISHED', source.publishedAt] : null,
    domain ? [source.type === 'pdf' ? 'FILE' : 'DOMAIN', domain] : null,
    source.fileSize ? ['SIZE', formatFileSize(source.fileSize)] : null,
    source.createdAt ? ['ADDED', formatShortDate(source.createdAt)] : null,
  ].filter(Boolean);

  return createElement('aside', {
    className: 'source-record-detail',
    'aria-label': `Selected source: ${source.title}`,
  },
    createElement('header', { className: 'source-record-header' },
      createElement('div', { className: 'source-record-labels' },
        createElement('span', { className: 'source-record-code' }, code),
        createElement('span', { className: `source-kind source-kind-${source.type}` },
          source.type === 'pdf' ? 'PDF' : 'WEB'
        )
      ),
      isAdmin
        ? createElement('button', {
            type: 'button',
            className: 'source-record-edit',
            onClick: () => openSourceEditor(source),
          }, 'EDIT RECORD')
        : null
    ),
    createElement('h2', null, source.title),
    source.description
      ? createElement('p', { className: 'source-record-description' }, source.description)
      : null,
    createElement('dl', { className: 'source-record-facts' },
      ...facts.flatMap(([label, value]) => [
        createElement('dt', { key: `${label}-term` }, label),
        createElement('dd', { key: `${label}-value` }, value),
      ])
    ),
    createElement('a', {
      href: source.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'source-record-open',
    }, source.type === 'pdf' ? 'OPEN DOCUMENT ↗' : 'VISIT ORIGINAL ↗'),
    createElement('section', { className: 'source-linked-writing' },
      createElement('div', { className: 'source-linked-heading' },
        createElement('span', null, 'LINKED WRITING'),
        createElement('strong', null, String(linkedEntries.length).padStart(2, '0'))
      ),
      linkedEntries.length
        ? createElement('ol', null,
            ...linkedEntries.map(entry => createElement('li', { key: entry.entryId },
              createElement('button', {
                type: 'button',
                onClick: () => selectLinkedEntry(entry),
              },
                createElement('span', null, entry.title || 'Untitled'),
                createElement('span', { 'aria-hidden': 'true' }, '→')
              )
            ))
          )
        : createElement('p', null, 'Retained in the index; not yet cited by a transmission.')
    )
  );
}

function SourceEditor() {
  const sources = AppState.sources || [];
  const editing = sources.find(source => source.id === AppState.sourceEditingId) || null;
  const type = editing?.type || AppState.sourceDraftType || 'website';
  let formNode;
  let statusNode;
  let saveNode;

  const close = () => updateState({
    sourceEditorOpen: false,
    sourceEditingId: null,
  });

  const setStatus = (message, state = '') => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  };

  const save = async event => {
    event.preventDefault();
    if (saveNode) saveNode.disabled = true;
    setStatus(editing ? 'Updating source…' : 'Adding source…', 'saving');
    try {
      const values = {
        type,
        title: formNode.elements.title.value,
        creator: formNode.elements.creator.value,
        publication: formNode.elements.publication.value,
        publishedAt: formNode.elements.publishedAt.value,
        description: formNode.elements.description.value,
      };
      if (type === 'website') {
        values.url = formNode.elements.url.value;
      } else if (!editing) {
        const file = formNode.elements.pdf.files?.[0];
        const uploaded = await uploadSourcePdf(file);
        Object.assign(values, uploaded);
        if (uploaded.documentUrl) values.url = uploaded.documentUrl;
      }
      const saved = editing
        ? await updateSource(editing.id, values)
        : await createSource(values);
      const next = editing
        ? sources.map(source => source.id === saved.id ? saved : source)
        : [...sources, saved];
      updateState({
        sources: next.sort((a, b) => a.title.localeCompare(b.title)),
        selectedSourceId: saved.id,
        sourceEditorOpen: false,
        sourceEditingId: null,
      });
    } catch (err) {
      setStatus('Could not save source: ' + err.message, 'error');
      if (saveNode) saveNode.disabled = false;
    }
  };

  const remove = async () => {
    if (!editing) return;
    const count = sourceUsageCount(editing.id);
    if (!confirm(
      `Delete “${editing.title}” from the source library?\n\n` +
      `${count} ${count === 1 ? 'piece' : 'pieces'} will have this citation removed. The writing itself will not be changed.`
    )) return;
    if (saveNode) saveNode.disabled = true;
    setStatus('Deleting source…', 'saving');
    try {
      await deleteSource(editing.id);
      const unlink = entry => (entry?.sourceIds || []).includes(editing.id)
        ? { ...entry, sourceIds: entry.sourceIds.filter(id => id !== editing.id) }
        : entry;
      updateState({
        sources: sources.filter(source => source.id !== editing.id),
        entries: (AppState.entries || []).map(unlink),
        selectedEntry: unlink(AppState.selectedEntry),
        editingEntry: unlink(AppState.editingEntry),
        selectedSourceId: null,
        sourceEditorOpen: false,
        sourceEditingId: null,
      });
    } catch (err) {
      setStatus('Could not delete source: ' + err.message, 'error');
      if (saveNode) saveNode.disabled = false;
    }
  };

  return createElement('div', {
    className: 'source-editor-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': editing ? 'Edit source' : 'Add source',
  },
    createElement('form', {
      className: 'source-editor',
      onSubmit: save,
      ref: node => { formNode = node; },
      key: editing?.id || `new-${type}`,
    },
      createElement('header', { className: 'source-editor-header' },
        createElement('div', null,
          createElement('span', { className: 'source-editor-kicker' }, type === 'pdf' ? 'DOCUMENT RECORD' : 'WEB RECORD'),
          createElement('h2', null, editing ? 'EDIT SOURCE' : `ADD ${type === 'pdf' ? 'PDF' : 'WEBSITE'}`)
        ),
        createElement('button', { type: 'button', className: 'close-btn', onClick: close }, '✕')
      ),
      createElement('div', { className: 'source-editor-fields' },
        createElement('label', null,
          createElement('span', null, 'TITLE'),
          createElement('input', {
            name: 'title', required: true, maxLength: 240,
            defaultValue: editing?.title || '',
          })
        ),
        createElement('div', { className: 'source-editor-row' },
          createElement('label', null,
            createElement('span', null, 'AUTHOR / CREATOR'),
            createElement('input', {
              name: 'creator', maxLength: 160,
              defaultValue: editing?.creator || '',
            })
          ),
          createElement('label', null,
            createElement('span', null, 'DATE'),
            createElement('input', {
              name: 'publishedAt', maxLength: 80,
              placeholder: '2026 or October 1, 2026',
              defaultValue: editing?.publishedAt || '',
            })
          )
        ),
        createElement('label', null,
          createElement('span', null, 'PUBLICATION / WEBSITE'),
          createElement('input', {
            name: 'publication', maxLength: 160,
            defaultValue: editing?.publication || '',
          })
        ),
        type === 'website'
          ? createElement('label', null,
              createElement('span', null, 'URL'),
              createElement('input', {
                type: 'url', name: 'url', required: true, maxLength: 2048,
                placeholder: 'https://…',
                defaultValue: editing?.url || '',
              })
            )
          : editing
            ? createElement('p', { className: 'source-file-note' },
                `FILE · ${editing.filename || 'PDF document'} · Replace by creating a new PDF source.`
              )
            : createElement('label', { className: 'source-file-field' },
                createElement('span', null, 'PDF FILE · MAX 25MB'),
                createElement('input', {
                  type: 'file', name: 'pdf', accept: 'application/pdf,.pdf', required: true,
                })
              ),
        createElement('label', null,
          createElement('span', null, 'NOTES'),
          createElement('textarea', {
            name: 'description', rows: 5, maxLength: 1000,
            defaultValue: editing?.description || '',
            placeholder: 'Why this source matters or what it contains.',
          })
        )
      ),
      createElement('p', {
        className: 'source-editor-status',
        ref: node => { statusNode = node; },
        'aria-live': 'polite',
      }, editing ? `${sourceUsageCount(editing.id)} linked pieces` : 'This source will be visible in the public library.'),
      createElement('footer', { className: 'source-editor-actions' },
        editing
          ? createElement('button', {
              type: 'button', className: 'source-delete', onClick: remove,
            }, 'DELETE SOURCE')
          : null,
        createElement('button', {
          type: 'submit', className: 'publish-btn',
          ref: node => { saveNode = node; },
        }, editing ? 'SAVE CHANGES' : 'ADD TO LIBRARY')
      )
    )
  );
}

export function SourcesView() {
  const sources = AppState.sources || [];
  const entries = AppState.entries || [];
  const isAdmin = isLoggedIn();
  const usage = sourceUsageMap(entries);
  const codes = sourceRecordCodes(sources);
  const counts = sourceFilterCounts(sources, usage);
  const results = indexedSources({
    sources,
    entries,
    query: AppState.sourceQuery,
    filter: AppState.sourceFilter,
    sort: AppState.sourceSort,
  });
  const selected = results.find(source => source.id === AppState.selectedSourceId)
    || results[0]
    || null;
  const linkedEntries = selected ? linkedEntriesForSource(selected.id, entries) : [];

  installSourceShortcuts();

  return createElement('div', { className: 'sources-view' },
    createElement('header', { className: 'sources-header' },
      createElement('div', null,
        createElement('span', { className: 'sources-kicker' }, 'RESEARCH INDEX'),
        createElement('h1', null, 'SOURCE LIBRARY'),
        createElement('p', null,
          `${sources.length} ${sources.length === 1 ? 'record' : 'records'} · ${counts.cited} cited`
        )
      ),
      isAdmin
        ? createElement('div', { className: 'sources-create-actions' },
            createElement('button', {
              type: 'button',
              onClick: () => updateState({
                sourceEditorOpen: true, sourceEditingId: null, sourceDraftType: 'website',
              }),
            }, '+ WEBSITE'),
            createElement('button', {
              type: 'button',
              onClick: () => updateState({
                sourceEditorOpen: true, sourceEditingId: null, sourceDraftType: 'pdf',
              }),
            }, '+ PDF')
          )
        : null
    ),
    sources.length
      ? createElement('main', { className: 'source-index-shell' },
          createElement('div', { className: 'source-index-tools' },
            createElement('label', { className: 'source-search' },
              createElement('span', { className: 'source-search-mark', 'aria-hidden': 'true' }, '/'),
              createElement('input', {
                type: 'search',
                value: AppState.sourceQuery,
                'aria-label': 'Search source records',
                placeholder: 'Search title, creator, publication, domain, or linked writing',
                onInput: event => updateState({ sourceQuery: event.target.value }),
                ref: node => { searchInputNode = node; },
              }),
              AppState.sourceQuery
                ? createElement('button', {
                    type: 'button',
                    className: 'source-search-clear',
                    onClick: () => updateState({ sourceQuery: '' }),
                    'aria-label': 'Clear source search',
                  }, 'CLEAR')
                : createElement('kbd', null, '/')
            ),
            createElement('div', { className: 'source-index-controls' },
              createElement('div', {
                className: 'source-filter-tabs',
                role: 'group',
                'aria-label': 'Filter source records',
              },
                ...SOURCE_INDEX_FILTERS.map(option => createElement('button', {
                  key: option.id,
                  type: 'button',
                  className: AppState.sourceFilter === option.id ? 'active' : '',
                  onClick: () => updateState({
                    sourceFilter: option.id,
                    selectedSourceId: null,
                  }),
                  'aria-pressed': AppState.sourceFilter === option.id ? 'true' : 'false',
                },
                  createElement('span', null, option.label.toUpperCase()),
                  createElement('small', null, String(counts[option.id]).padStart(2, '0'))
                ))
              ),
              createElement('label', { className: 'source-sort' },
                createElement('span', null, 'ORDER'),
                createElement('select', {
                  value: AppState.sourceSort,
                  onChange: event => updateState({
                    sourceSort: event.target.value,
                    selectedSourceId: null,
                  }),
                },
                  ...SOURCE_INDEX_SORTS.map(option => createElement('option', {
                    key: option.id,
                    value: option.id,
                  }, option.label))
                )
              )
            )
          ),
          createElement('div', { className: 'source-index-status', 'aria-live': 'polite' },
            createElement('span', null,
              `${results.length} OF ${sources.length} ${sources.length === 1 ? 'RECORD' : 'RECORDS'}`
            ),
            createElement('span', null, 'USE ↑↓ TO SCAN · ENTER TO INSPECT')
          ),
          createElement('div', { className: 'source-index-workspace' },
            createElement('section', {
              className: 'source-index-ledger',
              'aria-label': 'Source records',
            },
              results.length
                ? createElement('ol', null,
                    ...results.map(source => createElement(SourceIndexRow, {
                      key: source.id,
                      source,
                      code: codes.get(source.id),
                      uses: usage.get(source.id) || 0,
                      selected: selected?.id === source.id,
                    }))
                  )
                : createElement('div', { className: 'source-index-no-results' },
                    createElement('strong', null, 'NO MATCHING RECORDS'),
                    createElement('p', null, 'Try a broader term or clear the active filter.'),
                    createElement('button', {
                      type: 'button',
                      onClick: () => updateState({
                        sourceQuery: '',
                        sourceFilter: 'all',
                      }),
                    }, 'RESET INDEX')
                  )
            ),
            createElement(SourceRecordDetail, {
              source: selected,
              code: selected ? codes.get(selected.id) : null,
              linkedEntries,
              isAdmin,
            })
          )
        )
      : createElement('div', { className: 'sources-empty' },
          isAdmin ? 'NO SOURCES YET · ADD A WEBSITE OR PDF' : 'NO SOURCES HAVE BEEN PUBLISHED'
        ),
    isAdmin && AppState.sourceEditorOpen ? createElement(SourceEditor, {}) : null
  );
}
