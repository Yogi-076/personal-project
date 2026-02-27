# VAPT Framework - Quick Start Guide

## 🚀 One-Click Startup

### Windows Users

**Simply double-click:** `START-ALL.bat`

This will:
1. Install all dependencies automatically
2. Start backend server (port 3001)
3. Start frontend server (port 8080)
4. Open in separate windows

Then navigate to: **http://localhost:8080/scanner**

---

## 📋 Manual Startup (If Needed)

### Option 1: Start Both Servers

```bash
# Double-click START-ALL.bat
# OR run from terminal:
START-ALL.bat
```

### Option 2: Start Individually

**Backend Server:**
```bash
start-backend.bat
```

**Frontend Server:**
```bash
start-frontend.bat
```

---

## 🔧 Setup Requirements

### Required
- Node.js (already installed ✅)
- npm (already installed ✅)

### Optional (for Real Scans)
- Python 3
- Wapiti Scanner

**Install Wapiti:**
```bash
pip install wapiti3
```

**Verify Installation:**
```bash
wapiti --version
```

---

## 💡 How It Works

### Demo Mode (Default)
- Works **immediately** without Wapiti
- Shows demonstration scan results
- Perfect for testing the UI

### Real Scan Mode
- Requires Wapiti installation
- Performs actual vulnerability scans
- Results are whitelabeled (no Wapiti branding)

---

## 🎯 Using the Scanner

1. **Start the application:**
   - Run `START-ALL.bat`
   - Wait for both servers to start

2. **Navigate to scanner:**
   - Open browser: `http://localhost:8080/scanner`

3. **Run a scan:**
   - Enter target URL (e.g., `http://testphp.vulnweb.com`)
   - Click "Start Scan"
   - Watch real-time progress
   - View professional security report

---

## 🐛 Troubleshooting

### "Backend not available"
✅ **This is OK!** Scanner will run in demo mode with mock data.

To enable real scans:
1. Check backend window for errors
2. Make sure port 3001 is free
3. Install Wapiti: `pip install wapiti3`

### Frontend won't start
```bash
cd "d:\coding\VAPT Framework\vajrascan-vapt-framework"
npm install
npm run dev
```

### Port already in use
- Backend uses: 3001
- Frontend uses: 8080
- Close any apps using these ports

---

## 📊 Features

✅ **Professional UI** - Clean, modern interface
✅ **Real-time Progress** - Live scan monitoring
✅ **Whitelabel Reports** - No Wapiti branding
✅ **Demo Mode** - Works without backend
✅ **Export** - JSON report downloads
✅ **CVSS Scoring** -Industry standard ratings

---

## 🔒 Security Scanner Capabilities

When Wapiti is installed, scanner can detect:
- SQL Injection
- Cross-Site Scripting (XSS)
- CSRF vulnerabilities
- File upload issues
- Command execution
- Path traversal
- Security header issues
- And more...

---

## Need Help?

1. Check both server windows for errors
2. Ensure Node.js is installed
3. Try demo mode first (no Wapiti needed)
4. Install Wapiti for real scans
