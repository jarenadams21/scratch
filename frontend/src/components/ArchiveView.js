import { createElement } from '../engine/main.js';
import { deletePost, updatePostVisibility, currentUserEmail, isLoggedIn } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { formatShortDate, formatLongDate } from '../lib/format.js';
import { confirmDelete } from '../lib/actions.js';
import { ListView } from './ListView.js';

// Existing entries may not carry a visibility field — treat them as public
// so we never accidentally hide content that was created before this feature.
function visibilityOf(entry) {
  return entry?.visibility === 'admins' ? 'admins' : 'public';
}

// Old entries may also be missing an `author`; the pk encodes it as
// USER#<email>. Pull from there as a fallback.
function authorOf(entry) {
  if (entry?.author) return entry.author;
  if (typeof entry?.pk === 'string' && entry.pk.startsWith('USER#')) {
    return entry.pk.slice(5);
  }
  return null;
}

function VisibilityTag({ visibility }) {
  const isAdmins = visibility === 'admins';
  return createElement('span', {
    className: isAdmins ? 'vis-tag vis-tag-admins' : 'vis-tag vis-tag-public',
    title: isAdmins ? 'Visible to admins only' : 'Visible to everyone',
  }, isAdmins ? 'ADMINS' : 'PUBLIC');
}

function ArchiveListItem({ entry, isSelected }) {
  return createElement('div', {
    className: isSelected ? 'archive-list-item selected' : 'archive-list-item',
    onClick: () => updateState({ selectedEntry: entry }),
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'item-date' }, formatShortDate(entry.createdAt).toUpperCase())
    ),
    createElement('div', { className: 'item-meta' },
      createElement(VisibilityTag, { visibility: visibilityOf(entry) }),
      createElement('div', { className: 'item-preview' },
        entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '')
      )
    )
  );
}

function ReadingPane({ entry, onDeleted, onVisibilityChanged }) {
  if (!entry) return null;

  const visibility = visibilityOf(entry);
  const author     = authorOf(entry);
  const me         = currentUserEmail();
  const isAdmin    = isLoggedIn();
  const isOwner    = !!author && author === me;
  const canFlip    = isAdmin && !!author;     // any admin, given we know the owner pk
  const nextVisibility = visibility === 'public' ? 'admins' : 'public';

  const handleDelete = confirmDelete(
    'Destroy this record?',
    () => deletePost(entry.entryId, entry.createdAt),
    () => { updateState({ selectedEntry: null }); if (onDeleted) onDeleted(); }
  );

  const handleVisibilityFlip = async () => {
    try {
      await updatePostVisibility(entry.entryId, entry.createdAt, nextVisibility, author);
      // Patch in-memory entry so the chip updates instantly; reload syncs
      // the list with any other admin's concurrent changes.
      updateState({ selectedEntry: { ...entry, visibility: nextVisibility } });
      if (onVisibilityChanged) onVisibilityChanged();
    } catch (err) {
      alert('Could not change visibility: ' + err.message);
    }
  };

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
        createElement('div', { className: 'reading-meta-left' },
          createElement('span', { className: 'reading-date' }, formatLongDate(entry.createdAt).toUpperCase()),
          author ? createElement('span', { className: 'reading-author' }, '· ' + author) : null,
          createElement(VisibilityTag, { visibility })
        ),
        createElement('div', { className: 'reading-meta-actions' },
          canFlip
            ? createElement('button', {
                onClick: handleVisibilityFlip,
                className: 'visibility-flip-btn',
                title: visibility === 'public' ? 'Make admins-only' : 'Make public',
              }, visibility === 'public' ? 'MAKE PRIVATE' : 'MAKE PUBLIC')
            : null,
          isOwner
            ? createElement('button', { onClick: handleDelete, className: 'delete-btn' }, 'DELETE')
            : null
        )
      )
    ),
    createElement('div', { className: 'reading-divider' }),
    createElement('div', { className: 'reading-content' }, entry.content)
  );
}

export function ArchiveView({ entries, onDeleted }) {
  const isAdmin = isLoggedIn();
  return createElement(ListView, {
    title: 'ARCHIVES',
    entries,
    emptyLabel: 'NO RECORDS FOUND',
    renderItem: (entry) => createElement(ArchiveListItem, {
      entry,
      isSelected: AppState.selectedEntry?.entryId === entry.entryId,
    }),
    detailPane: AppState.selectedEntry
      ? createElement(ReadingPane, {
          entry: AppState.selectedEntry,
          onDeleted: isAdmin ? onDeleted : null,
          onVisibilityChanged: isAdmin ? onDeleted : null,
        })
      : null,
  });
}
