
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class ProxyService {
    constructor() {
        this.history = [];
        this.maxHistory = 100;
    }

    async executeRequest(reqDetails) {
        const { method, url, headers, body } = reqDetails;
        const requestId = uuidv4();
        const startTime = Date.now();

        const logEntry = {
            id: requestId,
            timestamp: new Date().toISOString(),
            method,
            url,
            requestHeaders: headers,
            requestBody: body,
            status: 'pending'
        };

        this.history.unshift(logEntry);
        if (this.history.length > this.maxHistory) this.history.pop();

        try {
            const response = await axios({
                method,
                url,
                headers,
                data: body,
                validateStatus: () => true // Resolve promise for all status codes
            });

            const duration = Date.now() - startTime;

            // Update log
            logEntry.status = 'completed';
            logEntry.statusCode = response.status;
            logEntry.statusText = response.statusText;
            logEntry.responseHeaders = response.headers;
            logEntry.responseBody = response.data;
            logEntry.duration = duration;

            return logEntry;

        } catch (error) {
            const duration = Date.now() - startTime;
            logEntry.status = 'failed';
            logEntry.error = error.message;
            logEntry.duration = duration;
            throw error;
        }
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
    }
}

module.exports = ProxyService;
