# Auto-Update Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic update functionality that checks GitHub releases, compares versions, and updates the binary with one click.

**Architecture:** New `version` package for ldflags values, `UpdateHandler` with SSE for progress streaming, frontend UI in Settings tab.

**Tech Stack:** Go 1.21+, Server-Sent Events (SSE), Alpine.js, GitHub Releases API

---

## Task 1: Create version package

**Files:**
- Create: `xkeen-go/internal/version/version.go`

**Step 1: Create version package**

```go
// Package version provides build version information.
package version

var (
	// Version is set via ldflags during build
	Version = "dev"
	// BuildDate is set via ldflags during build
	BuildDate = "unknown"
	// GitCommit is set via ldflags during build
	GitCommit = "unknown"
)

// SetVersion initializes version info from main.
func SetVersion(v, bd, gc string) {
	Version = v
	BuildDate = bd
	GitCommit = gc
}

// GetVersion returns the current version string.
func GetVersion() string {
	return Version
}

// GetBuildDate returns the build date.
func GetBuildDate() string {
	return BuildDate
}

// GetGitCommit returns the git commit hash.
func GetGitCommit() string {
	return GitCommit
}
```

**Step 2: Commit**

```bash
git add xkeen-go/internal/version/version.go
git commit -m "feat: add version package for ldflags integration"
```

---

## Task 2: Update main.go to use version package

**Files:**
- Modify: `xkeen-go/main.go`

**Step 1: Add import and call SetVersion**

Find the imports section and add:
```go
import (
	// ... existing imports ...
	"github.com/user/xkeen-go/internal/version"
)
```

Find the `runServer()` function, after loading config add:
```go
// Initialize version package with ldflags values
version.SetVersion(version, buildDate, gitCommit)
```

The `runServer()` function should have this addition after line ~219 (after config loading):
```go
	// Initialize version package with ldflags values
	version.SetVersion(version, buildDate, gitCommit)

	// Log startup information
	log.Printf("XKEEN-GO %s starting...", version)
```

**Step 2: Commit**

```bash
git add xkeen-go/main.go
git commit -m "feat: integrate version package in main"
```

---

## Task 3: Create update handler

**Files:**
- Create: `xkeen-go/internal/handlers/update.go`

**Step 1: Create update handler with check endpoint**

