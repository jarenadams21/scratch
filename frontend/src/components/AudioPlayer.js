import { createElement } from '../engine/main.js';
import { deleteAudioPost } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { MIME_TO_LABEL } from '../types/audio-types.js';
import { formatTime, formatFileSize } from '../lib/format.js';
import { confirmDelete } from '../lib/actions.js';

export function AudioPlayer({ entry, onDeleted }) {
  if (!entry) return null;

  const handleDelete = confirmDelete(
    'Destroy this recording?',
    () => deleteAudioPost(entry.entryId, entry.createdAt),
    () => { updateState({ selectedAudio: null }); if (onDeleted) onDeleted(); }
  );

  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const formatLabel = MIME_TO_LABEL[entry.mimeType] || 'AUDIO';

  const onPlayerMount = (container) => {
    if (!container) return;
    requestAnimationFrame(() => {
      const audio   = container.querySelector('audio');
      const playBtn = container.querySelector('.ap-play-btn');
      const bar     = container.querySelector('.ap-progress-bar');
      const fill    = container.querySelector('.ap-progress-fill');
      const current = container.querySelector('.ap-time-current');
      const total   = container.querySelector('.ap-time-total');

      if (!audio || !playBtn) return;

      // MediaRecorder WebM files lack duration metadata — audio.duration comes back
      // as Infinity. Fall back to the server-stored duration in that case.
      function knownDuration() {
        const d = audio.duration;
        return (Number.isFinite(d) && d > 0) ? d : (entry.duration || 0);
      }

      function refreshTotal() {
        total.textContent = formatTime(knownDuration());
      }

      audio.addEventListener('loadedmetadata', refreshTotal);
      audio.addEventListener('durationchange', refreshTotal);
      // Mobile browsers often fire loadedmetadata before the rAF listener attaches
      if (audio.readyState >= 1) refreshTotal();

      audio.addEventListener('timeupdate', () => {
        current.textContent = formatTime(audio.currentTime);
        const dur = knownDuration();
        fill.style.width = dur ? `${(audio.currentTime / dur) * 100}%` : '0%';
      });
      audio.addEventListener('ended', () => {
        playBtn.textContent = '▶';
        fill.style.width = '0%';
        audio.currentTime = 0;
      });
      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          audio.play()
            .then(() => { playBtn.textContent = '▌▌'; })
            .catch(() => { playBtn.textContent = '▶'; });
        } else {
          audio.pause();
          playBtn.textContent = '▶';
        }
      });
      bar.addEventListener('click', (e) => {
        const rect = bar.getBoundingClientRect();
        const dur = knownDuration();
        if (dur > 0) audio.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
      });
    });
  };

  return createElement('div', { className: 'reading-pane audio-reading-pane' },
    createElement('div', { className: 'reading-header' },
      createElement('div', { className: 'reading-title-row' },
        createElement('h1', { className: 'reading-title' }, entry.title.toUpperCase()),
        createElement('button', {
          onClick: () => updateState({ selectedAudio: null }),
          className: 'close-btn',
          title: 'Close',
        }, '✕')
      ),
      createElement('div', { className: 'reading-meta' },
        createElement('span', { className: 'reading-date' }, date.toUpperCase()),
        createElement('button', { onClick: handleDelete, className: 'delete-btn' }, 'DELETE')
      )
    ),
    createElement('div', { className: 'reading-divider' }),

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
