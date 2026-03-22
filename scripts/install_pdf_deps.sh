#!/bin/bash
# VPS Setup Script for Puppeteer (PDF Generation)
# Run with: sudo bash scripts/install_pdf_deps.sh

echo "================================================"
echo "VAPT Framework - Installing PDF (Puppeteer) Deps"
echo "================================================"

# Update package list
sudo apt-get update

# Install required system libraries for Chrome/Puppeteer
sudo apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget

# Ensure chromium is available via puppeteer
cd server
npm install puppeteer

echo "================================================"
echo "✓ Dependency installation complete!"
echo "Now run: node server/test_puppeteer.js"
echo "================================================"
