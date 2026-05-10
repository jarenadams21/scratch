#!/usr/bin/env node
/**
 * Admin Account Provisioning Script
 * Creates admin accounts directly in DynamoDB with hashed passwords
 * 
 * Usage: node scripts/create-admin.js
 */

import { input, password } from '@inquirer/prompts';
import bcrypt from 'bcryptjs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.DYNAMODB_TABLE || 'harbinger-prod';

async function createAdmin() {
  console.log('🔐 Harbinger Admin Account Creation\n');
  
  const email = await input({
    message: 'Admin email:',
    validate: (val) => val.includes('@') || 'Please enter a valid email'
  });
  
  const pass = await password({
    message: 'Password:',
    mask: '*'
  });
  
  const confirmPass = await password({
    message: 'Confirm password:',
    mask: '*'
  });
  
  if (pass !== confirmPass) {
    console.error('❌ Passwords do not match');
    process.exit(1);
  }
  
  if (pass.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }
  
  console.log('\n📝 Creating admin account...');
  
  const passwordHash = await bcrypt.hash(pass, 10);
  
  try {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        pk: `USER#${email}`,
        sk: 'PROFILE',
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        role: 'admin'
      }
    }));
    
    console.log('✅ Admin account created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Table: ${tableName}`);
    console.log('\n🎯 You can now log in at Harbinger');
    
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
