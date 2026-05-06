import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';
import { AudioPlayer } from './AudioPlayer.js';

function formatDuration(seconds) {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * RecordingsListItem — compact entry in the left pane.
 */
function RecordingsListItem({ entry, isSelected }) {
  const handleClick = () => updateState({ selectedAudio: entry });

  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return createElement('div', {
    className: isSelected ? 'archive-list-item selected' : 'archive-list-item',
    onClick: handleClick,
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'item-date' }, date.toUpperCase())
    ),
    createElement('div', { className: 'item-preview recording-preview' },
      '⏵ ' + formatDuration(entry.duration)
    )
  );
}

/**
 * RecordingsView — split-pane audio archive, mirrors ArchiveView layout.
 */
export function RecordingsView({ entries, onDeleted }) {
  if (!entries || entries.length === 0) {
    return createElement('div', { className: 'archive-full-view' },
      createElement('div', { className: 'archive-list-pane' },
        createElement('div', { className: 'archive-list-header' },
          createElement('h2', null, 'RECORDINGS'),
          createElement('div', { className: 'record-count' }, '0 RECORDS')
        ),
        createElement('div', { className: 'empty-archive' },
          createElement('div', { className: 'empty-archive-label' }, 'NO RECORDINGS FOUND')
        )
      )
    );
  }

  const hasSelection  = !!AppState.selectedAudio;
  const containerClass = hasSelection ? 'archive-split-view' : 'archive-full-view';

  return createElement('div', { className: containerClass },
    createElement('div', { className: 'archive-list-pane' },
      createElement('div', { className: 'archive-list-header' },
        createElement('h2', null, 'RECORDINGS'),
        createElement('div', { className: 'record-count' }, `${entries.length} RECORDS`)
      ),
      createElement('div', { className: 'archive-list-scroll' },
        ...entries.map(entry =>
          createElement(RecordingsListItem, {
            entry,
            isSelected: AppState.selectedAudio?.entryId === entry.entryId,
          })
        )
      )
    ),

    hasSelection
      ? createElement(AudioPlayer, { entry: AppState.selectedAudio, onDeleted })
      : null
  );
}
