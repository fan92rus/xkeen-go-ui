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
	githubRepo  string
	binaryName  string
	installPath string
	initScript  string
	downloadURL string
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
