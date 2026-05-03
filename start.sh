#!/bin/bash
# Quick start script for Harbinger

set -e

echo "🚀 Starting Harbinger..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "scripts/node_modules" ]; then
    echo "📦 Installing scripts dependencies..."
    cd scripts && npm install && cd ..
fi

echo ""
echo "✅ Dependencies installed"
echo ""

# Start dev servers
npm run dev
