import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config.js';

const client = new DynamoDBClient({ region: config.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: config.AWS_REGION });

const SHARED_BOARD = 'MEALBOARD#default';
// Reuse the audio bucket by default — same CORS, same IAM. The new prefix
// keeps the two media types cleanly separated.
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || process.env.AUDIO_BUCKET || 'harbinger-audio-files';
const IMAGE_PREFIX = 'meal-images';
const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);
const MAX_IMAGES_PER_DAY = 12;

// Schema of trait keys clients may persist. Each trait declares its type,
// which both gates the value and tells the client how to render the control.
// Adding a new trait = one new entry here, plus rendering in SettingsView.
export const DISPLAY_COLORS = Object.freeze(['green', 'indigo', 'terracotta', 'ochre', 'sand', 'plum']);

export const TRAIT_SCHEMA = Object.freeze({
  calendar:          { type: 'boolean' },
  defaultVisibility: { type: 'enum', values: ['public', 'admins'] },
  displayName:       { type: 'string', minLength: 1, maxLength: 32 },
  displayColor:      { type: 'enum', values: DISPLAY_COLORS },
});

export const ALLOWED_TRAITS = Object.freeze(Object.keys(TRAIT_SCHEMA));

// Public-facing fallback. Visitors and admins without a displayName render
// as "Operator" — keeps the surface anonymous without exposing email parts.
export const DEFAULT_DISPLAY_NAME = 'Operator';

const DATE_RX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MEAL_TEXT_MAX = 2000;
const MEAL_QUERY_MAX_DAYS = 366;

// ─── Validation helpers ────────────────────────────────────────────────────

function validateTraitValue(trait, value) {
  const schema = TRAIT_SCHEMA[trait];
  if (!schema) throw new Error(`Unknown trait: ${trait}`);
  if (schema.type === 'boolean') return !!value;
  if (schema.type === 'enum') {
    if (!schema.values.includes(value)) {
      throw new Error(`Invalid value for ${trait} (must be one of: ${schema.values.join(', ')})`);
    }
    return value;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      throw new Error(`Invalid value for ${trait} (must be a string)`);
    }
    const trimmed = value.trim();
    if (trimmed.length < (schema.minLength ?? 0)) {
      throw new Error(`Invalid value for ${trait} (too short)`);
    }
    if (trimmed.length > (schema.maxLength ?? Infinity)) {
      throw new Error(`Invalid value for ${trait} (too long, max ${schema.maxLength})`);
    }
    // Reject anything email-shaped or markup-shaped — display names should be
    // free of @ < > so they can't masquerade as system identifiers or open
    // an HTML-injection vector if rendering ever changes.
    if (/[@<>]/.test(trimmed)) {
      throw new Error(`Invalid value for ${trait} (cannot contain @ < >)`);
    }
    return trimmed;
  }
  throw new Error(`Unsupported trait type: ${schema.type}`);
}

function assertDate(date, label = 'date') {
  if (typeof date !== 'string' || !DATE_RX.test(date)) {
    throw new Error(`Invalid ${label} (expected YYYY-MM-DD)`);
  }
}

function assertDateRange(startDate, endDate) {
  assertDate(startDate, 'startDate');
  assertDate(endDate, 'endDate');
  if (endDate < startDate) {
    throw new Error('endDate must be on or after startDate');
  }
  const spanDays = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (spanDays > MEAL_QUERY_MAX_DAYS) {
    throw new Error(`Date range too large (max ${MEAL_QUERY_MAX_DAYS} days)`);
  }
}

function sanitizeMealText(text) {
  if (text == null) return '';
  if (typeof text !== 'string') {
    throw new Error('Meal entry text must be a string');
  }
  if (text.length > MEAL_TEXT_MAX) {
    throw new Error(`Meal entry too long (max ${MEAL_TEXT_MAX} chars)`);
  }
  return text;
}

