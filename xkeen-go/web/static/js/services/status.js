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
            onStatus(data.running ? 'running' : 'stopped');
        } catch (err) {
            console.error('Failed to parse status event:', err);
            onStatus('unknown');
        }
    });

    eventSource.onerror = (err) => {
        console.error('SSE error:', err);
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
