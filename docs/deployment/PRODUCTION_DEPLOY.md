# Harbinger Production Deployment Guide

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account (for CI/CD)
- [ ] Fly.io account (for backend)
- [ ] Cloudflare account (for frontend)
- [ ] AWS account (for DynamoDB)
- [ ] Custom domain (optional)

## One-Time Setup

### 1. Install Required Tools

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Install Wrangler (Cloudflare)
npm install -g wrangler

# Install AWS CLI
brew install awscli  # macOS
# or download from: https://aws.amazon.com/cli/
```

### 2. Configure Production Settings

Edit `config/flags.prod.yml`:

```yaml
api:
  base_url: "https://harbinger-api.fly.dev"  # Your backend URL

database:
  table_name: "harbinger-prod"
  region: "us-east-1"  # Your AWS region
```

### 3. Create DynamoDB Table

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
  --region us-east-1
```

### 4. Deploy Backend to Fly.io

```bash
cd backend

# Login to Fly.io
flyctl auth login

# Create app (first time only)
flyctl launch --name harbinger-api --region sjc

# Set environment secrets
flyctl secrets set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 32) \
  DYNAMODB_TABLE=harbinger-prod \
  AWS_REGION=us-east-1 \
  AWS_ACCESS_KEY_ID=your_access_key \
  AWS_SECRET_ACCESS_KEY=your_secret_key

# Deploy
flyctl deploy
```

Get your backend URL:
```bash
flyctl info
# Note the Hostname: harbinger-api.fly.dev
```

### 5. Update Frontend Config

Update `config/flags.prod.yml` with your backend URL:

```yaml
api:
  base_url: "https://harbinger-api.fly.dev"
```

Then rebuild config:
```bash
npm run load-config
```

### 6. Deploy Frontend to Cloudflare Pages

```bash
# Login to Cloudflare
wrangler login

# Build frontend
cd frontend
npm run build:prod

# Deploy
wrangler pages publish dist --project-name=harbinger
```

Your site will be at: `https://harbinger.pages.dev`

### 7. Setup Custom Domain (Optional)

#### For Backend (Fly.io):
```bash
cd backend
flyctl certs add api.yourdomain.com
```

Add DNS CNAME:
```
api.yourdomain.com → harbinger-api.fly.dev
```

#### For Frontend (Cloudflare Pages):
In Cloudflare Pages dashboard:
1. Go to your project
2. Click "Custom domains"
3. Add: `harbinger.yourdomain.com`
4. Follow DNS instructions

### 8. Setup GitHub Actions CI/CD

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
FLY_API_TOKEN           # Get from: flyctl auth token
CLOUDFLARE_API_TOKEN    # Get from: Cloudflare dashboard → API Tokens
CLOUDFLARE_ACCOUNT_ID   # Get from: Cloudflare dashboard → Account ID
```

To get Fly.io token:
```bash
flyctl auth token
```

To get Cloudflare API token:
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create Token → "Edit Cloudflare Workers" template
3. Add "Cloudflare Pages" permissions

Now every push to `main` or `proto` branch will automatically deploy!

## Production Deployment Workflow

### Manual Deployment

Use the deployment script:

```bash
./scripts/deploy/deploy.sh
```

This will:
1. Load production config
2. Build frontend
3. Deploy backend to Fly.io
4. Deploy frontend to Cloudflare Pages

### Automatic Deployment (CI/CD)

Simply push to main:

```bash
git add .
git commit -m "Update journal styling"
git push origin main
```

GitHub Actions will:
1. Deploy backend automatically
2. Build and deploy frontend
3. Notify you of deployment status

## Post-Deployment Checks

### 1. Verify Backend

```bash
curl https://harbinger-api.fly.dev
# Should return: "Harbinger API - v1.0.0"
```

### 2. Verify Frontend

Visit: `https://harbinger.pages.dev`

- Login should work (no auto-login in production)
- Create an entry
- View archives
- Delete works

### 3. Check Logs

Backend logs:
```bash
flyctl logs
```

Frontend logs:
- Check browser console for errors

### 4. Monitor Database

```bash
aws dynamodb scan \
  --table-name harbinger-prod \
  --region us-east-1 \
  --limit 10
```

## Environment Variables Reference

### Backend (Fly.io)

```bash
NODE_ENV=production
JWT_SECRET=<random-32-byte-hex>
DYNAMODB_TABLE=harbinger-prod
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

Set via:
```bash
flyctl secrets set KEY=value
```

View current secrets:
```bash
flyctl secrets list
```

### Frontend (Cloudflare Pages)

No secrets needed - configuration is baked into build via `flags-runtime.js`

## Updating Production

### Quick Updates

For quick fixes:

```bash
# Backend
cd backend
flyctl deploy

# Frontend
cd frontend
npm run build:prod
wrangler pages publish dist --project-name=harbinger
```

### Via Git (Automatic)

```bash
git add .
git commit -m "Fix login bug"
git push origin main
```

CI/CD handles the rest!

## Rollback

### Backend Rollback

```bash
cd backend
flyctl releases
flyctl rollback <version>
```

### Frontend Rollback

In Cloudflare Pages dashboard:
1. Go to Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"

## Monitoring

### Backend Health

```bash
flyctl status
flyctl logs --recent
```

### Frontend Analytics

Cloudflare Pages provides:
- Request count
- Bandwidth usage
- Error rates

View in: Cloudflare dashboard → Pages → Analytics

### Database

Monitor DynamoDB in AWS Console:
- Read/Write capacity units
- Item count
- Request latency

## Cost Estimate

| Service | Free Tier | Typical Cost |
|---------|-----------|--------------|
| Fly.io Backend | 3 shared VMs | $0-5/month |
| Cloudflare Pages | Unlimited | FREE |
| DynamoDB | 25 RCU/WCU | $0-2/month |
| **Total** | | **~$5/month** |

## Troubleshooting

### Backend not responding

```bash
cd backend
flyctl logs
flyctl status
```

Common issues:
- Environment secrets not set
- DynamoDB permissions
- AWS credentials

### Frontend shows blank page

Check browser console for:
- API URL mismatch in `flags-runtime.js`
- CORS errors (backend must allow your domain)
- Network errors

### Authentication fails

- Check JWT_SECRET is set on backend
- Verify DynamoDB table exists
- Check AWS credentials

### Can't create posts

- Verify DynamoDB write permissions
- Check backend logs for errors
- Ensure authToken in localStorage

## Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Auto-login | ✅ Yes | ❌ No |
| Mock data | ✅ Yes | ❌ No |
| Dev badges | ✅ Shown | ❌ Hidden |
| Console logs | ✅ Verbose | ⚠️ Errors only |
| Database | Mock | DynamoDB |
| API | localhost | fly.dev |

## Security Checklist

- [ ] JWT_SECRET is strong random value (32+ bytes)
- [ ] AWS credentials stored as Fly.io secrets (not in code)
- [ ] CORS configured for your domain only
- [ ] HTTPS enforced (Fly.io does this automatically)
- [ ] DynamoDB table has proper IAM permissions
- [ ] No sensitive data in GitHub repository
- [ ] Environment secrets not committed to git

## Support

- Fly.io docs: https://fly.io/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages
- DynamoDB guide: https://docs.aws.amazon.com/dynamodb

## Next Steps

After deployment:
1. Test thoroughly on production
2. Set up monitoring/alerts
3. Configure custom domain
4. Add email notifications (optional)
5. Set up backups (DynamoDB on-demand backups)
