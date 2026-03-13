const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'scans.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure data file exists with valid JSON
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

const supabase = require('./supabaseClient');

// Helper to check if Supabase is configured with backend (non-VITE) keys
// VITE_ prefixed keys are frontend-only and should NOT enable cloud mode
const isSupabaseActive = () => {
    // New STORAGE_MODE toggle - defaults to cloud if not specified and keys exist
    if (process.env.STORAGE_MODE === 'local') return false;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    // Must have non-VITE keys and they must not equal the VITE_ values
    if (!url || !key) return false;
    // Block VITE-prefixed values being used under the non-prefixed key names
    if (url === process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
    return true;
};

// Recursive directory deletion helper
const deleteFolderRecursive = (folderPath) => {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
};

class Storage {
    constructor() {
        this.useLocal = !isSupabaseActive();
        console.log(`[Storage] Initialized. Mode: ${this.useLocal ? 'LOCAL FILE (scans.json)' : 'SUPABASE CLOUD (verifying...)'}`);
        // Self-healing: test the connection asynchronously; fall back to local if tables missing
        if (!this.useLocal) {
            this._verifySupabaseConnection();
        }
    }

    async _verifySupabaseConnection() {
        try {
            const { error } = await supabase.from('scans').select('id').limit(1);
            if (error && (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation'))) {
                console.warn('[Storage] ⚠️  Supabase tables not found. Falling back to LOCAL FILE mode.');
                console.warn('[Storage] 💡 To enable cloud mode, run the SQL migration in supabase/migrations/20260305_scans_and_findings.sql');
                this.useLocal = true;
            } else if (error) {
                console.warn('[Storage] ⚠️  Supabase connection error:', error.message, '— falling back to LOCAL FILE mode.');
                this.useLocal = true;
            } else {
                console.log('[Storage] ✅ Supabase connected. Mode confirmed: SUPABASE CLOUD');
            }
        } catch (e) {
            console.warn('[Storage] ⚠️  Supabase unreachable. Falling back to LOCAL FILE mode.');
            this.useLocal = true;
        }
    }

    // --- Local File Helpers ---

    _readLocal() {
        try {
            if (!fs.existsSync(DATA_FILE)) return {};
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('[Storage] Read Error:', e.message);
            return {};
        }
    }

    _writeLocal(data) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            return true;
        } catch (e) {
            console.error('[Storage] Write Error:', e.message);
            return false;
        }
    }

    // --- Scans ---

    async saveScan(scan) {
        // Always save to local for backup/dev
        try {
            const localData = this._readLocal();
            localData[scan.id] = {
                ...scan,
                logs: scan.logs || [],
                savedAt: new Date().toISOString()
            };
            this._writeLocal(localData);

            // [NEW] Project Context Storage
            if (scan.projectId) {
                const projectScanDir = path.join(DATA_DIR, 'projects', scan.projectId, 'scans', scan.id);
                if (!fs.existsSync(projectScanDir)) fs.mkdirSync(projectScanDir, { recursive: true });
                fs.writeFileSync(path.join(projectScanDir, 'meta.json'), JSON.stringify(localData[scan.id], null, 2));
            }
        } catch (e) {
            console.warn('[Storage] Local backup failed:', e.message);
        }

        if (this.useLocal) return scan;

        // Supabase Logic
        try {
            const { error } = await supabase
                .from('scans')
                .insert({
                    id: scan.id,
                    target_url: scan.target,
                    status: scan.status,
                    scan_type: scan.type || 'full',
                    result_summary: scan.summary || {},
                    scan_logs: scan.logs || [],
                    created_at: scan.startedAt,
                });

            if (error) throw error;
            return scan;
        } catch (error) {
            console.error('[Storage] Supabase saveScan Error:', error.message);
            // Fallback is already handled by local save above
            return scan;
        }
    }

    async updateScan(id, updates) {
        // Local Update
        let localScan = null;
        try {
            const localData = this._readLocal();
            if (localData[id]) {
                localData[id] = { ...localData[id], ...updates };
                if (updates.findings) {
                    localData[id].findings = updates.findings;
                    // Also update summary immediately for better partial visibility
                    localData[id].summary = { ...localData[id].summary, ...updates.summary };
                }
                if (updates.logs) {
                    localData[id].logs = updates.logs;
                }
                this._writeLocal(localData);
                localScan = localData[id];

                // [NEW] Project Context Storage Sync
                if (localScan.projectId) {
                    const projectScanDir = path.join(DATA_DIR, 'projects', localScan.projectId, 'scans', id);
                    if (!fs.existsSync(projectScanDir)) fs.mkdirSync(projectScanDir, { recursive: true });

                    if (localScan.status === 'completed' && localScan.findings) {
                        fs.writeFileSync(path.join(projectScanDir, 'results.json'), JSON.stringify(localScan, null, 2));

                        // Break down finding types for project aggregation
                        const findingsDir = path.join(DATA_DIR, 'projects', localScan.projectId, 'findings');
                        if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });
                        fs.writeFileSync(path.join(findingsDir, `scan_${id}_summary.json`), JSON.stringify(localScan.summary, null, 2));
                    } else {
                        fs.writeFileSync(path.join(projectScanDir, 'meta.json'), JSON.stringify(localScan, null, 2));
                    }
                }
            }
        } catch (e) {
            console.warn('[Storage] Local update failed:', e.message);
        }

        if (this.useLocal) return localScan;

        // Supabase Logic
        try {
            const dbUpdates = {};
            if (updates.status) dbUpdates.status = updates.status;
            // if (updates.progress) dbUpdates.progress = updates.progress; 
            if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
            if (updates.summary) dbUpdates.result_summary = updates.summary;
            // if (updates.error) dbUpdates.error_message = updates.error; 
            if (updates.logs) dbUpdates.scan_logs = updates.logs; // Map logs if schema supports it or we treat it as jsonb

            const { data, error } = await supabase
                .from('scans')
                .update(dbUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Save Key Findings
            if (updates.findings && updates.findings.length > 0) {
                await this.saveFindings(id, updates.findings);
            }

            return data;
        } catch (error) {
            console.error('[Storage] Supabase updateScan Error:', error.message);
            return localScan; // Return local as fallback
        }
    }

    async saveFindings(scanId, findings) {
        if (this.useLocal) return; // Local JSON already has them inside the scan object

        try {
            const rules = findings.map(f => ({
                scan_id: scanId,
                title: f.name || f.title || 'Unknown Issue',
                severity: (f.severity || 'info').toLowerCase(),
                description: f.description || '',
                remediation: f.remediation || '',
                evidence: f.proof || f.evidence || '',
                reproduction_url: f.reproductionUrl || '',
                // curl_command: f.curlCommand || '' // Removed as per instruction
            }));

            // Delete old findings for this scan to avoid duplicates on retry
            await supabase.from('findings').delete().eq('scan_id', scanId);

            const { error } = await supabase.from('findings').insert(rules);
            if (error) throw error;
        } catch (error) {
            console.error('[Storage] saveFindings Error:', error.message);
        }
    }

    async getScan(id) {
        let localScan = null;
        try {
            const localData = this._readLocal();
            if (localData[id]) localScan = localData[id];
        } catch (e) { /* ignore */ }

        if (this.useLocal) return localScan;

        try {
            const { data: scan, error } = await supabase
                .from('scans')
                .select('*, findings(*)')
                .eq('id', id)
                .single();

            if (error || !scan) return localScan;

            // Transform back to internal format
            return {
                id: scan.id,
                target: scan.target_url,
                status: scan.status,
                type: scan.scan_type,
                startedAt: scan.created_at,
                completedAt: scan.completed_at,
                summary: scan.result_summary,
                logs: scan.scan_logs || [],
                findings: scan.findings?.map(f => ({
                    name: f.title,
                    severity: f.severity,
                    description: f.description,
                    remediation: f.remediation,
                    proof: f.evidence,
                    reproductionUrl: f.reproduction_url
                })) || []
            };
        } catch (error) {
            console.error('[Storage] getScan Error:', error.message);
            return localScan;
        }
    }

    async getAllScans(userId) {
        let localScans = [];
        try {
            const localData = this._readLocal();
            // Filter out keys like 'users' that aren't actual scan objects
            localScans = Object.values(localData)
                .filter(s => {
                    if (!s || typeof s !== 'object' || Array.isArray(s) || !s.id) return false;
                    // If a userId filter is given, only return matching scans.
                    // Scans without a userId field are treated as 'anonymous' (legacy data).
                    if (userId) {
                        const scanOwner = s.userId || 'anonymous';
                        return scanOwner === userId;
                    }
                    return true;
                })
                .map(s => ({
                    id: s.id,
                    target: s.target,
                    status: s.status,
                    startedAt: s.startedAt,
                    summary: s.summary,
                    type: s.type,
                    userId: s.userId || 'anonymous',
                    findingsCount: s.findings ? s.findings.length : 0
                })).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        } catch (e) { /* ignore */ }

        if (this.useLocal) return localScans;

        try {
            const { data: scans, error } = await supabase
                .from('scans')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // Changed limit from 20 to 50

            if (error) throw error;

            return scans.map(s => ({
                id: s.id,
                target: s.target_url,
                status: s.status,
                startedAt: s.created_at,
                summary: s.result_summary,
                type: s.scan_type,
                findingsCount: 0 // Cloud usually requires join, keep simple for now
            }));
        } catch (error) {
            console.error('[Storage] getAllScans Error:', error.message);
            return localScans;
        }
    }

    async deleteScan(id) {
        console.log(`[Storage] Deleting scan: ${id}`);
        let deletedLocally = false;
        let projectId = null;

        try {
            const localData = this._readLocal();
            if (localData[id]) {
                projectId = localData[id].projectId;
                delete localData[id];
                this._writeLocal(localData);
                deletedLocally = true;
            }

            // [NEW] Project Context Cleanup
            if (projectId) {
                const projectScanDir = path.join(DATA_DIR, 'projects', projectId, 'scans', id);
                if (fs.existsSync(projectScanDir)) {
                    deleteFolderRecursive(projectScanDir);
                    console.log(`[Storage] Project scan folder removed: ${projectScanDir}`);
                }

                // Also remove the summary from findings dir if it exists
                const summaryPath = path.join(DATA_DIR, 'projects', projectId, 'findings', `scan_${id}_summary.json`);
                if (fs.existsSync(summaryPath)) {
                    fs.unlinkSync(summaryPath);
                }
            }
        } catch (e) {
            console.warn('[Storage] Local deletion failed:', e.message);
        }

        if (this.useLocal) return deletedLocally;

        // Supabase Deletion
        try {
            // Findings are usually linked via FK with ON DELETE CASCADE, but let's be safe
            await supabase.from('findings').delete().eq('scan_id', id);
            const { error } = await supabase
                .from('scans')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[Storage] Supabase deleteScan Error:', error.message);
            return deletedLocally;
        }
    }

    // --- VMT Snapshots (Local File System) ---

    async saveSnapshot(projectId, name, data, userId) {
        try {
            const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
            if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

            const snapshotId = `snap-${Date.now()}`;
            const snapshot = {
                id: snapshotId,
                projectId,
                name,
                data,
                userId: userId || 'anonymous',
                createdAt: new Date().toISOString()
            };

            const filePath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
            return snapshot;
        } catch (error) {
            console.error('[Storage] saveSnapshot Error:', error.message);
            throw error;
        }
    }

    async getSnapshots(projectId, userId) {
        try {
            const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
            if (!fs.existsSync(SNAPSHOTS_DIR)) return [];

            const files = fs.readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.json'));
            const snapshots = [];

            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, file), 'utf8');
                    const snap = JSON.parse(content);
                    const snapOwner = snap.userId || 'anonymous';
                    // Filter by projectId AND userId ownership
                    if (snap.projectId === projectId && (!userId || snapOwner === userId)) {
                        snapshots.push({
                            id: snap.id,
                            name: snap.name,
                            createdAt: snap.createdAt,
                            count: snap.data?.length || 0
                        });
                    }
                } catch (e) { /* ignore malformed files */ }
            }
            return snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('[Storage] getSnapshots Error:', error.message);
            return [];
        }
    }

    async getSnapshot(id) {
        try {
            const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
            const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
            if (!fs.existsSync(filePath)) return null;
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error('[Storage] getSnapshot Error:', error.message);
            return null;
        }
    }

    // --- User Management (Delegated to Supabase Auth) ---
    // These methods are now largely redundant but kept for interface compatibility if needed
    saveUser(user) { console.log('[Storage] saveUser is deprecated (Supabase handles this)'); }
    findUserByEmail(email) { console.log('[Storage] findUserByEmail is deprecated'); return null; }
    getUsers() { return []; }
    clearScans() {
        if (this.useLocal) {
            this._writeLocal({});
            console.log('[Storage] Local scan history cleared');
        } else {
            console.log('[Storage] clearScans not implemented for Supabase (use Dashboard)');
        }
    }
}

module.exports = new Storage();
