import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/config.js';

const client = new DynamoDBClient({ region: config.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

// ─── User Operations ────────────────────────────────────────────────────────

export async function createUser(email, passwordHash) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: `USER#${email}`,
      sk: 'PROFILE',
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    }
  };
  
  await db.send(new PutCommand(params));
  return { email };
}

export async function getUserByEmail(email) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    Key: {
      pk: `USER#${email}`,
      sk: 'PROFILE'
    }
  };
  
  const result = await db.send(new GetCommand(params));
  return result.Item;
}

// ─── Entry Operations ────────────────────────────────────────────────────────

export const VISIBILITY_VALUES = Object.freeze(['public', 'admins']);
export const DEFAULT_VISIBILITY = 'public';

export function assertVisibility(v) {
  if (!VISIBILITY_VALUES.includes(v)) {
    throw new Error(`Invalid visibility (must be one of: ${VISIBILITY_VALUES.join(', ')})`);
  }
}

export async function createEntry(userId, entry) {
  const timestamp = new Date().toISOString();
  const entryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const visibility = entry.visibility || DEFAULT_VISIBILITY;
  assertVisibility(visibility);

  const params = {
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`,
      entryId,
      author: userId,
      title: entry.title,
      content: entry.content,
      mood: entry.mood || null,
      visibility,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  };

  await db.send(new PutCommand(params));
  return params.Item;
}

// Cross-admin visibility flip. Any authenticated caller can change the
// visibility of any entry, given the owner's email (used to construct the pk).
// Auth itself is enforced at the message-handler layer; this function only
// requires that the entry actually exists.
export async function updateEntryVisibility(ownerEmail, entryId, timestamp, visibility) {
  assertVisibility(visibility);
  if (!ownerEmail || typeof ownerEmail !== 'string') {
    throw new Error('Invalid author');
  }
  try {
    await db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: `USER#${ownerEmail}`, sk: `ENTRY#${timestamp}#${entryId}` },
      UpdateExpression: 'SET visibility = :v, updatedAt = :ts',
      ConditionExpression: 'attribute_exists(pk)',
      ExpressionAttributeValues: {
        ':v': visibility,
        ':ts': new Date().toISOString(),
      },
    }));
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new Error('Invalid entry (not found)');
    }
    throw err;
  }
  return { entryId, createdAt: timestamp, visibility, author: ownerEmail };
}

export async function getEntry(userId, entryId, timestamp) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`
    }
  };
  
  const result = await db.send(new GetCommand(params));
  return result.Item;
}

export async function getAllEntries(limit = 50) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    FilterExpression: 'begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':sk': 'ENTRY#' },
    Limit: limit
  };

  const result = await db.send(new ScanCommand(params));
  return (result.Items || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteEntry(userId, entryId, timestamp) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`
    }
  };
  
  await db.send(new DeleteCommand(params));
}