// ─── Feature Traits ─────────────────────────────────────────────────────────
// Stored as a single map per user. Single GET, single atomic UPDATE per trait.
// pk = USER#<email>, sk = TRAITS

export async function getTraits(userId) {
  const result = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: `USER#${userId}`, sk: 'TRAITS' },
  }));
  return result.Item?.traits || {};
}

// Public-safe profile view. Never includes the email — callers that need
// the email (admin operations) already have it as the lookup key.
export async function getProfile(email) {
  const traits = await getTraits(email);
  return {
    displayName: traits.displayName || DEFAULT_DISPLAY_NAME,
    displayColor: traits.displayColor || null,
  };
}

// Map of email -> profile. De-dupes the input list and parallels the lookups.
export async function getProfiles(emails) {
  const unique = [...new Set((emails || []).filter(e => typeof e === 'string' && e.length > 0))];
  const profiles = await Promise.all(unique.map(getProfile));
  const out = {};
  for (let i = 0; i < unique.length; i++) out[unique[i]] = profiles[i];
  return out;
}

export async function setTrait(userId, trait, value) {
  const validated = validateTraitValue(trait, value);
  const current = await getTraits(userId);
  const next = { ...current, [trait]: validated };
  await db.send(new PutCommand({
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: `USER#${userId}`,
      sk: 'TRAITS',
      traits: next,
      updatedAt: new Date().toISOString(),
    },
  }));
  return next;
}

// ─── Shared Meal Board ──────────────────────────────────────────────────────
// One entry per (date, author) pair on a shared board so all admins with the
// calendar trait see the same data and can each contribute their own log.
// pk = MEALBOARD#default, sk = DAY#YYYY-MM-DD#USER#<email>

function dayKey(date, userId) {
  return `DAY#${date}#USER#${userId}`;
}

export async function upsertMealEntry(userId, date, text) {
  assertDate(date);
  const safeText = sanitizeMealText(text);
  const timestamp = new Date().toISOString();
  // Atomic text-only update — preserves images and other fields. Creates
  // the row if it doesn't exist yet via if_not_exists on date/author.
  await db.send(new UpdateCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
    UpdateExpression: 'SET #t = :text, updatedAt = :ts, #d = if_not_exists(#d, :d), #a = if_not_exists(#a, :a)',
    ExpressionAttributeNames: { '#t': 'text', '#d': 'date', '#a': 'author' },
    ExpressionAttributeValues: {
      ':text': safeText,
      ':ts': timestamp,
      ':d': date,
      ':a': userId,
    },
  }));
  return { date, author: userId, text: safeText, updatedAt: timestamp };
}

export async function deleteMealEntry(userId, date) {
  assertDate(date);
  // Don't blow away images just because the text was cleared — only GC the
  // whole row when there's nothing else to keep.
  const current = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
  }));
  const item = current.Item;
  if (!item) return;
  const hasImages = Array.isArray(item.images) && item.images.length > 0;
  if (hasImages) {
    await db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
      UpdateExpression: 'SET #t = :empty, updatedAt = :ts',
      ExpressionAttributeNames: { '#t': 'text' },
      ExpressionAttributeValues: { ':empty': '', ':ts': new Date().toISOString() },
    }));
    return;
  }
  await db.send(new DeleteCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
  }));
}

// ─── Meal Images ────────────────────────────────────────────────────────────
// Images live on S3 under meal-images/<id>.<ext>. Their metadata is stored
// inline on the meal entry as an `images: [...]` array — atomic appends via
// list_append, atomic removes via DELETE then re-PUT (small enough to be cheap).

