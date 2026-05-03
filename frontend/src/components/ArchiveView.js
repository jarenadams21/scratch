import { createElement } from '../engine/main.js';
import { deletePost } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

/**
 * ArchiveListItem Component
 * Compact entry in the list (left pane)
 */
export function ArchiveListItem({ entry, isSelected }) {
  const handleClick = () => {
    updateState({ selectedEntry: entry });
  };
  
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  const className = isSelected 
    ? 'archive-list-item selected' 
    : 'archive-list-item';
  
  return createElement('div', { 
    className,
    onClick: handleClick 
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'item-date' }, date.toUpperCase())
    ),
    createElement('div', { className: 'item-preview' }, 
      entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '')
    )
  );
}

/**
 * ReadingPane Component
 * Expanded view of selected entry (right pane)
 */
export function ReadingPane({ entry, onDeleted }) {
  if (!entry) {
    return null; // Don't show pane at all when nothing selected
  }
  
  const handleClose = () => {
    updateState({ selectedEntry: null });
  };
  
  const handleDelete = async () => {
    if (!confirm('Destroy this record?')) return;
    
    try {
      await deletePost(entry.entryId, entry.createdAt);
      
      // Clear selection and notify parent
      updateState({ selectedEntry: null });
      
      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      alert('Deletion failed: ' + err.message);
    }
  };
  
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return createElement('div', { className: 'reading-pane' },
    createElement('div', { className: 'reading-header' },
      createElement('div', { className: 'reading-title-row' },
        createElement('h1', { className: 'reading-title' }, entry.title.toUpperCase()),
        createElement('button', { 
          onClick: handleClose, 
          className: 'close-btn',
          title: 'Close'
        }, '✕')
      ),
      createElement('div', { className: 'reading-meta' },
        createElement('span', { className: 'reading-date' }, date.toUpperCase()),
        createElement('button', { 
          onClick: handleDelete, 
          className: 'delete-btn' 
        }, 'DELETE')
      )
    ),
    createElement('div', { className: 'reading-divider' }),
    createElement('div', { className: 'reading-content' }, entry.content)
  );
}

/**
 * ArchiveView Component
 * Split-pane layout when entry selected, full list otherwise
 */
export function ArchiveView({ entries, onDeleted }) {
  if (!entries || entries.length === 0) {
    return createElement('div', { className: 'archive-full-view' },
      createElement('div', { className: 'archive-list-pane' },
        createElement('div', { className: 'archive-list-header' },
          createElement('h2', null, 'ARCHIVES'),
          createElement('div', { className: 'record-count' }, '0 RECORDS')
        ),
        createElement('div', { className: 'empty-archive' },
          createElement('div', { className: 'empty-archive-label' }, 'NO RECORDS FOUND')
        )
      )
    );
  }
  
  const hasSelection = !!AppState.selectedEntry;
  const containerClass = hasSelection ? 'archive-split-view' : 'archive-full-view';
  
  return createElement('div', { className: containerClass },
    // Left pane (or full pane when no selection): Entry list
    createElement('div', { className: 'archive-list-pane' },
      createElement('div', { className: 'archive-list-header' },
        createElement('h2', null, 'ARCHIVES'),
        createElement('div', { className: 'record-count' }, `${entries.length} RECORDS`)
      ),
      createElement('div', { className: 'archive-list-scroll' },
        ...entries.map(entry => 
          createElement(ArchiveListItem, { 
            entry, 
            isSelected: AppState.selectedEntry?.entryId === entry.entryId
          })
        )
      )
    ),
    
    // Right pane: Reading view (only when entry selected)
    hasSelection ? createElement(ReadingPane, { 
      entry: AppState.selectedEntry, 
      onDeleted 
    }) : null
  );
}
