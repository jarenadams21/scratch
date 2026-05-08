// ─── Audio MIME Types ────────────────────────────────────────────────────────

/** @enum {string} Supported audio MIME types */
export const AudioMimeType = {
  WEBM: 'audio/webm',       // Chrome, Firefox (MediaRecorder default)
  MP4:  'audio/mp4',        // Safari (MediaRecorder default on iOS/macOS)
  MPEG: 'audio/mpeg',       // .mp3 file uploads
  WAV:  'audio/wav',        // .wav file uploads
  OGG:  'audio/ogg',        // Firefox alternative
};

/** MIME types the browser MediaRecorder may produce */
export const RECORDABLE_MIME_TYPES = [
  AudioMimeType.WEBM,
  AudioMimeType.MP4,
  AudioMimeType.OGG,
];

/** MIME types accepted for file upload */
export const UPLOADABLE_MIME_TYPES = [
  AudioMimeType.WEBM,
  AudioMimeType.MP4,
  AudioMimeType.MPEG,
  AudioMimeType.WAV,
  AudioMimeType.OGG,
];

/** File extension for each MIME type */
export const MIME_TO_EXT = {
  [AudioMimeType.WEBM]: 'webm',
  [AudioMimeType.MP4]:  'm4a',
  [AudioMimeType.MPEG]: 'mp3',
  [AudioMimeType.WAV]:  'wav',
  [AudioMimeType.OGG]:  'ogg',
};

/** Human-readable label for each MIME type */
export const MIME_TO_LABEL = {
  [AudioMimeType.WEBM]: 'WEBM',
  [AudioMimeType.MP4]:  'M4A',
  [AudioMimeType.MPEG]: 'MP3',
  [AudioMimeType.WAV]:  'WAV',
  [AudioMimeType.OGG]:  'OGG',
};

// Browsers (especially iOS Safari) report inconsistent MIME strings for the
// same container — e.g. iPhone Voice Memos saved as .m4a may surface as
// 'audio/x-m4a', 'audio/m4a', or an empty string. Normalize aliases and fall
// back to extension when the type is empty/unknown.
const MIME_ALIASES = {
  'audio/x-m4a':    AudioMimeType.MP4,
  'audio/m4a':      AudioMimeType.MP4,
  'audio/aac':      AudioMimeType.MP4,
  'audio/mp3':      AudioMimeType.MPEG,
  'audio/x-mpeg':   AudioMimeType.MPEG,
  'audio/x-wav':    AudioMimeType.WAV,
  'audio/wave':     AudioMimeType.WAV,
  'audio/vnd.wave': AudioMimeType.WAV,
  'audio/x-ogg':    AudioMimeType.OGG,
};

const EXT_TO_MIME = {
  m4a:  AudioMimeType.MP4,
  mp4:  AudioMimeType.MP4,
  aac:  AudioMimeType.MP4,
  mp3:  AudioMimeType.MPEG,
  wav:  AudioMimeType.WAV,
  webm: AudioMimeType.WEBM,
  ogg:  AudioMimeType.OGG,
  oga:  AudioMimeType.OGG,
};

/**
 * Resolve a File to a canonical AudioMimeType, or null if unsupported.
 * Trusts the browser's MIME first, then aliases, then file extension.
 * @param {File} file
 * @returns {AudioMimeType|null}
 */
export function resolveAudioMimeType(file) {
  const reported = (file.type || '').toLowerCase();
  if (UPLOADABLE_MIME_TYPES.includes(reported)) return reported;
  if (MIME_ALIASES[reported]) return MIME_ALIASES[reported];

  const name = (file.name || '').toLowerCase();
  const dot  = name.lastIndexOf('.');
  if (dot >= 0) {
    const ext = name.slice(dot + 1);
    if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  }
  return null;
}

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Maximum recording duration in seconds (10 minutes) */
export const MAX_RECORDING_SECONDS = 600;

