# Harbinger MVP Deployment Guide

## Overview
Deploy Harbinger journal app with custom vdom engine, minimal dependencies, lowest cost possible.

## Architecture
- **Frontend**: Static files (HTML, JS, CSS)
- **Backend**: Node.js on AWS Lambda + API Gateway
- **Database**: DynamoDB
- **Custom Domain**: harbinger.yourdomain.com

---

## Part 1: Frontend Deployment (FREE or $1-5/month)

### Option A: AWS Amplify (FREE - RECOMMENDED)
**Cost**: $0/month for small apps
**Features**: Git-based auto-deploy, automatic HTTPS, custom domain

Push to your branch — Amplify auto-deploys:
```bash
git push origin proto
```

**Setup**:
1. Create app in Amplify Console → connect your GitHub repo
2. Set build branch (e.g. `proto` or `main`)
3. Amplify detects the build config from `amplify.yml`
4. Custom domain via Amplify Console → Domain management

---

### Option B: Cloudflare Pages (FREE)
**Cost**: $0/month for unlimited bandwidth
**Features**: Global CDN, automatic HTTPS, custom domain

```bash
cd frontend
npm run build:prod

npm install -g wrangler
wrangler login
wrangler pages publish dist --project-name=harbinger
```

**Setup**:
1. Create account at cloudflare.com
2. Deploy via Wrangler CLI or drag-and-drop in dashboard
3. Custom domain automatically gets HTTPS

---

### Option C: Netlify (FREE tier available)
**Cost**: $0/month for 100GB bandwidth

```bash
npm install -g netlify-cli
cd frontend
npm run build:prod
netlify deploy --prod --dir=dist
```

---

### Option D: AWS S3 + CloudFront (~$1-5/month)
**Cost**: ~$0.50/month storage + $0.01/GB transfer

```bash
aws s3 mb s3://harbinger-app
aws s3 website s3://harbinger-app --index-document index.html
cd frontend
aws s3 sync dist/ s3://harbinger-app --acl public-read
aws cloudfront create-distribution --origin-domain-name harbinger-app.s3.amazonaws.com
```

---

## Part 2: Backend Deployment

### Option A: AWS Lambda + API Gateway (FREE - RECOMMENDED)
**Cost**: FREE (1M requests/month free tier)
**Best for**: Serverless, scales automatically, already configured

```bash
# Build the zip from project root
npm run build:lambda

# Upload via CLI
aws lambda update-function-code \
  --function-name harbinger-prod-lambda \
  --zip-file fileb://harbinger-backend.zip
```

Set Lambda environment variables:
```
ALLOWED_ORIGINS = https://your-frontend.amplifyapp.com
JWT_SECRET      = <openssl rand -hex 32>
DYNAMODB_TABLE  = harbinger-prod
AWS_REGION      = us-east-2
```

Configure API Gateway CORS (HTTP API → CORS):
- Allow origins: your frontend URL
- Allow methods: `GET, POST, DELETE, OPTIONS`
- Allow headers: `Content-Type, Authorization`
- Allow credentials: Yes

Lambda handler: `backend/lambda.handler`

---

### Option B: Railway.app (EASIEST - $5/month)
**Cost**: $5/month for 500 hours
**Best for**: Simplicity, developer experience

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
# Add environment variables in Railway dashboard
```

---

### Option C: DigitalOcean App Platform ($5/month)
**Cost**: $5/month for basic tier
**Features**: Managed Node.js, automatic SSL, scaling

Setup via dashboard:
1. Connect GitHub repo
2. Select backend folder
3. Add environment variables
4. Deploy (automatic builds)

---

## Part 3: Database (DynamoDB)

### AWS DynamoDB Pricing
**Free Tier**: 25 WCU, 25 RCU (enough for small-medium apps)
**Cost**: $0/month for small apps

```bash
aws dynamodb create-table \
  --table-name harbinger-prod \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

---

## Part 4: Custom Domain Setup

### Cheapest Domain Registrars
1. **Porkbun**: $9/year (.com) — often cheapest
2. **Namecheap**: $8-12/year (.com)
3. **Cloudflare Registrar**: At-cost pricing (~$9/year)

### DNS Configuration
```
# Frontend (Amplify)
harbinger.yourdomain.com  CNAME  <amplify-branch>.d<id>.amplifyapp.com

# Frontend (Cloudflare Pages)
harbinger.yourdomain.com  CNAME  harbinger.pages.dev
```

---

## Recommended Setup (CHEAPEST)

### ✅ Minimal Viable Production Stack

| Component | Service | Cost |
|-----------|---------|------|
| **Frontend** | AWS Amplify | FREE |
| **Backend** | AWS Lambda + API Gateway | FREE |
| **Database** | DynamoDB Free Tier | FREE |
| **Domain** | Porkbun | $9/year |
| **Total** | | **~$0.75/month** |

---

## Production Checklist

### Backend Environment Variables
```bash
# Required in Lambda
ALLOWED_ORIGINS=https://your-frontend.amplifyapp.com
DEV_MODE=false
DYNAMODB_TABLE=harbinger-prod
AWS_REGION=us-east-2
JWT_SECRET=<random-256-bit-hex-string>
```

Generate JWT secret:
```bash
openssl rand -hex 32
```

### Security Hardening
1. CORS restricted to your domain via API Gateway + `ALLOWED_ORIGINS` env var
2. HTTPS enforced automatically by API Gateway and Amplify
3. JWT secret stored as Lambda environment variable (not in code)

---

## Testing Production Build Locally

```bash
# 1. Set production flags
# Edit config/flags.yml: set dev.enabled: false

# 2. Rebuild config
npm run load-config

# 3. Start backend
cd backend
node server.js

# 4. Serve frontend
cd frontend
npx serve dist -p 8080
```

---

## Deployment Commands Summary

```bash
# Build Lambda zip
npm run build:lambda

# Upload to Lambda
aws lambda update-function-code \
  --function-name harbinger-prod-lambda \
  --zip-file fileb://harbinger-backend.zip

# Build and deploy frontend
cd frontend
npm run build:prod
wrangler pages publish dist --project-name=harbinger
# or just: git push origin proto (Amplify auto-deploys)
```

---

## Scaling Considerations

### When to upgrade from free tiers:
- **Traffic**: >1000 daily active users → Railway $5/mo
- **Storage**: >25GB DynamoDB data → Add $1.25/GB
- **Latency**: Lambda cold starts noticeable → enable provisioned concurrency

### Cost projection:
- 0-1000 users: **FREE**
- 1000-10000 users: **$5-10/month**
- 10000+ users: **$50-100/month**

---

## Next Steps

1. **Test locally with production config**
2. **Create DynamoDB table**
3. **Build and upload Lambda zip**
4. **Configure API Gateway CORS**
5. **Update frontend config with API URL**
6. **Deploy frontend (push to Amplify branch)**
7. **Add custom domain**

---

## Support Resources

- AWS Lambda: https://docs.aws.amazon.com/lambda
- API Gateway: https://docs.aws.amazon.com/apigateway
- Cloudflare Pages: https://pages.cloudflare.com
- DynamoDB local testing: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
- Railway quickstart: https://docs.railway.app/quick-start
