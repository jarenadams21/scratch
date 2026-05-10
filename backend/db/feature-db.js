import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/config.js';

const client = new DynamoDBClient({ region: config.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

const SHARED_BOARD = 'MEALBOARD#default';

// Schema of trait keys clients may persist. Each trait declares its type,
// which both gates the value and tells the client how to render the control.
// Adding a new trait = one new entry here, plus rendering in SettingsView.
export const TRAIT_SCHEMA = Object.freeze({
  calendar:          { type: 'boolean' },
  defaultVisibility: { type: 'enum', values: ['public', 'admins'] },
});

export const ALLOWED_TRAITS = Object.freeze(Object.keys(TRAIT_SCHEMA));

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
  const item = {
    pk: SHARED_BOARD,
    sk: dayKey(date, userId),
    date,
    author: userId,
    text: safeText,
    updatedAt: timestamp,
  };
  await db.send(new PutCommand({ TableName: config.DYNAMODB_TABLE, Item: item }));
  return item;
}

export async function deleteMealEntry(userId, date) {
  assertDate(date);
  await db.send(new DeleteCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
  }));
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
