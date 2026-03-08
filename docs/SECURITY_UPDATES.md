# Security Updates - SHA256 Checksum Verification

## Overview

Starting from this version, XKEEN-GO includes **SHA256 checksum verification** for automatic updates. This provides an additional layer of security beyond HTTPS.

## How It Works

### During Auto-Update

1. **Download binary** from GitHub releases (HTTPS)
2. **Download checksum** file (.sha256) from GitHub (HTTPS)
3. **Verify checksum** matches downloaded binary
4. **Proceed with update** only if verification passes

### If Checksum Fails

- Binary is automatically deleted
- Error is shown in the UI
- Update is aborted
- User must retry or manually update

### If Checksum File Missing

- Warning is logged
- Update continues with HTTPS-only verification
- This ensures backward compatibility

## Benefits

### Protection Against

✅ **CDN Cache Poisoning** - Modified binary in CDN cache
✅ **Corporate MITM Proxy** - Malicious proxy modifying downloads
✅ **Download Corruption** - Incomplete or corrupted downloads
✅ **Partial Compromise** - Attacker modified binary but not checksum

### Does NOT Protect Against

❌ **Full Repository Compromise** - If attacker can modify both binary and checksum
❌ **Malicious Code in Source** - If bad code is merged into the repository

For protection against full repository compromise, use **GPG signatures** (see below).

## For Developers: Creating Releases

### Required Files

When creating a GitHub release, include **BOTH** files:

1. `xkeen-go-keenetic-arm64` - The binary
2. `xkeen-go-keenetic-arm64.sha256` - SHA256 checksum

### Generating Checksum

```bash
# Generate checksum
sha256sum xkeen-go-keenetic-arm64 > xkeen-go-keenetic-arm64.sha256

# Verify format (should be: "hash  filename")
cat xkeen-go-keenetic-arm64.sha256
# Output: a1b2c3d4e5f6...  xkeen-go-keenetic-arm64
```

### GitHub Actions Workflow

See `.github/workflows/release.yml.example` for automated checksum generation.

## For Users: Manual Verification

If you prefer to manually verify updates:

```bash
# 1. Download both files
wget https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64
wget https://github.com/fan92rus/xkeen-go-ui/releases/latest/download/xkeen-go-keenetic-arm64.sha256

# 2. Verify checksum
sha256sum -c xkeen-go-keenetic-arm64.sha256
# Output: xkeen-go-keenetic-arm64: OK

# 3. If OK, proceed with manual update
chmod +x xkeen-go-keenetic-arm64
./xkeen-go-keenetic-arm64 install
```

## Security Architecture

### Layer 1: HTTPS (Transport Security)
- Encrypts traffic between GitHub and your device
- Protects against passive eavesdropping
- **Already implemented** in all previous versions

### Layer 2: SHA256 Checksum (Integrity Verification)
- Verifies downloaded binary matches expected hash
- Protects against CDN poisoning, MITM proxies, corruption
- **Implemented** in this version

### Layer 3: GPG Signatures (Optional - Future)
- Cryptographic signature with developer's private key
- Protects against full repository compromise
- **Not implemented** (overkill for this project's threat model)

## Threat Model

### Assumptions

- **GitHub account** is secured with 2FA
- **HTTPS** provides adequate transport security
- **Solo maintainer** project (no multi-sig needed)
- **Local network** deployment (limited attack surface)

### Accepted Risks

- Full GitHub repository compromise (very low probability)
- Compromised build system (very low probability)
- Malicious code in source (mitigated by code review)

## Troubleshooting

### Update Fails with "checksum verification failed"

**Cause:** Downloaded binary doesn't match checksum

**Solutions:**
1. Retry update (might be temporary download issue)
2. Check network connection
3. Verify no corporate proxy is interfering
4. Manual update if problem persists

### Update Shows "Checksum file not available" Warning

**Cause:** Release doesn't include .sha256 file

**Impact:** Update proceeds with HTTPS-only verification

**Solutions:**
- This is normal for older releases
- Update to latest version when available
- No action needed (HTTPS provides adequate security)

### Manual Checksum Verification Fails

**Cause:** Binary was modified or corrupted

**Solutions:**
1. Delete both files
2. Re-download from GitHub
3. Verify checksum again
4. If still fails, report issue on GitHub

## Implementation Details

### Checksum File Format

```
<sha256-hash>  <filename>
```

Example:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456  xkeen-go-keenetic-arm64
```

### Code Location

- Verification logic: `internal/handlers/update.go`
- Function: `downloadWithChecksum()`
- Uses constant-time comparison to prevent timing attacks

### Fallback Behavior

If checksum file is not available:
1. Log warning
2. Continue with HTTPS-only download
3. No error shown to user
4. Ensures backward compatibility

## References

- [SHA256](https://en.wikipedia.org/wiki/SHA-2)
- [The Update Framework (TUF)](https://theupdateframework.io/)
- [GitHub Release Security](https://docs.github.com/en/rest/releases)

## Changelog

- **v0.2.0** - Added SHA256 checksum verification
- **v0.1.0** - Initial release (HTTPS only)
