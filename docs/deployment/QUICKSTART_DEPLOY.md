# Harbinger MVP Quick Deploy Guide

**Goal**: Get Harbinger running in production with minimal cost (~$0/month)

---

## Pre-Deployment Checklist

### ✅ Step 1: Test Locally with Production Config

```bash
# 1. Switch to production config
cp config/flags.production.yml config/flags.yml

# 2. Update YOUR settings in flags.yml:
#    - api.base_url: Your API Gateway URL (get after Step 3)
#    - database.table_name: harbinger-prod
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

### AWS Lambda + API Gateway (FREE - Recommended)

```bash
# Build the Lambda zip from project root
npm run build:lambda
```

1. AWS Lambda Console → `harbinger-prod-lambda` → Code → Upload from .zip file
2. Set environment variables (Configuration → Environment variables):
   ```
   ALLOWED_ORIGINS = https://your-frontend.amplifyapp.com
   JWT_SECRET      = <openssl rand -hex 32>
   DYNAMODB_TABLE  = harbinger-prod
   AWS_REGION      = us-east-2
   ```
3. In API Gateway → your HTTP API → CORS: set your frontend origin
4. Your API endpoint: `https://<api-id>.execute-api.<region>.amazonaws.com`

### Railway.app ($5/month - Easier alternative)

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
# Add env vars in Railway dashboard
```

---

## Setup Database (DynamoDB)

```bash
aws configure
# Enter: Access Key ID, Secret Key, region, json

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

aws dynamodb describe-table --table-name harbinger-prod
```

---

## Deploy Frontend (FREE)

### Update Config with Backend URL

```bash
# Edit config/flags.yml, set:
api:
  base_url: "https://<api-id>.execute-api.<region>.amazonaws.com"

npm run load-config

cd frontend
npm run build:prod
```

### Deploy to Amplify

Push to your branch — Amplify auto-deploys:
```bash
git push origin proto
```

### Or Deploy to Cloudflare Pages

```bash
npm install -g wrangler
wrangler login
wrangler pages publish dist --project-name=harbinger
```

### Or Deploy to Netlify

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

---

## Add Custom Domain (Optional - $9/year)

### Buy Domain
- Porkbun.com (~$9/year for .com)
- Namecheap, Cloudflare Registrar

### Configure DNS

**For Amplify:**
Amplify Console → your app → Domain management → Add domain.

**For Cloudflare Pages:**
Cloudflare Pages dashboard → Custom domains → Add your domain.

**Backend subdomain (optional — API Gateway custom domain):**
API Gateway Console → Custom domain names → Create domain → map to your stage.

---

## Post-Deployment Testing

### 1. Test Backend Preflight

```bash
curl -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/msg \
  -H "Origin: https://your-frontend.amplifyapp.com" -v
# Expect: 200 with Access-Control-Allow-Origin header
```

### 2. Test Frontend

Visit your deployed URL — should show login screen (no auto-login since DEV=false).

### 3. Check Logs

CloudWatch → Log groups → `/aws/lambda/harbinger-prod-lambda`

---

## Troubleshooting

### Frontend shows blank screen
- Check browser console for errors
- Verify `flags-runtime.js` has correct API URL
- Make sure CORS is configured in API Gateway and Lambda `ALLOWED_ORIGINS`

### Backend 500 errors
- Check CloudWatch logs
- Verify AWS credentials are set correctly
- Check DynamoDB table exists and region matches

### CORS errors
Ensure:
1. API Gateway CORS config includes your frontend origin
2. Lambda `ALLOWED_ORIGINS` env var matches

### Can't create posts
- Verify authToken in localStorage
- Check network tab for API request/response
- Ensure DynamoDB table has correct IAM permissions

---

## Cost Summary

| Service | Free Tier | Typical Cost |
|---------|-----------|--------------|
| Lambda + API Gateway | 1M req/month | FREE |
| Amplify / Cloudflare Pages | Unlimited | FREE |
| DynamoDB | 25 RCU/WCU | FREE for small apps |
| Domain | - | $9/year |
| **Total** | | **~$0.75/month** |

---

## Next Steps After Deployment

1. ✅ **Monitor usage**: Check CloudWatch metrics
2. ✅ **Set up backups**: Export DynamoDB data weekly
3. ✅ **Add analytics**: Plausible.io (privacy-friendly, free tier)
4. ✅ **SSL check**: Verify HTTPS works on custom domain
5. ✅ **Performance**: Test from different locations (webpagetest.org)
6. ✅ **Security audit**: Run OWASP ZAP or similar
7. ✅ **Monitoring**: Add UptimeRobot (free, checks every 5 min)

---

## Rollback Plan

```bash
# Backend rollback — re-upload a previous zip to Lambda
aws lambda update-function-code \
  --function-name harbinger-prod-lambda \
  --zip-file fileb://harbinger-backend-previous.zip

# Frontend rollback (Amplify)
# Amplify Console → your branch → redeploy a previous build

# Frontend rollback (Cloudflare Pages)
# Pages dashboard → Deployments → Rollback
```

---

## Support

- **AWS Lambda**: https://docs.aws.amazon.com/lambda
- **Cloudflare**: https://community.cloudflare.com
- **DynamoDB**: AWS Support Console
- **This project**: Open GitHub issue

---

**🎉 You're ready to deploy!**

Start with `npm run build:lambda` then follow the backend deployment steps above.
