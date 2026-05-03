# Harbinger - Quick Deploy

## 🚀 Deploy to Production in 5 Minutes

### Option 1: Automated Setup (Recommended)

```bash
npm run setup:prod
```

Follow the prompts to:
1. Configure production settings
2. Create DynamoDB table
3. Setup Fly.io backend
4. Login to Cloudflare

Then deploy:

```bash
npm run deploy
```

### Option 2: Manual Steps

#### 1. Backend (Fly.io)

```bash
cd backend
flyctl auth login
flyctl launch --name harbinger-api
flyctl secrets set JWT_SECRET=$(openssl rand -hex 32)
flyctl secrets set AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx
flyctl deploy
```

#### 2. Frontend (Cloudflare Pages)

Update `config/flags.prod.yml` with your backend URL, then:

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
- `FLY_API_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 🎯 Your URLs

After deployment:
- Backend: `https://harbinger-api.fly.dev`
- Frontend: `https://harbinger.pages.dev`
- Custom: Set up your domain in dashboards

## ✅ Post-Deploy Checklist

- [ ] Backend responds: `curl https://harbinger-api.fly.dev`
- [ ] Frontend loads in browser
- [ ] Can create account
- [ ] Can write & publish entry
- [ ] Can view archives
- [ ] Reading pane works
- [ ] Can delete entries

## 💰 Cost

- Fly.io: FREE (3 shared VMs)
- Cloudflare Pages: FREE
- DynamoDB: FREE (25 RCU/WCU)
- **Total: $0/month** (for small usage)

## 🆘 Help

Something not working?

1. Check logs: `flyctl logs`
2. Verify secrets: `flyctl secrets list`
3. Test backend: `curl https://your-backend.fly.dev`
4. Check browser console for frontend errors

See [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) for troubleshooting.