/** Maximum file size for upload in bytes (50 MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Human-readable max file size */
export const MAX_FILE_SIZE_LABEL = '50MB';

// ─── Error Codes ─────────────────────────────────────────────────────────────

/** @enum {string} Audio operation error codes */
export const AudioErrorCode = {
  MICROPHONE_DENIED:    'MICROPHONE_DENIED',
  MICROPHONE_UNAVAILABLE: 'MICROPHONE_UNAVAILABLE',
  UNSUPPORTED_FORMAT:   'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE:       'FILE_TOO_LARGE',
  DURATION_TOO_LONG:    'DURATION_TOO_LONG',
  TITLE_REQUIRED:       'TITLE_REQUIRED',
  UPLOAD_FAILED:        'UPLOAD_FAILED',
  SAVE_FAILED:          'SAVE_FAILED',
  DELETE_FAILED:        'DELETE_FAILED',
  NO_RECORDING:         'NO_RECORDING',
};

/** User-facing error messages keyed by AudioErrorCode */
export const AudioErrorMessage = {
  [AudioErrorCode.MICROPHONE_DENIED]:      'Microphone access denied. Check browser permissions.',
  [AudioErrorCode.MICROPHONE_UNAVAILABLE]: 'No microphone detected on this device.',
  [AudioErrorCode.UNSUPPORTED_FORMAT]:     `Unsupported format. Accepted: MP3, M4A, WAV, WEBM, OGG.`,
  [AudioErrorCode.FILE_TOO_LARGE]:         `File exceeds ${MAX_FILE_SIZE_LABEL} limit.`,
  [AudioErrorCode.DURATION_TOO_LONG]:      `Recording exceeds ${MAX_RECORDING_SECONDS / 60} minute limit.`,
  [AudioErrorCode.TITLE_REQUIRED]:         'Title is required before transmitting.',
  [AudioErrorCode.UPLOAD_FAILED]:          'Upload failed. Check connection and try again.',
  [AudioErrorCode.SAVE_FAILED]:            'Failed to save recording metadata. Try again.',
  [AudioErrorCode.DELETE_FAILED]:          'Deletion failed. Try again.',
  [AudioErrorCode.NO_RECORDING]:           'No recording to transmit.',
};

// ─── Audio Entry Shape (internal) ────────────────────────────────────────────

/**
 * Shape of an audio entry as stored in DynamoDB and returned by the API.
 * @typedef {Object} AudioEntry
 * @property {string} entryId
 * @property {string} title
 * @property {string} audioKey    - S3 object key
 * @property {string} audioUrl    - Public S3 URL
 * @property {AudioMimeType} mimeType
 * @property {number} duration    - Duration in seconds
 * @property {number} fileSize    - Size in bytes
 * @property {string} createdAt   - ISO 8601 timestamp
 * @property {string} updatedAt   - ISO 8601 timestamp
 */

// ─── Upload Request Shape (external → backend) ───────────────────────────────

/**
 * @typedef {Object} UploadUrlRequest
 * @property {string} filename
 * @property {AudioMimeType} contentType
 * @property {number} duration   - seconds, validated server-side
 * @property {number} fileSize   - bytes, validated server-side
 */

/**
 * @typedef {Object} UploadUrlResponse
 * @property {string} uploadUrl  - Presigned S3 PUT URL
 * @property {string} audioKey   - S3 object key
 * @property {string} audioUrl   - Public URL after upload completes
 */

// ─── Recorder State ──────────────────────────────────────────────────────────

/** @enum {string} Recorder UI states */
export const RecorderState = {
  IDLE:       'IDLE',       // nothing started
  RECORDING:  'RECORDING',  // mic active, countdown running
  STOPPED:    'STOPPED',    // recorded, awaiting transmit/drop
  UPLOADING:  'UPLOADING',  // presigned PUT in progress
  DONE:       'DONE',       // transmitted successfully
  ERROR:      'ERROR',      // something failed
};
