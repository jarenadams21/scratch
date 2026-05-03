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

## 2. Deploy Backend to AWS Lambda

```bash
# Build the Lambda zip from project root
npm run build:lambda
```

Upload `harbinger-backend.zip` to your Lambda function:
1. AWS Lambda Console → `harbinger-prod-lambda` → Code → Upload from .zip file
2. Set the handler to `backend/lambda.handler`
3. Set environment variables under Configuration → Environment variables:
   - `JWT_SECRET` — generate with `openssl rand -hex 32`
   - `AWS_REGION` — e.g. `us-east-2`
   - `DYNAMODB_TABLE` — `harbinger-prod`
   - `ALLOWED_ORIGINS` — your Amplify URL, e.g. `https://proto.d9avjouq8id14.amplifyapp.com`

Your backend endpoint: `https://<api-id>.execute-api.<region>.amazonaws.com/msg`

## 3. Configure API Gateway CORS

In API Gateway → your HTTP API → CORS:
- **Allow origins**: your Amplify URL
- **Allow methods**: `GET, POST, DELETE, OPTIONS`
- **Allow headers**: `Content-Type, Authorization`
- **Allow credentials**: Yes

## 4. Update Frontend Config

Edit `config/flags.prod.yml`:

```yaml
api:
  base_url: "https://<api-id>.execute-api.<region>.amazonaws.com"
```

## 5. Deploy Frontend to Amplify

Push to the `proto` (or `main`) branch — Amplify auto-deploys on push.

## 6. Test It!

1. Open your Amplify URL in browser
2. Log in with your admin account
3. Write and publish an entry
4. Check the archive
5. Test delete functionality

## 7. Custom Domain (Optional)

### Backend (API Gateway)
In API Gateway → Custom domain names → create a domain and map it to your API stage.

### Frontend (Amplify)
In Amplify Console → your app → Domain management → Add domain.

## Troubleshooting

### Backend logs
AWS Lambda Console → Monitor → View CloudWatch logs

### Test backend directly
```bash
curl -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/msg \
  -H "Origin: https://your-amplify-url.amplifyapp.com" -v
```

### Frontend issues
- Check browser console (F12)
- Verify API URL in `config/flags.prod.yml`
- Check CORS settings in API Gateway and `backend/server.js`

## Cost

- **AWS Lambda**: FREE (1M requests/month free tier)
- **API Gateway**: FREE (1M requests/month free tier)
- **Amplify**: FREE (build minutes + hosting)
- **DynamoDB**: FREE (25GB storage, 25 RCU/WCU)

**Total: $0/month** for small usage!

## Next Steps

1. Set up custom domain
2. Enable GitHub Actions CI/CD
3. Add CloudWatch alarms for errors
4. Configure email notifications (optional)
