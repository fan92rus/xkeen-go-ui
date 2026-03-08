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
        console.log('[SSE] Raw event data:', e.data);
        try {
            const data = JSON.parse(e.data);
            const status = data.running ? 'running' : 'stopped';
            console.log('[SSE] Parsed status:', status, 'from data:', data);
            onStatus(status);
        } catch (err) {
            console.error('[SSE] Failed to parse status event:', err, 'raw data:', e.data);
            onStatus('unknown');
        }
    });

    eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err, 'readyState:', eventSource?.readyState);
        // Browser will auto-reconnect
    };

    eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
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