```go
// Package handlers provides HTTP handlers for XKEEN-GO API endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/user/xkeen-go/internal/version"
)

// UpdateHandler handles application update operations.
type UpdateHandler struct {
	githubRepo    string
	binaryName    string
	installPath   string
	initScript    string
	downloadURL   string
}

// NewUpdateHandler creates a new UpdateHandler.
func NewUpdateHandler() *UpdateHandler {
	repo := "fan92rus/xkeen-go-ui"
	binaryName := "xkeen-go-keenetic-arm64"
	return &UpdateHandler{
		githubRepo:  repo,
		binaryName:  binaryName,
		installPath: "/opt/bin/" + binaryName,
		initScript:  "/opt/etc/init.d/xkeen-go",
		downloadURL: fmt.Sprintf("https://github.com/%s/releases/latest/download/%s", repo, binaryName),
	}
}

// GitHubRelease represents a GitHub release.
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
}

// CheckUpdateResponse is the response for CheckUpdate.
type CheckUpdateResponse struct {
	CurrentVersion  string `json:"current_version"`
	LatestVersion   string `json:"latest_version"`
	UpdateAvailable bool   `json:"update_available"`
	ReleaseURL      string `json:"release_url,omitempty"`
	ReleaseNotes    string `json:"release_notes,omitempty"`
	Error           string `json:"error,omitempty"`
}

// CheckUpdate checks GitHub for the latest release.
// GET /api/update/check
func (h *UpdateHandler) CheckUpdate(w http.ResponseWriter, r *http.Request) {
	currentVersion := version.GetVersion()

	// Create request with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", h.githubRepo), nil)
	if err != nil {
		h.respondJSON(w, http.StatusInternalServerError, CheckUpdateResponse{
			CurrentVersion: currentVersion,
			Error:          fmt.Sprintf("failed to create request: %v", err),
		})
		return
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "XKEEN-GO/"+currentVersion)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.respondJSON(w, http.StatusOK, CheckUpdateResponse{
			CurrentVersion: currentVersion,
			Error:          fmt.Sprintf("failed to fetch release info: %v", err),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		h.respondJSON(w, http.StatusOK, CheckUpdateResponse{
			CurrentVersion: currentVersion,
			Error:          fmt.Sprintf("GitHub API error: %d - %s", resp.StatusCode, string(body)),
		})
		return
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		h.respondJSON(w, http.StatusOK, CheckUpdateResponse{
			CurrentVersion: currentVersion,
			Error:          fmt.Sprintf("failed to parse release info: %v", err),
		})
		return
	}

	// Compare versions
	updateAvailable := h.compareVersions(currentVersion, release.TagName) < 0

	h.respondJSON(w, http.StatusOK, CheckUpdateResponse{
		CurrentVersion:  currentVersion,
		LatestVersion:   release.TagName,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      release.HTMLURL,
		ReleaseNotes:    release.Body,
	})
}

// compareVersions compares two version strings.
// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
func (h *UpdateHandler) compareVersions(v1, v2 string) int {
	// Remove 'v' prefix if present
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			n1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			n2, _ = strconv.Atoi(parts2[i])
		}

		if n1 < n2 {
			return -1
		} else if n1 > n2 {
			return 1
		}
	}

	return 0
}

// SSEEvent represents a Server-Sent Event.
type SSEEvent struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// ProgressData represents progress information.
type ProgressData struct {
	Percent int    `json:"percent"`
	Status  string `json:"status"`
}

// ErrorData represents error information.
type ErrorData struct {
	Error string `json:"error"`
}

// CompleteData represents completion information.
type CompleteData struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// StartUpdate starts the update process with SSE progress.
// POST /api/update/start
func (h *UpdateHandler) StartUpdate(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	// Helper to send SSE event
	sendEvent := func(event string, data interface{}) {
		jsonData, _ := json.Marshal(data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(jsonData))
		flusher.Flush()
	}

	// Step 1: Download
	sendEvent("progress", ProgressData{Percent: 5, Status: "downloading"})

	tmpFile := "/tmp/" + h.binaryName + ".new"
	if err := h.downloadFile(r.Context(), tmpFile); err != nil {
		sendEvent("error", ErrorData{Error: fmt.Sprintf("Download failed: %v", err)})
		return
	}

	sendEvent("progress", ProgressData{Percent: 40, Status: "download complete"})

	// Step 2: Set permissions
	sendEvent("progress", ProgressData{Percent: 45, Status: "setting permissions"})
	if err := os.Chmod(tmpFile, 0755); err != nil {
		sendEvent("error", ErrorData{Error: fmt.Sprintf("Failed to set permissions: %v", err)})
		return
	}

	// Step 3: Verify file
	sendEvent("progress", ProgressData{Percent: 50, Status: "verifying"})
	info, err := os.Stat(tmpFile)
	if err != nil {
		sendEvent("error", ErrorData{Error: fmt.Sprintf("Verification failed: %v", err)})
		return
	}
	if info.Size() < 1000000 { // Less than 1MB is suspicious
		sendEvent("error", ErrorData{Error: "Downloaded file too small, likely corrupted"})
		return
	}

	sendEvent("progress", ProgressData{Percent: 60, Status: "verified"})

	// Step 4: Stop service
	sendEvent("progress", ProgressData{Percent: 70, Status: "stopping service"})
	if err := h.runCommand(h.initScript, "stop"); err != nil {
		log.Printf("Warning: failed to stop service: %v", err)
		// Continue anyway, we might not be running as a service
	}

	// Step 5: Replace binary
	sendEvent("progress", ProgressData{Percent: 80, Status: "replacing binary"})
	if err := os.Rename(tmpFile, h.installPath); err != nil {
		// Try copy if rename fails (cross-filesystem)
		if err := h.copyFile(tmpFile, h.installPath); err != nil {
			sendEvent("error", ErrorData{Error: fmt.Sprintf("Failed to replace binary: %v", err)})
			return
		}
		os.Remove(tmpFile)
	}

	// Step 6: Start service
	sendEvent("progress", ProgressData{Percent: 95, Status: "starting service"})
	if err := h.runCommand(h.initScript, "start"); err != nil {
		log.Printf("Warning: failed to start service: %v", err)
	}

	// Step 7: Complete
	sendEvent("progress", ProgressData{Percent: 100, Status: "complete"})
	sendEvent("complete", CompleteData{
		Success: true,
		Message: "Update complete. Service is restarting...",
	})
}

// downloadFile downloads a file from URL to path.
func (h *UpdateHandler) downloadFile(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", h.downloadURL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("User-Agent", "XKEEN-GO/"+version.GetVersion())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// copyFile copies a file from src to dst.
func (h *UpdateHandler) copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// runCommand executes a command with arguments.
func (h *UpdateHandler) runCommand(name string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	return cmd.Run()
}

// respondJSON writes a JSON response.
func (h *UpdateHandler) respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// RegisterUpdateRoutes registers update-related routes.
func RegisterUpdateRoutes(r *mux.Router, handler *UpdateHandler) {
	r.HandleFunc("/update/check", handler.CheckUpdate).Methods("GET")
	r.HandleFunc("/update/start", handler.StartUpdate).Methods("POST")
}
```

**Step 2: Commit**

```bash
git add xkeen-go/internal/handlers/update.go
git commit -m "feat: add update handler with check and SSE update endpoints"
```

