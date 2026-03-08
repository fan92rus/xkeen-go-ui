// services/status.js - SSE status streaming

let eventSource = null;

/**
 * Connect to SSE status stream
 * @param {function} onStatus - Callback receiving 'running' | 'stopped' | 'unknown'
 * @returns {function} Disconnect function
 */
export function connectStatusStream(onStatus) {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource('/api/xkeen/status/stream');

    eventSource.addEventListener('status', (e) => {
        try {
            const data = JSON.parse(e.data);
            const status = data.running ? 'running' : 'stopped';
            onStatus(status);
        } catch (err) {
            onStatus('unknown');
        }
    });

    eventSource.onerror = () => {
        // Browser will auto-reconnect
    };

    return () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    };
}

/**
 * Disconnect SSE status stream
 */
export function disconnectStatusStream() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}
