# Harbinger Production Deployment Guide

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account (for CI/CD)
- [ ] AWS account (for Lambda, API Gateway, DynamoDB)
- [ ] Cloudflare account (for frontend, optional if using Amplify)
- [ ] Custom domain (optional)

## One-Time Setup

### 1. Install Required Tools

```bash
# Install Wrangler (Cloudflare, if using Cloudflare Pages)
npm install -g wrangler

# Install AWS CLI
brew install awscli  # macOS
# or download from: https://aws.amazon.com/cli/
```

### 2. Configure Production Settings

Edit `config/flags.prod.yml`:

```yaml
api:
  base_url: "https://<api-id>.execute-api.<region>.amazonaws.com"

database:
  table_name: "harbinger-prod"
  region: "us-east-2"
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
  --region us-east-2
```

### 4. Deploy Backend to AWS Lambda

```bash
# Build the zip from project root
npm run build:lambda
```

Upload `harbinger-backend.zip` to Lambda:
- AWS Console → Lambda → `harbinger-prod-lambda` → Code → Upload from .zip file
- Or via CLI: `aws lambda update-function-code --function-name harbinger-prod-lambda --zip-file fileb://harbinger-backend.zip`

Set Lambda environment variables (Configuration → Environment variables):

```
ALLOWED_ORIGINS     = https://your-amplify-url.amplifyapp.com
JWT_SECRET          = <openssl rand -hex 32>
DYNAMODB_TABLE      = harbinger-prod
AWS_REGION          = us-east-2
```

### 5. Configure API Gateway CORS

In API Gateway → your HTTP API → CORS:
- **Allow origins**: your frontend URL
- **Allow methods**: `GET, POST, DELETE, OPTIONS`
- **Allow headers**: `Content-Type, Authorization`
- **Allow credentials**: Yes

### 6. Update Frontend Config

Update `config/flags.prod.yml` with your API Gateway URL, then rebuild:

```bash
npm run load-config
```

### 7. Deploy Frontend

**Amplify** (auto-deploys on push to your branch):
```bash
git push origin proto
```

**Cloudflare Pages** (manual):
```bash
cd frontend
npm run build:prod
wrangler pages publish dist --project-name=harbinger
```

### 8. Setup Custom Domain (Optional)

#### Backend (API Gateway):
In API Gateway → Custom domain names → create domain → map to your API stage.

#### Frontend (Amplify):
Amplify Console → your app → Domain management → Add domain.

#### Frontend (Cloudflare Pages):
Cloudflare Pages dashboard → Custom domains → Add your domain.

### 9. Setup GitHub Actions CI/CD

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

```
CLOUDFLARE_API_TOKEN    # Cloudflare dashboard → API Tokens
CLOUDFLARE_ACCOUNT_ID   # Cloudflare dashboard → Account ID
```

Now every push to `main` or `proto` branch will automatically deploy the frontend.

## Production Deployment Workflow

### Manual Deployment

```bash
./scripts/deploy/deploy.sh
```

### Automatic Deployment (CI/CD)

```bash
git add .
git commit -m "Update journal styling"
git push origin main
```

GitHub Actions builds and deploys the frontend automatically.

## Post-Deployment Checks

### 1. Verify Backend

```bash
curl -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/msg \
  -H "Origin: https://your-frontend.amplifyapp.com" -v
# Should return 200 with Access-Control-Allow-Origin header
```

### 2. Verify Frontend

Visit your Amplify or Cloudflare Pages URL:
- Login should work (no auto-login in production)
- Create an entry
- View archives
- Delete works

### 3. Check Logs

Lambda logs in CloudWatch:
- AWS Console → Lambda → Monitor → View CloudWatch logs

### 4. Monitor Database

```bash
aws dynamodb scan \
  --table-name harbinger-prod \
  --region us-east-2 \
  --limit 10
```

## Environment Variables Reference

### Backend (Lambda)

```
ALLOWED_ORIGINS=https://your-frontend.amplifyapp.com
JWT_SECRET=<random-32-byte-hex>
DYNAMODB_TABLE=harbinger-prod
AWS_REGION=us-east-2
```

Set via Lambda Console → Configuration → Environment variables.

### Frontend

No secrets needed — configuration is baked into the build via `flags-runtime.js`.

## Updating Production

### Backend

```bash
npm run build:lambda
aws lambda update-function-code \
  --function-name harbinger-prod-lambda \
  --zip-file fileb://harbinger-backend.zip
```

### Frontend

```bash
git push origin main
# Amplify auto-deploys, or run deploy.sh for Cloudflare Pages
```

## Rollback

### Backend

In AWS Lambda Console → your function → Versions → deploy a previous version.
Or re-upload a previous zip.

### Frontend (Amplify)

Amplify Console → your app → your branch → redeploy a previous build.

### Frontend (Cloudflare Pages)

Cloudflare Pages dashboard → Deployments → Rollback to previous deployment.

## Monitoring

### Backend Health

CloudWatch → Log groups → `/aws/lambda/harbinger-prod-lambda`

### Frontend Analytics

Amplify Console → your app → Monitoring.

### Database

AWS DynamoDB Console → your table → Monitor tab:
- Read/Write capacity units
- Item count
- Request latency

## Cost Estimate

| Service | Free Tier | Typical Cost |
|---------|-----------|--------------|
| Lambda + API Gateway | 1M req/month | FREE |
| Amplify | Build minutes + hosting | FREE |
| DynamoDB | 25 RCU/WCU | FREE |
| **Total** | | **$0/month** |

## Troubleshooting

### CORS preflight blocked

```bash
curl -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/msg \
  -H "Origin: https://your-frontend.amplifyapp.com" -v
```

Check that:
1. API Gateway CORS is configured with your origin
2. Lambda `ALLOWED_ORIGINS` env var includes your frontend URL
3. Lambda is running without crashes (check CloudWatch logs)

### Lambda crashes on cold start

Check CloudWatch logs. Common causes:
- Missing `config/flags.json` — rebuild zip with `npm run build:lambda`
- Missing environment variables

### Frontend shows blank page

- Check browser console for errors
- Verify `flags-runtime.js` has correct API URL
- Check network tab for CORS or 5xx errors

### Authentication fails

- Check `JWT_SECRET` is set in Lambda env vars
- Verify DynamoDB table exists and region matches

## Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Auto-login | ✅ Yes | ❌ No |
| Mock data | ✅ Yes | ❌ No |
| Dev badges | ✅ Shown | ❌ Hidden |
| Console logs | ✅ Verbose | ⚠️ Errors only |
| Database | Mock | DynamoDB |
| API | localhost | API Gateway |

## Security Checklist

- [ ] JWT_SECRET is strong random value (32+ bytes)
- [ ] AWS credentials stored as Lambda env vars (not in code)
- [ ] CORS configured for your domain only
- [ ] HTTPS enforced (API Gateway + Amplify do this automatically)
- [ ] DynamoDB table has proper IAM permissions
- [ ] No sensitive data in GitHub repository
- [ ] Environment variables not committed to git

## Support

- AWS Lambda docs: https://docs.aws.amazon.com/lambda
- API Gateway docs: https://docs.aws.amazon.com/apigateway
- Cloudflare Pages: https://developers.cloudflare.com/pages
- DynamoDB guide: https://docs.aws.amazon.com/dynamodb

## Next Steps

After deployment:
1. Test thoroughly on production
2. Set up CloudWatch alarms for Lambda errors
3. Configure custom domain
4. Add email notifications (optional)
5. Set up DynamoDB on-demand backups
