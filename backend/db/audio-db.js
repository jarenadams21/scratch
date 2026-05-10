import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config.js';

const AUDIO_TABLE  = process.env.AUDIO_TABLE  || 'harbinger-audio';
const AUDIO_BUCKET = process.env.AUDIO_BUCKET || 'harbinger-audio-files';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.AWS_REGION }));
const s3     = new S3Client({ region: config.AWS_REGION });

// ─── S3 Presigned URL ────────────────────────────────────────────────────────

/**
 * Generate a presigned S3 PUT URL so the browser can upload directly.
 * Expires in 15 minutes.
 * @param {string} filename
 * @param {string} contentType  - AudioMimeType value
 * @returns {{ uploadUrl: string, audioKey: string, audioUrl: string }}
 */
export async function generateUploadUrl(filename, contentType) {
  const entryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const ext     = filename.split('.').pop().toLowerCase();
  const key     = `audio/${entryId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: AUDIO_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  const audioUrl  = `https://${AUDIO_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, audioKey: key, audioUrl };
}

// ─── DynamoDB Audio Operations ───────────────────────────────────────────────

/**
 * Save an audio entry record to harbinger-audio after the S3 upload completes.
 */
export async function createAudioEntry(userId, entry) {
  const timestamp = new Date().toISOString();
  const entryId   = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const item = {
    pk:        `USER#${userId}`,
    sk:        `ENTRY#${timestamp}#${entryId}`,
    entryId,
    title:     entry.title,
    audioKey:  entry.audioKey,
    audioUrl:  entry.audioUrl,
    mimeType:  entry.mimeType,
    duration:  entry.duration,
    fileSize:  entry.fileSize,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await dynamo.send(new PutCommand({ TableName: AUDIO_TABLE, Item: item }));
  return item;
}

/**
 * Scan all audio entries for the shared feed, newest first.
 */
export async function getAllAudioEntries(limit = 50) {
  const result = await dynamo.send(new ScanCommand({
    TableName: AUDIO_TABLE,
    FilterExpression: 'begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':sk': 'ENTRY#' },
    Limit: limit,
  }));
  return (result.Items || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Delete an audio entry from DynamoDB.
 * Does not remove the S3 file (archived storage — intentional).
 */
export async function deleteAudioEntry(userId, entryId, createdAt) {
  await dynamo.send(new DeleteCommand({
    TableName: AUDIO_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${createdAt}#${entryId}`,
    },
  }));
}
