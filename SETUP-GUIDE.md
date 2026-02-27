# 🚀 STEP-BY-STEP SETUP GUIDE

## ⚡ Quick Setup (5 Minutes)

### Step 1: Fix PowerShell (If Needed)

If you get "cannot be loaded" errors, run PowerShell **as Administrator** and execute:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

### Step 2: Install Backend Dependencies

Open **Command Prompt** or **PowerShell** and run:
```bash
cd "d:\coding\VAPT Framework\vajrascan-vapt-framework\server"
npm install
```

You should see packages installing. Wait for it to finish.

### Step 3: Install Wapiti (For Real Scans)

```bash
pip install wapiti3
```

Verify installation:
```bash
wapiti --version
```

You should see: `Wapiti 3.x.x`

### Step 4: Start Backend Server

**Keep this terminal open!**
```bash
cd "d:\coding\VAPT Framework\vajrascan-vapt-framework\server"
node index.js
```

You should see:
```
🔒 VAPT Framework Scanner API running on port 3001
📡 Health check: http://localhost:3001/api/health
```

### Step 5: Start Frontend Server

**Open a NEW terminal** and run:
```bash
cd "d:\coding\VAPT Framework\vajrascan-vapt-framework"
npm run dev
```

You should see:
```
VITE ready in XXX ms
Local: http://localhost:8080
```

### Step 6: Open Scanner

Open your browser and go to:
```
http://localhost:8080/scanner
```

## ✅ Testing the Scanner

### Demo Mode Test (No Wapiti Needed):
1. Enter ANY URL: `https://example.com`
2. Click "Start Scan"
3. See demo vulnerability results

### Real Scan Test (With Wapiti):
1. Make sure backend shows: "VAPT Framework Scanner API running"
2. Enter a test site: `http://testphp.vulnweb.com`
3. Click "Start Scan"
4. **Wapiti will run in the background!**
5. Wait 1-3 minutes
6. View REAL vulnerability findings

## 🔧 Troubleshooting

### "npm: cannot be loaded"
Run as Administrator:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### "Port 3001 already in use"
Kill the process:
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### "Could not connect to scanner service"
- Make sure backend is running (Step 4)
- Check you see "running on port 3001"
- Scanner will use demo mode if backend is down

### "Wapiti not found"
Install Python and Wapiti:
```bash
pip install wapiti3
```

### Backend won't start
Check `server/node_modules` exists:
```bash
cd server
npm install
```

## 📊 How to Know It's Working

### Backend Running ✅
Terminal shows:
```
🔒 VAPT Framework Scanner API running on port 3001
```

### Frontend Running ✅
Terminal shows:
```
Local: http://localhost:8080
```

### Scanner Working ✅
Browser shows:
- "Security Scanner" page
- URL input field
- "Start Scan" button

### Wapiti Integration Working ✅
When you scan, you see:
- Real-time progress (0-100%)
- Actual vulnerability findings
- **NO "Wapiti" mentioned anywhere!**

## 🎯 Expected Behavior

### User Journey:
1. Opens: `http://localhost:8080/scanner`
2. Sees: Professional security scanner interface
3. Enters: Target URL
4. Clicks: "Start Scan"
5. Watches: Progress bar (real-time)
6. Views: Professional vulnerability report
7. **Never sees:** Terminal, Wapiti, or technical details

### Behind the Scenes:
1. Frontend sends URL to backend
2. Backend executes: `wapiti <url> -f json`
3. Wapiti scans and returns findings
4. Backend removes all "Wapiti" references
5. Frontend displays clean VAPT report

## 📝 Daily Usage

Once everything is set up:

1. **Start Backend:**
   ```bash
   cd "d:\coding\VAPT Framework\vajrascan-vapt-framework\server"
   node index.js
   ```

2. **Start Frontend:**
   ```bash
   cd "d:\coding\VAPT Framework\vajrascan-vapt-framework"
   npm run dev
   ```

3. **Use Scanner:**
   - Open: `http://localhost:8080/scanner`
   - Scan any website!

## 🚨 Important Notes

- Keep both terminals open while scanning
- Don't close backend during a scan
- Scans may take 1-5 minutes depending on target
- All Wapiti branding is automatically removed
- Users only see "VAPT Framework"

## ✅ You're Done!

The Wapiti scanner is **fully integrated**. Just start the servers and begin scanning!
