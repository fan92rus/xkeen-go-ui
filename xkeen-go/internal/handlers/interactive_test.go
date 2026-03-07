package handlers

import (
	"testing"
)

func TestNewInteractiveHandler(t *testing.T) {
	handler := NewInteractiveHandler(nil)
	if handler == nil {
		t.Fatal("Expected non-nil handler")
	}
	if handler.allowedCommands == nil {
		t.Error("Expected allowedCommands to be initialized")
	}
	if len(handler.allowedCommands) == 0 {
		t.Error("Expected non-empty allowedCommands")
	}
}
