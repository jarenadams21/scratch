import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/config.js';

const client = new DynamoDBClient({ region: config.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

const SHARED_BOARD = 'MEALBOARD#default';

// ─── Feature Traits ─────────────────────────────────────────────────────────
// Stored as a single JSON blob per user so reads/writes are atomic.
// pk = USER#<email>, sk = TRAITS

export async function getTraits(userId) {
  const result = await db.send(new GetCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: `USER#${userId}`, sk: 'TRAITS' },
  }));
  return result.Item?.traits || {};
}

export async function setTrait(userId, trait, enabled) {
  const current = await getTraits(userId);
  const next = { ...current, [trait]: !!enabled };
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
  const timestamp = new Date().toISOString();
  const item = {
    pk: SHARED_BOARD,
    sk: dayKey(date, userId),
    date,
    author: userId,
    text: text || '',
    updatedAt: timestamp,
  };
  await db.send(new PutCommand({ TableName: config.DYNAMODB_TABLE, Item: item }));
  return item;
}

export async function deleteMealEntry(userId, date) {
  await db.send(new DeleteCommand({
    TableName: config.DYNAMODB_TABLE,
    Key: { pk: SHARED_BOARD, sk: dayKey(date, userId) },
  }));
}

export async function getMealEntries(startDate, endDate) {
  // Range prefix on sk works because dates are zero-padded and sort lexically.
  const params = {
    TableName: config.DYNAMODB_TABLE,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :lo AND :hi',
    ExpressionAttributeValues: {
      ':pk': SHARED_BOARD,
      ':lo': `DAY#${startDate}`,
      ':hi': `DAY#${endDate}#~`,
    },
  };
  const result = await db.send(new QueryCommand(params));
  return result.Items || [];
}
