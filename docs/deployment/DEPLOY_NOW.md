# Harbinger - Quick Deploy

## 🚀 Deploy to Production in 5 Minutes

### Option 1: Automated Setup (Recommended)

```bash
npm run setup:prod
```

Follow the prompts to:
1. Configure production settings
2. Create DynamoDB table
3. Build Lambda package
4. Login to Cloudflare

Then deploy:

```bash
npm run deploy
```

### Option 2: Manual Steps

#### 1. Backend (AWS Lambda)

```bash
# Build the zip from project root
npm run build:lambda
```

Upload `harbinger-backend.zip` to AWS Lambda, then set environment variables:
- `JWT_SECRET` — `openssl rand -hex 32`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- `DYNAMODB_TABLE` — `harbinger-prod`
- `ALLOWED_ORIGINS` — your Amplify URL

#### 2. Frontend (Amplify / Cloudflare Pages)

Update `config/flags.prod.yml` with your API Gateway URL, then push to your deploy branch or run:

```bash
npm run build:prod
cd frontend
wrangler pages publish dist --project-name=harbinger
```

## 📝 Documentation

- **Full Guide**: [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)
- **Deployment Info**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Start**: [QUICKSTART_DEPLOY.md](QUICKSTART_DEPLOY.md)

## 🔄 CI/CD

Push to `main` or `proto` branch to auto-deploy:

```bash
git push origin main
```

Requires GitHub secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 🎯 Your URLs

After deployment:
- Backend: `https://<api-id>.execute-api.<region>.amazonaws.com`
- Frontend: your Amplify or Cloudflare Pages URL
- Custom: Set up your domain in dashboards

## ✅ Post-Deploy Checklist

- [ ] Backend OPTIONS preflight returns 200
- [ ] Frontend loads in browser
- [ ] Can log in with admin account
- [ ] Can write & publish entry
- [ ] Can view archives
- [ ] Reading pane works
- [ ] Can delete entries

## 💰 Cost

- AWS Lambda + API Gateway: FREE (1M req/month free tier)
- Amplify / Cloudflare Pages: FREE
- DynamoDB: FREE (25 RCU/WCU)
- **Total: $0/month** (for small usage)

## 🆘 Help

Something not working?

1. Check Lambda logs in CloudWatch
2. Test preflight: `curl -X OPTIONS <api-url>/msg -H "Origin: <your-url>" -v`
3. Verify `ALLOWED_ORIGINS` env var in Lambda
4. Check browser console for frontend errors

See [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) for troubleshooting.
