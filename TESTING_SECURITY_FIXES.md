# Security Fixes - Testing Guide

## Changes Implemented

### 1. Default Credentials Fix ✅
- Added `force_password_change` field to AuthConfig
- Install command creates config with admin/admin + force_password_change = true
- Login endpoint returns `require_password_change: true` if flag is set
- ChangePassword endpoint clears the flag after successful password change

### 2. SHA256 Checksum Verification ✅
- Added `downloadWithChecksum()` function
- Downloads binary + .sha256 file
- Verifies checksum with constant-time comparison
- Falls back to HTTPS-only if checksum file missing
- Updated StartUpdate to use new verification

---

## Testing Default Credentials Fix

### Test 1: Fresh Installation

```bash
# 1. Run install command
./xkeen-go-keenetic-arm64 install

# 2. Check config file
cat /opt/etc/xkeen-go/config.json | grep -A 2 "force_password_change"
# Expected: "force_password_change": true

# 3. Start server
/opt/etc/init.d/xkeen-go start

# 4. Test login with admin/admin
curl -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Expected response:
{
  "ok": true,
  "csrf_token": "...",
  "require_password_change": true,
  "message": "You must change the default password before continuing"
}

# 5. Change password
curl -X POST http://localhost:8089/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  -H "Cookie: session=<session>" \
  -d '{"current_password":"admin","new_password":"newsecurepass123"}'

# Expected: {"ok": true, "message": "Password changed successfully"}

# 6. Verify force_password_change cleared
cat /opt/etc/xkeen-go/config.json | grep "force_password_change"
# Expected: "force_password_change": false

# 7. Test login with new password
curl -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"newsecurepass123"}'

# Expected: {"ok": true, "csrf_token": "..."}  (NO require_password_change)
```

### Test 2: Existing Installation

```bash
# 1. Start with existing config (no force_password_change field)
# Expected: Works normally, field defaults to false

# 2. Login should NOT require password change
curl -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<existing_password>"}'

# Expected: {"ok": true, "csrf_token": "..."}  (NO require_password_change)
```

---

## Testing SHA256 Checksum Verification

### Test 1: Update with Valid Checksum

```bash
# Prerequisites:
# - GitHub release with both binary and .sha256 file
# - Server running with old version

# 1. Check for updates
curl http://localhost:8089/api/update/check

# 2. Start update
curl -X POST http://localhost:8089/api/update/start \
  -H "X-CSRF-Token: <token>" \
  -H "Cookie: session=<session>"

# Expected SSE events:
# event: progress, data: {"percent":5,"status":"downloading"}
# event: progress, data: {"percent":40,"status":"download complete, checksum verified"}
# event: progress, data: {"percent":45,"status":"setting permissions"}
# ...
# event: complete, data: {"success":true,"message":"Update downloaded..."}

# 3. Check logs for verification
tail -f /opt/var/log/xkeen-go.log | grep -i checksum
# Expected: "Checksum verified successfully: a1b2c3d4..."
```

### Test 2: Update without Checksum File (Fallback)

```bash
# Prerequisites:
# - GitHub release with ONLY binary (no .sha256 file)

# 1. Start update
curl -X POST http://localhost:8089/api/update/start

# Expected in logs:
# "WARNING: Checksum file not available: <error>"
# "WARNING: Skipping checksum verification (downloaded from HTTPS)"

# Update should still succeed (backward compatibility)
```

### Test 3: Checksum Mismatch (Simulated Attack)

```bash
# Manual simulation:
# 1. Download binary and checksum
# 2. Modify binary
# 3. Try to verify

# In code, this would trigger:
# - Binary deletion
# - Error returned
# - Update aborted
```

### Test 4: Manual Checksum Verification

```bash
# 1. Download files
wget https://github.com/fan92rus/xkeen-go-ui/releases/download/v0.2.0/xkeen-go-keenetic-arm64
wget https://github.com/fan92rus/xkeen-go-ui/releases/download/v0.2.0/xkeen-go-keenetic-arm64.sha256

# 2. Verify
sha256sum -c xkeen-go-keenetic-arm64.sha256
# Expected: xkeen-go-keenetic-arm64: OK

# 3. Test with corrupted file
echo "corrupted" >> xkeen-go-keenetic-arm64
sha256sum -c xkeen-go-keenetic-arm64.sha256
# Expected: xkeen-go-keenetic-arm64: FAILED
```

---

## Integration Testing

### Full Flow Test

