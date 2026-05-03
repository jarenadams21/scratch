#!/bin/bash
# Initial Setup for Harbinger Production Deployment
# Run this once before first deployment

set -e

echo "🎯 Harbinger Production Setup"
echo "=============================="
echo ""

# Check if tools are installed
echo "📋 Checking prerequisites..."

if ! command -v flyctl &> /dev/null; then
    echo "❌ Fly.io CLI not found. Install: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Install: npm install -g wrangler"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI not found (optional for DynamoDB)"
fi

echo "✅ All tools installed"
echo ""

# Configure production settings
echo "⚙️  Step 1: Configure production settings"
echo ""

read -p "Enter your backend domain (e.g., harbinger-api.fly.dev): " BACKEND_DOMAIN
read -p "Enter your DynamoDB region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}
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
  base_url: "https://${BACKEND_DOMAIN}"
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

# Fly.io setup
echo "🛫 Step 3: Fly.io Backend Setup"
echo ""

read -p "Setup Fly.io backend now? (yes/no): " SETUP_FLY
if [ "$SETUP_FLY" == "yes" ]; then
    cd backend
    
    echo "Logging into Fly.io..."
    flyctl auth login
    
    echo "Creating Fly.io app..."
    flyctl launch --name harbinger-api --region sjc --no-deploy || echo "App may already exist"
    
    echo ""
    echo "Set environment secrets? You'll need:"
    echo "  - JWT_SECRET (generate with: openssl rand -hex 32)"
    echo "  - AWS_ACCESS_KEY_ID"
    echo "  - AWS_SECRET_ACCESS_KEY"
    echo ""
    read -p "Set secrets now? (yes/no): " SET_SECRETS
    
    if [ "$SET_SECRETS" == "yes" ]; then
        JWT_SECRET=$(openssl rand -hex 32)
        echo "Generated JWT_SECRET: ${JWT_SECRET}"
        
        read -p "Enter AWS_ACCESS_KEY_ID: " AWS_KEY
        read -sp "Enter AWS_SECRET_ACCESS_KEY: " AWS_SECRET
        echo ""
        
        flyctl secrets set \
          NODE_ENV=production \
          JWT_SECRET=${JWT_SECRET} \
          DYNAMODB_TABLE=${TABLE_NAME} \
          AWS_REGION=${AWS_REGION} \
          AWS_ACCESS_KEY_ID=${AWS_KEY} \
          AWS_SECRET_ACCESS_KEY=${AWS_SECRET}
        
        echo "✅ Secrets configured"
    fi
    
    cd ..
fi

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
echo "1. Deploy backend:  cd backend && flyctl deploy"
echo "2. Get backend URL: flyctl info"
echo "3. Update config/flags.prod.yml with backend URL"
echo "4. Deploy frontend: ./scripts/deploy/deploy.sh"
echo ""
echo "For GitHub Actions CI/CD, add these secrets:"
echo "  - FLY_API_TOKEN (get with: flyctl auth token)"
echo "  - CLOUDFLARE_API_TOKEN"
echo "  - CLOUDFLARE_ACCOUNT_ID"
echo ""
echo "See PRODUCTION_DEPLOY.md for detailed instructions"
