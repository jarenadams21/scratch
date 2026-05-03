# Deployment Guide

## Frontend (Cloudflare Pages)

1. Push your code to GitHub

2. Go to Cloudflare dashboard and create new Pages project

3. Connect your GitHub repo

4. Build settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `frontend`

5. Deploy!

Your site will be at: `https://your-project.pages.dev`

### Custom Domain

1. Go to Pages project → Custom domains
2. Add your domain from Cloudflare Registrar
3. DNS is configured automatically

## Backend (AWS Lambda)

### Option 1: Manual Upload

1. Install dependencies locally:
```bash
cd backend
npm install
```

2. Create deployment package:
```bash
zip -r backend.zip . -x "*.git*" -x "node_modules/aws-sdk/*"
```

3. Create Lambda function in AWS Console:
   - Runtime: Node.js 20.x
   - Upload `backend.zip`
   - Add environment variables:
     - `JWT_SECRET`: random secret key
     - `DYNAMODB_TABLE`: `journal-app`
     - `ALLOWED_ORIGINS`: your Cloudflare Pages URL

4. Create API Gateway HTTP API:
   - Create routes for all endpoints
   - Enable CORS
   - Point to Lambda function

5. Get your API URL and update `frontend/src/api.js`

### Option 2: AWS SAM (Recommended)

TODO: Add SAM template

## After Deployment

1. Update `frontend/src/api.js` with your API Gateway URL
2. Redeploy frontend
3. Test signup/login
4. Done!

## Cost Estimate

- DynamoDB: Free tier (25GB, 200M requests/month)
- Lambda: Free tier (1M requests/month)
- API Gateway: Free tier (1M requests/month)
- Cloudflare Pages: Free (unlimited bandwidth)
- Domain: ~$9/year

**Total: $0/month + $9/year for domain**
