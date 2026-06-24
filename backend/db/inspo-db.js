import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config.js';

// ─── Inspiration space (boards + images + outfits) ───────────────────────────
// One shared space across admins (like the meal board), pk = INSPO#default:
//   BOARD#<id>   image board (freeform grid), { name, visibility }
//   IMG#<id>     an inspiration image, { imageKey, facets, boards[] }
//   OUTFIT#<id>  a body-map of image refs into slots, { name, visibility, slots }
// AUTHORIZATION lives in server.js: every write requires a logged-in admin
// (userId); reads pass isAdmin and the functions below return only PUBLIC
// collections to anyone who isn't. The frontend's read-only gating is UX only —
// this is the real boundary.

const client = new DynamoDBClient({ region: config.AWS_REGION });
let db = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: config.AWS_REGION });

// Test seam: inject an in-memory DocumentClient so auth/visibility can be
// verified without touching AWS. No-op in production.
export function __setTestDb(stub) { db = stub; }

const T = config.DYNAMODB_TABLE;
const SHARED = 'INSPO#default';
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || process.env.AUDIO_BUCKET || 'harbinger-audio-files';
// Inspo image bytes ride the existing request_image_upload_url flow, which
// writes under this prefix — so we validate against it here too.
const IMAGE_PREFIX = 'meal-images';
const VIEW_TTL = 900; // 15 min signed-GET, same as meal images
const SLOT_KEYS = ['head', 'eyewear', 'outerwear', 'top', 'belt', 'bottom', 'sock', 'shoe'];
const VISIBILITIES = ['public', 'admins'];
const MAX_ACCESSORIES = 40;

// ─── helpers ──────────────────────────────────────────────────────────────────

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const nowISO = () => new Date().toISOString();

function reqName(name, max = 80) {
  const s = String(name ?? '').trim();
  if (!s) throw new Error('Invalid name (required)');
  return s.slice(0, max);
}

function visOrPrivate(v) {
  return VISIBILITIES.includes(v) ? v : 'admins';
}

function strList(arr, maxItems = 40, maxLen = 48) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t) out.push(t.slice(0, maxLen));
    if (out.length >= maxItems) break;
  }
  return [...new Set(out)];
}

// Short-lived signed GET so stored URLs are never long-lived. Fails soft:
// returns null (caller falls back to the stored URL) instead of throwing, so a
// presign hiccup can't take down a whole read.
async function presignGet(imageKey) {
  if (!imageKey || typeof imageKey !== 'string') return null;
  try {
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: imageKey }), { expiresIn: VIEW_TTL });
  } catch {
    return null;
  }
}

async function queryPrefix(prefix) {
  const r = await db.send(new QueryCommand({
    TableName: T,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
    ExpressionAttributeValues: { ':pk': SHARED, ':p': prefix },
  }));
  return r.Items || [];
}

// ─── Boards ─────────────────────────────────────────────────────────────────

const boardOut = (b) => ({ id: b.id, name: b.name, visibility: b.visibility, createdAt: b.createdAt, updatedAt: b.updatedAt });

