# Harbinger - Simple AWS Console Deployment

## 🎯 Simplest Deployment (15 minutes, all in AWS Console)

Everything in one place: AWS Console. No CLIs, no extra accounts.

---

## Part 1: Create DynamoDB Table (2 minutes)

1. Go to: https://console.aws.amazon.com/dynamodb
2. Click **"Create table"**
3. Enter:
   - **Table name**: `harbinger-prod`
   - **Partition key**: `pk` (String)
   - **Sort key**: `sk` (String)
4. Keep all other defaults (On-demand mode)
5. Click **"Create table"**
6. ✅ Wait for status to show "Active"

---

## Part 2: Package Backend for Lambda (3 minutes)

In your terminal:

```bash
cd /Users/jarenadams/scratch/backend

# Create deployment package
zip -r ../harbinger-backend.zip . -x "node_modules/*"

# Install dependencies for Lambda (production only)
npm install --omit=dev

# Add dependencies to zip
zip -r ../harbinger-backend.zip node_modules/

# Go back to root
cd ..

# Your deployment package is now: harbinger-backend.zip
ls -lh harbinger-backend.zip
```

---

## Part 3: Create Lambda Function (5 minutes)

1. Go to: https://console.aws.amazon.com/lambda
2. Click **"Create function"**
3. Choose **"Author from scratch"**
4. Enter:
   - **Function name**: `harbinger-backend`
   - **Runtime**: Node.js 20.x (or latest)
   - **Architecture**: arm64 (cheaper) or x86_64
5. Click **"Create function"**

### Upload Your Code:

1. In the function page, scroll to **"Code source"**
2. Click **"Upload from"** → **".zip file"**
3. Upload `harbinger-backend.zip`
4. Click **"Save"**

### Set Environment Variables:

1. Click **"Configuration"** tab → **"Environment variables"**
2. Click **"Edit"** → **"Add environment variable"** for each:
   - `JWT_SECRET`: Run in terminal: `openssl rand -hex 32` and paste result
   - `DYNAMODB_TABLE`: `harbinger-prod`
   - `AWS_REGION`: `us-east-1`
   - `DEV_MODE`: `false`
   - `PORT`: `3000`
3. Click **"Save"**

### Add IAM Permissions for DynamoDB:

1. Click **"Configuration"** tab → **"Permissions"**
2. Click the **Role name** (opens in new tab)
3. Click **"Add permissions"** → **"Attach policies"**
4. Search for `AmazonDynamoDBFullAccess`
5. Check it and click **"Attach policies"**
6. ✅ Lambda can now access DynamoDB

### Update Handler:

1. Back in Lambda, click **"Code"** tab
2. Click **"Runtime settings"** → **"Edit"**
3. Change **Handler** to: `lambda.handler`
4. Click **"Save"**

---

## Part 4: Create API Gateway (3 minutes)

1. Go to: https://console.aws.amazon.com/apigateway
2. Click **"Create API"**
3. Choose **"HTTP API"** (simpler, cheaper)
4. Click **"Build"**
5. Under **"Integrations"**:
   - Click **"Add integration"**
   - Choose **"Lambda"**
   - Select your `harbinger-backend` function
   - **API name**: `harbinger-api`
6. Click **"Next"**
7. **Configure routes**:
   - Method: **ANY**
   - Path: `/{proxy+}`
   - Integration: `harbinger-backend`
8. Click **"Next"**
9. **Configure stages**:
   - Stage name: `$default` (auto-deploy)
10. Click **"Next"** → **"Create"**

### Enable CORS:

1. In your API, click **"CORS"**
2. Click **"Configure"**
3. Set:
   - **Access-Control-Allow-Origin**: `*` (or your domain later)
   - **Access-Control-Allow-Headers**: `*`
   - **Access-Control-Allow-Methods**: All methods
4. Click **"Save"**

### Get Your API URL:

1. Note the **"Invoke URL"** - it looks like:
   ```
   https://abc123xyz.execute-api.us-east-1.amazonaws.com
   ```
2. ✅ Your backend is live! Test it:
   ```bash
   curl https://YOUR_API_URL.execute-api.us-east-1.amazonaws.com
   ```

---

## Part 5: Build Frontend (2 minutes)

Back in your terminal:

