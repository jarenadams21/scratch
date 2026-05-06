import { createElement } from '../engine/main.js';
import { deletePost } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { formatShortDate, formatLongDate } from '../lib/format.js';
import { confirmDelete } from '../lib/actions.js';
import { ListView } from './ListView.js';

function ArchiveListItem({ entry, isSelected }) {
  return createElement('div', {
    className: isSelected ? 'archive-list-item selected' : 'archive-list-item',
    onClick: () => updateState({ selectedEntry: entry }),
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'item-date' }, formatShortDate(entry.createdAt).toUpperCase())
    ),
    createElement('div', { className: 'item-preview' },
      entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '')
    )
  );
}

function ReadingPane({ entry, onDeleted }) {
  if (!entry) return null;

  const handleDelete = confirmDelete(
    'Destroy this record?',
    () => deletePost(entry.entryId, entry.createdAt),
    () => { updateState({ selectedEntry: null }); if (onDeleted) onDeleted(); }
  );

  return createElement('div', { className: 'reading-pane' },
    createElement('div', { className: 'reading-header' },
      createElement('div', { className: 'reading-title-row' },
        createElement('h1', { className: 'reading-title' }, entry.title.toUpperCase()),
        createElement('button', {
          onClick: () => updateState({ selectedEntry: null }),
          className: 'close-btn',
          title: 'Close',
        }, '✕')
      ),
      createElement('div', { className: 'reading-meta' },
        createElement('span', { className: 'reading-date' }, formatLongDate(entry.createdAt).toUpperCase()),
        createElement('button', { onClick: handleDelete, className: 'delete-btn' }, 'DELETE')
      )
    ),
    createElement('div', { className: 'reading-divider' }),
    createElement('div', { className: 'reading-content' }, entry.content)
  );
}

export function ArchiveView({ entries, onDeleted }) {
  return createElement(ListView, {
    title: 'ARCHIVES',
    entries,
    emptyLabel: 'NO RECORDS FOUND',
    renderItem: (entry) => createElement(ArchiveListItem, {
      entry,
      isSelected: AppState.selectedEntry?.entryId === entry.entryId,
    }),
    detailPane: AppState.selectedEntry
      ? createElement(ReadingPane, { entry: AppState.selectedEntry, onDeleted })
      : null,
  });
}
