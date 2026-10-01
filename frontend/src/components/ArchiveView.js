import { createElement } from '../engine/main.js';
import { deletePost, updatePostVisibility, currentUserEmail, isLoggedIn } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { formatShortDate, formatLongDate } from '../lib/format.js';
import { plainText, renderMarkdown } from '../lib/markdown.js';
import { confirmDelete } from '../lib/actions.js';
import { ensureProfilesFor, profileFor } from '../lib/loaders.js';
import { ListView } from './ListView.js';

function visibilityOf(entry) {
  return entry?.visibility === 'admins' ? 'admins' : 'public';
}

function authorOf(entry) {
  if (entry?.author) return entry.author;
  if (typeof entry?.pk === 'string' && entry.pk.startsWith('USER#')) return entry.pk.slice(5);
  return null;
}

function displayNameFor(entry) {
  if (entry?.displayName) return entry.displayName;
  return profileFor(authorOf(entry)).displayName;
}

function shelfFor(entry) {
  return (AppState.shelves || []).find(shelf => shelf.id === entry?.shelfId) || null;
}

function VisibilityTag({ visibility }) {
  const isAdmins = visibility === 'admins';
  return createElement('span', {
    className: isAdmins ? 'vis-tag vis-tag-admins' : 'vis-tag vis-tag-public',
  }, isAdmins ? 'ADMINS' : 'PUBLIC');
}

function ShelfTag({ entry }) {
  const shelf = shelfFor(entry);
  if (!shelf) return null;
  return createElement('span', {
    className: 'shelf-tag',
    style: `--shelf-color:${shelf.color}`,
    title: shelf.description || shelf.name,
  }, shelf.name.toUpperCase());
}

function SourcesUsed({ entry }) {
  const ids = Array.isArray(entry?.sourceIds) ? entry.sourceIds : [];
  const sources = ids
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
            [source.creator, source.publication, source.publishedAt, source.type.toUpperCase()]
              .filter(Boolean).join(' · ')
          )
        )
      ))
    )
  );
}

function ArchiveListItem({ entry, isSelected }) {
  const preview = plainText(entry.content);
  return createElement('div', {
    className: isSelected ? 'archive-list-item selected' : 'archive-list-item',
    onClick: () => updateState({ selectedEntry: entry }),
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, (entry.title || 'Untitled').toUpperCase()),
      createElement('div', { className: 'item-date' }, formatShortDate(entry.createdAt).toUpperCase())
    ),
    createElement('div', { className: 'item-meta' },
      entry.status === 'draft'
        ? createElement('span', { className: 'vis-tag vis-tag-draft' }, 'DRAFT')
        : createElement(VisibilityTag, { visibility: visibilityOf(entry) }),
      createElement(ShelfTag, { entry }),
      createElement('div', { className: 'item-preview' }, preview.slice(0, 100) + (preview.length > 100 ? '…' : ''))
    )
  );
}

function FeaturedEntry({ entry }) {
  if (!entry) return null;
  const preview = plainText(entry.content);
  return createElement('button', {
    className: 'featured-entry',
    onClick: () => updateState({ selectedEntry: entry }),
  },
    createElement('div', { className: 'featured-tag-row' },
      createElement('span', { className: 'featured-tag' }, 'LATEST'),
      createElement('span', { className: 'featured-meta' },
        formatShortDate(entry.createdAt).toUpperCase() + ' · ' + displayNameFor(entry).toUpperCase()
      ),
      createElement(ShelfTag, { entry }),
      createElement(VisibilityTag, { visibility: visibilityOf(entry) })
    ),
    createElement('div', { className: 'featured-title' }, (entry.title || 'Untitled').toUpperCase()),
    createElement('div', { className: 'featured-preview' }, preview.slice(0, 240) + (preview.length > 240 ? '…' : '')),
    createElement('div', { className: 'featured-cta' }, '→')
  );
}

