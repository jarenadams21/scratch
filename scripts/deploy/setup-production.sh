#!/bin/bash
# Initial Setup for Harbinger Production Deployment
# Run this once before first deployment

set -e

echo "🎯 Harbinger Production Setup"
echo "=============================="
echo ""

# Check if tools are installed
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI not found (optional for DynamoDB)"
fi

if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Install: npm install -g wrangler"
    exit 1
fi

echo "✅ Tools checked"
echo ""

# Configure production settings
echo "⚙️  Step 1: Configure production settings"
echo ""

read -p "Enter your API Gateway endpoint (e.g., https://<id>.execute-api.us-east-2.amazonaws.com): " BACKEND_DOMAIN
read -p "Enter your DynamoDB region (default: us-east-2): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-2}
read -p "Enter your DynamoDB table name (default: harbinger-prod): " TABLE_NAME
TABLE_NAME=${TABLE_NAME:-harbinger-prod}

# Update production config
cat > config/flags.prod.yml << EOF
dev:
  enabled: false
  description: "Development mode with mock authentication and data"
  mock_user: "admin@harbinger.dev"
  mock_token: "mock-dev-token-12345"
  simulated_delay_ms: 0

debug:
  enabled: false
  description: "Enable detailed console logging"

verbose:
  enabled: false
  description: "Enable verbose output for all operations"

logging:
  log_level: "INFO"
  log_to_console: false
  log_messages: false
  description: "Configure application-wide logging behavior"

api:
  base_url: "${BACKEND_DOMAIN}"
  timeout_ms: 30000
  retry_attempts: 3
  description: "Backend API connection settings"

ui:
  show_dev_badges: false
  auto_save_interval_ms: 60000
  max_title_length: 100
  max_content_length: 10000
  description: "User interface behavior settings"

database:
  table_name: "${TABLE_NAME}"
  region: "${AWS_REGION}"
  description: "DynamoDB connection settings"

auth:
  jwt_expires_in: "7d"
  require_email_verification: false
  description: "Authentication configuration"
EOF

echo "✅ Production config created: config/flags.prod.yml"
echo ""

# DynamoDB setup
echo "📊 Step 2: DynamoDB Table Setup"
echo ""

if command -v aws &> /dev/null; then
    read -p "Create DynamoDB table now? (yes/no): " CREATE_TABLE
    if [ "$CREATE_TABLE" == "yes" ]; then
        echo "Creating table ${TABLE_NAME}..."
        aws dynamodb create-table \
          --table-name ${TABLE_NAME} \
          --attribute-definitions \
            AttributeName=pk,AttributeType=S \
            AttributeName=sk,AttributeType=S \
          --key-schema \
            AttributeName=pk,KeyType=HASH \
            AttributeName=sk,KeyType=RANGE \
          --billing-mode PAY_PER_REQUEST \
          --region ${AWS_REGION} || echo "Table may already exist"
        echo "✅ Table created/verified"
    fi
else
    echo "⚠️  AWS CLI not available. Create table manually:"
    echo "   aws dynamodb create-table --table-name ${TABLE_NAME} ..."
fi

echo ""

# Lambda build
echo "📦 Step 3: Build Lambda Package"
echo ""
npm run build:lambda
echo "✅ Built: harbinger-backend.zip"
echo "   Upload this to AWS Lambda → harbinger-prod-lambda → Code → Upload from .zip"
echo "   Set Lambda environment variables:"
echo "     ALLOWED_ORIGINS = <your Amplify URL>"
echo "     JWT_SECRET      = \$(openssl rand -hex 32)"
echo "     DYNAMODB_TABLE  = ${TABLE_NAME}"
echo "     AWS_REGION      = ${AWS_REGION}"

echo ""

# Cloudflare setup
echo "☁️  Step 4: Cloudflare Pages Setup"
echo ""

read -p "Login to Cloudflare now? (yes/no): " SETUP_CF
if [ "$SETUP_CF" == "yes" ]; then
    wrangler login
    echo "✅ Logged into Cloudflare"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Upload harbinger-backend.zip to AWS Lambda"
echo "2. Set Lambda environment variables (ALLOWED_ORIGINS, JWT_SECRET, etc.)"
echo "3. Update config/flags.prod.yml with backend URL"
echo "4. Deploy frontend: ./scripts/deploy/deploy.sh"
echo ""
echo "For GitHub Actions CI/CD, add these secrets:"
echo "  - CLOUDFLARE_API_TOKEN"
echo "  - CLOUDFLARE_ACCOUNT_ID"
echo ""
echo "See DEPLOY_STEPS.md for detailed instructions"
