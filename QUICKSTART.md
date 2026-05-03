# Quick Start

## 1. Backend Setup

```bash
cd backend
npm install

# Configure AWS CLI
aws configure

# Create DynamoDB table
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

# Start server
npm run dev
```

Server runs on http://localhost:3000

## 2. Frontend

Just open `frontend/index.html` in your browser or use the dev server:

```bash
cd frontend
npm run dev
```

## 3. Test It

1. Open http://localhost:8080
2. Click "Sign Up" 
3. Enter email + password
4. Start writing!

## Files Created

```
backend/
  ├── auth.js         # JWT signup/login/verify
  ├── db.js           # DynamoDB operations
  ├── config.js       # Environment config
  ├── server.js       # HTTP API server
  └── package.json

frontend/
  ├── src/
  │   ├── api.js      # Backend API client
  │   ├── journal.js  # Journal app UI
  │   └── journal.css # Styles
  └── wrangler.toml   # Cloudflare config

DEPLOY.md             # Deployment guide
```

## Next Steps

- [ ] Test locally
- [ ] Deploy backend to Lambda  
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Update API_URL in frontend/src/api.js
- [ ] Buy domain and configure DNS

See DEPLOY.md for detailed deployment instructions.
