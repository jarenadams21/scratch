# Harbinger MVP Deployment Guide

## Overview
Deploy Harbinger journal app with custom vdom engine, minimal dependencies, lowest cost possible.

## Architecture
- **Frontend**: Static files (HTML, JS, CSS) - no build step needed in production
- **Backend**: Node.js API server with DynamoDB
- **Custom Domain**: harbinger.yourdomain.com

---

## Part 1: Frontend Deployment (FREE or $1-5/month)

### Option A: Cloudflare Pages (FREE - RECOMMENDED)
**Cost**: $0/month for unlimited bandwidth
**Features**: Global CDN, automatic HTTPS, custom domain

```bash
# 1. Build frontend for production
cd frontend
npm run build  # We'll create this script

# 2. Install Cloudflare Wrangler
npm install -g wrangler

# 3. Login and deploy
wrangler login
wrangler pages publish dist --project-name=harbinger
```

**Setup**:
1. Create account at cloudflare.com
2. Add your domain to Cloudflare (free)
3. Deploy via Wrangler CLI or drag-and-drop in dashboard
4. Custom domain automatically gets HTTPS

---

### Option B: Netlify (FREE tier available)
**Cost**: $0/month for 100GB bandwidth
**Features**: Continuous deployment, automatic HTTPS

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build and deploy
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**Setup**:
1. Create account at netlify.com
2. Connect Git repo (optional) or manual deploy
3. Add custom domain in dashboard

---

### Option C: AWS S3 + CloudFront (~$1-5/month)
**Cost**: ~$0.50/month storage + $0.01/GB transfer
**Features**: Full AWS integration, scales infinitely

```bash
# 1. Create S3 bucket
aws s3 mb s3://harbinger-app

# 2. Enable static website hosting
aws s3 website s3://harbinger-app --index-document index.html

# 3. Upload files
cd frontend
aws s3 sync dist/ s3://harbinger-app --acl public-read

# 4. Create CloudFront distribution (CDN + HTTPS)
aws cloudfront create-distribution --origin-domain-name harbinger-app.s3.amazonaws.com
```

---

## Part 2: Backend Deployment

### Option A: AWS Lambda + API Gateway (PAY-PER-USE)
**Cost**: ~$0-5/month for low traffic (1M free requests/month)
**Best for**: Serverless, scales automatically

```bash
# 1. Package backend
cd backend
zip -r function.zip server.js auth.js db.js config.js node_modules/

# 2. Create Lambda function
aws lambda create-function \
  --function-name harbinger-api \
  --runtime nodejs20.x \
  --handler server.handler \
  --zip-file fileb://function.zip

# 3. Create HTTP API in API Gateway
# (Done via AWS Console - very simple)
```

**Required changes to server.js**:
```javascript
// Wrap Express app for Lambda
export const handler = serverless(app);
```

---

### Option B: Railway.app (EASIEST - $5/month)
**Cost**: $5/month for 500 hours, includes PostgreSQL
**Best for**: Simplicity, developer experience

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and init
railway login
railway init

# 3. Deploy
cd backend
railway up

# 4. Add environment variables in dashboard
DYNAMODB_TABLE=journal-app
AWS_REGION=us-east-1
```

**Setup**:
1. Create account at railway.app
2. One command deploy: `railway up`
3. Get public URL instantly
4. Add DynamoDB credentials as env vars

---

### Option C: Fly.io (FREE tier - 3 shared-cpu-1x 256mb VMs)
**Cost**: FREE for small apps, then ~$2/month
**Best for**: Docker-ready apps, edge deployment

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Launch app
cd backend
flyctl launch --name harbinger-api

# 4. Deploy
flyctl deploy
```

**Auto-generates Dockerfile**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

### Option D: DigitalOcean App Platform ($5/month)
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
**Free Tier**: 25 WCU, 25 RCU (enough for ~200M requests/month)
**Cost**: $0/month for small apps, $1.25/GB storage beyond free tier

```bash
# Create table
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

**Alternative: MongoDB Atlas FREE tier**
- 512MB storage (enough for thousands of posts)
- No credit card required
- Auto-scaling

---

## Part 4: Custom Domain Setup

### Cheapest Domain Registrars
1. **Namecheap**: $8-12/year (.com)
2. **Porkbun**: $9/year (.com) - often cheapest
3. **Cloudflare Registrar**: At-cost pricing (~$9/year)

### DNS Configuration
```
# Frontend (Cloudflare Pages)
harbinger.yourdomain.com  CNAME  harbinger.pages.dev

