#!/bin/sh
# XKEEN-UI Uninstall Script
# Completely removes XKEEN-UI from the system
# Compatible with busybox (Keenetic/Entware)

set -e

BINARY="/opt/bin/xkeen-ui-keenetic-arm64"
SYMLINK="/opt/bin/xkeen-ui"
INIT_SCRIPT="/opt/etc/init.d/xkeen-ui"
UPDATE_SCRIPT="/opt/etc/xkeen-ui/update.sh"
LOGFILE="/opt/var/log/xkeen-ui.log"
PIDFILE="/var/run/xkeen-ui.pid"

log() {
    echo "$1"
}

error() {
    echo "ERROR: $1" >&2
}

# Check root
if [ "$(id -u)" != "0" ]; then
    error "This script must be run as root"
    exit 1
fi

echo "==================================="
echo "  XKEEN-UI Uninstall Script"
echo "==================================="
echo ""

# Stop service via init script
if [ -f "$INIT_SCRIPT" ]; then
    log "Stopping service..."
    "$INIT_SCRIPT" stop 2>/dev/null || true
fi

# Kill any remaining processes
log "Checking for running processes..."
if command -v pgrep >/dev/null 2>&1; then
    PIDS=$(pgrep -f "xkeen-ui" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            log "Killing process $PID..."
            kill "$PID" 2>/dev/null || true
        done
        sleep 1
        # Force kill if still running
        PIDS=$(pgrep -f "xkeen-ui" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            for PID in $PIDS; do
                log "Force killing process $PID..."
                kill -9 "$PID" 2>/dev/null || true
            done
        fi
    fi
fi

# Remove PID file
if [ -f "$PIDFILE" ]; then
    log "Removing PID file..."
    rm -f "$PIDFILE"
fi

# Remove init script
if [ -f "$INIT_SCRIPT" ]; then
    log "Removing init script..."
    rm -f "$INIT_SCRIPT"
fi

# Remove symlink
if [ -L "$SYMLINK" ] || [ -f "$SYMLINK" ]; then
    log "Removing symlink..."
    rm -f "$SYMLINK"
fi

# Remove binary
if [ -f "$BINARY" ]; then
    log "Removing binary..."
    rm -f "$BINARY"
fi

# Remove log file
if [ -f "$LOGFILE" ]; then
    log "Removing log file..."
    rm -f "$LOGFILE"
fi

# Remove update script
if [ -f "$UPDATE_SCRIPT" ]; then
    log "Removing update script..."
    rm -f "$UPDATE_SCRIPT"
fi

echo ""
echo "==================================="
echo "  Uninstallation complete!"
echo "==================================="
echo ""
echo "XKEEN-UI has been removed from your system."
echo "Config directory preserved: /opt/etc/xkeen-ui"
echo ""
