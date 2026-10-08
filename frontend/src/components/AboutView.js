import { createElement } from '../engine/main.js';
import { isLoggedIn, setAbout } from '../lib/api.js';
import { installFormatter } from '../lib/formatter.js';
import { AppState, updateState } from '../lib/state.js';
import { CatalogStack, normalizeAbout } from './AboutCatalog.js';

let escapeInstalled = false;
let pendingSummaryFocusId = null;
let pendingReturnFocusId = null;

function installEscapeHandler() {
  if (escapeInstalled || typeof document === 'undefined') return;
  escapeInstalled = true;
  document.addEventListener('keydown', event => {
    if (
      event.key !== 'Escape'
      || AppState.currentView !== 'about'
      || (AppState.aboutEditing && AppState.aboutEditorMode !== 'preview')
      || !AppState.aboutActiveSectionId
    ) return;
    const id = AppState.aboutActiveSectionId;
    pendingSummaryFocusId = id;
    updateState({ aboutActiveSectionId: null });
  });
}

function selectCard(id) {
  pendingReturnFocusId = id;
  updateState({ aboutActiveSectionId: id });
}

function returnToCatalog(id) {
  pendingSummaryFocusId = id;
  updateState({ aboutActiveSectionId: null });
}

function registerSummary(id, node) {
  if (node && pendingSummaryFocusId === id) {
    pendingSummaryFocusId = null;
    requestAnimationFrame(() => node.focus());
  }
}

function registerReturn(id, node) {
  if (node && pendingReturnFocusId === id) {
    pendingReturnFocusId = null;
    requestAnimationFrame(() => node.focus());
  }
}