# Backend (Railway/Fly/Lambda)
api.yourdomain.com        CNAME  harbinger-api.railway.app

# Or use subdomain
harbinger.yourdomain.com  CNAME  your-cf-pages.pages.dev
```

---

## Recommended Setup (CHEAPEST - ~$5-10/month total)

### ✅ Minimal Viable Production Stack

| Component | Service | Cost | Why |
|-----------|---------|------|-----|
| **Frontend** | Cloudflare Pages | FREE | Unlimited bandwidth, auto HTTPS, CDN |
| **Backend** | Fly.io | FREE* | 3 free VMs, scales on demand |
| **Database** | DynamoDB Free Tier | FREE | 25 RCU/WCU covers small-medium apps |
| **Domain** | Porkbun | $9/year | Cheapest .com registrar |
| **Total** | ~$0.75/month | Essentially free |

*Fly.io free tier covers most small apps; Railway.app at $5/mo is more reliable alternative

---

## Production Checklist

### Frontend Build Script
Add to `frontend/package.json`:
```json
{
  "scripts": {
    "build": "tsc && node build.js"
  }
}
```

Create `frontend/build.js`:
```javascript
import fs from 'fs';
import path from 'path';

// Copy static files to dist/
fs.mkdirSync('dist', { recursive: true });
fs.copyFileSync('index.html', 'dist/index.html');
fs.cpSync('src', 'dist/src', { recursive: true });

// Update index.html to remove TypeScript references
let html = fs.readFileSync('dist/index.html', 'utf-8');
html = html.replace('main.tsx', 'main.js');
fs.writeFileSync('dist/index.html', html);

console.log('✅ Build complete: dist/');
```

### Backend Environment Variables
```bash
# Required in production
NODE_ENV=production
DEV_MODE=false
DYNAMODB_TABLE=journal-app
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
JWT_SECRET=random-256-bit-hex-string
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Security Hardening
1. Enable CORS only for your domain:
   ```javascript
   app.use(cors({ origin: 'https://harbinger.yourdomain.com' }));
   ```

2. Add rate limiting:
   ```bash
   npm install express-rate-limit
   ```

3. Add helmet for security headers:
   ```bash
   npm install helmet
   ```

---

## Testing Production Build Locally

```bash
# 1. Set production flags
cd config
# Edit flags.yml: set dev.enabled: false

# 2. Rebuild config
npm run load-config

# 3. Start backend
cd backend
NODE_ENV=production node server.js

# 4. Serve frontend (simple static server)
cd frontend
npx serve dist -p 8080
```

---

## Deployment Commands Summary

### Quick Deploy (Fly.io + Cloudflare Pages)
```bash
# Backend
cd backend
flyctl launch --name harbinger-api
flyctl secrets set JWT_SECRET=$(openssl rand -hex 32)
flyctl secrets set AWS_ACCESS_KEY_ID=xxx
flyctl secrets set AWS_SECRET_ACCESS_KEY=xxx
flyctl deploy

# Frontend
cd frontend
npm run build
wrangler pages publish dist --project-name=harbinger

# Done! Backend at: https://harbinger-api.fly.dev
#       Frontend at: https://harbinger.pages.dev
```

Add custom domains in respective dashboards.

---

## Scaling Considerations

### When to upgrade from free tiers:
- **Traffic**: >1000 daily active users → Railway $5/mo
- **Storage**: >1GB DynamoDB data → Add $1.25/GB
- **Compute**: Backend response time >500ms → Scale Fly.io VMs

### Cost projection:
- 0-1000 users: **FREE**
- 1000-10000 users: **$5-10/month**
- 10000+ users: **$50-100/month** (still very cheap!)

---

## Next Steps

1. **Fix UI bugs** ✅ (done - added ref support)
2. **Test locally with production config**
3. **Choose deployment stack** (recommend Fly.io + Cloudflare Pages)
4. **Create DynamoDB table**
5. **Deploy backend, get API URL**
6. **Update frontend config with production API URL**
7. **Deploy frontend**
8. **Add custom domain**
9. **Wire real auth and database** (replace mock data)

---

## Support Resources

- Fly.io docs: https://fly.io/docs
- Cloudflare Pages: https://pages.cloudflare.com
- DynamoDB local testing: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
- Railway quickstart: https://docs.railway.app/quick-start
