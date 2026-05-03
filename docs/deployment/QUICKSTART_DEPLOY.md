# Harbinger MVP Quick Deploy Guide

**Goal**: Get Harbinger running in production with minimal cost (~$0-5/month)

---

## Pre-Deployment Checklist

### ✅ Step 1: Test Locally with Production Config

```bash
# 1. Switch to production config
cp config/flags.production.yml config/flags.yml

# 2. Update YOUR settings in flags.yml:
#    - api.base_url: Your backend URL (get after Step 3)
#    - database.table_name: journal-app-prod
#    - database.region: your-aws-region

# 3. Regenerate config
npm run load-config

# 4. Test frontend build
cd frontend
npm run build:prod
npm run preview
# Visit http://localhost:8080 - should work WITHOUT backend

# 5. Test backend locally
cd ../backend
node server.js
# Should say "DEV mode: OFF"
```

---

## Deploy Backend First (Get API URL)

### Option 1: Fly.io (FREE - Recommended)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch (from backend/ directory)
cd backend
flyctl launch --name harbinger-api

# It will ask questions:
# - Choose region: Choose closest to your users
# - PostgreSQL? NO (we use DynamoDB)
# - Deploy now? YES

# Set secrets
flyctl secrets set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 32) \
  DYNAMODB_TABLE=journal-app-prod \
  AWS_REGION=us-east-1 \
  AWS_ACCESS_KEY_ID=your_key_here \
  AWS_SECRET_ACCESS_KEY=your_secret_here

# Get your API URL
flyctl info
# Copy the URL: https://harbinger-api.fly.dev
```

### Option 2: Railway.app ($5/month - Easier)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Deploy
railway up

# Add environment variables in dashboard:
# https://railway.app/project/YOUR_PROJECT/variables
# - NODE_ENV=production
# - JWT_SECRET=<generate-with-openssl>
# - DYNAMODB_TABLE=journal-app-prod
# - AWS credentials

# Get your API URL from Railway dashboard
```

### Option 3: AWS Lambda (Almost Free)

See DEPLOYMENT.md for detailed Lambda setup.

---

## Setup Database (DynamoDB)

```bash
# Install AWS CLI if needed
# brew install awscli (macOS)
# Or download from: https://aws.amazon.com/cli/

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Output format: json

# Create production table
aws dynamodb create-table \
  --table-name journal-app-prod \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Verify table created
aws dynamodb describe-table --table-name journal-app-prod
```

**No AWS Account?** Use MongoDB Atlas FREE tier instead:
- Visit mongodb.com/cloud/atlas
- Create free cluster (no credit card needed)
- Update backend/db.js to use MongoDB instead of DynamoDB

---

## Deploy Frontend (FREE)

### Update Config with Backend URL

```bash
# 1. Edit config/flags.yml
# Change api.base_url to your backend URL:
api:
  base_url: "https://harbinger-api.fly.dev"  # Your actual backend URL

# 2. Regenerate config
npm run load-config

# 3. Build production frontend
cd frontend
npm run build:prod
```

### Deploy to Cloudflare Pages (FREE)

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages publish dist --project-name=harbinger

# Get your URL:
# https://harbinger.pages.dev
```

### Or Deploy to Netlify (FREE)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist

# Follow prompts to create site
# Get your URL: https://YOUR-SITE.netlify.app
```

---

## Add Custom Domain (Optional - $9/year)

### Buy Domain
- Cheapest: Porkbun.com (~$9/year for .com)
- Or: Namecheap, Google Domains, Cloudflare Registrar

### Configure DNS

**For Cloudflare Pages:**
1. Go to your Cloudflare Pages dashboard
2. Click "Custom domains"
3. Add: `harbinger.yourdomain.com`
4. Follow DNS instructions (add CNAME)

**For Netlify:**
1. Go to Site settings → Domain management
2. Add custom domain: `harbinger.yourdomain.com`
3. Add CNAME record at your registrar:
   ```
   CNAME  harbinger  YOUR-SITE.netlify.app
   ```

**Backend subdomain (optional):**
```
# Add to DNS:
CNAME  api  harbinger-api.fly.dev
```

Then update `config/flags.yml`:
```yaml
api:
  base_url: "https://api.yourdomain.com"
```

---

## Post-Deployment Testing

### 1. Test Backend

```bash
# Health check
curl https://harbinger-api.fly.dev

# Test signup
curl -X POST https://harbinger-api.fly.dev/msg \
  -H "Content-Type: application/json" \
  -d '{
    "command": "auth_signup",
    "payload": {
      "content": {
        "email": "test@example.com",
        "password": "testpass123"
      },
      "num": 7
    }
  }'
```

### 2. Test Frontend

Visit your deployed URL:
- `https://harbinger.pages.dev` (or your custom domain)
- Should see login screen (NOT auto-login since DEV=false)
- Create account and test posting

### 3. Check Logs

**Fly.io:**
```bash
flyctl logs
```

**Railway:**
View logs in dashboard

---

## Troubleshooting

### Frontend shows blank screen
- Check browser console for errors
- Verify `flags-runtime.js` has correct API URL
- Make sure CORS is enabled in backend

### Backend 500 errors
- Check backend logs
- Verify AWS credentials are set correctly
- Check DynamoDB table exists and region matches

### CORS errors
Ensure backend has:
```javascript
app.use(cors({ origin: 'https://harbinger.yourdomain.com' }));
```

### Can't create posts
- Verify authToken in localStorage
- Check network tab for API request/response
- Ensure DynamoDB table has correct permissions

---

## Cost Summary

| Service | Free Tier | Typical Cost |
|---------|-----------|--------------|
| Fly.io Backend | 3 VMs free | $0-5/month |
| Cloudflare Pages | Unlimited | FREE |
| DynamoDB | 25 RCU/WCU | FREE for small apps |
| Domain | - | $9/year |
| **Total** | | **~$0.75/month** |

---

## Next Steps After Deployment

1. ✅ **Monitor usage**: Check Fly.io/Railway metrics
2. ✅ **Set up backups**: Export DynamoDB data weekly
3. ✅ **Add analytics**: Plausible.io (privacy-friendly, free tier)
4. ✅ **SSL check**: Verify HTTPS works on custom domain
5. ✅ **Performance**: Test from different locations (webpagetest.org)
6. ✅ **Security audit**: Run OWASP ZAP or similar
7. ✅ **Monitoring**: Add UptimeRobot (free, checks every 5 min)

---

## Rollback Plan

If something breaks:

```bash
# Backend rollback (Fly.io)
flyctl releases
flyctl rollback <version>

# Frontend rollback (Cloudflare)
# Go to Pages dashboard → Deployments → Rollback

# Or redeploy previous commit:
git checkout <previous-commit>
npm run build
wrangler pages publish dist
```

---

## Support

- **Fly.io**: https://community.fly.io
- **Cloudflare**: https://community.cloudflare.com
- **DynamoDB**: AWS Support Console
- **This project**: Open GitHub issue (if you pushed to GitHub)

---

**🎉 You're ready to deploy!**

Start with: `npm run build` then follow Backend deployment steps above.
