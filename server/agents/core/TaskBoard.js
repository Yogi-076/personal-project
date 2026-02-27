class TaskBoard {
    constructor() {
        this.tasks = new Map(); // id -> task
        this.findings = [];
        this.assets = new Set();
    }

    addTask(task) {
        this.tasks.set(task.id, { ...task, status: 'pending', createdAt: Date.now() });
    }

    updateTask(id, status, result = null) {
        if (this.tasks.has(id)) {
            const task = this.tasks.get(id);
            task.status = status;
            if (result) task.result = result;
            this.tasks.set(id, task);
        }
    }

    addFinding(finding) {
        // Deduplicate based on type + endpoint + method
        const exists = this.findings.some(f =>
            f.type === finding.type &&
            f.endpoint === finding.endpoint &&
            f.method === finding.method
        );

        if (!exists) {
            this.findings.push({ ...finding, foundAt: Date.now() });
            return true;
        }
        return false;
    }

    addAsset(asset) {
        if (!this.assets.has(asset)) {
            this.assets.add(asset);
            return true;
        }
        return false;
    }

    getPendingTasks() {
        return Array.from(this.tasks.values()).filter(t => t.status === 'pending');
    }

    getAllFindings() {
        return this.findings;
    }
}

module.exports = new TaskBoard();
