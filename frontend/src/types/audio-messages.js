// Audio Message Creators — follows the same command/payload/num pattern as journal-messages.js

const AUDIO_COMMAND_MAP = {
  'request_upload_url': 10,
  'create_audio_post':  11,
  'get_audio_posts':    12,
  'delete_audio_post':  13,
};

// ─── Audio Message Creators ──────────────────────────────────────────────────

/**
 * Request a presigned S3 PUT URL from the backend.
 * @param {string} filename
 * @param {string} contentType  - AudioMimeType value
 * @param {number} duration     - seconds
 * @param {number} fileSize     - bytes
 */
export function requestUploadUrlMessage(filename, contentType, duration, fileSize) {
  return {
    command: 'request_upload_url',
    payload: {
      content: { filename, contentType, duration, fileSize },
      num: AUDIO_COMMAND_MAP['request_upload_url'],
    },
  };
}

/**
 * Save audio entry metadata to DynamoDB after S3 upload completes.
 * @param {string} title
 * @param {string} audioKey    - S3 object key
 * @param {string} audioUrl    - Public S3 URL
 * @param {number} duration    - seconds
 * @param {string} mimeType    - AudioMimeType value
 * @param {number} fileSize    - bytes
 */
export function createAudioPostMessage(title, audioKey, audioUrl, duration, mimeType, fileSize) {
  return {
    command: 'create_audio_post',
    payload: {
      content: { title, audioKey, audioUrl, duration, mimeType, fileSize },
      num: AUDIO_COMMAND_MAP['create_audio_post'],
    },
  };
}

/**
 * Fetch all audio entries (public: all entries; authenticated: own entries).
 */
export function getAudioPostsMessage() {
  return {
    command: 'get_audio_posts',
    payload: {
      content: {},
      num: AUDIO_COMMAND_MAP['get_audio_posts'],
    },
  };
}

/**
 * Delete an audio entry by entryId and createdAt timestamp.
 * @param {string} entryId
 * @param {string} createdAt  - ISO 8601 timestamp (used as part of the DynamoDB sk)
 */
export function deleteAudioPostMessage(entryId, createdAt) {
  return {
    command: 'delete_audio_post',
    payload: {
      content: { entryId, createdAt },
      num: AUDIO_COMMAND_MAP['delete_audio_post'],
    },
  };
}
