# VajraScan - VAPT Framework
> **Advanced Vulnerability Assessment & Penetration Testing Framework**

VajraScan is a unified security testing platform that orchestrates multiple scanning engines (Wapiti, ZAP, SAST) and leverages AI (Moltbot) for intelligent vulnerability analysis and reproduction.

---

## 🏗️ Architecture

The framework consists of three core microservices:

| Component | Technology | Port | Path | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React, Vite, Tailwind | `8081` | `/` | The interactive dashboard for managing scans and viewing reports. |
| **Backend** | Node.js, Express | `3001` | `/server` | Orchestrates scanners, manages data, and handles report generation. |
| **AI Agent** | Moltbot (TypeScript) | `18789` | `/moltbot` | "Pluto" AI agent for analyzing findings and generating fix suggestions. |

---

## ✅ Prerequisites

Ensure you have the following installed before starting:

1.  **Node.js**: Version `22.12.0` or higher (Required for AI component).
    *   [Download Node.js](https://nodejs.org/)
2.  **Git**: For version control.
    *   [Download Git](https://git-scm.com/)
3.  **Python**: (Optional) Required for running standalone exploit scripts.
4.  **pnpm**: (Recommended) Package manager for Moltbot.
    ```bash
    npm install -g pnpm
    ```

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Yogi-076/Design_-_Development_VAPT_Framework.git
cd Design_-_Development_VAPT_Framework
```
*(Note: If the directory is named `lovable-security-framework-main`, rename it to `vajrascan-vapt-framework`)*

### 2. External Security Engine Setup (CRITICAL)
For the scanner to work fully, you must install the underlying engines.

#### 🐍 Wapiti (Python DAST)
Wapiti is used for black-box vulnerability scanning.
1.  **Install Python 3.10+**: [Download Python](https://www.python.org/downloads/) (Check "Add Python to PATH" during install).
2.  **Install Wapiti via pip**:
    ```bash
    pip install wapiti3
    ```
3.  **Verify**: Open a terminal and type `wapiti --version`. If it works, you are ready.

#### ⚡ OWASP ZAP (Java DAST)
ZAP is used for advanced crawling and attacking.
1.  **Install Java (OpenJDK 11+)**: Required for ZAP. [Download Java](https://adoptium.net/)
2.  **Download OWASP ZAP**: [Download Installer](https://www.zaproxy.org/download/)
3.  **Install Location**: Install to the default location:
    *   Windows: `C:\Program Files\ZAP\Zed Attack Proxy`
    *   *If you install elsewhere, you must add the installation folder to your System PATH.*
4.  **Verify**: Run the `start_zap.bat` script in the root directory. It should start ZAP in daemon mode.

### 3. Install Project Dependencies

---

## ⚡ Quick Start (Windows)

The easiest way to run the entire stack is using the automation script.

1.  Double-click **`START-ALL.bat`** in the root directory.
2.  This will open **three** new command windows:
    *   **VAPT Backend**: Starts the API server.
    *   **Pluto AI**: Starts the Moltbot AI gateway.
    *   **VAPT Frontend**: Starts the React dashboard.
3.  Once all windows are running, the dashboard will open automatically at:
    **[http://localhost:8081/scanner](http://localhost:8081/scanner)**

---

## 🛠️ Manual Startup Guide

If you prefer to run services individually or need to debug:

### 1. Start Backend
```bash
cd server
npm install
node index.js
```
*Wait for: `Server running on port 3001`*

### 2. Start AI Agent (Moltbot)
```bash
cd moltbot
pnpm install
npm run start
```
*Wait for: `Gateway active on port 18789`*

### 3. Start Frontend
```bash
# Return to root directory
npm install
npm run dev
```
*Wait for: `Local: http://localhost:8081`*

---

## ⚙️ Configuration

### Environment Variables
Create a `.env` file in the `server/` directory for API keys:

```env
# server/.env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

### Database
The system uses a local JSON-based storage for scan results by default. No external database setup is required for basic usage.

---

## 📂 Project Structure

```
vajrascan-vapt-framework/
├── src/                # Frontend React Source Code
├── server/             # Backend API & Scanner Orchestration
│   ├── services/       # Wrappers for Wapiti, ZAP, SAST
│   └── index.js        # Main API Entry Point
├── moltbot/            # AI Agent (Pluto/Moltbot) Source
├── public/             # Static Assets (Favicons, Logos)
├── START-ALL.bat       # Master Startup Script
├── package.json        # Frontend Dependencies
└── README.md           # Documentation
```

---

## 🧩 Key Features

*   **One-Click Scan**: Launch full SAST & DAST scans from the UI.
*   **Exact Reproduction**: Reports include curl commands and direct URLs to test vulnerabilities.
*   **AI Analysis**: "Pluto" explains vulnerabilities and suggests fixes.
*   **Monorepo**: All components in a single, easy-to-manage repository.

---

## ❓ Troubleshooting

**Q: Frontend says "Network Error" or Backend not connected.**
*   A: Ensure the **Backend** terminal is running and shows "Server running on port 3001".

**Q: Port 8081 is already in use.**
*   A: Edit `vite.config.ts` and change the port number, or kill the process using port 8081.

**Q: "Access Denied" when renaming folder.**
*   A: Close VS Code and all terminals, then rename the folder via Windows Explorer.

---

## 📜 License
Proprietary software developed by **Fornsec Solutions**.
