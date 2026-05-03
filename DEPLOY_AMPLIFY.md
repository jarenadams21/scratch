# Harbinger - AWS Amplify Deployment

## 🚀 Deploy with AWS Amplify (Recommended for AWS Users)

Since you have AWS access and Amplify experience, this is the fastest path!

## Prerequisites

1. ✅ AWS account (you have this)
2. ✅ DynamoDB table created
3. Install Amplify CLI:

```bash
npm install -g @aws-amplify/cli
amplify configure
```

## Step 1: Create DynamoDB Table

1. Go to https://console.aws.amazon.com/dynamodb
2. Click "Create table"
3. **Table name**: `harbinger-prod`
4. **Partition key**: `pk` (String)
5. **Sort key**: `sk` (String)
6. Leave settings as default (On-demand)
7. Click "Create table"

## Step 2: Initialize Amplify

```bash
cd /Users/jarenadams/scratch

# Initialize Amplify project
amplify init

# When prompted:
# - Project name: harbinger
# - Environment: prod
# - Default editor: (your choice)
# - App type: javascript
# - Framework: none
# - Source directory: frontend/dist
# - Build command: npm run build:prod
# - Start command: (leave empty)
```

## Step 3: Add Backend API (Lambda)

```bash
# Add API with Lambda backend
amplify add api

# When prompted:
# - Select: REST
# - API name: harbingerapi
# - Path: /msg
# - Lambda source: Use existing Lambda function? NO
# - Function name: harbingerBackend
# - Runtime: NodeJS
# - Template: Hello World
# - Advanced settings: Yes
# - Environment variables: Add these:
#   - JWT_SECRET: <generate with: openssl rand -hex 32>
#   - AWS_REGION: us-east-1
#   - DYNAMODB_TABLE: harbinger-prod
#   - DEV_MODE: false
# - Configure CORS: Yes (select all methods)
```

**Important**: After the Lambda function is created, replace its code:

```bash
# Copy your backend code to the Lambda function
cp -r backend/* amplify/backend/function/harbingerBackend/src/
```

Edit `amplify/backend/function/harbingerBackend/src/index.js`:

```javascript
export { handler } from './lambda.js';
```

## Step 4: Add IAM Permissions for DynamoDB

Edit `amplify/backend/function/harbingerBackend/harbingerBackend-cloudformation-template.json`:

Find the `PolicyDocument` section and add DynamoDB permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:Query",
    "dynamodb:DeleteItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:*:table/harbinger-prod"
}
```

## Step 5: Add Frontend Hosting

```bash
# Add hosting
amplify add hosting

# When prompted:
# - Select: Hosting with Amplify Console
# - Continuous deployment: Manual deployment
```

## Step 6: Build Production Frontend

Update your backend URL in production config:

```bash
# This will be your Lambda URL - we'll get it after deployment
# For now, leave it as placeholder
```

Build frontend:

```bash
npm run build:prod
```

## Step 7: Deploy Everything!

```bash
# Deploy backend (Lambda + API Gateway) and frontend
amplify push

# This will:
# 1. Create Lambda function from backend/
# 2. Create API Gateway endpoint
# 3. Set up IAM roles
# 4. Deploy frontend to Amplify Console
```

After deployment, you'll get:
- **API Endpoint**: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`
- **Frontend URL**: `https://xxxxx.amplifyapp.com`

## Step 8: Update Frontend Config

Edit `config/flags.prod.yml`:

```yaml
api:
  base_url: "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

Rebuild and redeploy frontend:

```bash
npm run build:prod
amplify publish
```

## Step 9: Test Your App!

1. Visit your Amplify URL
2. Create an account
3. Write an entry
4. Check archive
5. Test delete

## Monitoring & Logs

```bash
# View backend logs
amplify console api

# View frontend
amplify console

# Or directly in AWS Console:
# Lambda: https://console.aws.amazon.com/lambda
# CloudWatch Logs: https://console.aws.amazon.com/cloudwatch
# Amplify: https://console.aws.amazon.com/amplify
```

## Custom Domain (Optional)

In Amplify Console:
1. Go to your app
2. Click "Domain management"
3. Add your domain
4. Follow DNS configuration steps

## Cost Estimate

- Lambda: FREE (1M requests/month)
- API Gateway: FREE (1M requests/month)
- Amplify Hosting: FREE (1000 build minutes)
- DynamoDB: FREE (25GB + 25 RCU/WCU)

**Total: $0/month** for personal use!

## Troubleshooting

### Lambda errors
- Check CloudWatch Logs in AWS Console
- Verify IAM permissions for DynamoDB
- Check environment variables

### Frontend errors
- Verify API URL in flags.prod.yml
- Check browser console
- Verify CORS settings

### Can't connect to backend
```bash
# Test API Gateway endpoint directly
curl https://YOUR_API.execute-api.us-east-1.amazonaws.com/prod
```

## Alternative: Simpler Approach

If Amplify feels heavy, you can also:

1. **Deploy Lambda manually** via AWS Console
2. **Create API Gateway** manually
3. **Deploy frontend to S3 + CloudFront** manually

Would you like a guide for the manual approach instead?
