import { createElement } from '../engine/main.js';
import { currentUserEmail, upsertPost } from '../lib/api.js';
import { installFormatter } from '../lib/formatter.js';
import { renderMarkdown } from '../lib/markdown.js';
import { AppState, updateState } from '../lib/state.js';
import { DEFAULT_VISIBILITY_FALLBACK } from './SettingsView.js';

const RECOVERY_KEY = 'harbinger-editor-draft-v2';
const AUTOSAVE_DELAY = 900;

function readRecoveryDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    return draft && typeof draft === 'object' ? draft : null;
  } catch {
    return null;
  }
}

function writeRecoveryDraft(draft) {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ ...draft, recoveredAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

function clearRecoveryDraft() {
  localStorage.removeItem(RECOVERY_KEY);
}

function DraftPicker({ drafts }) {
  if (!drafts.length) return null;
  return createElement('div', { className: 'draft-picker' },
    createElement('div', { className: 'draft-picker-label' }, 'SAVED DRAFTS'),
    createElement('div', { className: 'draft-picker-list' },
      ...drafts.map(draft => createElement('button', {
        type: 'button',
        className: AppState.editingEntry?.entryId === draft.entryId ? 'draft-chip active' : 'draft-chip',
        onClick: () => updateState({
          editingEntry: draft,
          editorMode: 'write',
          editorBuffer: null,
        }),
      },
        createElement('strong', null, draft.title || 'UNTITLED'),
        createElement('span', null, new Date(draft.updatedAt || draft.createdAt).toLocaleDateString('en-US'))
      ))
    )
  );
}

function PreviewSources({ sourceIds }) {
  const sources = (sourceIds || [])
    .map(id => (AppState.sources || []).find(source => source.id === id))
    .filter(Boolean);
  if (!sources.length) return null;
  return createElement('section', { className: 'reading-sources' },
    createElement('div', { className: 'reading-sources-rule' }),
    createElement('span', { className: 'reading-sources-kicker' }, 'SOURCES USED'),
    createElement('ol', null,
      ...sources.map(source => createElement('li', { key: source.id },
        createElement('a', {
          href: source.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
          createElement('strong', null, source.title),
          createElement('span', null,
            [source.creator, source.publication, source.publishedAt, source.type?.toUpperCase()]
              .filter(Boolean).join(' · ')
          )
        )
      ))
    )
  );
}

function EditorPreview({ draft }) {
  const shelf = (AppState.shelves || []).find(item => item.id === draft?.shelfId);
  const isPublic = draft?.visibility !== 'admins';
  const date = new Date(draft?.createdAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const content = draft?.content?.trim();

  return createElement('article', {
    className: 'editor-reader-preview',
    'aria-label': 'Signed-out reader preview',
  },
    createElement('div', { className: 'editor-preview-notice' },
      createElement('strong', null, isPublic ? 'SIGNED-OUT READER PREVIEW' : 'FORMATTING PREVIEW'),
      createElement('span', null,
        isPublic
          ? 'This matches the public reading surface. Nothing has been published.'
          : 'Admins-only pieces are not visible to signed-out readers. Nothing has been published.'
      )
    ),
    createElement('header', { className: 'reading-header' },
      createElement('h1', { className: 'reading-title' }, (draft?.title || 'Untitled').toUpperCase()),
      createElement('div', { className: 'reading-meta' },
        createElement('div', { className: 'reading-meta-left' },
          createElement('span', { className: 'reading-date' }, date.toUpperCase()),
          shelf
            ? createElement('span', {
                className: 'shelf-tag',
                style: `--shelf-color:${shelf.color}`,
                title: shelf.description || shelf.name,
              }, shelf.name.toUpperCase())
            : null,
          createElement('span', {
            className: isPublic ? 'vis-tag vis-tag-public' : 'vis-tag vis-tag-admins',
          }, isPublic ? 'PUBLIC' : 'ADMINS')
        )
      )
    ),
    createElement('div', { className: 'reading-divider' }),
    content
      ? createElement('div', { className: 'reading-content' }, ...renderMarkdown(draft.content))
      : createElement('p', { className: 'editor-preview-empty' }, 'Begin writing to preview the formatted piece.'),
    createElement(PreviewSources, { sourceIds: draft?.sourceIds })
  );
}

export function EditorView({ onPostCreated, onDraftSaved }) {
  const defaultVis = AppState.traits?.defaultVisibility ?? DEFAULT_VISIBILITY_FALLBACK;
  const me = currentUserEmail();
  const ownDrafts = (AppState.entries || []).filter(entry =>
    entry.status === 'draft' && (!entry.author || entry.author === me)
  );
  const recovered = readRecoveryDraft();
  const recoveryMatches = recovered && (
    AppState.editingEntry
      ? recovered.entryId === AppState.editingEntry.entryId
      : true
  );
  const recoveredEntry = recoveryMatches
    ? { ...(AppState.editingEntry || {}), ...recovered }
    : AppState.editingEntry || null;
  const bufferMatches = AppState.editorBuffer && (
    AppState.editingEntry
      ? AppState.editorBuffer.entryId === AppState.editingEntry.entryId
      : true
  );
  let currentEntry = bufferMatches
    ? { ...(recoveredEntry || {}), ...AppState.editorBuffer }
    : recoveredEntry;
  let formNode;
  let bodyNode;
  let menuNode;
  let statusNode;
  let shelfNode;
  let autosaveTimer;
  let saveChain = Promise.resolve();

  const setStatus = (message, state = '') => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  };

  const fields = () => {
    if (!formNode) return null;
    return {
      entryId: currentEntry?.entryId || null,
      createdAt: currentEntry?.createdAt || null,
      title: formNode.elements.title.value,
      content: formNode.elements.content.value,
      visibility: formNode.elements.visibility.value,
      shelfId: formNode.elements.shelfId.value || null,
      sourceIds: [...formNode.querySelectorAll('input[name="sourceIds"]:checked')].map(input => input.value),
    };
  };

  const save = async (status, { quiet = false } = {}) => {
    const draft = fields();
    if (!draft) return currentEntry;
    if (status === 'published' && (!draft.title.trim() || !draft.content.trim())) {
      throw new Error('Headline and body required');
    }
    if (status === 'draft' && !draft.title.trim() && !draft.content.trim()) {
      setStatus('Start writing to save a draft');
      return currentEntry;
    }
    setStatus(status === 'draft' ? 'Saving draft to database…' : 'Publishing…', 'saving');
    const operation = saveChain.then(async () => {
      const payload = {
        ...draft,
        entryId: draft.entryId || currentEntry?.entryId || null,
        createdAt: draft.createdAt || currentEntry?.createdAt || null,
        status,
      };
      currentEntry = await upsertPost(payload);
      const latest = fields();
      const unchanged = latest
        && latest.title === draft.title
        && latest.content === draft.content
        && latest.visibility === draft.visibility
        && latest.shelfId === draft.shelfId
        && latest.sourceIds.join('|') === draft.sourceIds.join('|');
      writeRecoveryDraft({
        ...(unchanged ? currentEntry : latest),
        entryId: currentEntry.entryId,
        createdAt: currentEntry.createdAt,
        status: 'draft',
      });
      const nextEntries = [
        currentEntry,
        ...(AppState.entries || []).filter(entry => entry.entryId !== currentEntry.entryId),
      ].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
      if (quiet) AppState.entries = nextEntries;
      else updateState({ entries: nextEntries });
      setStatus(status === 'draft' ? 'Draft saved to database' : 'Published', 'saved');
      if (!quiet && status === 'draft' && onDraftSaved) onDraftSaved(currentEntry);
      return currentEntry;
    });
    saveChain = operation.catch(() => {});
    try {
      return await operation;
    } catch (err) {
      setStatus('Database save failed · browser recovery retained', 'error');
      throw err;
    }
  };

  const scheduleAutosave = () => {
    clearTimeout(autosaveTimer);
    const draft = fields();
    if (!draft) return;
    const protectedLocally = writeRecoveryDraft({ ...draft, status: 'draft' });
    setStatus(protectedLocally ? 'Draft protected · waiting to save…' : 'Browser recovery unavailable', protectedLocally ? 'saving' : 'error');
    if (!draft.title.trim() && !draft.content.trim()) return;
    const runAutosave = () => {
      if (menuNode?.classList.contains('visible')) {
        autosaveTimer = setTimeout(runAutosave, AUTOSAVE_DELAY);
        return;
      }
      save('draft', { quiet: true }).catch(() => {});
    };
    autosaveTimer = setTimeout(runAutosave, AUTOSAVE_DELAY);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearTimeout(autosaveTimer);
    const visibility = event.target.elements.visibility.value;
    if (visibility === 'public') {
      const ok = confirm(
        'Publish to the PUBLIC web?\n\n' +
        'Unauthenticated visitors will see the title, formatted body, shelf, and your display name.'
      );
      if (!ok) return;
    }
    try {
      await save('published');
      clearRecoveryDraft();
      updateState({ editingEntry: null, editorBuffer: null, editorMode: 'write' });
      if (onPostCreated) onPostCreated();
    } catch (err) {
      if (err.message === 'Headline and body required') alert(err.message);
      else alert('Transmission failed: ' + err.message);
    }
  };

  const handleSaveDraft = async () => {
    clearTimeout(autosaveTimer);
    try {
      const saved = await save('draft');
      if (saved) {
        clearRecoveryDraft();
        updateState({ editingEntry: saved, editorBuffer: null });
        if (onDraftSaved) onDraftSaved(saved);
      }
    } catch (err) {
      alert('Could not save draft: ' + err.message);
    }
  };

  const handleNewDraft = () => {
    clearTimeout(autosaveTimer);
    clearRecoveryDraft();
    updateState({ editingEntry: null, editorMode: 'write', editorBuffer: null });
  };

  const showPreview = () => {
    clearTimeout(autosaveTimer);
    const draft = fields();
    if (!draft) return;
    writeRecoveryDraft({ ...draft, status: 'draft' });
    updateState({ editorMode: 'preview', editorBuffer: draft });
  };

  const bindFormatter = () => {
    if (bodyNode && menuNode) installFormatter(bodyNode, menuNode, scheduleAutosave);
  };

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const shelves = AppState.shelves || [];
  const initialShelf = currentEntry?.shelfId || shelves[0]?.id || '';
  const initialVisibility = currentEntry?.visibility || defaultVis;
  const initialSourceIds = currentEntry?.sourceIds || [];
  const sources = AppState.sources || [];
  const editorMode = AppState.editorMode === 'preview' ? 'preview' : 'write';

  return createElement('div', { className: 'editor-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, date.toUpperCase()),
      createElement('span', { className: 'date-stamp' }, currentEntry?.entryId ? 'EDIT' : 'COMPOSE')
    ),
    createElement(DraftPicker, { drafts: ownDrafts }),
    createElement('div', {
      className: 'editor-mode-tabs',
      role: 'tablist',
      'aria-label': 'Compose mode',
    },
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: editorMode === 'write' ? 'active' : '',
        'aria-selected': editorMode === 'write' ? 'true' : 'false',
        onClick: () => updateState({ editorMode: 'write' }),
      }, 'WRITE'),
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: editorMode === 'preview' ? 'active' : '',
        'aria-selected': editorMode === 'preview' ? 'true' : 'false',
        onClick: showPreview,
      }, 'PREVIEW')
    ),
    editorMode === 'preview'
      ? createElement(EditorPreview, { draft: currentEntry || {} })
      : createElement('form', {
      className: 'typewriter-form',
      onSubmit: handleSubmit,
      onInput: scheduleAutosave,
      onChange: scheduleAutosave,
      ref: node => { formNode = node; },
      key: `editor-${currentEntry?.entryId || currentEntry?.recoveredAt || 'new'}-${defaultVis}`,
    },
      createElement('input', {
        type: 'text',
        name: 'title',
        placeholder: 'HEADLINE',
        className: 'headline-input',
        autocomplete: 'off',
        defaultValue: currentEntry?.title || '',
        maxLength: 240,
      }),
      createElement('div', { className: 'editor-input' },
        createElement('textarea', {
          name: 'content',
          placeholder: 'Begin transmission… Type / on an empty line for formatting.',
          className: 'body-text',
          defaultValue: currentEntry?.content || '',
          spellcheck: true,
          ref: node => { bodyNode = node; bindFormatter(); },
        }),
        createElement('div', {
          className: 'slash-menu',
          role: 'listbox',
          'aria-label': 'Writing and formatting choices',
          ref: node => { menuNode = node; bindFormatter(); },
        })
      ),
      createElement('div', { className: 'editor-options' },
        createElement('div', { className: 'editor-shelf-control' },
          createElement('label', { className: 'shelf-field' },
            createElement('span', { className: 'visibility-label' }, 'SHELF'),
            createElement('select', {
              name: 'shelfId',
              className: 'shelf-select',
              defaultValue: initialShelf,
              ref: node => { shelfNode = node; },
            },
              createElement('option', { value: '' }, 'UNCATEGORIZED'),
              ...shelves.map(shelf => createElement('option', { value: shelf.id }, shelf.name.toUpperCase()))
            )
          ),
          createElement('button', {
            type: 'button',
            className: 'shelf-create-btn',
            onClick: () => updateState({
              shelfManagerOpen: true,
              shelfEditingId: null,
            }),
          }, 'MANAGE SHELVES')
        ),
        createElement('p', { className: 'editor-options-note' },
          'Organization controls are separated from the writing canvas.'
        )
      ),
      createElement('div', { className: 'visibility-row' },
        createElement('span', { className: 'visibility-label' }, 'AUDIENCE'),
        createElement('label', { className: 'visibility-option' },
          createElement('input', {
            type: 'radio', name: 'visibility', value: 'public',
            defaultChecked: initialVisibility === 'public',
          }),
          createElement('span', null, 'PUBLIC')
        ),
        createElement('label', { className: 'visibility-option' },
          createElement('input', {
            type: 'radio', name: 'visibility', value: 'admins',
            defaultChecked: initialVisibility === 'admins',
          }),
          createElement('span', null, 'ADMINS ONLY')
        )
      ),
      createElement('section', { className: 'editor-sources' },
        createElement('div', { className: 'editor-sources-heading' },
          createElement('div', null,
            createElement('span', { className: 'visibility-label' }, 'SOURCES USED'),
            createElement('p', null, 'Selected references appear beneath the published piece.')
          ),
          createElement('button', {
            type: 'button',
            className: 'line-btn',
            onClick: () => updateState({ currentView: 'sources' }),
          }, 'OPEN LIBRARY')
        ),
        sources.length
          ? createElement('div', { className: 'editor-source-list' },
              ...sources.map(source => createElement('label', {
                className: 'editor-source-option',
                key: source.id,
              },
                createElement('input', {
                  type: 'checkbox',
                  name: 'sourceIds',
                  value: source.id,
                  defaultChecked: initialSourceIds.includes(source.id),
                }),
                createElement('span', { className: 'editor-source-check' }, '✓'),
                createElement('span', { className: 'editor-source-copy' },
                  createElement('strong', null, source.title),
                  createElement('small', null,
                    [source.creator, source.publication, source.type.toUpperCase()].filter(Boolean).join(' · ')
                  )
                )
              ))
            )
          : createElement('p', { className: 'editor-sources-empty' }, 'The source library is empty.')
      ),
      createElement('div', {
        className: 'editor-save-state',
        ref: node => { statusNode = node; },
        'aria-live': 'polite',
      }, currentEntry?.entryId ? 'Draft loaded · autosave on' : 'Autosave on'),
      createElement('div', { className: 'editor-footer' },
        currentEntry?.entryId
          ? createElement('button', { type: 'button', className: 'line-btn', onClick: handleNewDraft }, 'NEW')
          : null,
        createElement('span', { className: 'editor-footer-spacer' }),
        createElement('button', {
          type: 'button',
          className: 'line-btn',
          onClick: handleSaveDraft,
        }, 'SAVE DRAFT'),
        createElement('button', {
          type: 'submit',
          className: 'publish-btn'
        }, '▶  PUBLISH')
      )
    )
  );
}
