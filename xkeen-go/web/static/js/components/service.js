// components/service.js - Service status and control buttons
// Status updates are handled via SSE in store.js

document.addEventListener('alpine:init', () => {
    Alpine.data('service', function() {
        return {
            init() {
                // Status is provided via SSE stream (see store.js init)
                // No polling needed
            },

            start() {
                this.$store.app.startService();
            },

            stop() {
                this.$store.app.stopService();
            }
        };
    });
});
