#!/bin/bash
# Deploy Harbinger to Production
# This script deploys both backend and frontend

set -e  # Exit on error

echo "🚀 Deploying Harbinger to Production"
echo "======================================"
echo ""

# Check if production config exists
if [ ! -f "config/flags.prod.yml" ]; then
    echo "❌ Error: config/flags.prod.yml not found"
    echo "   Please create production configuration first"
    exit 1
fi

# Confirm deployment
read -p "⚠️  Deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "📦 Step 1: Load production configuration"
cp config/flags.prod.yml config/flags.yml
npm run load-config

echo ""
echo "🔨 Step 2: Build frontend"
cd frontend
npm run build:prod
cd ..

echo ""
echo "📦 Step 3: Build Lambda zip"
npm run build:lambda
echo "Upload harbinger-backend.zip to AWS Lambda manually or via AWS CLI:"
echo "  aws lambda update-function-code --function-name harbinger-prod-lambda --zip-file fileb://harbinger-backend.zip"

echo ""
echo "☁️  Step 4: Deploy frontend to Cloudflare Pages"
cd frontend
npx wrangler pages publish dist --project-name=harbinger
cd ..

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Don't forget to:"
echo "1. Update config/flags.prod.yml with backend URL"
echo "2. Set environment variables in Lambda (ALLOWED_ORIGINS, JWT_SECRET, etc.)"
echo "3. Create DynamoDB table if not exists"
