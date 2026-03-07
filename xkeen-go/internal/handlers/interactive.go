// Package handlers provides HTTP handlers for XKEEN-GO API endpoints.
package handlers

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// InteractiveHandler handles interactive command execution via WebSocket.
type InteractiveHandler struct {
	mu              sync.RWMutex
	allowedCommands map[string]CommandConfig
	allowedOrigins  map[string]bool
	upgrader        websocket.Upgrader
}

// InteractiveConfig configures the interactive handler.
type InteractiveConfig struct {
	AllowedOrigins []string
}

// NewInteractiveHandler creates a new InteractiveHandler.
func NewInteractiveHandler(cfg *InteractiveConfig) *InteractiveHandler {
	// Build allowed origins map
	allowedOrigins := make(map[string]bool)
	if cfg != nil {
		for _, origin := range cfg.AllowedOrigins {
			allowedOrigins[origin] = true
		}
	}

	h := &InteractiveHandler{
		allowedCommands: defaultCommands,
		allowedOrigins:  allowedOrigins,
	}

	// Create upgrader with origin check
	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.checkOrigin,
	}

	return h
}

// checkOrigin validates the origin of WebSocket connections.
func (h *InteractiveHandler) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	host := r.Host

	if origin == "" {
		return true
	}

	if h.allowedOrigins[origin] {
		return true
	}

	if origin == "http://"+host || origin == "https://"+host {
		return true
	}

	log.Printf("WebSocket connection rejected from origin: %s (host: %s)", origin, host)
	return false
}

// isCommandAllowed checks if a command is in the whitelist.
func (h *InteractiveHandler) isCommandAllowed(cmd string) (CommandConfig, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	config, exists := h.allowedCommands[cmd]
	return config, exists
}
