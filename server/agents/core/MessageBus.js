const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class MessageBus extends EventEmitter {
    constructor() {
        super();
        this.history = [];
    }

    publish(type, source, target, payload = {}, priority = 'MEDIUM', requestId = null) {
        const message = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            type,
            priority,
            source,
            target,
            payload,
            requestId // For correlation
        };

        this.history.push(message);

        // Emit specific event for targeted listeners
        this.emit(type, message);

        // Emit catch-all for logging/monitoring
        this.emit('*', message);

        // If target is specific, could emit to that target channel naturally via the type/payload filter
        // But for now, we trust agents to filter or listen to specific topics.

        return message;
    }

    subscribe(type, callback) {
        this.on(type, callback);
    }

    getHistory() {
        return this.history;
    }
}

module.exports = new MessageBus();
