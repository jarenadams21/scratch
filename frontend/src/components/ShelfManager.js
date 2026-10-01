import { createElement } from '../engine/main.js';
import { createShelf, deleteShelf, updateShelf } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

function entryCount(shelfId) {
  return (AppState.entries || []).filter(entry => entry.shelfId === shelfId).length;
}

function sortedShelves(shelves) {
  return [...shelves].sort((a, b) => a.name.localeCompare(b.name));
}

export function ShelfManager() {
  const shelves = AppState.shelves || [];
  const editingId = AppState.shelfEditingId || null;
  const editing = shelves.find(shelf => shelf.id === editingId) || null;
  let formNode;
  let statusNode;
  let saveNode;

  const setStatus = (message, state = '') => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  };

  const close = () => updateState({
    shelfManagerOpen: false,
    shelfEditingId: null,
  });

  const startNew = () => updateState({ shelfEditingId: null });

  const save = async (event) => {
    event.preventDefault();
    const name = formNode?.elements.name.value.trim();
    const description = formNode?.elements.description.value.trim();
    const color = formNode?.elements.color.value;
    if (!name) {
      setStatus('A shelf name is required', 'error');
      return;
    }
    if (saveNode) saveNode.disabled = true;
    setStatus(editing ? 'Updating shelf…' : 'Creating shelf…', 'saving');
    try {
      const saved = editing
        ? await updateShelf(editing.id, { name, description, color })
        : await createShelf(name, color, description);
      const nextShelves = editing
        ? shelves.map(shelf => shelf.id === saved.id ? saved : shelf)
        : [...shelves, saved];
      updateState({
        shelves: sortedShelves(nextShelves),
        shelfEditingId: saved.id,
      });
    } catch (err) {
      setStatus('Could not save shelf: ' + err.message, 'error');
      if (saveNode) saveNode.disabled = false;
    }
  };

  const remove = async () => {
    if (!editing) return;
    const count = entryCount(editing.id);
    const impact = count
      ? `${count} assigned ${count === 1 ? 'entry' : 'entries'} will be moved to Uncategorized.`
      : 'No entries are assigned to it.';
    if (!confirm(`Delete “${editing.name}”?\n\n${impact}\n\nThe entries themselves will not be deleted.`)) return;
    if (saveNode) saveNode.disabled = true;
    setStatus('Deleting shelf…', 'saving');
    try {
      await deleteShelf(editing.id);
      const clearShelf = entry => entry?.shelfId === editing.id
        ? { ...entry, shelfId: null }
        : entry;
      updateState({
        shelves: shelves.filter(shelf => shelf.id !== editing.id),
        entries: (AppState.entries || []).map(clearShelf),
        selectedEntry: clearShelf(AppState.selectedEntry),
        editingEntry: clearShelf(AppState.editingEntry),
        archiveShelfId: AppState.archiveShelfId === editing.id ? null : AppState.archiveShelfId,
        shelfEditingId: null,
      });
    } catch (err) {
      setStatus('Could not delete shelf: ' + err.message, 'error');
      if (saveNode) saveNode.disabled = false;
    }
  };

  return createElement('div', {
    className: 'shelf-manager-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Manage shelves',
  },
    createElement('section', { className: 'shelf-manager' },
      createElement('header', { className: 'shelf-manager-header' },
        createElement('div', null,
          createElement('span', { className: 'shelf-manager-kicker' }, 'ARCHIVE STRUCTURE'),
          createElement('h2', null, 'MANAGE SHELVES')
        ),
        createElement('button', {
          type: 'button',
          className: 'close-btn',
          onClick: close,
          title: 'Close shelf manager',
        }, '✕')
      ),
      createElement('div', { className: 'shelf-manager-body' },
        createElement('aside', { className: 'shelf-manager-list' },
          createElement('button', {
            type: 'button',
            className: editing ? 'shelf-manager-new' : 'shelf-manager-new active',
            onClick: startNew,
          }, '+ NEW SHELF'),
          ...shelves.map(shelf => createElement('button', {
            type: 'button',
            key: shelf.id,
            className: shelf.id === editingId ? 'shelf-manager-item active' : 'shelf-manager-item',
            onClick: () => updateState({ shelfEditingId: shelf.id }),
            style: `--shelf-color:${shelf.color}`,
          },
            createElement('span', { className: 'shelf-manager-item-name' }, shelf.name),
            createElement('span', { className: 'shelf-manager-item-count' },
              `${entryCount(shelf.id)} ${entryCount(shelf.id) === 1 ? 'ENTRY' : 'ENTRIES'}`
            ),
            shelf.description
              ? createElement('span', { className: 'shelf-manager-item-description' }, shelf.description)
              : null
          ))
        ),
        createElement('form', {
          className: 'shelf-manager-form',
          onSubmit: save,
          ref: node => { formNode = node; },
          key: editing?.id || 'new-shelf',
        },
          createElement('label', { className: 'shelf-manager-field' },
            createElement('span', null, 'NAME'),
            createElement('input', {
              type: 'text',
              name: 'name',
              maxLength: 80,
              required: true,
              defaultValue: editing?.name || '',
              placeholder: 'e.g. Serious Papers',
            })
          ),
          createElement('label', { className: 'shelf-manager-field' },
            createElement('span', null, 'DESCRIPTION'),
            createElement('textarea', {
              name: 'description',
              maxLength: 280,
              rows: 4,
              defaultValue: editing?.description || '',
              placeholder: 'What belongs on this shelf?',
            })
          ),
          createElement('label', { className: 'shelf-manager-field shelf-manager-color-field' },
            createElement('span', null, 'COLOR'),
            createElement('input', {
              type: 'color',
              name: 'color',
              defaultValue: editing?.color || '#c85232',
            }),
            createElement('strong', null, editing?.color?.toUpperCase() || 'SELECT')
          ),
          createElement('p', {
            className: 'shelf-manager-status',
            ref: node => { statusNode = node; },
            'aria-live': 'polite',
          }, editing
            ? `${entryCount(editing.id)} assigned ${entryCount(editing.id) === 1 ? 'entry' : 'entries'}`
            : 'Create a named collection for related writing.'),
          createElement('footer', { className: 'shelf-manager-actions' },
            editing
              ? createElement('button', {
                  type: 'button',
                  className: 'shelf-manager-delete',
                  onClick: remove,
                }, 'DELETE SHELF')
              : null,
            createElement('button', {
              type: 'submit',
              className: 'publish-btn',
              ref: node => { saveNode = node; },
            }, editing ? 'SAVE CHANGES' : 'CREATE SHELF')
          )
        )
      )
    )
  );
}
