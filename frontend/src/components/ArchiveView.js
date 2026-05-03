import { createElement } from '../main.js';
import { deletePost } from '../api.js';

/**
 * ArchiveEntry Component
 * Single entry in the archive list
 */
export function ArchiveEntry({ entry, onDeleted }) {
  const handleDelete = async () => {
    if (!confirm('Destroy this record?')) return;
    
    try {
      await deletePost(entry.entryId, entry.createdAt);
      
      // Notify parent (triggers reload)
      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      alert('Deletion failed: ' + err.message);
    }
  };
  
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  return createElement('div', { className: 'archive-entry' },
    createElement('div', { className: 'archive-header' },
      createElement('h3', { className: 'archive-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'archive-date' }, date.toUpperCase())
    ),
    createElement('div', { className: 'archive-body' }, entry.content),
    createElement('button', { 
      onClick: handleDelete, 
      className: 'destroy-btn' 
    }, 'X')
  );
}

/**
 * ArchiveView Component
 * Display all journal entries
 */
export function ArchiveView({ entries, onDeleted }) {
  if (!entries || entries.length === 0) {
    return createElement('div', { className: 'archive-sheet' },
      createElement('div', { className: 'empty-archive' }, 'NO RECORDS FOUND')
    );
  }
  
  return createElement('div', { className: 'archive-sheet' },
    createElement('div', { className: 'archive-header-bar' },
      createElement('h2', null, 'ARCHIVES'),
      createElement('div', { className: 'record-count' }, `${entries.length} RECORDS`)
    ),
    createElement('div', { className: 'archive-list' },
      ...entries.map(entry => 
        createElement(ArchiveEntry, { entry, onDeleted })
      )
    )
  );
}