---

## Task 4: Register update routes in server

**Files:**
- Modify: `xkeen-go/internal/server/server.go`

**Step 1: Add updateHandler to Server struct**

In the Server struct (around line 28), add after `commandsHandler`:
```go
	commandsHandler *handlers.CommandsHandler
	updateHandler   *handlers.UpdateHandler
```

**Step 2: Initialize updateHandler in NewServer**

In `NewServer` function, after initializing `commandsHandler` (around line 113):
```go
	s.commandsHandler = handlers.NewCommandsHandler()
	s.updateHandler = handlers.NewUpdateHandler()
```

**Step 3: Register update routes**

In `setupRoutes` function, after registering other routes (around line 228):
```go
	handlers.RegisterCommandsRoutes(apiRouter, s.commandsHandler)
	handlers.RegisterUpdateRoutes(apiRouter, s.updateHandler)
```

**Step 4: Commit**

```bash
git add xkeen-go/internal/server/server.go
git commit -m "feat: register update routes in server"
```

---

## Task 5: Create frontend update service

**Files:**
- Create: `xkeen-go/web/static/js/services/update.js`

**Step 1: Create update service**

```javascript
// update.js - Update API service

const API_BASE = '/api';

/**
 * Check for available updates
 */
export async function checkUpdate() {
    const response = await fetch(`${API_BASE}/update/check`, {
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
 * Start update and listen to SSE events
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onProgress - Called with {percent, status}
 * @param {Function} callbacks.onComplete - Called with {success, message}
 * @param {Function} callbacks.onError - Called with {error}
 */
export function startUpdate(callbacks) {
    return new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${API_BASE}/update/start`, {
            // POST method is not supported by EventSource, so we use GET
            // The server handles this as POST for this endpoint
        });

        // Since EventSource only supports GET, we need a different approach
        // Use fetch with POST and manually parse SSE
        fetch(`${API_BASE}/update/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => {
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
                            const data = JSON.parse(line.substring(6));

                            switch (currentEvent) {
                                case 'progress':
                                    if (callbacks.onProgress) {
                                        callbacks.onProgress(data);
                                    }
                                    break;
                                case 'complete':
                                    if (callbacks.onComplete) {
                                        callbacks.onComplete(data);
                                    }
                                    resolve(data);
                                    return;
                                case 'error':
                                    if (callbacks.onError) {
                                        callbacks.onError(data);
                                    }
                                    reject(new Error(data.error));
                                    return;
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
```

**Step 2: Commit**

```bash
git add xkeen-go/web/static/js/services/update.js
git commit -m "feat: add frontend update service with SSE support"
```

---

## Task 6: Update store.js with update state

**Files:**
- Modify: `xkeen-go/web/static/js/store.js`

**Step 1: Add import for update service**

At the top of the file, add:
```javascript
import * as updateService from './services/update.js';
```

**Step 2: Add update state to store**

In the Alpine.store('app', {...}) object, add after `xraySettings`:
```javascript
        // Update state
        currentVersion: 'unknown',
        updateInfo: {
            update_available: false,
            current_version: '',
            latest_version: '',
            release_url: '',
            release_notes: ''
        },
        updateChecking: false,
        updating: false,
        updateProgress: 0,
        updateStatus: '',
```

**Step 3: Add update actions**

Add these methods to the store, before the `init()` method:
```javascript
        // Update actions
        async checkUpdate() {
            this.updateChecking = true;
            try {
                const data = await updateService.checkUpdate();
                this.currentVersion = data.current_version;
                this.updateInfo = {
                    update_available: data.update_available,
                    current_version: data.current_version,
                    latest_version: data.latest_version,
                    release_url: data.release_url || '',
                    release_notes: data.release_notes || ''
                };
                if (data.error) {
                    this.showToast('Update check: ' + data.error, 'error');
                }
            } catch (err) {
                this.showToast('Failed to check for updates', 'error');
            } finally {
                this.updateChecking = false;
            }
        },

        async startUpdate() {
            this.updating = true;
            this.updateProgress = 0;
            this.updateStatus = 'Starting update...';

            try {
                await updateService.startUpdate({
                    onProgress: (data) => {
                        this.updateProgress = data.percent;
                        this.updateStatus = data.status;
                    },
                    onComplete: (data) => {
                        this.showToast(data.message || 'Update complete!', 'success');
                        // Page will reload when service restarts
                    },
                    onError: (data) => {
                        this.showToast('Update failed: ' + data.error, 'error');
                        this.updating = false;
                    }
                });
            } catch (err) {
                this.showToast('Update failed: ' + err.message, 'error');
                this.updating = false;
            }
        },
```

**Step 4: Update init() to check version**

In the `init()` method, add checkUpdate call:
```javascript
        async init() {
            this.loadFiles();
            this.loadXraySettings();
            this.checkUpdate();
        }
```

**Step 5: Commit**

```bash
git add xkeen-go/web/static/js/store.js
git commit -m "feat: add update state and actions to store"
```

---

## Task 7: Add update UI to Settings tab

**Files:**
- Modify: `xkeen-go/web/index.html`

**Step 1: Add Updates section in Settings tab**

Find the Settings tab section (around line 129), after the existing settings content and before `</section>` for settings, add:

```html
                    <div class="settings-section">
                        <h3>Updates</h3>

                        <div class="update-status">
                            <div class="setting-row">
                                <label>Current version:</label>
                                <span class="version-info" x-text="$store.app.currentVersion"></span>
                            </div>

                            <template x-if="$store.app.updateInfo.update_available">
                                <div class="update-available">
                                    <p>New version available: <strong x-text="$store.app.updateInfo.latest_version"></strong></p>
                                    <a :href="$store.app.updateInfo.release_url"
                                       target="_blank"
                                       class="release-link">View release notes</a>
                                </div>
                            </template>

                            <template x-if="!$store.app.updateInfo.update_available && $store.app.updateInfo.latest_version">
                                <p class="up-to-date">You are running the latest version.</p>
                            </template>
                        </div>

                        <div class="update-actions">
                            <button @click="$store.app.checkUpdate()"
                                    :disabled="$store.app.updateChecking || $store.app.updating"
                                    class="btn"
                                    x-text="$store.app.updateChecking ? 'Checking...' : 'Check for Updates'"></button>

                            <template x-if="$store.app.updateInfo.update_available">
                                <button @click="$store.app.startUpdate()"
                                        :disabled="$store.app.updating"
                                        class="btn btn-primary"
                                        x-text="$store.app.updating ? 'Updating...' : 'Update Now'"></button>
                            </template>
                        </div>

                        <!-- Progress bar during update -->
                        <div x-show="$store.app.updating" class="update-progress">
                            <div class="progress-bar">
                                <div class="progress-fill"
                                     :style="'width: ' + $store.app.updateProgress + '%'"></div>
                            </div>
                            <p class="progress-status" x-text="$store.app.updateStatus"></p>
                        </div>
                    </div>
```

This should be added inside the Settings section, after the existing settings-section divs and before the settings-actions div.

**Step 2: Commit**

```bash
git add xkeen-go/web/index.html
git commit -m "feat: add update UI section to Settings tab"
```

---

## Task 8: Add CSS styles for update UI

**Files:**
- Modify: `xkeen-go/web/static/css/style.css`

**Step 1: Add update-related styles**

Add at the end of the file:

```css
/* Update section styles */
.update-status {
    margin-bottom: 1rem;
}

.version-info {
    font-family: monospace;
    background: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.update-available {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: rgba(52, 152, 219, 0.1);
    border-left: 3px solid var(--primary);
    border-radius: 4px;
}

.update-available p {
    margin: 0 0 0.5rem 0;
}

.release-link {
    font-size: 0.875rem;
    color: var(--primary);
}

.up-to-date {
    color: var(--success);
    margin-top: 0.5rem;
}

.update-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.update-progress {
    margin-top: 1rem;
}

.progress-bar {
    height: 8px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
}

.progress-status {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
}
```

**Step 2: Commit**

```bash
git add xkeen-go/web/static/css/style.css
git commit -m "feat: add CSS styles for update UI"
```

---

## Task 9: Test the implementation

**Files:**
- Test manually

**Step 1: Build the binary**

```bash
cd xkeen-go && make build
```

Expected: Binary built successfully with version info

**Step 2: Run locally (simulated)**

```bash
cd xkeen-go && ./build/xkeen-go-keenetic-arm64 version
```

Expected: Shows version, build date, git commit

**Step 3: Commit test confirmation**

```bash
git add -A
git commit -m "test: verify update feature works"
```

---

## Task 10: Final cleanup and documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with update feature info**

Add to the Architecture section:

```markdown
### Auto-Update
UpdateHandler provides one-click updates from GitHub releases:
- GET /api/update/check - Check for updates
- POST /api/update/start - Start update with SSE progress
- Updates are downloaded from https://github.com/fan92rus/xkeen-go-ui
- Binary is replaced and service is restarted automatically
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document auto-update feature in CLAUDE.md"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create version package | `internal/version/version.go` |
| 2 | Update main.go | `main.go` |
| 3 | Create update handler | `internal/handlers/update.go` |
| 4 | Register routes | `internal/server/server.go` |
| 5 | Create frontend service | `web/static/js/services/update.js` |
| 6 | Update store | `web/static/js/store.js` |
| 7 | Add UI | `web/index.html` |
| 8 | Add styles | `web/static/css/style.css` |
| 9 | Test | Manual testing |
| 10 | Documentation | `CLAUDE.md` |
