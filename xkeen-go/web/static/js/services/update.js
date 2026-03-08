// update.js - Update API service

const API_BASE = '/api';

/**
 * Check for available updates
 * @param {boolean} prerelease - Check for dev/prerelease builds
 * @returns {Promise<Object>} Update info with current_version, latest_version, update_available, etc.
 */
export async function checkUpdate(prerelease = false) {
    const url = prerelease
        ? `${API_BASE}/update/check?prerelease=true`
        : `${API_BASE}/update/check`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get CSRF token from cookie
 * @returns {string} CSRF token
 */
function getCSRFToken() {
    return document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '';
}

/**
 * Start update and listen to SSE events
 * @param {Object} options - Options and callbacks
 * @param {boolean} options.prerelease - Download dev/prerelease build
 * @param {Function} options.onProgress - Called with {percent, status}
 * @param {Function} options.onComplete - Called with {success, message}
 * @param {Function} options.onError - Called with {error}
 * @returns {Promise<void>}
 */
export function startUpdate(options) {
    const { prerelease = false, onProgress, onComplete, onError } = options;

    return new Promise((resolve, reject) => {
        const url = prerelease
            ? `${API_BASE}/update/start?prerelease=true`
            : `${API_BASE}/update/start`;

        // Use fetch with POST and manually parse SSE
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCSRFToken()
            }
        }).then(response => {
            if (!response.ok) {
                reject(new Error(`HTTP ${response.status}`));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        resolve();
                        return;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE events
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    let currentEvent = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEvent = line.substring(7);
                        } else if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));

                                switch (currentEvent) {
                                    case 'progress':
                                        if (onProgress) {
                                            onProgress(data);
                                        }
                                        break;
                                    case 'complete':
                                        if (onComplete) {
                                            onComplete(data);
                                        }
                                        resolve(data);
                                        return;
                                    case 'error':
                                        if (onError) {
                                            onError(data);
                                        }
                                        reject(new Error(data.error));
                                        return;
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE data:', e);
                            }
                        }
                    }

                    read();
                }).catch(err => {
                    reject(err);
                });
            }

            read();
        }).catch(err => {
            reject(err);
        });
    });
}