```bash
cd /Users/jarenadams/scratch

# Update production config with your API URL
# Edit config/flags.prod.yml and set:
#   api:
#     base_url: "https://YOUR_API_URL.execute-api.us-east-1.amazonaws.com"
```

After editing, build:

```bash
npm run build:prod
```

Your production files are now in: `frontend/dist/`

---

## Part 6: Deploy Frontend to S3 + CloudFront (5 minutes)

### Create S3 Bucket:

1. Go to: https://console.aws.amazon.com/s3
2. Click **"Create bucket"**
3. Enter:
   - **Bucket name**: `harbinger-app` (must be globally unique, try `harbinger-app-YOUR_NAME`)
   - **Region**: us-east-1
   - ⚠️ **Uncheck** "Block all public access" (we need public read)
   - Check the warning acknowledgment
4. Click **"Create bucket"**

### Upload Frontend Files:

1. Click your bucket name
2. Click **"Upload"**
3. Drag all files from `frontend/dist/` folder
4. Click **"Upload"**
5. ✅ Wait for upload to complete

### Enable Static Website Hosting:

1. Click **"Properties"** tab
2. Scroll to **"Static website hosting"**
3. Click **"Edit"**
4. Select **"Enable"**
5. Enter:
   - **Index document**: `index.html`
   - **Error document**: `index.html`
6. Click **"Save changes"**
7. **Copy the bucket website endpoint** - looks like:
   ```
   http://harbinger-app.s3-website-us-east-1.amazonaws.com
   ```

### Make Bucket Public:

1. Click **"Permissions"** tab
2. Scroll to **"Bucket policy"**
3. Click **"Edit"**
4. Paste this policy (replace `YOUR_BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

5. Click **"Save changes"**

### (Optional) Add CloudFront CDN:

For HTTPS and custom domain:

1. Go to: https://console.aws.amazon.com/cloudfront
2. Click **"Create distribution"**
3. Enter:
   - **Origin domain**: Select your S3 bucket
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
4. Click **"Create distribution"**
5. Wait 5-10 minutes for deployment
6. Your CloudFront URL: `https://d123456.cloudfront.net`

---

## 🎉 You're Live!

### Test Your App:

1. **Open**: Your S3 website URL (or CloudFront URL)
2. **Create account**: Sign up with email/password
3. **Write entry**: Compose and publish
4. **Check archive**: View your entries
5. **Test delete**: Remove an entry

### Your URLs:

- **Backend API**: `https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com`
- **Frontend**: `http://YOUR_BUCKET.s3-website-us-east-1.amazonaws.com`
- **CloudFront** (optional): `https://YOUR_ID.cloudfront.net`

---

## 💰 Cost: $0/month

- Lambda: FREE (1M requests/month)
- API Gateway: FREE (1M requests/month)
- DynamoDB: FREE (25GB storage, 25 RCU/WCU)
- S3: FREE (5GB storage, 20K GET requests)
- CloudFront: FREE (1TB transfer, 10M requests)

**All within AWS Free Tier!**

---

## 🔧 Updates & Maintenance

### Update Backend:

1. Make changes to `backend/`
2. Re-zip: `cd backend && zip -r ../harbinger-backend.zip .`
3. Upload in Lambda Console → "Upload from" → ".zip file"

### Update Frontend:

1. Make changes to `frontend/src/`
2. Rebuild: `npm run build:prod`
3. Upload `frontend/dist/*` to S3 bucket
4. If using CloudFront, create invalidation: `/*`

### View Logs:

- Lambda logs: https://console.aws.amazon.com/cloudwatch
- API Gateway logs: Enable in API Gateway → "Logging"

---

## 🆘 Troubleshooting

### Backend not responding:
- Check Lambda logs in CloudWatch
- Verify environment variables in Lambda
- Test Lambda directly: Use "Test" tab in Lambda Console

### Frontend can't reach backend:
- Verify API URL in `config/flags.prod.yml`
- Check CORS settings in API Gateway
- Check browser console for errors

### DynamoDB errors:
- Verify IAM role has DynamoDB permissions
- Check table exists and is "Active"
- Verify table name matches environment variable

---

**Ready to deploy? Follow steps 1-6 above!** 🚀

After you create the DynamoDB table and get started with Lambda, let me know if you need help with any step!
