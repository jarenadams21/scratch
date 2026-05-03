# Backend Setup

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up AWS credentials:
```bash
aws configure
```

3. Create DynamoDB table:
```bash
aws dynamodb create-table \
  --table-name journal-app \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

4. Create `.env` file (optional):
```bash
AWS_REGION=us-east-1
DYNAMODB_TABLE=journal-app
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:8080
```

5. Run server:
```bash
npm run dev
```

## DynamoDB Schema

Single table design:
```
pk                          sk                      attributes
USER#email@example.com      PROFILE                 email, passwordHash, createdAt
USER#email@example.com      ENTRY#timestamp#id      entryId, title, content, mood, createdAt
```

## API Endpoints

### Message Endpoint
- `POST /msg` - Single endpoint for all operations

Message format:
```json
{
  "command": "create_post",
  "payload": {
    "content": { "title": "...", "content": "..." },
    "num": { "val": 10 }
  }
}
```

### Available Commands
- `auth_signup` - Create account (val: 20)
- `auth_login` - Get JWT token (val: 21)
- `create_post` - Create post (val: 10, requires auth)
- `get_posts` - Get all posts (val: 11, requires auth)
- `delete_post` - Delete post (val: 14, requires auth)

All commands validated against REGISTERED_NUM_MAP in types/types.ts

## Deploy to AWS Lambda

TODO: Add SAM or CDK config