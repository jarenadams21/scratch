import { createElement } from '../engine/main.js';
import {
  createSource, deleteSource, isLoggedIn, updateSource, uploadSourcePdf,
} from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

function sourceUsageCount(id) {
  return (AppState.entries || []).filter(entry => (entry.sourceIds || []).includes(id)).length;
}

function sourceByline(source) {
  return [source.creator, source.publication, source.publishedAt].filter(Boolean).join(' · ');
}

function SourceCard({ source, isAdmin }) {
  const uses = sourceUsageCount(source.id);
  return createElement('article', { className: 'source-card' },
    createElement('div', { className: 'source-card-topline' },
      createElement('span', { className: `source-kind source-kind-${source.type}` },
        source.type === 'pdf' ? 'PDF' : 'WEB'
      ),
      createElement('span', { className: 'source-usage' },
        `${uses} ${uses === 1 ? 'PIECE' : 'PIECES'}`
      )
    ),
    createElement('h2', null, source.title),
    sourceByline(source)
      ? createElement('p', { className: 'source-byline' }, sourceByline(source))
      : null,
    source.description
      ? createElement('p', { className: 'source-description' }, source.description)
      : null,
    createElement('footer', { className: 'source-card-actions' },
      createElement('a', {
        href: source.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'source-open',
      }, source.type === 'pdf' ? 'VIEW PDF ↗' : 'VISIT SOURCE ↗'),
      isAdmin
        ? createElement('button', {
            type: 'button',
            className: 'source-edit',
            onClick: () => updateState({
              sourceEditorOpen: true,
              sourceEditingId: source.id,
              sourceDraftType: source.type,
            }),
          }, 'EDIT')
        : null
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
  const isAdmin = isLoggedIn();
  return createElement('div', { className: 'sources-view' },
    createElement('header', { className: 'sources-header' },
      createElement('div', null,
        createElement('span', { className: 'sources-kicker' }, 'RESEARCH INDEX'),
        createElement('h1', null, 'SOURCE LIBRARY'),
        createElement('p', null, 'The documents and websites behind the work in Harbinger.')
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
      ? createElement('div', { className: 'source-grid' },
          ...sources.map(source => createElement(SourceCard, {
            key: source.id, source, isAdmin,
          }))
        )
      : createElement('div', { className: 'sources-empty' },
          isAdmin ? 'NO SOURCES YET · ADD A WEBSITE OR PDF' : 'NO SOURCES HAVE BEEN PUBLISHED'
        ),
    isAdmin && AppState.sourceEditorOpen ? createElement(SourceEditor, {}) : null
  );
}
