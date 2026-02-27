# VAPT Framework Backend Server

## Prerequisites

### Install Wapiti Scanner

**Linux/Mac:**
```bash
pip3 install wapiti3
```

**Windows:**
```bash
pip install wapiti3
```

Or download from: https://wapiti-scanner.github.io/

### Verify Installation
```bash
wapiti --version
```

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/scan/start` - Start new scan
- `GET /api/scan/status/:scanId` - Get scan status
- `GET /api/scan/results/:scanId` - Get scan results
- `GET /api/scan/history` - Get scan history

## Environment Variables

- `PORT` - Server port (default: 3001)

## Security Notes

- Wapiti scanner runs in isolated process
- All references to Wapiti are removed from API responses
- Results are transformed to whitelabel format
- Scan results are sanitized before sending to frontend
