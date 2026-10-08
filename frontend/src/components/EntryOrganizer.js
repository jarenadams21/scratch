import { createElement } from '../engine/main.js';
import { updatePostOrganization } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

export function EntryOrganizer({ entry }) {
  let formNode;
  let statusNode;
  let saveNode;
  const shelves = AppState.shelves || [];
  const sources = AppState.sources || [];
  const initialSourceIds = Array.isArray(entry?.sourceIds) ? entry.sourceIds : [];

  const close = () => updateState({ entryOrganizerOpen: false });

  const save = async event => {
    event.preventDefault();
    if (saveNode) saveNode.disabled = true;
    if (statusNode) {
      statusNode.textContent = 'Updating organization metadata…';
      statusNode.dataset.state = 'saving';
    }
    const shelfId = formNode.elements.shelfId.value || null;
    const sourceIds = [...formNode.querySelectorAll('input[name="sourceIds"]:checked')]
      .map(input => input.value);
    try {
      const metadata = await updatePostOrganization(
        entry.entryId,
        entry.createdAt,
        shelfId,
        sourceIds,
      );
      const apply = item => item?.entryId === entry.entryId
        ? { ...item, ...metadata }
        : item;
      updateState({
        entries: (AppState.entries || []).map(apply),
        selectedEntry: apply(AppState.selectedEntry),
        entryOrganizerOpen: false,
      });
    } catch (err) {
      if (statusNode) {
        statusNode.textContent = 'Could not update organization: ' + err.message;
        statusNode.dataset.state = 'error';
      }
      if (saveNode) saveNode.disabled = false;
    }
  };

  return createElement('div', {
    className: 'entry-organizer-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Organize transmitted piece',
  },
    createElement('form', {
      className: 'entry-organizer',
      onSubmit: save,
      ref: node => { formNode = node; },
    },
      createElement('header', { className: 'entry-organizer-header' },
        createElement('div', null,
          createElement('span', { className: 'entry-organizer-kicker' }, 'METADATA ONLY'),
          createElement('h2', null, 'SHELF & SOURCES'),
          createElement('p', null, entry.title || 'Untitled')
        ),
        createElement('button', {
          type: 'button',
          className: 'close-btn',
          onClick: close,
          title: 'Close organizer',
        }, '✕')
      ),
      createElement('div', { className: 'entry-organizer-body' },
        createElement('section', { className: 'entry-organizer-section' },
          createElement('div', { className: 'entry-organizer-section-head' },
            createElement('div', null,
              createElement('span', { className: 'visibility-label' }, 'SHELF'),
              createElement('p', null, 'Move this piece without altering its transmitted text.')
            ),
            createElement('button', {
              type: 'button',
              className: 'line-btn',
              onClick: () => updateState({
                shelfManagerOpen: true,
                shelfEditingId: entry.shelfId || null,
              }),
            }, 'MANAGE SHELVES')
          ),
          createElement('select', {
            name: 'shelfId',
            className: 'entry-organizer-select',
            defaultValue: entry.shelfId || '',
          },
            createElement('option', { value: '' }, 'UNCATEGORIZED'),
            ...shelves.map(shelf => createElement('option', {
              value: shelf.id,
              key: shelf.id,
            }, shelf.name.toUpperCase()))
          )
        ),
        createElement('section', { className: 'entry-organizer-section' },
          createElement('div', { className: 'entry-organizer-section-head' },
            createElement('div', null,
              createElement('span', { className: 'visibility-label' }, 'SOURCES USED'),
              createElement('p', null, 'These references will appear beneath the public piece.')
            )
          ),
          sources.length
            ? createElement('div', { className: 'entry-organizer-sources' },
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
                      [source.creator, source.publication, source.type?.toUpperCase()]
                        .filter(Boolean).join(' · ')
                    )
                  )
                ))
              )
            : createElement('p', { className: 'editor-sources-empty' },
                'The source library is empty. Add sources from the Sources tab.'
              )
        )
      ),
      createElement('p', {
        className: 'entry-organizer-status',
        ref: node => { statusNode = node; },
        'aria-live': 'polite',
      }, 'The title and body remain permanently unchanged.'),
      createElement('footer', { className: 'entry-organizer-actions' },
        createElement('button', {
          type: 'button',
          className: 'line-btn',
          onClick: close,
        }, 'CANCEL'),
        createElement('button', {
          type: 'submit',
          className: 'publish-btn',
          ref: node => { saveNode = node; },
        }, 'SAVE SHELF & SOURCES')
      )
    )
  );
}
