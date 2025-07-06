#!/bin/bash

echo "Setting up development environment..."

echo ""
echo "Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Development environment setup complete!"
echo ""
echo "To start development servers, run: ./start_dev.sh"
echo "" 