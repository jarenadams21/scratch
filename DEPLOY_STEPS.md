# Harbinger Deployment Steps

## 1. Create DynamoDB Table (AWS Console)

1. Go to https://console.aws.amazon.com/dynamodb  
2. Click "Create table"
3. **Table name**: `harbinger-prod`
4. **Partition key**: `pk` (String)
5. **Sort key**: `sk` (String)  
6. Leave other settings as default (On-demand capacity)
7. Click "Create table"
8. Note your Access Key ID and Secret Access Key

## 2. Deploy Backend to Fly.io

```bash
# Login to Fly.io (opens browser)
flyctl auth login

# Launch the app (creates it on Fly.io)
cd /Users/jarenadams/scratch/backend
flyctl launch --name harbinger-api --region iad --no-deploy

# Set environment secrets
flyctl secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  AWS_ACCESS_KEY_ID=YOUR_AWS_KEY \
  AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET \
  AWS_REGION=us-east-1 \
  DYNAMODB_TABLE=harbinger-prod

# Deploy!
flyctl deploy

# Get your backend URL
flyctl info
```

Your backend will be at: `https://harbinger-api.fly.dev`

## 3. Update Frontend Config

Edit `config/flags.prod.yml`:

```yaml
api:
  base_url: "https://harbinger-api.fly.dev"  # Your backend URL
```

## 4. Deploy Frontend to Cloudflare Pages

```bash
# Login to Cloudflare
wrangler login

# Build production frontend
cd /Users/jarenadams/scratch
npm run build:prod

# Deploy to Cloudflare Pages
cd frontend
wrangler pages deploy dist --project-name=harbinger

# Or create project first
wrangler pages project create harbinger
wrangler pages deploy dist --project-name=harbinger
```

Your frontend will be at: `https://harbinger.pages.dev`

## 5. Test It!

1. Open `https://harbinger.pages.dev` in browser
2. Create an account
3. Write and publish an entry
4. Check the archive
5. Test delete functionality

## 6. Custom Domain (Optional)

### Backend (Fly.io)
```bash
flyctl certs create harbinger.yourdomain.com
```

### Frontend (Cloudflare Pages)
1. Go to Cloudflare Pages dashboard
2. Select your project
3. Go to "Custom domains"
4. Add your domain

## Troubleshooting

### Backend logs
```bash
flyctl logs
```

### Backend status
```bash
flyctl status
```

### Test backend directly
```bash
curl https://harbinger-api.fly.dev
```

### Frontend issues
- Check browser console (F12)
- Verify API URL in flags.prod.yml
- Check CORS settings in backend/server.js

## Cost

- **Fly.io**: FREE (3 shared VMs, 256MB RAM)
- **Cloudflare Pages**: FREE (unlimited builds, 500 builds/month)
- **DynamoDB**: FREE (25GB storage, 25 RCU/WCU)

**Total: $0/month** for small usage!

## Next Steps

1. Set up custom domain
2. Enable GitHub Actions CI/CD
3. Add monitoring/alerts
4. Configure email notifications (optional)
