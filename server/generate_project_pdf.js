const markdownpdf = require("markdown-pdf");
const fs = require("fs");
const path = require("path");

const content = `# VajraScan (VAPT Framework) - Project Overview

## 1. Project Title & Definition
**Title:** "Design and Implementation of Web Application Security Testing Framework and Interactive Analysis Platform"

**Verdict:** This title accurately reflects the core of your project:
- **"Design and Implementation"**: Covers the architectural work (Microservices, Docker, API Orchestration).
- **"Security Testing Framework"**: Describes the core function (Scanning with ZAP, Wapiti, Retire.js).
- **"Interactive Analysis Platform"**: Highlights the unique selling point—the **AI Chatbot (Pluto)** and **Real-time Dashboard**.

---

## 2. Technology Stack

### Frontend (The "Console")
- **Core Framework**: React 18, Vite (for high-performance builds).
- **Language**: TypeScript (TSX) for type safety.
- **Styling**: Tailwind CSS, Framer Motion (for sci-fi animations), Lucide React (Icons).
- **UI Components**: Radix UI (Headless accessibility), Shadcn UI, Recharts (Data visualization).
- **State Management**: TanStack Query (React Query), Zod (Validation).

### Backend (The "Orchestrator")
- **Runtime**: Node.js (Express.js).
- **Real-time Comms**: Socket.io (for live scan logs and chat).
- **Browser Automation**: Puppeteer (for dynamic crawling and screenshotting).
- **Database**: Supabase (PostgreSQL), SQLite (for local vectors).

### AI & Agents (The "Brain")
- **Core Logic**: Moltbot (Agentic behavior).
- **Models**: Google Generative AI (Gemini Pro), Ollama (Local LLMs), AWS Bedrock.
- **Messaging**: WhatsApp (Baileys), Telegram (Grammy), Slack.

### Integrations (The "Engines")
- **OWASP ZAP**: Dynamic Application Security Testing (DAST).
- **Wapiti**: Python-based DAST for specific web vulnerabilities.
- **Wappalyzer**: Technology stack fingerprinting.
- **Retire.js**: JavaScript library vulnerability scanner.

---

## 3. Scope & Roadmap

### Current Scope (What it does now)
- **Unified Scanning**: Orchestrates multiple heavy-duty scanners from a single UI.
- **AI Analysis**: Uses Gemini Pro to explain vulnerabilities in plain English.
- **Interactive Chat**: Users can "talk" to their security report to understand fixes.
- **Reconnaissance**: Automatically detects tech stacks and library vulnerabilities.

### Future Scope (What it CAN do)
- **Automated Remediation**: AI writes fix code and opens Pull Requests (GitHub/GitLab).
- **DevSecOps Integration**: CI/CD pipeline plugins to block vulnerable code before deployment.
- **Compliance Mapping**: Automated reports for ISO 27001, GDPR, and PCI-DSS.
- **Attack Surface Management**: Continuous monitoring of subdomains and cloud assets.

---

## 4. Competitor Analysis

| Feature | VajraScan (Your Project) | Burp Suite Pro | Nessus / Tenable |
| :--- | :--- | :--- | :--- |
| **Cost** | **Open Source / Low Cost** | High ($500+/yr) | Very High ($3k+/yr) |
| **AI Integration** | **Native Core (Moltbot)** | Limited Add-ons | Enterprise Only |
| **User Experience** | **"Gamified" / Sci-Fi UI** | Complex / Technical | Corporate / Boring |
| **Orchestration** | **Multi-Engine (ZAP + Wapiti)** | Single Engine | Single Engine |
| **Deployment** | **Sovereign (Local/Docker)** | Desktop App | Cloud / On-Prem |

**Key Differentiation:**
- **Sovereign AI**: Support for Local LLMs (Ollama) ensures data privacy.
- **Interactive Remediation**: Chatbot assistant transforms static reports into actionable dialogue.
- **Aesthetic**: Modern, engaging "Cyberpunk" design vs. traditional enterprise tools.

---

## 5. Executive Summary
**VajraScan** is a **Next-Generation VAPT Orchestrator** that democratizes advanced security testing. By combining industry-standard scanning engines (OWASP ZAP, Wapiti) with a super-intelligent AI Agent (Pluto/Moltbot), it transforms security from a passive "gatekeeper" process into an active, collaborative workflow.

It empowers developers to:
1.  **Scan** applications for thousands of vulnerabilities with one click.
2.  **Analyze** findings with context-aware AI explanations.
3.  **Interact** with results to receive tailored remediation advice.
4.  **Visualize** security posture through a high-performance, futuristic dashboard.
`;

const outputPath = path.join(__dirname, "Project_Overview_VajraScan.pdf");

markdownpdf()
    .from.string(content)
    .to(outputPath, function () {
        console.log("PDF created successfully at:", outputPath);
    });