function ReadingPane({ entry, onDeleted, onVisibilityChanged }) {
  if (!entry) return null;
  const visibility = visibilityOf(entry);
  const author = authorOf(entry);
  const isAdmin = isLoggedIn();
  const isOwner = !!author && author === currentUserEmail();
  const canFlip = isAdmin && !!author && entry.status !== 'draft';
  const nextVisibility = visibility === 'public' ? 'admins' : 'public';

  const handleDelete = confirmDelete(
    'Destroy this record?',
    () => deletePost(entry.entryId, entry.createdAt),
    () => { updateState({ selectedEntry: null }); if (onDeleted) onDeleted(); }
  );

  const handleVisibilityFlip = async () => {
    if (nextVisibility === 'public' && !confirm('Make this post visible on the PUBLIC web?')) return;
    try {
      await updatePostVisibility(entry.entryId, entry.createdAt, nextVisibility, author);
      updateState({ selectedEntry: { ...entry, visibility: nextVisibility } });
      if (onVisibilityChanged) onVisibilityChanged();
    } catch (err) {
      alert('Could not change visibility: ' + err.message);
    }
  };

  const editDraft = () => updateState({
    editingEntry: entry,
    editorMode: 'write',
    currentView: 'compose',
    selectedEntry: null,
  });

  return createElement('div', { className: 'reading-pane' },
    createElement('div', { className: 'reading-header' },
      createElement('div', { className: 'reading-title-row' },
        createElement('h1', { className: 'reading-title' }, (entry.title || 'Untitled').toUpperCase()),
        createElement('button', {
          onClick: () => updateState({ selectedEntry: null }),
          className: 'close-btn',
          title: 'Close',
        }, '✕')
      ),
      createElement('div', { className: 'reading-meta' },
        createElement('div', { className: 'reading-meta-left' },
          createElement('span', { className: 'reading-date' }, formatLongDate(entry.createdAt).toUpperCase()),
          createElement('span', { className: 'reading-author' }, '· ' + displayNameFor(entry)),
          createElement(ShelfTag, { entry }),
          entry.status === 'draft'
            ? createElement('span', { className: 'vis-tag vis-tag-draft' }, 'DRAFT')
            : createElement(VisibilityTag, { visibility })
        ),
        createElement('div', { className: 'reading-meta-actions' },
          entry.status === 'draft' && isOwner
            ? createElement('button', { onClick: editDraft, className: 'visibility-flip-btn' }, 'CONTINUE WRITING')
            : null,
          canFlip
            ? createElement('button', { onClick: handleVisibilityFlip, className: 'visibility-flip-btn' },
                visibility === 'public' ? 'MAKE PRIVATE' : 'MAKE PUBLIC')
            : null,
          isOwner ? createElement('button', { onClick: handleDelete, className: 'delete-btn' }, 'DELETE') : null
        )
      )
    ),
    createElement('div', { className: 'reading-divider' }),
    createElement('div', { className: 'reading-content' }, ...renderMarkdown(entry.content)),
    createElement(SourcesUsed, { entry })
  );
}

function ArchiveFilters({ isAdmin }) {
  const shelves = AppState.shelves || [];
  const setMode = (mode, shelfId = null) => updateState({
    archiveMode: mode,
    archiveShelfId: shelfId,
    selectedEntry: null,
  });
  return createElement('div', { className: 'archive-filters' },
    createElement('button', {
      className: AppState.archiveMode === 'published' && !AppState.archiveShelfId ? 'active' : '',
      onClick: () => setMode('published'),
    }, 'ALL'),
    ...shelves.map(shelf => createElement('button', {
      className: AppState.archiveShelfId === shelf.id ? 'active' : '',
      style: `--shelf-color:${shelf.color}`,
      onClick: () => setMode('published', shelf.id),
      title: shelf.description || shelf.name,
    }, shelf.name.toUpperCase())),
    isAdmin ? createElement('button', {
      className: AppState.archiveMode === 'drafts' ? 'active' : '',
      onClick: () => setMode('drafts'),
    }, 'DRAFTS') : null,
    isAdmin ? createElement('button', {
      className: 'archive-manage-shelves',
      onClick: () => updateState({
        shelfManagerOpen: true,
        shelfEditingId: AppState.archiveShelfId || null,
      }),
    }, 'MANAGE SHELVES') : null
  );
}

export function ArchiveView({ entries, onDeleted }) {
  const isAdmin = isLoggedIn();
  const me = currentUserEmail();
  ensureProfilesFor((entries || []).map(authorOf));
  let visible = (entries || []).filter(entry => {
    const status = entry.status || 'published';
    if (AppState.archiveMode === 'drafts') return isAdmin && status === 'draft' && (!entry.author || entry.author === me);
    return status === 'published' && (!AppState.archiveShelfId || entry.shelfId === AppState.archiveShelfId);
  });
  const featured = (!AppState.selectedEntry && AppState.archiveMode !== 'drafts' && visible.length) ? visible[0] : null;
  if (featured) visible = visible.slice(1);

  return createElement('div', { className: 'archive-with-filters' },
    createElement(ArchiveFilters, { isAdmin }),
    createElement(ListView, {
      title: AppState.archiveMode === 'drafts' ? 'DRAFTS' : 'ARCHIVES',
      entries: visible,
      emptyLabel: featured ? 'NO OTHER RECORDS' : AppState.archiveMode === 'drafts' ? 'NO SAVED DRAFTS' : 'NO RECORDS FOUND',
      renderItem: entry => createElement(ArchiveListItem, {
        entry,
        isSelected: AppState.selectedEntry?.entryId === entry.entryId,
      }),
      topSlot: featured ? createElement(FeaturedEntry, { entry: featured }) : null,
      detailPane: AppState.selectedEntry
        ? createElement(ReadingPane, {
            entry: AppState.selectedEntry,
            onDeleted: isAdmin ? onDeleted : null,
            onVisibilityChanged: isAdmin ? onDeleted : null,
          })
        : null,
    })
  );
}