export async function generateImageUploadUrl(filename, contentType) {
  if (typeof contentType !== 'string' || !ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
    throw new Error(`Invalid content type (must be one of: ${ALLOWED_IMAGE_TYPES.join(', ')})`);
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const ext = String(filename || '').split('.').pop().toLowerCase().slice(0, 8) || 'jpg';
  const key = `${IMAGE_PREFIX}/${id}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  const imageUrl  = `https://${MEDIA_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
  return { uploadUrl, imageKey: key, imageUrl };
}

function assertImageMeta(meta) {
  if (!meta || typeof meta !== 'object') throw new Error('Invalid image metadata');
  if (typeof meta.imageKey !== 'string' || !meta.imageKey.startsWith(`${IMAGE_PREFIX}/`)) {
    throw new Error('Invalid imageKey');
  }
  if (typeof meta.imageUrl !== 'string' || !meta.imageUrl.startsWith('https://')) {
    throw new Error('Invalid imageUrl');
  }
  if (meta.mimeType && !ALLOWED_IMAGE_TYPES.includes(String(meta.mimeType).toLowerCase())) {
    throw new Error('Invalid mimeType');
  }
}

export async function attachMealImage(userId, date, image) {
  assertDate(date);
  assertImageMeta(image);
  const item = {
    imageKey: image.imageKey,
    imageUrl: image.imageUrl,
    mimeType: image.mimeType || null,
    size:     typeof image.size === 'number' ? image.size : null,
    uploadedAt: new Date().toISOString(),
  };
  // Atomic append. Creates the entry if missing (nothing else exists for
  // that day yet), bumps updatedAt, caps the list at MAX_IMAGES_PER_DAY.
  try {
    // `date` is a reserved keyword in DynamoDB UpdateExpressions — has to go
     // through ExpressionAttributeNames or the parser rejects it outright.
    await db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
      UpdateExpression: 'SET images = list_append(if_not_exists(images, :empty), :one), #d = if_not_exists(#d, :d), author = if_not_exists(author, :a), updatedAt = :ts',
      ConditionExpression: 'attribute_not_exists(images) OR size(images) < :max',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: {
        ':empty': [],
        ':one':   [item],
        ':d':     date,
        ':a':     userId,
        ':ts':    item.uploadedAt,
        ':max':   MAX_IMAGES_PER_DAY,
      },
    }));
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new Error(`Invalid request — already at max ${MAX_IMAGES_PER_DAY} images for this day`);
    }
    throw err;
  }
  return item;
}

export async function detachMealImage(userId, date, imageKey) {
  assertDate(date);
  if (typeof imageKey !== 'string' || !imageKey.startsWith(`${IMAGE_PREFIX}/`)) {
    throw new Error('Invalid imageKey');
  }
  // Read-modify-write since DynamoDB doesn't support filtering list elements
  // server-side. Per-day list is tiny (≤12) so this is cheap.
  const current = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
  }));
  const existing = current.Item;
  if (!existing) return { removed: 0 };
  const before = (existing.images || []);
  const after  = before.filter(i => i.imageKey !== imageKey);
  if (after.length === before.length) return { removed: 0 };

  // If we just removed the last image AND there's no text, garbage-collect
  // the whole row so empty records don't linger on the shared board.
  if (after.length === 0 && (!existing.text || existing.text.length === 0)) {
    await db.send(new DeleteCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
    }));
    return { removed: 1 };
  }

  await db.send(new UpdateCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
    UpdateExpression: 'SET images = :imgs, updatedAt = :ts',
    ExpressionAttributeValues: {
      ':imgs': after,
      ':ts':   new Date().toISOString(),
    },
  }));
  return { removed: 1 };
}

export async function getMealEntries(startDate, endDate) {
  assertDateRange(startDate, endDate);
  // sk uses zero-padded ISO dates so lexical sort matches calendar order.
  // The high bound `DAY#<endDate>#~` sits past any USER#<email> sk, since
  // tilde (0x7e) outranks every char an email can contain.
  const result = await db.send(new QueryCommand({
    TableName: config.DYNAMODB_TABLE,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :lo AND :hi',
    ExpressionAttributeValues: {
      ':pk': SHARED_BOARD,
      ':lo': `DAY#${startDate}`,
      ':hi': `DAY#${endDate}#~`,
    },
  }));
  return result.Items || [];
}
