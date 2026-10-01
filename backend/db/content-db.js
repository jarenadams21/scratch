import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/config.js';

const client = new DynamoDBClient({ region: config.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);
const SITE_PK = 'SITE#HARBINGER';
const DEFAULT_APPEARANCE = Object.freeze({ theme: 'dark', palette: 'ember' });
const THEMES = Object.freeze(['light', 'dark']);
const PALETTES = Object.freeze(['ember', 'blue', 'moss']);

function cleanShelfName(value) {
  if (typeof value !== 'string') throw new Error('Invalid shelf name');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) throw new Error('Invalid shelf name (must be 1-80 characters)');
  if (['__proto__', 'prototype', 'constructor'].includes(name.toLowerCase())) {
    throw new Error('Invalid shelf name');
  }
  return name;
}

function cleanColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error('Invalid shelf color (expected #RRGGBB)');
  }
  return value.toLowerCase();
}

function cleanDescription(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Invalid shelf description');
  const description = value.trim().replace(/\s+/g, ' ');
  if (description.length > 280) {
    throw new Error('Invalid shelf description (max 280 characters)');
  }
  return description;
}

export async function getShelves() {
  const result = await db.send(new QueryCommand({
    TableName: config.DYNAMODB_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': SITE_PK, ':prefix': 'SHELF#' },
  }));
  return (result.Items || [])
    .map(({ pk, sk, ...shelf }) => shelf)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createShelf(userId, name, color, description = '') {
  const shelf = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: cleanShelfName(name),
    color: cleanColor(color),
    description: cleanDescription(description),
    author: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const shelves = await getShelves();
  if (shelves.some(item => item.name.toLowerCase() === shelf.name.toLowerCase())) {
    throw new Error('Invalid shelf name (already exists)');
  }
  await db.send(new PutCommand({
    TableName: config.DYNAMODB_TABLE,
    Item: { pk: SITE_PK, sk: `SHELF#${shelf.id}`, ...shelf },
  }));
  return shelf;
}

export async function updateShelf(id, patch) {
  if (typeof id !== 'string' || !id) throw new Error('Invalid shelf');
  const current = (await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SITE_PK, sk: `SHELF#${id}` },
  }))).Item;
  if (!current) throw new Error('Invalid shelf (not found)');
  const name = patch.name == null ? current.name : cleanShelfName(patch.name);
  const color = patch.color == null ? current.color : cleanColor(patch.color);
  const description = patch.description == null
    ? cleanDescription(current.description)
    : cleanDescription(patch.description);
  const shelves = await getShelves();
  if (shelves.some(item => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Invalid shelf name (already exists)');
  }
  const updatedAt = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SITE_PK, sk: `SHELF#${id}` },
    UpdateExpression: 'SET #name = :name, color = :color, description = :description, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: {
      ':name': name,
      ':color': color,
      ':description': description,
      ':updatedAt': updatedAt,
    },
  }));
  const { pk, sk, ...shelf } = current;
  return { ...shelf, name, color, description, updatedAt };
}

export async function deleteShelf(id) {
  if (typeof id !== 'string' || !id) throw new Error('Invalid shelf');
  try {
    await db.send(new DeleteCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: SITE_PK, sk: `SHELF#${id}` },
      ConditionExpression: 'attribute_exists(pk)',
    }));
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new Error('Invalid shelf (not found)');
    }
    throw err;
  }
}

export async function getAppearance() {
  const result = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SITE_PK, sk: 'APPEARANCE' },
  }));
  return result.Item?.appearance || DEFAULT_APPEARANCE;
}

export async function setAppearance(theme, palette) {
  if (!THEMES.includes(theme)) throw new Error(`Invalid theme (must be one of: ${THEMES.join(', ')})`);
  if (!PALETTES.includes(palette)) throw new Error(`Invalid palette (must be one of: ${PALETTES.join(', ')})`);
  const appearance = { theme, palette };
  await db.send(new PutCommand({
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: SITE_PK,
      sk: 'APPEARANCE',
      appearance,
      updatedAt: new Date().toISOString(),
    },
  }));
  return appearance;
}
