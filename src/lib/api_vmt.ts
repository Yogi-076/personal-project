import Config from '../config';

// API Gateway URL
const API_URL = Config.API_URL;

type RequestOptions = RequestInit & {
    headers?: Record<string, string>;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = localStorage.getItem('vmt_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('vmt_token');
            // window.location.href = '/auth'; // Optional: Redirect
        }
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Request failed with status ${response.status}`);
    }

    return response.json();
}

// --- Auth Endpoints ---
export const authApi = {
    login: (credentials: any) => request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }),
    register: (data: any) => request<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    getMe: () => request<any>('/auth/me'),
};

// --- Scanner Endpoints ---
export const scannerApi = {
    getHistory: () => request<any[]>('/api/scan/history'),
    startScan: (target: string, options?: { wafBypass?: boolean; proxy?: string; projectId?: string; fullModules?: boolean }) => request<any>('/api/scan/start', {
        method: 'POST',
        body: JSON.stringify({ target, ...options }),
    }),
    startSastScan: (repoUrl: string) => request<any>('/api/scan/sast/start', {
        method: 'POST',
        body: JSON.stringify({ repoUrl }),
    }),
    startDastScan: (target: string) => request<any>('/api/scan/dast/start', {
        method: 'POST',
        body: JSON.stringify({ target }),
    }),
    stopScan: (scanId: string) => request<any>(`/api/scan/${scanId}/stop`, {
        method: 'POST',
    }),
    startZapScan: (target: string) => request<any>('/api/scan/zap/start', {
        method: 'POST',
        body: JSON.stringify({ target }),
    }),
    // Gray Box Authentication Endpoints
    startAuthenticatedScan: (params: {
        target: string;
        loginUrl: string;
        username: string;
        password: string;
        selectors?: { user?: string; pass?: string; btn?: string };
        tool?: string;
        projectId?: string;
        fullModules?: boolean;
    }) => request<any>('/api/scan/authenticated/start', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    testLogin: (params: {
        loginUrl: string;
        username: string;
        password: string;
        selectors?: { user?: string; pass?: string; btn?: string };
    }) => request<any>('/api/auth/test-login', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    // Katana Crawl
    startKatanaCrawl: (params: {
        target: string;
        loginUrl?: string;
        username?: string;
        password?: string;
        selectors?: { user?: string; pass?: string; btn?: string };
        depth?: number;
        headless?: boolean;
    }) => request<any>('/api/scan/katana/start', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    // Nuclei CVE Scan
    startNucleiScan: (params: {
        target: string;
        loginUrl?: string;
        username?: string;
        password?: string;
        selectors?: { user?: string; pass?: string; btn?: string };
        tags?: string[];
        severity?: string;
    }) => request<any>('/api/scan/nuclei/start', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    // Retire.js SCA Scanner
    startRetireScan: (params: {
        target: string;
        mode?: string;
    }) => request<any>('/api/scan/retire/start', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    getRetireStatus: (scanId: string) => request<any>(`/api/scan/retire/status/${scanId}`),
    getRetireResults: (scanId: string) => request<any>(`/api/scan/retire/results/${scanId}`),
    // Full Gray Box Pipeline
    startFullPipeline: (params: {
        target: string;
        loginUrl: string;
        username: string;
        password: string;
        selectors?: { user?: string; pass?: string; btn?: string };
    }) => request<any>('/api/scan/graybox/full', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    // AI-Powered Vulnerability Hunter
    startAiHunt: (params: {
        target: string;
        loginUrl: string;
        username: string;
        password: string;
        selectors?: { user?: string; pass?: string; btn?: string };
        wafBypass?: boolean;
        proxy?: string;
        repoName?: string;
    }) => request<any>('/api/scan/ai-hunter/start', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    getAiHuntStatus: (scanId: string) => request<any>(`/api/scan/ai-hunter/status/${scanId}`),
    getStatus: (scanId: string) => request<any>(`/api/scan/status/${scanId}`),
    getResults: (scanId: string) => request<any>(`/api/scan/results/${scanId}`),
    clearHistory: () => request<any>('/api/scan/history', { method: 'DELETE' }),
    deleteScan: (scanId: string) => request<any>(`/api/scan/${scanId}`, { method: 'DELETE' }),
};

// --- VMT (Vulnerability Matrix) Endpoints ---
export const vmtApi = {
    getVulnerabilities: (projectId: string) => request<any[]>(`/api/vulnerabilities/${projectId}`),
    updateVulnerability: (id: string, projectId: string, field: string, value: any) => request<any>(`/api/vulnerabilities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ projectId, field, value }),
    }),
    addVulnerability: (projectId: string, data: any) => request<any>(`/api/vulnerabilities/${projectId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteVulnerability: (projectId: string, id: string) => request<any>(`/api/vulnerabilities/${projectId}/${id}`, {
        method: 'DELETE',
    }),

    // Snapshots
    saveSnapshot: (projectId: string, name: string, data: any[]) => request<any>(`/api/vmt/snapshots/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ name, data }),
    }),
    getSnapshots: (projectId: string) => request<any[]>(`/api/vmt/snapshots/${projectId}`),
    getSnapshot: (id: string) => request<any>(`/api/vmt/snapshot/${id}`),

    // Legacy AI endpoints
    aiAutocomplete: (issue_name: string) => request<any>('/api/ai/autocomplete', {
        method: 'POST',
        body: JSON.stringify({ issue_name }),
    }),
    aiChat: (message: string) => request<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
    }),
    aiRephrase: (mitigation_text: string) => request<any>('/api/ai/rephrase', {
        method: 'POST',
        body: JSON.stringify({ mitigation_text }),
    }),
    aiAnalyze: (issue_name: string, endpoint: string) => request<any>('/api/ai/analyze-vuln', {
        method: 'POST',
        body: JSON.stringify({ issue_name, endpoint }),
    }),

    // VAPT AI Assistant endpoints
    vaptChat: (message: string, context?: string) => request<any>('/api/ai/vapt-chat', {
        method: 'POST',
        body: JSON.stringify({ message, context }),
    }),
    generateFinding: (description: string, endpoint?: string, severity?: string) => request<any>('/api/ai/generate-finding', {
        method: 'POST',
        body: JSON.stringify({ description, endpoint, severity }),
    }),
    calculateCVSS: (params: {
        vulnerability: string;
        attackVector?: string;
        complexity?: string;
        privileges?: string;
        userInteraction?: string;
        scope?: string;
        impacts?: any;
    }) => request<any>('/api/ai/calculate-cvss', {
        method: 'POST',
        body: JSON.stringify(params),
    }),
    improveText: (text: string, targetAudience?: string) => request<any>('/api/ai/improve-text', {
        method: 'POST',
        body: JSON.stringify({ text, targetAudience }),
    }),
    validateReport: (findings: any[], sections?: any) => request<any>('/api/ai/validate-report', {
        method: 'POST',
        body: JSON.stringify({ findings, sections }),
    }),
};
