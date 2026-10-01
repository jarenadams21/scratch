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
export const ENTRY_STATUS_VALUES = Object.freeze(['draft', 'published']);
export const DEFAULT_ENTRY_STATUS = 'published';

export function assertVisibility(v) {
  if (!VISIBILITY_VALUES.includes(v)) {
    throw new Error(`Invalid visibility (must be one of: ${VISIBILITY_VALUES.join(', ')})`);
  }
}

export function assertEntryStatus(status) {
  if (!ENTRY_STATUS_VALUES.includes(status)) {
    throw new Error(`Invalid entry status (must be one of: ${ENTRY_STATUS_VALUES.join(', ')})`);
  }
}

function validatedEntry(entry, { publishing = false } = {}) {
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  const content = typeof entry.content === 'string' ? entry.content : '';
  const status = entry.status || DEFAULT_ENTRY_STATUS;
  const visibility = entry.visibility || DEFAULT_VISIBILITY;
  const shelfId = typeof entry.shelfId === 'string' ? entry.shelfId.trim() : '';
  const sourceIds = Array.isArray(entry.sourceIds)
    ? [...new Set(entry.sourceIds.filter(id => typeof id === 'string').map(id => id.trim()).filter(Boolean))]
    : [];

  assertVisibility(visibility);
  assertEntryStatus(status);
  if (title.length > 240) throw new Error('Invalid title (max 240 characters)');
  if (content.length > 200000) throw new Error('Invalid content (max 200000 characters)');
  if (shelfId.length > 120) throw new Error('Invalid shelf');
  if (sourceIds.length > 100 || sourceIds.some(id => id.length > 120)) {
    throw new Error('Invalid sources');
  }
  if ((publishing || status === 'published') && (!title || !content.trim())) {
    throw new Error('Published entries require a title and body');
  }
  return { title, content, status, visibility, shelfId: shelfId || null, sourceIds };
}

export async function createEntry(userId, entry) {
  const timestamp = new Date().toISOString();
  const entryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const validated = validatedEntry(entry, { publishing: true });

  const params = {
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`,
      entryId,
      author: userId,
      title: validated.title,
      content: validated.content,
      mood: entry.mood || null,
      visibility: validated.visibility,
      status: validated.status,
      shelfId: validated.shelfId,
      sourceIds: validated.sourceIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  };

  await db.send(new PutCommand(params));
  return params.Item;
}

export async function upsertEntry(userId, entry) {
  const validated = validatedEntry(entry);
  if (!entry.entryId || !entry.createdAt) {
    const timestamp = new Date().toISOString();
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const item = {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`,
      entryId,
      author: userId,
      title: validated.title,
      content: validated.content,
      mood: entry.mood || null,
      visibility: validated.visibility,
      status: validated.status,
      shelfId: validated.shelfId,
      sourceIds: validated.sourceIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.send(new PutCommand({ TableName: config.DYNAMODB_TABLE, Item: item }));
    return item;
  }

  const updatedAt = new Date().toISOString();
  try {
    await db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `ENTRY#${entry.createdAt}#${entry.entryId}`,
      },
      UpdateExpression: 'SET title = :title, content = :content, mood = :mood, visibility = :visibility, #status = :status, shelfId = :shelfId, sourceIds = :sourceIds, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':title': validated.title,
        ':content': validated.content,
        ':mood': entry.mood || null,
        ':visibility': validated.visibility,
        ':status': validated.status,
        ':shelfId': validated.shelfId,
        ':sourceIds': validated.sourceIds,
        ':updatedAt': updatedAt,
      },
      ConditionExpression: 'attribute_exists(pk)',
    }));
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new Error('Invalid entry (not found)');
    }
    throw err;
  }
  return {
    entryId: entry.entryId,
    author: userId,
    title: validated.title,
    content: validated.content,
    mood: entry.mood || null,
    visibility: validated.visibility,
    status: validated.status,
    shelfId: validated.shelfId,
    sourceIds: validated.sourceIds,
    createdAt: entry.createdAt,
    updatedAt,
  };
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
  const items = [];
  let lastKey;
  do {
    const result = await db.send(new ScanCommand({
      TableName: config.DYNAMODB_TABLE,
      FilterExpression: 'begins_with(sk, :sk)',
      ExpressionAttributeValues: { ':sk': 'ENTRY#' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function clearShelfFromEntries(shelfId) {
  if (typeof shelfId !== 'string' || !shelfId) throw new Error('Invalid shelf');
  const entries = [];
  let lastKey;
  do {
    const result = await db.send(new ScanCommand({
      TableName: config.DYNAMODB_TABLE,
      FilterExpression: 'begins_with(sk, :entryPrefix) AND shelfId = :shelfId',
      ProjectionExpression: 'pk, sk',
      ExpressionAttributeValues: {
        ':entryPrefix': 'ENTRY#',
        ':shelfId': shelfId,
      },
      ExclusiveStartKey: lastKey,
    }));
    entries.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const updatedAt = new Date().toISOString();
  for (let index = 0; index < entries.length; index += 20) {
    const batch = entries.slice(index, index + 20);
    await Promise.all(batch.map(entry => db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: entry.pk, sk: entry.sk },
      UpdateExpression: 'SET updatedAt = :updatedAt REMOVE shelfId',
      ExpressionAttributeValues: { ':updatedAt': updatedAt },
    }))));
  }
  return entries.length;
}

export async function clearSourceFromEntries(sourceId) {
  if (typeof sourceId !== 'string' || !sourceId) throw new Error('Invalid source');
  const entries = [];
  let lastKey;
  do {
    const result = await db.send(new ScanCommand({
      TableName: config.DYNAMODB_TABLE,
      FilterExpression: 'begins_with(sk, :entryPrefix) AND contains(sourceIds, :sourceId)',
      ProjectionExpression: 'pk, sk, sourceIds',
      ExpressionAttributeValues: {
        ':entryPrefix': 'ENTRY#',
        ':sourceId': sourceId,
      },
      ExclusiveStartKey: lastKey,
    }));
    entries.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const updatedAt = new Date().toISOString();
  for (let index = 0; index < entries.length; index += 20) {
    const batch = entries.slice(index, index + 20);
    await Promise.all(batch.map(entry => db.send(new UpdateCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: { pk: entry.pk, sk: entry.sk },
      UpdateExpression: 'SET sourceIds = :sourceIds, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':sourceIds': (entry.sourceIds || []).filter(id => id !== sourceId),
        ':updatedAt': updatedAt,
      },
    }))));
  }
  return entries.length;
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