function newSection() {
  return {
    id: `about-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    descriptor: '',
    classification: '',
    content: '',
  };
}

function AboutSectionEditor({ section, index, count, onMove, onDelete }) {
  let bodyNode;
  let menuNode;
  const bindFormatter = () => {
    if (bodyNode && menuNode) installFormatter(bodyNode, menuNode, () => {});
  };
  return createElement('section', {
    className: 'about-section-editor',
    'data-about-section': section.id,
  },
    createElement('header', { className: 'about-section-editor-head' },
      createElement('div', null,
        createElement('strong', null, section.title || 'UNTITLED SECTION')
      ),
      createElement('div', { className: 'about-section-controls' },
        createElement('button', {
          type: 'button',
          className: 'line-btn',
          disabled: index === 0,
          onClick: () => onMove(section.id, -1),
          'aria-label': `Move ${section.title || 'section'} earlier`,
        }, '↑'),
        createElement('button', {
          type: 'button',
          className: 'line-btn',
          disabled: index === count - 1,
          onClick: () => onMove(section.id, 1),
          'aria-label': `Move ${section.title || 'section'} later`,
        }, '↓'),
        createElement('button', {
          type: 'button',
          className: 'about-section-delete',
          onClick: () => onDelete(section.id),
        }, 'REMOVE')
      )
    ),
    createElement('div', { className: 'about-section-meta-grid' },
      createElement('label', null,
        createElement('span', null, 'SECTION TITLE'),
        createElement('input', {
          type: 'text',
          name: 'sectionTitle',
          maxLength: 120,
          defaultValue: section.title,
          placeholder: 'Background',
        })
      )
    ),
    createElement('label', { className: 'about-section-descriptor' },
      createElement('span', null, 'ONE-LINE DESCRIPTOR'),
      createElement('input', {
        type: 'text',
        name: 'descriptor',
        maxLength: 240,
        defaultValue: section.descriptor,
        placeholder: 'A concise description of this section.',
      })
    ),
    createElement('label', { className: 'about-section-content' },
      createElement('span', null, 'SECTION CONTENT · MARKDOWN'),
      createElement('div', { className: 'about-editor-input' },
        createElement('textarea', {
          name: 'sectionContent',
          maxLength: 50000,
          defaultValue: section.content,
          placeholder: 'Write the full section… Type / on an empty line for formatting.',
          spellcheck: true,
          ref: node => { bodyNode = node; bindFormatter(); },
        }),
        createElement('div', {
          className: 'slash-menu',
          role: 'listbox',
          'aria-label': `Formatting choices for ${section.title || 'About section'}`,
          ref: node => { menuNode = node; bindFormatter(); },
        })
      )
    )
  );
}

function AboutEditor() {
  const saved = normalizeAbout(AppState.about);
  const draft = normalizeAbout(AppState.aboutBuffer || saved);
  const mode = AppState.aboutEditorMode === 'preview' ? 'preview' : 'write';
  let formNode;
  let statusNode;
  let saveNode;

  const fields = () => {
    if (!formNode) return draft;
    return {
      title: formNode.elements.title.value || '',
      sections: [...formNode.querySelectorAll('[data-about-section]')].map(node => ({
        id: node.dataset.aboutSection,
        title: node.querySelector('[name="sectionTitle"]').value,
        descriptor: node.querySelector('[name="descriptor"]').value,
        classification: draft.sections.find(section => section.id === node.dataset.aboutSection)
          ?.classification || '',
        content: node.querySelector('[name="sectionContent"]').value,
      })),
    };
  };

  const updateSections = transform => {
    const current = fields();
    updateState({
      aboutBuffer: { ...current, sections: transform(current.sections) },
      aboutEditorMode: 'write',
    });
  };

  const moveSection = (id, direction) => updateSections(sections => {
    const next = [...sections];
    const index = next.findIndex(section => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const deleteSection = id => {
    const section = fields().sections.find(item => item.id === id);
    if (
      section
      && (section.title.trim() || section.content.trim())
      && !confirm(`Remove the “${section.title || 'Untitled'}” section?`)
    ) return;
    updateSections(sections => sections.filter(item => item.id !== id));
  };

  const close = () => updateState({
    aboutEditing: false,
    aboutEditorMode: 'write',
    aboutBuffer: null,
    aboutActiveSectionId: null,
  });

  const preview = () => updateState({
    aboutBuffer: fields(),
    aboutEditorMode: 'preview',
    aboutActiveSectionId: null,
  });

  const save = async event => {
    event.preventDefault();
    const next = fields();
    if (saveNode) saveNode.disabled = true;
    if (statusNode) {
      statusNode.textContent = 'Saving About page…';
      statusNode.dataset.state = 'saving';
    }
    try {
      const stored = await setAbout(next.title, next.sections);
      updateState({
        about: stored,
        aboutEditing: false,
        aboutEditorMode: 'write',
        aboutBuffer: null,
        aboutActiveSectionId: null,
      });
    } catch (err) {
      if (statusNode) {
        statusNode.textContent = 'Could not save About page: ' + err.message;
        statusNode.dataset.state = 'error';
      }
      if (saveNode) saveNode.disabled = false;
    }
  };

  return createElement('section', { className: 'about-editor-shell about-catalog-editor-shell' },
    createElement('header', { className: 'about-editor-header' },
      createElement('div', null,
        createElement('h1', null, 'ABOUT')
      ),
      createElement('button', {
        type: 'button',
        className: 'close-btn',
        onClick: close,
        title: 'Close About editor',
      }, '✕')
    ),
    createElement('div', {
      className: 'editor-mode-tabs about-mode-tabs',
      role: 'tablist',
      'aria-label': 'About editing mode',
    },
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: mode === 'write' ? 'active' : '',
        'aria-selected': mode === 'write' ? 'true' : 'false',
        onClick: () => updateState({ aboutEditorMode: 'write', aboutActiveSectionId: null }),
      }, 'WRITE'),
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: mode === 'preview' ? 'active' : '',
        'aria-selected': mode === 'preview' ? 'true' : 'false',
        onClick: preview,
      }, 'PREVIEW')
    ),
    mode === 'preview'
      ? createElement('div', { className: 'about-editor-preview about-catalog-preview' },
          createElement(CatalogStack, {
            about: draft,
            activeId: AppState.aboutActiveSectionId,
            onSelect: selectCard,
            onReturn: returnToCatalog,
            registerSummary,
            registerReturn,
            emptyLabel: 'Add a section in Write mode to preview the About page.',
          })
        )
      : createElement('form', {
          className: 'about-editor-form about-catalog-editor-form',
          onSubmit: save,
          ref: node => { formNode = node; },
          key: `about-catalog-${draft.sections.map(section => section.id).join('-')}`,
        },
          createElement('label', { className: 'about-title-field' },
            createElement('span', null, 'ABOUT TITLE'),
            createElement('input', {
              type: 'text',
              name: 'title',
              maxLength: 160,
              defaultValue: draft.title || '',
              placeholder: 'About',
            })
          ),
          createElement('div', { className: 'about-section-list' },
            ...draft.sections.map((section, index) => createElement(AboutSectionEditor, {
              key: section.id,
              section,
              index,
              count: draft.sections.length,
              onMove: moveSection,
              onDelete: deleteSection,
            }))
          ),
          createElement('button', {
            type: 'button',
            className: 'about-add-section',
            disabled: draft.sections.length >= 12,
            onClick: () => updateSections(sections => [...sections, newSection()]),
          }, draft.sections.length >= 12 ? 'SECTION LIMIT REACHED' : '+ ADD SECTION'),
          createElement('p', {
            className: 'about-editor-status',
            ref: node => { statusNode = node; },
            'aria-live': 'polite',
          }, 'Changes remain unpublished until the About page is saved.'),
          createElement('footer', { className: 'about-editor-actions' },
            createElement('button', {
              type: 'button',
              className: 'line-btn',
              onClick: close,
            }, 'CANCEL'),
            createElement('button', {
              type: 'submit',
              className: 'publish-btn',
              ref: node => { saveNode = node; },
            }, 'SAVE ABOUT')
          )
        )
  );
}

export function AboutView() {
  installEscapeHandler();
  const isAdmin = isLoggedIn();
  const about = normalizeAbout(AppState.about);
  if (isAdmin && AppState.aboutEditing) return createElement(AboutEditor, {});

  return createElement('div', { className: 'about-view about-catalog-view' },
    createElement('div', { className: 'about-public-frame about-catalog-frame' },
      isAdmin
        ? createElement('div', { className: 'about-owner-actions' },
            createElement('button', {
              type: 'button',
              className: 'line-btn',
              onClick: () => updateState({
                aboutEditing: true,
                aboutEditorMode: 'write',
                aboutActiveSectionId: null,
                aboutBuffer: {
                  title: about.title,
                  sections: about.sections.map(section => ({ ...section })),
                },
              }),
            }, about.sections.length || about.title.trim() ? 'EDIT ABOUT' : 'CREATE ABOUT')
          )
        : null,
      createElement(CatalogStack, {
        about,
        activeId: AppState.aboutActiveSectionId,
        onSelect: selectCard,
        onReturn: returnToCatalog,
        registerSummary,
        registerReturn,
        emptyLabel: isAdmin
          ? 'No About page has been published. Use “Create About” to add the first section.'
          : 'No About page has been published.',
      })
    )
  );
}
