import { createElement } from '../engine/main.js';
import { requestUploadUrl, uploadAudioToS3, createAudioPost } from '../lib/api.js';
import { formatTime } from '../lib/format.js';
import {
  AudioMimeType,
  UPLOADABLE_MIME_TYPES,
  MIME_TO_EXT,
  MAX_RECORDING_SECONDS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  AudioErrorCode,
  AudioErrorMessage,
  RecorderState,
} from '../types/audio-types.js';

function getSupportedMimeType() {
  const candidates = [AudioMimeType.WEBM, AudioMimeType.MP4, AudioMimeType.OGG];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return AudioMimeType.MP4;
}

export function AudioRecorder({ onTransmitted }) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const onMount = (container) => {
    if (!container) return;
    requestAnimationFrame(() => {

    let recorderState   = RecorderState.IDLE;
    let mediaRecorder   = null;
    let audioStream     = null;
    let recordedChunks  = [];
    let recordedBlob    = null;
    let recordedMime    = null;
    let recordedSeconds = 0;
    let uploadedFile    = null;
    let countdownInterval = null;

    const titleInput     = container.querySelector('.ar-title-input');
    const recordBtn      = container.querySelector('.ar-record-btn');
    const stopBtn        = container.querySelector('.ar-stop-btn');
    const uploadInput    = container.querySelector('.ar-file-input');
    const uploadLabel    = container.querySelector('.ar-upload-label');
    const countdownEl    = container.querySelector('.ar-countdown');
    const statusEl       = container.querySelector('.ar-status');
    const previewSection = container.querySelector('.ar-preview-section');
    const previewLabel   = container.querySelector('.ar-preview-label');
    const transmitBtn    = container.querySelector('.ar-transmit-btn');
    const dropBtn        = container.querySelector('.ar-drop-btn');
    const errorEl        = container.querySelector('.ar-error');

    function setState(next) {
      recorderState = next;
      const isIdle      = next === RecorderState.IDLE;
      const isRecording = next === RecorderState.RECORDING;
      const isStopped   = next === RecorderState.STOPPED;
      const isUploading = next === RecorderState.UPLOADING;

      recordBtn.style.display      = isIdle      ? '' : 'none';
      uploadLabel.style.display    = isIdle      ? '' : 'none';
      stopBtn.style.display        = isRecording ? '' : 'none';
      countdownEl.style.display    = isRecording ? '' : 'none';
      previewSection.style.display = isStopped   ? '' : 'none';
      transmitBtn.disabled         = isUploading;
      transmitBtn.textContent      = isUploading ? 'TRANSMITTING...' : '▶  TRANSMIT';
    }

    function showError(code) {
      errorEl.textContent = AudioErrorMessage[code] || 'An error occurred.';
      errorEl.style.display = '';
    }

    function clearError() {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    function startCountdown() {
      let remaining = MAX_RECORDING_SECONDS;
      countdownEl.textContent = formatTime(remaining);
      countdownInterval = setInterval(() => {
        remaining--;
        countdownEl.textContent = formatTime(remaining);
        if (remaining <= 0) stopRecording(true);
      }, 1000);
    }

    function stopCountdown() {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    recordBtn.addEventListener('click', async () => {
      clearError();
      if (!navigator.mediaDevices?.getUserMedia) {
        showError(AudioErrorCode.MICROPHONE_UNAVAILABLE);
        return;
      }
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        showError(AudioErrorCode.MICROPHONE_DENIED);
        return;
      }

      recordedMime   = getSupportedMimeType();
      recordedChunks = [];
      const startTime = Date.now();

      mediaRecorder = new MediaRecorder(audioStream, { mimeType: recordedMime });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        recordedSeconds = Math.round((Date.now() - startTime) / 1000);
        recordedBlob = new Blob(recordedChunks, { type: recordedMime });
        uploadedFile = null;
        previewLabel.textContent =
          `RECORDED — ${formatTime(recordedSeconds)} · ${(recordedBlob.size / (1024 * 1024)).toFixed(1)}MB`;
        setState(RecorderState.STOPPED);
        audioStream.getTracks().forEach(t => t.stop());
        audioStream = null;
      };

      mediaRecorder.start(1000);
      setState(RecorderState.RECORDING);
      startCountdown();
    });

    function stopRecording(autoStopped = false) {
      stopCountdown();
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      statusEl.textContent = autoStopped ? 'MAX LENGTH REACHED' : '';
    }

    stopBtn.addEventListener('click', () => stopRecording(false));

    uploadInput.addEventListener('change', (e) => {
      clearError();
      const file = e.target.files[0];
      if (!file) return;

      if (!UPLOADABLE_MIME_TYPES.includes(file.type)) {
        showError(AudioErrorCode.UNSUPPORTED_FORMAT);
        uploadInput.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showError(AudioErrorCode.FILE_TOO_LARGE);
        uploadInput.value = '';
        return;
      }

      uploadedFile    = file;
      recordedBlob    = null;
      recordedMime    = file.type;
      recordedSeconds = 0;

      const url = URL.createObjectURL(file);
      const tempAudio = document.createElement('audio');
      tempAudio.src = url;
      tempAudio.addEventListener('loadedmetadata', () => {
        recordedSeconds = Math.round(tempAudio.duration) || 0;
        URL.revokeObjectURL(url);
        previewLabel.textContent =
          `${file.name} — ${(file.size / (1024 * 1024)).toFixed(1)}MB` +
          (recordedSeconds ? ` · ${formatTime(recordedSeconds)}` : '');
      });

      previewLabel.textContent = `${file.name} — ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
      setState(RecorderState.STOPPED);
    });

    transmitBtn.addEventListener('click', async () => {
      clearError();
      const title = titleInput.value.trim();
      if (!title) { showError(AudioErrorCode.TITLE_REQUIRED); return; }

      const blob     = recordedBlob || uploadedFile;
      const mimeType = recordedMime;
      const ext      = MIME_TO_EXT[mimeType] || 'bin';
      const filename = `recording.${ext}`;
      const fileSize = blob.size;
      const duration = recordedSeconds;

      setState(RecorderState.UPLOADING);
      try {
        const { uploadUrl, audioKey, audioUrl } = await requestUploadUrl(filename, mimeType, duration, fileSize);
        await uploadAudioToS3(uploadUrl, blob, mimeType);
        await createAudioPost(title, audioKey, audioUrl, duration, mimeType, fileSize);

        titleInput.value = '';
        uploadInput.value = '';
        setState(RecorderState.IDLE);
        statusEl.textContent = '';
        if (onTransmitted) onTransmitted();
      } catch (err) {
        setState(RecorderState.STOPPED);
        showError(AudioErrorCode.UPLOAD_FAILED);
        console.error('Audio transmit error:', err);
      }
    });

    dropBtn.addEventListener('click', () => {
      clearError();
      recordedBlob    = null;
      uploadedFile    = null;
      recordedMime    = null;
      recordedSeconds = 0;
      uploadInput.value = '';
      statusEl.textContent = '';
      setState(RecorderState.IDLE);
    });

    setState(RecorderState.IDLE);
    }); // end requestAnimationFrame
  };

  return createElement('div', { className: 'editor-sheet audio-recorder-sheet', ref: onMount },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, date.toUpperCase()),
      createElement('span', { className: 'date-stamp' }, 'RECORD')
    ),

    createElement('div', { className: 'ar-error', style: 'display:none' }),

    createElement('input', {
      type: 'text',
      className: 'headline-input ar-title-input',
      placeholder: 'TRANSMISSION TITLE',
      autocomplete: 'off',
    }),

    createElement('div', { className: 'ar-controls' },

      createElement('button', { className: 'ar-record-btn ar-action-btn' }, '⏺  RECORD'),

      createElement('button', { className: 'ar-stop-btn ar-action-btn ar-stop', style: 'display:none' }, '⏹  STOP'),

      createElement('div', { className: 'ar-countdown', style: 'display:none' },
        formatTime(MAX_RECORDING_SECONDS)
      ),

      createElement('div', { className: 'ar-divider-label' }, '— OR —'),

      createElement('label', { className: 'ar-upload-label ar-action-btn' },
        '⬆  UPLOAD FILE',
        createElement('input', {
          type: 'file',
          className: 'ar-file-input',
          accept: UPLOADABLE_MIME_TYPES.join(','),
          style: 'display:none',
        })
      ),

      createElement('div', { className: 'ar-format-hint' },
        `MP3 · M4A · WAV · WEBM · OGG — MAX ${MAX_FILE_SIZE_LABEL} · ${MAX_RECORDING_SECONDS / 60} MIN`
      )
    ),

    createElement('div', { className: 'ar-status' }),

    createElement('div', { className: 'ar-preview-section', style: 'display:none' },
      createElement('div', { className: 'ar-preview-label' }),
      createElement('div', { className: 'ar-transmit-row' },
        createElement('button', { className: 'publish-btn ar-transmit-btn' }, '▶  TRANSMIT'),
        createElement('button', { className: 'ar-drop-btn' }, 'DROP')
      )
    )
  );
}
