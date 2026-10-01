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
USER#email@example.com      ENTRY#timestamp#id      entryId, title, Markdown content, status, shelfId, sourceIds, visibility, createdAt
SITE#HARBINGER              SHELF#id                id, name, description, color, author, createdAt
SITE#HARBINGER              SOURCE#id               id, type, title, creator, publication, URL or PDF metadata, createdAt
SITE#HARBINGER              APPEARANCE              appearance.theme, appearance.palette, updatedAt
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
- `upsert_post` - Create or update a draft/published post (requires auth)
- `get_posts` - Get all posts (val: 11, requires auth)
- `delete_post` - Delete post (val: 14, requires auth)
- `get_shelves` / `create_shelf` / `update_shelf` / `delete_shelf` - Full shelf CRUD; deletion uncategorizes assigned entries
- `get_appearance` / `set_appearance`
- `get_sources` / `create_source` / `update_source` / `delete_source`
- `request_source_upload_url` - Create a presigned PDF upload URL (requires auth)

PDFs use `SOURCE_BUCKET`, falling back to `MEDIA_BUCKET` or `AUDIO_BUCKET`, and
are returned to readers through one-hour signed viewing URLs. Configure S3 CORS
to allow browser `PUT` requests from the Harbinger origin.

All commands validated against REGISTERED_NUM_MAP in types/types.ts

## Deploy to AWS Lambda

TODO: Add SAM or CDK config