# Mihomo Config Editor Support

**Date**: 2026-03-08
**Status**: Approved
**Approach**: Minimal changes with parameterization

## Overview

Add support for editing Mihomo configuration files alongside existing Xray support. Users can switch between Xray and Mihomo modes via a toggle in Settings. The implementation reuses existing code with mode parameterization.

## Requirements

1. Edit Mihomo config at `/opt/etc/mihomo/config.yml` (YAML format)
2. Visual separation between Xray and Mihomo configs in UI
3. Handle case when Mihomo is not installed (show error toast)
4. Universal code for: config editing, logs, service commands (start/stop/restart)
5. Standard log paths: `/opt/var/log/mihomo/access.log`, `/opt/var/log/mihomo/error.log`

## Design Decisions

### Mode Switching

- Toggle in Settings tab (not separate tabs)
- Single `currentMode` state ('xray' | 'mihomo')
- Check availability before switching
- Toast error if Mihomo unavailable

### Editor

- CodeMirror with dynamic language mode
- JSON mode for Xray configs
- YAML mode for Mihomo configs
- Requires `@codemirror/lang-yaml` vendor file

### File Handling

- Filter by extension: `.json`, `.jsonc` (Xray), `.yml`, `.yaml` (Mihomo)
- Skip JSON validation for YAML files
- Use existing backup mechanism

## Backend Changes

### Config Structure (`internal/config/config.go`)

```go
type Config struct {
    // ... existing fields ...
    MihomoConfigDir string   `json:"mihomo_config_dir"`  // default: "/opt/etc/mihomo"
    MihomoBinary    string   `json:"mihomo_binary"`      // default: "mihomo"
}
```

Update `DefaultConfig()`:
```go
MihomoConfigDir: "/opt/etc/mihomo",
MihomoBinary:    "mihomo",
```

### ConfigHandler Changes (`internal/handlers/config.go`)

New endpoints:
```
GET  /api/config/mode           - get current mode and availability
POST /api/config/mode           - set mode {mode: "xray"|"mihomo"}
GET  /api/config/files?mode=... - list files with mode parameter
```

Mode endpoint response:
```json
{
    "mode": "xray",
    "xray_available": true,
    "mihomo_available": true
}
```

ListFiles changes:
- Accept `mode` query parameter
- Return appropriate directory based on mode
- Filter extensions by mode

ReadFile/WriteFile changes:
- Skip JSON validation for `.yml`/`.yaml` files

### Service Handler Changes (`internal/handlers/service.go`)

- Add Mihomo to service control whitelist
- Use appropriate binary based on current mode

## Frontend Changes

### Store (`store.js`)

New state:
```javascript
currentMode: 'xray',        // 'xray' | 'mihomo'
mihomoAvailable: false,
xrayAvailable: true,
```

New methods:
```javascript
async checkModeAvailability()  // Check both modes
async switchMode(mode)         // Switch with validation
async loadFiles()              // Update to use mode parameter
```

### Settings Tab (`index.html`)

Add mode switcher section:
```html
<div class="settings-section">
    <h3>Active Configuration</h3>
    <div class="mode-switcher">
        <button @click="switchMode('xray')"
                :class="{ active: $store.app.currentMode === 'xray' }">Xray</button>
        <button @click="switchMode('mihomo')"
                :class="{ active: $store.app.currentMode === 'mihomo' }"
                :disabled="!$store.app.mihomoAvailable">Mihomo</button>
    </div>
</div>
```

### Editor Component (`components/editor.js`)

- Dynamic CodeMirror creation with language mode
- Recreate editor when mode changes
- Import YAML language support

### Logs Tab (`index.html`)

Dynamic log file dropdown based on mode:
- Xray: `/opt/var/log/xray/access.log`, `/opt/var/log/xray/error.log`
- Mihomo: `/opt/var/log/mihomo/access.log`, `/opt/var/log/mihomo/error.log`

### CSS (`style.css`)

Add mode switcher styles:
```css
.mode-switcher {
    display: flex;
    gap: 0.5rem;
}

.mode-switcher button.active {
    background: var(--primary);
    color: white;
}
```

## Vendor Dependencies

Add CodeMirror YAML language support:
- Download `@codemirror/lang-yaml` to `/static/vendor/@codemirror/lang-yaml/6.0.0/`
- Update importmap in `index.html`

## Error Handling

1. **Mode switch to unavailable mode**: Toast error "Mihomo is not installed"
2. **Directory not found**: 404 response, show empty file list
3. **File read/write errors**: Existing error handling applies

## Testing Considerations

1. Mode switching with available/unavailable states
2. YAML file validation (no JSON parsing)
3. Backup/restore for YAML files
4. Log file paths update correctly
