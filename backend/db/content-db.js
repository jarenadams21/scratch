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
const PALETTES = Object.freeze([
  'ember',
  'moss',
  'mainsail',
  'summer-sea',
  'sailor-red',
  'night-sky',
  'rrl-purple',
  'maize',
  'hammond-khaki',
]);
const PALETTE_ALIASES = Object.freeze({ blue: 'summer-sea' });
const EMPTY_ABOUT = Object.freeze({ title: '', content: '', sections: [], updatedAt: null });
const MAX_ABOUT_SECTIONS = 12;

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
  const stored = result.Item?.appearance;
  const theme = THEMES.includes(stored?.theme) ? stored.theme : DEFAULT_APPEARANCE.theme;
  const requestedPalette = PALETTE_ALIASES[stored?.palette] || stored?.palette;
  const palette = PALETTES.includes(requestedPalette)
    ? requestedPalette
    : DEFAULT_APPEARANCE.palette;
  return { theme, palette };
}

export async function setAppearance(theme, palette) {
  if (!THEMES.includes(theme)) throw new Error(`Invalid theme (must be one of: ${THEMES.join(', ')})`);
  const requestedPalette = PALETTE_ALIASES[palette] || palette;
  if (!PALETTES.includes(requestedPalette)) {
    throw new Error(`Invalid palette (must be one of: ${PALETTES.join(', ')})`);
  }
  const appearance = { theme, palette: requestedPalette };
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

export async function getAbout() {
  const result = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SITE_PK, sk: 'ABOUT' },
  }));
  if (!result.Item) return { ...EMPTY_ABOUT, sections: [] };
  const legacyContent = typeof result.Item.content === 'string' ? result.Item.content : '';
  const storedSections = Array.isArray(result.Item.sections) ? result.Item.sections : [];
  const sections = storedSections.length
    ? storedSections.map((section, index) => ({
        id: typeof section?.id === 'string' && section.id ? section.id : `about-${index + 1}`,
        title: typeof section?.title === 'string' ? section.title : '',
        descriptor: typeof section?.descriptor === 'string' ? section.descriptor : '',
        classification: typeof section?.classification === 'string' ? section.classification : '',
        content: typeof section?.content === 'string' ? section.content : '',
      })).filter(section => section.title || section.content)
    : legacyContent.trim()
      ? [{
          id: 'about-legacy',
          title: typeof result.Item.title === 'string' && result.Item.title.trim()
            ? result.Item.title.trim()
            : 'About',
          descriptor: '',
          classification: '',
          content: legacyContent,
        }]
      : [];
  return {
    title: typeof result.Item.title === 'string' ? result.Item.title : '',
    content: legacyContent,
    sections,
    updatedAt: result.Item.updatedAt || null,
  };
}

function cleanAboutText(value, label, max, { required = false } = {}) {
  if (typeof value !== 'string') throw new Error(`Invalid About ${label}`);
  const cleaned = value.trim();
  if ((required && !cleaned) || cleaned.length > max) {
    throw new Error(`Invalid About ${label} (max ${max} characters)`);
  }
  return cleaned;
}

function validatedAboutSections(value, legacyTitle = '') {
  const input = typeof value === 'string'
    ? value.trim()
      ? [{
          id: 'about-legacy',
          title: legacyTitle.trim() || 'About',
          descriptor: '',
          classification: '',
          content: value,
        }]
      : []
    : value;
  if (!Array.isArray(input) || input.length > MAX_ABOUT_SECTIONS) {
    throw new Error(`Invalid About sections (max ${MAX_ABOUT_SECTIONS})`);
  }
  const ids = new Set();
  const sections = input.map((section, index) => {
    const id = cleanAboutText(section?.id || `about-${index + 1}`, 'section id', 80, { required: true });
    if (ids.has(id)) throw new Error('Invalid About section id (must be unique)');
    ids.add(id);
    if (typeof section?.content !== 'string' || section.content.length > 50000) {
      throw new Error('Invalid About section content (max 50000 characters)');
    }
    return {
      id,
      title: cleanAboutText(section?.title, 'section title', 120, { required: true }),
      descriptor: cleanAboutText(section?.descriptor || '', 'section descriptor', 240),
      classification: cleanAboutText(section?.classification || '', 'section classification', 160),
      content: section.content,
    };
  });
  if (sections.reduce((total, section) => total + section.content.length, 0) > 100000) {
    throw new Error('Invalid About content (max 100000 characters)');
  }
  return sections;
}

function sectionsAsMarkdown(sections) {
  return sections.map(section => [
    `## ${section.title}`,
    section.descriptor ? `*${section.descriptor}*` : '',
    section.classification ? `Filed under: ${section.classification}` : '',
    section.content,
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n');
}

export async function setAbout(title, sectionsOrContent) {
  if (typeof title !== 'string' || title.trim().length > 160) {
    throw new Error('Invalid About title (max 160 characters)');
  }
  const sections = validatedAboutSections(sectionsOrContent, title);
  const about = {
    title: title.trim(),
    content: sectionsAsMarkdown(sections),
    sections,
    updatedAt: new Date().toISOString(),
  };
  await db.send(new PutCommand({
    TableName: config.DYNAMODB_TABLE,
    Item: { pk: SITE_PK, sk: 'ABOUT', ...about },
  }));
  return about;
}
