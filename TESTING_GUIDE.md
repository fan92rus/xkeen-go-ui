# Security Fixes - Quick Testing Guide

## Quick Test (5 minutes)

### 1. Test Default Credentials Fix

```bash
# 1. Fresh install
./xkeen-go-keenetic-arm64 uninstall
./xkeen-go-keenetic-arm64 install

# 2. Check config
cat /opt/etc/xkeen-go/config.json | grep force_password_change
# Expected: "force_password_change": true

# 3. Start server
/opt/etc/init.d/xkeen-go start

# 4. Open browser: http://router-ip:8089/login

# 5. Login with admin/admin
# Expected: Shows password change form

# 6. Set new password (e.g., "testpass12345")
# Expected: "Password changed successfully! Redirecting..."

# 7. Should auto-redirect to main page
```

### 2. Test SHA256 Verification (Backend)

```bash
# 1. Check logs after login
tail -f /opt/var/log/xkeen-go.log | grep -i "checksum"

# 2. Check update endpoint
curl http://localhost:8089/api/update/check \
  -H "Cookie: session=<your-session>"

# 3. Start update (will verify checksum if available)
curl -X POST http://localhost:8089/api/update/start \
  -H "Cookie: session=<your-session>" \
  -H "X-CSRF-Token: <your-csrf-token>"

# Watch logs for:
# - "Downloading..."
# - "Checksum verified successfully: ..."
# OR
# - "WARNING: Checksum file not available"
# - "WARNING: Skipping checksum verification"
```

### 3. Verify CI/CD Changes

```bash
# 1. Make a small change andecho "// test" >> xkeen-go/main.go

# 2. Commit and push
git add .
git commit -m "test: trigger CI/CD"
git push

# 3. Check GitHub Actions
# - Go to Actions tab
# - Verify "Generate SHA256 checksum" step runs
# - Check release assets include .sha256 file

# 4. Download and verify manually
wget https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64
wget https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64.sha256
sha256sum -c xkeen-go-keenetic-arm64.sha256
# Expected: xkeen-go-keenetic-arm64: OK
```

## Integration Test

### Full Flow Test

```bash
#!/bin/bash

# Clean state
./xkeen-go-keenetic-arm64 uninstall 2>/dev/null || true

# Fresh install
./xkeen-go-keenetic-arm64 install

# Start service
/opt/etc/init.d/xkeen-go start
sleep 2

# Test login
RESPONSE=$(curl -s -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

echo "Login response:"
echo "$RESPONSE" | jq .

# Check if password change required
if echo "$RESPONSE" | grep -q "require_password_change.*true"; then
  echo "✅ Password change required (correct)"

  # Extract tokens
  CSRF=$(echo "$RESPONSE" | jq -r '.csrf_token')
  SESSION=$(echo "$RESPONSE" | grep -o 'session=[^;]*' | cut -d= -f2)

  # Change password
  CHANGE_RESP=$(curl -s -X POST http://localhost:8089/api/auth/change-password \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF" \
    -H "Cookie: session=$SESSION" \
    -d '{"current_password":"admin","new_password":"testpass12345"}')

  echo "Change password response:"
  echo "$CHANGE_RESP" | jq .

  if echo "$CHANGE_RESP" | grep -q '"ok":true'; then
    echo "✅ Password changed successfully"

    # Verify flag cleared
    if grep -q '"force_password_change": false' /opt/etc/xkeen-go/config.json; then
      echo "✅ Force password change flag cleared"
    else
      echo "❌ Force password change flag NOT cleared"
      exit 1
    fi

    # Test login with new password
    NEW_LOGIN=$(curl -s -X POST http://localhost:8089/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"testpass12345"}')

    if echo "$NEW_LOGIN" | grep -q '"ok":true'; then
      echo "✅ Login with new password successful"

      # Should NOT require password change
      if echo "$NEW_LOGIN" | grep -q "require_password_change.*true"; then
        echo "❌ Still requires password change (incorrect)"
        exit 1
      else
        echo "✅ No password change required (correct)"
      fi
    else
      echo "❌ Login with new password failed"
      exit 1
    fi
  else
    echo "❌ Password change failed"
    exit 1
  fi
else
  echo "❌ Password change NOT required (incorrect)"
  exit 1
fi

# Cleanup
/opt/etc/init.d/xkeen-go stop

echo ""
echo "✅ All tests passed!"
```

## Manual UI Test

1. **Open browser:** http://router-ip:8089/login
2. **Enter:** admin / admin
3. **Expected:** Password change form appears
4. **Set new password:** testpass12345
5. **Expected:** "Password changed successfully! Redirecting..."
6. **Expected:** Auto-redirect to main page

## Troubleshooting

### "Password change form doesn't appear"
```bash
# Check backend logs
tail -f /opt/var/log/xkeen-go.log

# Check browser console for errors
# F12 → Console

# Verify login response
curl -v -X POST http://localhost:8089/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### "Update fails with checksum error"
```bash
# Check if checksum file exists in release
curl -I https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64.sha256

# Should return 200 OK

# Manual verification
wget https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64.sha256
cat xkeen-go-keenetic-arm64.sha256
# Should show: "hash  filename"
```

### "CI/CD doesn't generate checksum"
```bash
# Check workflow logs in GitHub Actions
# Look for "Generate SHA256 checksum" step

# Verify step exists in workflow
cat .github/workflows/build.yml | grep -A 5 "Generate SHA256"
```

## Expected Results

✅ Default credentials force password change
✅ Password strength indicator works
✅ Password validation (8+ chars, match)
✅ Auto-login after password change
✅ SHA256 checksum generated in CI/CD
✅ Checksum verification during update
✅ Fallback to HTTPS-only if checksum missing
✅ All changes backward compatible
