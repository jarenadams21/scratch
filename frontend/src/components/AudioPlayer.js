import { createElement } from '../engine/main.js';
import { deleteAudioPost } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { MIME_TO_LABEL } from '../types/audio-types.js';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * AudioPlayer Component
 * Tape-era styled player rendered in the right pane of RecordingsView.
 */
export function AudioPlayer({ entry, onDeleted }) {
  if (!entry) return null;

  const handleClose = () => updateState({ selectedAudio: null });

  const handleDelete = async () => {
    if (!confirm('Destroy this recording?')) return;
    try {
      await deleteAudioPost(entry.entryId, entry.createdAt);
      updateState({ selectedAudio: null });
      if (onDeleted) onDeleted();
    } catch (err) {
      alert('Deletion failed: ' + err.message);
    }
  };

  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const formatLabel = MIME_TO_LABEL[entry.mimeType] || 'AUDIO';

  // Wire up HTML5 audio controls via DOM events on mount
  const onPlayerMount = (container) => {
    if (!container) return;
    const audio    = container.querySelector('audio');
    const playBtn  = container.querySelector('.ap-play-btn');
    const bar      = container.querySelector('.ap-progress-bar');
    const fill     = container.querySelector('.ap-progress-fill');
    const current  = container.querySelector('.ap-time-current');
    const total    = container.querySelector('.ap-time-total');

    if (!audio || !playBtn) return;

    audio.addEventListener('loadedmetadata', () => {
      total.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      current.textContent = formatTime(audio.currentTime);
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = pct + '%';
    });

    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶';
      fill.style.width = '0%';
      audio.currentTime = 0;
    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.textContent = '▌▌';
      } else {
        audio.pause();
        playBtn.textContent = '▶';
      }
    });

    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct  = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });
  };

  return createElement('div', { className: 'reading-pane audio-reading-pane' },
    createElement('div', { className: 'reading-header' },
      createElement('div', { className: 'reading-title-row' },
        createElement('h1', { className: 'reading-title' }, entry.title.toUpperCase()),
        createElement('button', { onClick: handleClose, className: 'close-btn', title: 'Close' }, '✕')
      ),
      createElement('div', { className: 'reading-meta' },
        createElement('span', { className: 'reading-date' }, date.toUpperCase()),
        createElement('button', { onClick: handleDelete, className: 'delete-btn' }, 'DELETE')
      )
    ),
    createElement('div', { className: 'reading-divider' }),

    // Player shell — ref wires up audio events after mount
    createElement('div', { className: 'audio-player-shell', ref: onPlayerMount },
      createElement('audio', { src: entry.audioUrl, preload: 'metadata' }),

      createElement('div', { className: 'ap-transport' },
        createElement('button', { className: 'ap-play-btn' }, '▶'),
        createElement('div', { className: 'ap-timeline' },
          createElement('div', { className: 'ap-progress-bar' },
            createElement('div', { className: 'ap-progress-fill' })
          ),
          createElement('div', { className: 'ap-time-row' },
            createElement('span', { className: 'ap-time-current' }, '00:00'),
            createElement('span', { className: 'ap-time-divider' }, '/'),
            createElement('span', { className: 'ap-time-total' }, formatTime(entry.duration))
          )
        )
      ),

      createElement('div', { className: 'ap-meta-row' },
        createElement('span', { className: 'ap-format-tag' }, formatLabel),
        createElement('span', { className: 'ap-filesize' }, formatFileSize(entry.fileSize)),
        createElement('span', { className: 'ap-duration-label' }, formatTime(entry.duration) + ' TOTAL')
      )
    )
  );
}