export async function getInspoBoards(isAdmin) {
  let boards = (await queryPrefix('BOARD#')).map(boardOut);
  if (!isAdmin) boards = boards.filter(b => b.visibility === 'public');
  return boards.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function createInspoBoard(name) {
  const ts = nowISO();
  const board = { pk: SHARED, sk: `BOARD#${newId()}`, id: undefined, name: reqName(name), visibility: 'admins', createdAt: ts, updatedAt: ts };
  board.id = board.sk.slice('BOARD#'.length);
  await db.send(new PutCommand({ TableName: T, Item: board }));
  return boardOut(board);
}

export async function updateInspoBoard(id, patch = {}) {
  const cur = await db.send(new GetCommand({ TableName: T, Key: { pk: SHARED, sk: `BOARD#${id}` } }));
  if (!cur.Item) throw new Error('Invalid board (not found)');
  const next = { ...cur.Item, updatedAt: nowISO() };
  if (typeof patch.name === 'string') next.name = reqName(patch.name);
  if (patch.visibility != null) next.visibility = visOrPrivate(patch.visibility);
  await db.send(new PutCommand({ TableName: T, Item: next }));
  return boardOut(next);
}

export async function deleteInspoBoard(id) {
  await db.send(new DeleteCommand({ TableName: T, Key: { pk: SHARED, sk: `BOARD#${id}` } }));
  // Detach this board from any image that referenced it (images survive).
  const imgs = await queryPrefix('IMG#');
  await Promise.all(
    imgs
      .filter(i => Array.isArray(i.boards) && i.boards.includes(id))
      .map(i => db.send(new PutCommand({ TableName: T, Item: { ...i, boards: i.boards.filter(b => b !== id), updatedAt: nowISO() } })))
  );
  return { message: 'Deleted' };
}

// ─── Images ─────────────────────────────────────────────────────────────────

async function imageOut(i) {
  return {
    id: i.id,
    imageKey: i.imageKey,
    imageUrl: (await presignGet(i.imageKey)) || i.imageUrl,
    mimeType: i.mimeType ?? null,
    size: typeof i.size === 'number' ? i.size : null,
    title: i.title || '',
    note: i.note || '',
    boards: i.boards || [],
    scenarios: i.scenarios || [],
    seasons: i.seasons || [],
    colors: i.colors || [],
    tags: i.tags || [],
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export async function getInspos(isAdmin) {
  const raw = await queryPrefix('IMG#');
  let items = raw;
  if (!isAdmin) {
    // Visitors see only images that live in at least one PUBLIC board, and the
    // private board ids are stripped from what they get back.
    const publicIds = new Set((await getInspoBoards(false)).map(b => b.id));
    items = raw
      .filter(i => (i.boards || []).some(id => publicIds.has(id)))
      .map(i => ({ ...i, boards: (i.boards || []).filter(id => publicIds.has(id)) }));
  }
  const out = await Promise.all(items.map(imageOut));
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function assertImageMeta(image) {
  if (!image || typeof image !== 'object') throw new Error('Invalid image');
  if (typeof image.imageKey !== 'string' || !image.imageKey.startsWith(`${IMAGE_PREFIX}/`)) {
    throw new Error('Invalid imageKey');
  }
  if (typeof image.imageUrl !== 'string' || !image.imageUrl.startsWith('https://')) {
    throw new Error('Invalid imageUrl');
  }
}

export async function createInspo(image, meta = {}) {
  assertImageMeta(image);
  const ts = nowISO();
  const id = newId();
  const item = {
    pk: SHARED, sk: `IMG#${id}`, id,
    imageKey: image.imageKey,
    imageUrl: image.imageUrl,
    mimeType: image.mimeType || null,
    size: typeof image.size === 'number' ? image.size : null,
    title: String(meta.title || '').slice(0, 120),
    note: String(meta.note || '').slice(0, 600),
    boards: strList(meta.boards),
    scenarios: strList(meta.scenarios),
    seasons: strList(meta.seasons),
    colors: strList(meta.colors),
    tags: strList(meta.tags),
    createdAt: ts, updatedAt: ts,
  };
  await db.send(new PutCommand({ TableName: T, Item: item }));
  return imageOut(item);
}

export async function updateInspo(id, patch = {}) {
  const cur = await db.send(new GetCommand({ TableName: T, Key: { pk: SHARED, sk: `IMG#${id}` } }));
  if (!cur.Item) throw new Error('Invalid image (not found)');
  const next = { ...cur.Item, updatedAt: nowISO() };
  if (typeof patch.title === 'string') next.title = patch.title.slice(0, 120);
  if (typeof patch.note === 'string') next.note = patch.note.slice(0, 600);
  for (const f of ['boards', 'scenarios', 'seasons', 'colors', 'tags']) {
    if (patch[f] !== undefined) next[f] = strList(patch[f]);
  }
  await db.send(new PutCommand({ TableName: T, Item: next }));
  return imageOut(next);
}

export async function deleteInspo(id) {
  await db.send(new DeleteCommand({ TableName: T, Key: { pk: SHARED, sk: `IMG#${id}` } }));
  return { message: 'Deleted' };
}

// ─── Outfits ────────────────────────────────────────────────────────────────

function validRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (typeof ref.imageId !== 'string' || typeof ref.imageUrl !== 'string') return null;
  return { imageId: ref.imageId, imageUrl: ref.imageUrl, title: String(ref.title || '').slice(0, 120) };
}

// Snapshot the source image's imageKey onto each slot ref so reads can re-sign
// the URL (and so the look survives the image being retagged later).
function enrichSlots(slots, keyById) {
  const out = { accessories: [] };
  for (const k of SLOT_KEYS) {
    const r = validRef(slots && slots[k]);
    out[k] = r ? { ...r, imageKey: keyById[r.imageId] || null } : null;
  }
  const accs = Array.isArray(slots && slots.accessories) ? slots.accessories : [];
  out.accessories = accs.map(validRef).filter(Boolean).slice(0, MAX_ACCESSORIES)
    .map(r => ({ ...r, imageKey: keyById[r.imageId] || null }));
  return out;
}

async function presignSlots(slots) {
  const reSign = async (r) => (r ? { ...r, imageUrl: (await presignGet(r.imageKey)) || r.imageUrl } : null);
  const out = { accessories: [] };
  for (const k of SLOT_KEYS) out[k] = await reSign(slots[k]);
  out.accessories = await Promise.all((slots.accessories || []).map(reSign));
  return out;
}

async function imageKeyMap() {
  const imgs = await queryPrefix('IMG#');
  const map = {};
  for (const i of imgs) map[i.id] = i.imageKey;
  return map;
}

async function outfitOut(o) {
  return { id: o.id, name: o.name, visibility: o.visibility, slots: await presignSlots(o.slots || { accessories: [] }), createdAt: o.createdAt, updatedAt: o.updatedAt };
}

export async function getOutfits(isAdmin) {
  let raw = await queryPrefix('OUTFIT#');
  if (!isAdmin) raw = raw.filter(o => o.visibility === 'public');
  const out = await Promise.all(raw.map(outfitOut));
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createOutfit(name, slots) {
  const ts = nowISO();
  const id = newId();
  const keyById = await imageKeyMap();
  const item = {
    pk: SHARED, sk: `OUTFIT#${id}`, id,
    name: reqName(name),
    visibility: 'admins',
    slots: enrichSlots(slots, keyById),
    createdAt: ts, updatedAt: ts,
  };
  await db.send(new PutCommand({ TableName: T, Item: item }));
  return outfitOut(item);
}

export async function updateOutfit(id, patch = {}) {
  const cur = await db.send(new GetCommand({ TableName: T, Key: { pk: SHARED, sk: `OUTFIT#${id}` } }));
  if (!cur.Item) throw new Error('Invalid outfit (not found)');
  const next = { ...cur.Item, updatedAt: nowISO() };
  if (typeof patch.name === 'string') next.name = reqName(patch.name);
  if (patch.visibility != null) next.visibility = visOrPrivate(patch.visibility);
  if (patch.slots) next.slots = enrichSlots(patch.slots, await imageKeyMap());
  await db.send(new PutCommand({ TableName: T, Item: next }));
  return outfitOut(next);
}

export async function deleteOutfit(id) {
  await db.send(new DeleteCommand({ TableName: T, Key: { pk: SHARED, sk: `OUTFIT#${id}` } }));
  return { message: 'Deleted' };
}
