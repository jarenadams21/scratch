import { createElement } from '../engine/main.js';
import { currentUserEmail, upsertPost } from '../lib/api.js';
import { installFormatter } from '../lib/formatter.js';
import { renderMarkdown } from '../lib/markdown.js';
import { applyWritingSuggestion, reviewWriting } from '../lib/writing-review.js';
import { AppState, updateState } from '../lib/state.js';
import { DEFAULT_VISIBILITY_FALLBACK } from './SettingsView.js';

const RECOVERY_KEY = 'harbinger-editor-draft-v2';
const AUTOSAVE_DELAY = 900;
let pendingReviewSelection = null;

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

function WritingReview({ draft, publishPending, onApply, onLocate, onReturn, onTransmit }) {
  const review = reviewWriting(draft);
  const grouped = [
    ['grammar', 'GRAMMAR'],
    ['mechanics', 'MECHANICS'],
    ['clarity', 'CLARITY'],
  ];
  return createElement('section', {
    className: 'writing-review',
    'aria-label': 'Local writing review',
  },
    createElement('header', { className: 'writing-review-header' },
      createElement('div', null,
        createElement('span', { className: 'writing-review-kicker' }, 'LOCAL PREFLIGHT'),
        createElement('h2', null, 'WRITING REVIEW'),
        createElement('p', null,
          'Grammar and clarity checks run in this browser. Draft text is not sent to an AI or third-party review service.'
        )
      ),
      createElement('div', { className: 'writing-review-stats', 'aria-label': 'Draft statistics' },
        createElement('span', null, `${review.stats.words} WORDS`),
        createElement('span', null, `${review.stats.sentences} SENTENCES`),
        createElement('span', null, review.stats.minutes ? `${review.stats.minutes} MIN READ` : 'NO READING TIME')
      )
    ),
    createElement('div', { className: 'writing-review-spelling' },
      createElement('strong', null, 'SPELLING'),
      createElement('span', null,
        'Browser spelling remains active in Write mode. Underlined words can be corrected with the browser context menu.'
      )
    ),
    review.issues.length
      ? createElement('div', { className: 'writing-review-groups' },
          ...grouped.map(([category, label]) => {
            const issues = review.issues.filter(issue => issue.category === category);
            if (!issues.length) return null;
            return createElement('section', { className: 'writing-review-group', key: category },
              createElement('div', { className: 'writing-review-group-heading' },
                createElement('h3', null, label),
                createElement('span', null, String(issues.length).padStart(2, '0'))
              ),
              ...issues.map(issue => createElement('article', {
                className: 'writing-review-issue',
                key: issue.id,
              },
                createElement('div', { className: 'writing-review-issue-copy' },
                  createElement('strong', null, issue.message),
                  createElement('p', null, issue.detail),
                  createElement('blockquote', null,
                    createElement('span', null, issue.excerpt.before),
                    createElement('mark', null, issue.excerpt.match || 'DOCUMENT'),
                    createElement('span', null, issue.excerpt.after)
                  )
                ),
                createElement('div', { className: 'writing-review-issue-actions' },
                  createElement('button', {
                    type: 'button',
                    className: 'line-btn',
                    onClick: () => onLocate(issue),
                  }, 'LOCATE'),
                  issue.replacement !== null
                    ? createElement('button', {
                        type: 'button',
                        className: 'writing-review-apply',
                        onClick: () => onApply(issue),
                      }, issue.replacement ? `APPLY “${issue.replacement}”` : 'REMOVE')
                    : null
                )
              ))
            );
          })
        )
      : createElement('div', { className: 'writing-review-clear', role: 'status' },
          createElement('span', { 'aria-hidden': 'true' }, '✓'),
          createElement('strong', null, 'NO LOCAL REVIEW NOTES'),
          createElement('p', null, 'Read through once more and check any browser spelling underlines before transmission.')
        ),
    createElement('footer', { className: 'writing-review-actions' },
      createElement('button', {
        type: 'button',
        className: 'line-btn',
        onClick: onReturn,
      }, 'RETURN TO WRITING'),
      publishPending
        ? createElement('button', {
            type: 'button',
            className: 'publish-btn',
            onClick: () => onTransmit(draft),
          }, review.issues.length ? `TRANSMIT WITH ${review.issues.length} ${review.issues.length === 1 ? 'NOTE' : 'NOTES'}` : 'TRANSMIT')
        : null
    )
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
  let titleNode;
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

  const snapshot = () => fields() || currentEntry;

  const save = async (status, { quiet = false, draftOverride = null } = {}) => {
    const draft = draftOverride || fields();
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
        ...(unchanged ? currentEntry : (latest || draft)),
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
    await publishDraft(fields());
  };

  const publishDraft = async (draft, skipReview = false) => {
    if (!draft) return;
    const review = reviewWriting(draft);
    if (!skipReview && review.issues.length) {
      writeRecoveryDraft({ ...draft, status: 'draft' });
      updateState({
        editorMode: 'review',
        editorBuffer: draft,
        editorPublishPending: true,
      });
      return;
    }
    const visibility = draft.visibility;
    if (visibility === 'public') {
      const ok = confirm(
        'Publish to the PUBLIC web?\n\n' +
        'Unauthenticated visitors will see the title, formatted body, shelf, and your display name.\n\n' +
        'This is a one-way transmission. The title and body cannot be edited after publication.'
      );
      if (!ok) return;
    }
    try {
      await save('published', { draftOverride: draft });
      clearRecoveryDraft();
      updateState({
        editingEntry: null,
        editorBuffer: null,
        editorMode: 'write',
        editorPublishPending: false,
      });
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
    updateState({
      editingEntry: null,
      editorMode: 'write',
      editorBuffer: null,
      editorPublishPending: false,
    });
  };

  const showPreview = () => {
    clearTimeout(autosaveTimer);
    const draft = snapshot();
    if (!draft) return;
    writeRecoveryDraft({ ...draft, status: 'draft' });
    updateState({
      editorMode: 'preview',
      editorBuffer: draft,
      editorPublishPending: false,
    });
  };

  const showReview = (publishPending = false) => {
    clearTimeout(autosaveTimer);
    const draft = snapshot();
    if (!draft) return;
    writeRecoveryDraft({ ...draft, status: 'draft' });
    updateState({
      editorMode: 'review',
      editorBuffer: draft,
      editorPublishPending: publishPending,
    });
  };

  const bindFormatter = () => {
    if (bodyNode && menuNode) {
      installFormatter(bodyNode, menuNode, {
        onChange: scheduleAutosave,
        onReview: () => showReview(false),
      });
      if (pendingReviewSelection?.field === 'content') {
        const selection = pendingReviewSelection;
        pendingReviewSelection = null;
        requestAnimationFrame(() => {
          bodyNode.focus();
          bodyNode.setSelectionRange(selection.start, selection.end);
        });
      }
    }
  };

  const locateIssue = (issue) => {
    pendingReviewSelection = issue;
    updateState({
      editorMode: 'write',
      editorPublishPending: false,
    });
  };

  const applyIssue = (issue) => {
    const draft = snapshot();
    const next = applyWritingSuggestion(draft, issue);
    writeRecoveryDraft({ ...next, status: 'draft' });
    updateState({ editorBuffer: next });
  };

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const shelves = AppState.shelves || [];
  const initialShelf = currentEntry?.shelfId || shelves[0]?.id || '';
  const initialVisibility = currentEntry?.visibility || defaultVis;
  const initialSourceIds = currentEntry?.sourceIds || [];
  const sources = AppState.sources || [];
  const editorMode = ['preview', 'review'].includes(AppState.editorMode)
    ? AppState.editorMode
    : 'write';

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
        onClick: () => updateState({ editorMode: 'write', editorPublishPending: false }),
      }, 'WRITE'),
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: editorMode === 'preview' ? 'active' : '',
        'aria-selected': editorMode === 'preview' ? 'true' : 'false',
        onClick: showPreview,
      }, 'PREVIEW'),
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: editorMode === 'review' ? 'active' : '',
        'aria-selected': editorMode === 'review' ? 'true' : 'false',
        onClick: () => showReview(false),
      }, 'REVIEW')
    ),
    editorMode === 'preview'
      ? createElement(EditorPreview, { draft: currentEntry || {} })
      : editorMode === 'review'
        ? createElement(WritingReview, {
            draft: currentEntry || {},
            publishPending: AppState.editorPublishPending,
            onApply: applyIssue,
            onLocate: locateIssue,
            onReturn: () => updateState({
              editorMode: 'write',
              editorPublishPending: false,
            }),
            onTransmit: draft => publishDraft(draft, true),
          })
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
        spellcheck: true,
        autocapitalize: 'sentences',
        defaultValue: currentEntry?.title || '',
        maxLength: 240,
        ref: node => {
          titleNode = node;
          if (node && pendingReviewSelection?.field === 'title') {
            const selection = pendingReviewSelection;
            pendingReviewSelection = null;
            requestAnimationFrame(() => {
              titleNode.focus();
              titleNode.setSelectionRange(selection.start, selection.end);
            });
          }
        },
      }),
      createElement('div', { className: 'editor-input' },
        createElement('textarea', {
          name: 'content',
          placeholder: 'Begin transmission… Type / on an empty line for formatting.',
          className: 'body-text',
          defaultValue: currentEntry?.content || '',
          spellcheck: true,
          autocorrect: 'on',
          autocapitalize: 'sentences',
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
