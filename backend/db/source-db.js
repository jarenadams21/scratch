import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config.js';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.AWS_REGION }));
const s3 = new S3Client({ region: config.AWS_REGION });
const SITE_PK = 'SITE#HARBINGER';
const SOURCE_BUCKET = process.env.SOURCE_BUCKET || process.env.MEDIA_BUCKET || process.env.AUDIO_BUCKET || 'harbinger-audio-files';
const SOURCE_TYPES = Object.freeze(['website', 'pdf']);
const MAX_PDF_SIZE = 25 * 1024 * 1024;
const VIEW_TTL_SECONDS = 3600;

function cleanText(value, label, max, { required = false } = {}) {
  if (value == null) value = '';
  if (typeof value !== 'string') throw new Error(`Invalid source ${label}`);
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (required && !cleaned) throw new Error(`Invalid source ${label} (required)`);
  if (cleaned.length > max) throw new Error(`Invalid source ${label} (max ${max} characters)`);
  return cleaned;
}

function cleanUrl(value) {
  const raw = cleanText(value, 'URL', 2048, { required: true });
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid source URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Invalid source URL (expected an HTTP or HTTPS address without credentials)');
  }
  return parsed.href;
}

function cleanType(value) {
  if (!SOURCE_TYPES.includes(value)) {
    throw new Error(`Invalid source type (must be one of: ${SOURCE_TYPES.join(', ')})`);
  }
  return value;
}

function cleanPdf(file) {
  const filename = cleanText(file?.filename, 'filename', 240, { required: true });
  const documentKey = cleanText(file?.documentKey, 'document key', 500, { required: true });
  const mimeType = file?.mimeType;
  const fileSize = Number(file?.fileSize);
  if (mimeType !== 'application/pdf') throw new Error('Invalid source file type (PDF required)');
  if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_PDF_SIZE) {
    throw new Error(`Invalid source file size (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`);
  }
  if (!documentKey.startsWith('sources/')) throw new Error('Invalid source document key');
  return { filename, documentKey, mimeType, fileSize };
}

function cleanMetadata(input, current = null) {
  const type = cleanType(input.type ?? current?.type);
  const metadata = {
    type,
    title: cleanText(input.title ?? current?.title, 'title', 240, { required: true }),
    creator: cleanText(input.creator ?? current?.creator, 'creator', 160),
    publication: cleanText(input.publication ?? current?.publication, 'publication', 160),
    publishedAt: cleanText(input.publishedAt ?? current?.publishedAt, 'date', 80),
    description: cleanText(input.description ?? current?.description, 'description', 1000),
  };
  if (type === 'website') {
    metadata.url = cleanUrl(input.url ?? current?.url);
  } else {
    Object.assign(metadata, cleanPdf(input.documentKey == null ? current : input));
  }
  return metadata;
}

async function publicSource(item) {
  const { pk, sk, author, documentKey, ...source } = item;
  if (source.type === 'pdf' && documentKey) {
    source.url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: documentKey }),
      { expiresIn: VIEW_TTL_SECONDS },
    );
  }
  return source;
}

export async function getSources() {
  const result = await db.send(new QueryCommand({
    TableName: config.DYNAMODB_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': SITE_PK, ':prefix': 'SOURCE#' },
  }));
  const sources = await Promise.all((result.Items || []).map(publicSource));
  return sources.sort((a, b) => a.title.localeCompare(b.title));
}

export async function createSource(userId, input) {
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const source = {
    id,
    ...cleanMetadata(input),
    author: userId,
    createdAt: now,
    updatedAt: now,
  };
  const item = { pk: SITE_PK, sk: `SOURCE#${id}`, ...source };
  await db.send(new PutCommand({ TableName: config.DYNAMODB_TABLE, Item: item }));
  return publicSource(item);
}

export async function updateSource(id, patch) {
  if (typeof id !== 'string' || !id) throw new Error('Invalid source');
  const key = { pk: SITE_PK, sk: `SOURCE#${id}` };
  const current = (await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: key,
  }))).Item;
  if (!current) throw new Error('Invalid source (not found)');
  if (patch.type != null && patch.type !== current.type) {
    throw new Error('Invalid source type (create a new source to change its type)');
  }
  const next = {
    ...current,
    ...cleanMetadata(patch, current),
    updatedAt: new Date().toISOString(),
  };
  await db.send(new PutCommand({ TableName: config.DYNAMODB_TABLE, Item: next }));
  return publicSource(next);
}

export async function deleteSource(id) {
  if (typeof id !== 'string' || !id) throw new Error('Invalid source');
  try {
    await db.send(new DeleteCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: SITE_PK, sk: `SOURCE#${id}` },
      ConditionExpression: 'attribute_exists(pk)',
    }));
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new Error('Invalid source (not found)');
    }
    throw err;
  }
}

export async function generateSourceUploadUrl(filename, contentType, fileSize) {
  const file = cleanPdf({
    filename,
    mimeType: contentType,
    fileSize,
    documentKey: `sources/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.pdf`,
  });
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: SOURCE_BUCKET,
      Key: file.documentKey,
      ContentType: file.mimeType,
    }),
    { expiresIn: 900 },
  );
  return { uploadUrl, ...file };
}
