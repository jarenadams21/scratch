import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';
import { formatTime, formatShortDate } from '../lib/format.js';
import { AudioPlayer } from './AudioPlayer.js';
import { ListView } from './ListView.js';

function RecordingsListItem({ entry, isSelected }) {
  return createElement('div', {
    className: isSelected ? 'archive-list-item selected' : 'archive-list-item',
    onClick: () => updateState({ selectedAudio: entry }),
  },
    createElement('div', { className: 'item-header' },
      createElement('div', { className: 'item-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'item-date' }, formatShortDate(entry.createdAt).toUpperCase())
    ),
    createElement('div', { className: 'item-preview recording-preview' },
      '⏵ ' + formatTime(entry.duration)
    )
  );
}

export function RecordingsView({ entries, onDeleted }) {
  return createElement(ListView, {
    title: 'RECORDINGS',
    entries,
    emptyLabel: 'NO RECORDINGS FOUND',
    renderItem: (entry) => createElement(RecordingsListItem, {
      entry,
      isSelected: AppState.selectedAudio?.entryId === entry.entryId,
    }),
    detailPane: AppState.selectedAudio
      ? createElement(AudioPlayer, { entry: AppState.selectedAudio, onDeleted })
      : null,
  });
}