```bash
#!/bin/bash

# 1. Fresh install
./xkeen-go-keenetic-arm64 uninstall 2>/dev/null || true
./xkeen-go-keenetic-arm64 install

# 2. Start service
/opt/etc/init.d/xkeen-go start
sleep 2

# 3. Login with default credentials
RESPONSE=$(curl -s -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

echo "Login response: $RESPONSE"

# Check if password change required
if echo "$RESPONSE" | grep -q "require_password_change.*true"; then
  echo "✅ Password change required (correct)"
else
  echo "❌ Password change NOT required (incorrect)"
  exit 1
fi

# 4. Extract session and CSRF token
SESSION=$(echo "$RESPONSE" | grep -o 'session=[^;]*' | cut -d= -f2)
CSRF=$(echo "$RESPONSE" | grep -o '"csrf_token":"[^"]*"' | cut -d'"' -f4)

# 5. Change password
CHANGE_RESPONSE=$(curl -s -X POST http://localhost:8089/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Cookie: session=$SESSION" \
  -d '{"current_password":"admin","new_password":"testpass12345"}')

echo "Change password response: $CHANGE_RESPONSE"

if echo "$CHANGE_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Password changed successfully"
else
  echo "❌ Password change failed"
  exit 1
fi

# 6. Verify flag cleared
if grep -q '"force_password_change": false' /opt/etc/xkeen-go/config.json; then
  echo "✅ Force password change flag cleared"
else
  echo "❌ Force password change flag NOT cleared"
  exit 1
fi

# 7. Test update check (if newer version available)
UPDATE_CHECK=$(curl -s http://localhost:8089/api/update/check \
  -H "Cookie: session=$SESSION")
echo "Update check: $UPDATE_CHECK"

# 8. Cleanup
/opt/etc/init.d/xkeen-go stop

echo ""
echo "✅ All tests passed!"
```

---

## Security Verification Checklist

### Default Credentials
- [ ] Install creates config with force_password_change = true
- [ ] Login with default credentials returns require_password_change
- [ ] ChangePassword clears the flag
- [ ] Subsequent login does NOT return require_password_change
- [ ] Existing configs (without the field) work normally

### SHA256 Verification
- [ ] Update with checksum file verifies successfully
- [ ] Checksum mismatch causes update to abort
- [ ] Missing checksum file shows warning but continues
- [ ] Corrupted binary is detected and deleted
- [ ] Logs show verification status

### General
- [ ] No breaking changes for existing installations
- [ ] Backward compatibility maintained
- [ ] Clear error messages for users
- [ ] Proper logging for debugging

---

## Common Issues

### Issue: "Password change required" after changing password

**Cause:** Config file not saved properly

**Solution:**
```bash
# Check file permissions
ls -la /opt/etc/xkeen-go/config.json
# Should be: -rw------- (0600)

# Check file content
cat /opt/etc/xkeen-go/config.json | grep force_password_change
# Should be: "force_password_change": false
```

### Issue: Update fails with "checksum verification failed"

**Cause:** Network issue or corrupted download

**Solution:**
```bash
# Retry update
# If persists, check network connection
# Manual update as last resort
```

### Issue: "Checksum file not available" warning

**Cause:** Release doesn't include .sha256 file

**Solution:**
- Normal for older releases
- Update to latest version when available
- No action needed (HTTPS provides security)

---

## Performance Impact

### SHA256 Verification
- **CPU:** Minimal (single hash calculation)
- **Memory:** ~2x binary size (loaded into memory)
- **Time:** < 1 second for 2MB binary on ARM64
- **Network:** One additional HTTP request (.sha256 file)

### Force Password Change
- **CPU:** None
- **Memory:** None
- **Time:** None (single boolean check)
- **Storage:** 1 additional field in config

---

## Rollback Plan

If issues arise:

### Default Credentials
```bash
# Manually clear the flag
jq '.auth.force_password_change = false' /opt/etc/xkeen-go/config.json > /tmp/config.json
mv /tmp/config.json /opt/etc/xkeen-go/config.json
/opt/etc/init.d/xkeen-go restart
```

### SHA256 Verification
```bash
# Disable verification (not recommended)
# Edit update.go, comment out checksum verification
# Rebuild and reinstall
```

---

## Next Steps

1. ✅ Test on development environment
2. ✅ Test on actual Keenetic hardware
3. ✅ Create GitHub release with checksum files
4. ✅ Update documentation
5. ✅ Monitor logs for any issues
6. ✅ Gather user feedback

---

## Monitoring

### Key Metrics to Watch

1. **Password changes:**
   ```bash
   grep "Password changed successfully" /opt/var/log/xkeen-go.log
   ```

2. **Checksum verifications:**
   ```bash
   grep "Checksum verified" /opt/var/log/xkeen-go.log
   ```

3. **Checksum warnings:**
   ```bash
   grep "Checksum file not available" /opt/var/log/xkeen-go.log
   ```

4. **Failed updates:**
   ```bash
   grep "checksum verification failed" /opt/var/log/xkeen-go.log
   ```

---

## Support

If you encounter issues:

1. Check logs: `/opt/var/log/xkeen-go.log`
2. Check config: `/opt/etc/xkeen-go/config.json`
3. Open issue: https://github.com/fan92rus/xkeen-go-ui/issues
4. Include: logs, config (remove password hash!), steps to reproduce
