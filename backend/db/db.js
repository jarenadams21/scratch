import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

export async function createEntry(userId, entry) {
  const timestamp = new Date().toISOString();
  const entryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const params = {
    TableName: config.DYNAMODB_TABLE,
    Item: {
      pk: `USER#${userId}`,
      sk: `ENTRY#${timestamp}#${entryId}`,
      entryId,
      title: entry.title,
      content: entry.content,
      mood: entry.mood || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  };
  
  await db.send(new PutCommand(params));
  return params.Item;
}

export async function getUserEntries(userId, limit = 50) {
  const params = {
    TableName: config.DYNAMODB_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'ENTRY#'
    },
    ScanIndexForward: false, // newest first
    Limit: limit
  };
  
  const result = await db.send(new QueryCommand(params));
  return result.Items || [];
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
