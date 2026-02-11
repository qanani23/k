# Code Signing Guide for Kiyya Desktop

This document provides comprehensive instructions for code signing Kiyya Desktop application across all supported platforms. Code signing is **strongly recommended** for production releases to avoid security warnings and ensure users can verify the authenticity of the application.

## Table of Contents

- [Why Code Signing?](#why-code-signing)
- [Platform-Specific Requirements](#platform-specific-requirements)
- [Windows Code Signing](#windows-code-signing)
- [macOS Code Signing](#macos-code-signing)
- [Linux Code Signing](#linux-code-signing)
- [Automated Signing in CI/CD](#automated-signing-in-cicd)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Why Code Signing?

Code signing provides several critical benefits:

1. **User Trust**: Signed applications display your verified identity instead of "Unknown Publisher" warnings
2. **Security**: Users can verify the application hasn't been tampered with since signing
3. **Platform Requirements**: 
   - Windows SmartScreen filters unsigned applications
   - macOS Gatekeeper blocks unsigned applications by default (macOS 10.15+)
   - Some antivirus software flags unsigned executables
4. **Distribution**: App stores and enterprise deployment tools often require signed applications

**Without code signing:**
- Windows: Users see "Windows protected your PC" warnings
- macOS: Users must right-click and select "Open" to bypass Gatekeeper
- Linux: No immediate impact, but checksums should be provided

## Platform-Specific Requirements

### Windows

**Required:**
- Code signing certificate (.pfx or .p12 file) from a trusted Certificate Authority
- Certificate password
- SignTool (included with Windows SDK)

**Certificate Authorities:**
- DigiCert (recommended)
- Sectigo (formerly Comodo)
- GlobalSign
- SSL.com

**Cost:** $100-$500/year depending on certificate type

### macOS

**Required:**
- Apple Developer account ($99/year)
- Developer ID Application certificate
- Xcode Command Line Tools
- App-specific password for notarization

**Certificate Types:**
- **Developer ID Application**: For distribution outside Mac App Store
- **Mac App Store**: For Mac App Store distribution (different process)

### Linux

**Optional:**
- GPG key for package signing
- SHA256 checksums (minimum requirement)

**Note:** Linux users typically verify packages using checksums rather than code signatures.

## Windows Code Signing

### Step 1: Obtain a Code Signing Certificate

#### Option A: Purchase from Certificate Authority

1. **Choose a Certificate Authority** (DigiCert, Sectigo, etc.)
2. **Select certificate type:**
   - Standard Code Signing Certificate: $100-$300/year
   - EV Code Signing Certificate: $300-$500/year (recommended for immediate SmartScreen reputation)
3. **Complete identity verification** (may take 1-7 days)
4. **Download certificate** as .pfx or .p12 file

#### Option B: Self-Signed Certificate (Testing Only)

**⚠️ WARNING: Self-signed certificates will still trigger security warnings. Use only for testing.**

```powershell
# Create self-signed certificate (PowerShell as Administrator)
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Kiyya Development" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(2)

# Export certificate with password
$password = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "kiyya-dev-cert.pfx" -Password $password
```

### Step 2: Configure Tauri for Automatic Signing

Edit `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
        "digestAlgorithm": "sha256",
        "timestampUrl": "http://timestamp.digicert.com"
      }
    }
  }
}
```

**To find your certificate thumbprint:**

```powershell
# List certificates in Personal store
Get-ChildItem -Path Cert:\CurrentUser\My

# Or for a specific certificate
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*Kiyya*"}

# Copy the Thumbprint value (40-character hex string)
```

**Timestamp URLs by Certificate Authority:**
- DigiCert: `http://timestamp.digicert.com`
- Sectigo: `http://timestamp.sectigo.com`
- GlobalSign: `http://timestamp.globalsign.com`

### Step 3: Build with Automatic Signing

```bash
# Build will automatically sign if certificate is configured
npm run tauri:build
```

The installer will be signed during the build process.

### Step 4: Manual Signing (Alternative)

If automatic signing doesn't work or you prefer manual control:

```powershell
# Navigate to build output directory
cd src-tauri\target\release\bundle\msi

# Sign the installer
signtool sign `
  /f "C:\path\to\certificate.pfx" `
  /p "CERTIFICATE_PASSWORD" `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /d "Kiyya Desktop" `
  /du "https://kiyya.app" `
  Kiyya_1.0.0_x64_en-US.msi

# Verify signature
signtool verify /pa Kiyya_1.0.0_x64_en-US.msi
```

**SignTool Parameters:**
- `/f` - Certificate file path
- `/p` - Certificate password
- `/fd` - File digest algorithm (sha256)
- `/tr` - Timestamp server URL (RFC 3161)
- `/td` - Timestamp digest algorithm (sha256)
- `/d` - Description shown in signature
- `/du` - URL shown in signature
- `/pa` - Verify using default authentication

### Step 5: Verify Signature

```powershell
# Verify signature is valid
signtool verify /pa Kiyya_1.0.0_x64_en-US.msi

# View signature details
Get-AuthenticodeSignature Kiyya_1.0.0_x64_en-US.msi | Format-List *
```

**Expected output:**
```
Status        : Valid
SignerCertificate : [Certificate details]
TimeStamperCertificate : [Timestamp details]
```

### Windows SmartScreen Reputation

**Important:** Even with a valid signature, new certificates may trigger SmartScreen warnings until they build reputation.

**Building reputation:**
- EV certificates get immediate reputation
- Standard certificates need downloads/installations over time
- Typically 1,000-3,000 downloads needed
- Can take weeks to months

**Workarounds:**
- Purchase EV certificate for immediate reputation
- Submit application to Microsoft for reputation review
- Provide clear installation instructions for users

## macOS Code Signing

### Step 1: Enroll in Apple Developer Program

1. Visit https://developer.apple.com/programs/
2. Enroll as an individual or organization ($99/year)
3. Complete enrollment process (may take 1-2 days)

### Step 2: Create Certificates

#### Using Xcode (Recommended)

1. Open Xcode
2. Go to **Xcode → Preferences → Accounts**
3. Add your Apple ID
4. Select your team
5. Click **Manage Certificates**
6. Click **+** and select **Developer ID Application**
7. Certificate will be created and installed automatically

#### Using Developer Portal (Manual)

1. Visit https://developer.apple.com/account/resources/certificates
2. Click **+** to create new certificate
3. Select **Developer ID Application**
4. Follow instructions to create Certificate Signing Request (CSR)
5. Upload CSR and download certificate
6. Double-click certificate to install in Keychain

### Step 3: Configure Tauri for Automatic Signing

Edit `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
        "providerShortName": "YOUR_PROVIDER_SHORT_NAME",
        "entitlements": "entitlements.plist",
        "minimumSystemVersion": "10.13"
      }
    }
  }
}
```

**To find your signing identity:**

```bash
# List all code signing identities
security find-identity -v -p codesigning

# Look for "Developer ID Application: Your Name (TEAM_ID)"
# Copy the entire string including parentheses
```

**To find your provider short name:**

```bash
# List your team information
xcrun altool --list-providers -u "your@email.com" -p "@keychain:AC_PASSWORD"

# Use the ProviderShortname value
```

### Step 4: Create Entitlements File

Create `src-tauri/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Allow network access -->
  <key>com.apple.security.network.client</key>
  <true/>
  
  <!-- Allow network server (for local HTTP server) -->
  <key>com.apple.security.network.server</key>
  <true/>
  
  <!-- Allow file access -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  
  <!-- Hardened runtime -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

### Step 5: Build with Automatic Signing

```bash
# Build will automatically sign if identity is configured
npm run tauri:build
```

### Step 6: Manual Signing (Alternative)

If automatic signing doesn't work:

```bash
# Navigate to build output
cd src-tauri/target/release/bundle/macos

# Sign the application bundle
codesign --force \
  --options runtime \
  --deep \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --entitlements ../../../entitlements.plist \
  --timestamp \
  Kiyya.app

# Verify signature
codesign --verify --deep --strict --verbose=2 Kiyya.app
spctl --assess --type execute --verbose=4 Kiyya.app
```

### Step 7: Create Signed DMG

```bash
# Create DMG from signed app
hdiutil create -volname "Kiyya" \
  -srcfolder Kiyya.app \
  -ov \
  -format UDZO \
  Kiyya_1.0.0_x64.dmg

# Sign the DMG
codesign --force \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --timestamp \
  Kiyya_1.0.0_x64.dmg

# Verify DMG signature
codesign --verify --verbose=2 Kiyya_1.0.0_x64.dmg
```

### Step 8: Notarization (Required for macOS 10.15+)

Notarization is required for distribution outside the Mac App Store on macOS 10.15 (Catalina) and later.

#### Setup Notarization Credentials

```bash
# Create app-specific password at appleid.apple.com
# Then store in keychain
xcrun notarytool store-credentials "notarytool-profile" \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password"
```

#### Submit for Notarization

```bash
# Submit DMG for notarization
xcrun notarytool submit Kiyya_1.0.0_x64.dmg \
  --keychain-profile "notarytool-profile" \
  --wait

# This will wait for notarization to complete (usually 5-15 minutes)
```

#### Check Notarization Status

```bash
# If you didn't use --wait, check status manually
xcrun notarytool info SUBMISSION_ID \
  --keychain-profile "notarytool-profile"

# View notarization log if there are issues
xcrun notarytool log SUBMISSION_ID \
  --keychain-profile "notarytool-profile"
```

#### Staple Notarization Ticket

```bash
# Staple the notarization ticket to the DMG
xcrun stapler staple Kiyya_1.0.0_x64.dmg

# Verify stapling
xcrun stapler validate Kiyya_1.0.0_x64.dmg
spctl --assess --type open --context context:primary-signature --verbose=4 Kiyya_1.0.0_x64.dmg
```

### macOS Notarization Troubleshooting

**Common issues:**

1. **"The binary is not signed with a valid Developer ID certificate"**
   - Ensure you're using "Developer ID Application" certificate, not "Apple Development"
   - Re-sign with correct certificate

2. **"The signature does not include a secure timestamp"**
   - Add `--timestamp` flag to codesign command
   - Ensure internet connection during signing

3. **"The executable does not have the hardened runtime enabled"**
   - Add `--options runtime` to codesign command
   - Ensure entitlements file is properly configured

4. **Notarization fails with "Invalid"**
   - Check notarization log: `xcrun notarytool log SUBMISSION_ID`
   - Common causes: missing entitlements, unsigned frameworks, invalid bundle structure

## Linux Code Signing

Linux packages typically don't require code signing in the same way as Windows/macOS, but you should provide verification methods.

### Option 1: SHA256 Checksums (Minimum Requirement)

```bash
# Generate checksums for all packages
sha256sum kiyya_1.0.0_amd64.deb > SHA256SUMS
sha256sum kiyya_1.0.0_amd64.AppImage >> SHA256SUMS
sha256sum kiyya-1.0.0-1.x86_64.rpm >> SHA256SUMS

# Users verify with:
sha256sum -c SHA256SUMS
```

### Option 2: GPG Signing (Recommended)

#### Setup GPG Key

```bash
# Generate GPG key if you don't have one
gpg --full-generate-key

# Select:
# - RSA and RSA
# - 4096 bits
# - No expiration (or set expiration)
# - Your name and email

# Export public key for users
gpg --armor --export your@email.com > kiyya-public-key.asc

# Publish to keyserver
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

#### Sign Debian Packages

```bash
# Sign .deb package
dpkg-sig --sign builder kiyya_1.0.0_amd64.deb

# Verify signature
dpkg-sig --verify kiyya_1.0.0_amd64.deb

# Users verify with:
# 1. Import your public key
gpg --import kiyya-public-key.asc
# 2. Verify package
dpkg-sig --verify kiyya_1.0.0_amd64.deb
```

#### Sign RPM Packages

```bash
# Configure RPM signing in ~/.rpmmacros
echo "%_gpg_name Your Name <your@email.com>" >> ~/.rpmmacros

# Sign RPM package
rpm --addsign kiyya-1.0.0-1.x86_64.rpm

# Verify signature
rpm --checksig kiyya-1.0.0-1.x86_64.rpm

# Users verify with:
# 1. Import your public key
rpm --import kiyya-public-key.asc
# 2. Verify package
rpm --checksig kiyya-1.0.0-1.x86_64.rpm
```

#### Sign AppImage

```bash
# Create detached signature
gpg --detach-sign --armor kiyya_1.0.0_amd64.AppImage

# This creates kiyya_1.0.0_amd64.AppImage.asc

# Users verify with:
gpg --verify kiyya_1.0.0_amd64.AppImage.asc kiyya_1.0.0_amd64.AppImage
```

### Option 3: Sign Checksums File

```bash
# Create checksums
sha256sum *.deb *.AppImage *.rpm > SHA256SUMS

# Sign checksums file
gpg --clearsign SHA256SUMS

# This creates SHA256SUMS.asc

# Users verify with:
gpg --verify SHA256SUMS.asc
sha256sum -c SHA256SUMS
```

## Automated Signing in CI/CD

### GitHub Actions Example

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-sign:
    strategy:
      matrix:
        platform:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
    
    runs-on: ${{ matrix.platform.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: ${{ matrix.platform.target }}
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm run test:all
      
      # Windows signing
      - name: Setup Windows signing
        if: matrix.platform.os == 'windows-latest'
        run: |
          echo "${{ secrets.WINDOWS_CERTIFICATE }}" | base64 --decode > certificate.pfx
          echo "WINDOWS_CERTIFICATE_PATH=$PWD/certificate.pfx" >> $GITHUB_ENV
          echo "WINDOWS_CERTIFICATE_PASSWORD=${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}" >> $GITHUB_ENV
      
      # macOS signing
      - name: Setup macOS signing
        if: matrix.platform.os == 'macos-latest'
        run: |
          echo "${{ secrets.MACOS_CERTIFICATE }}" | base64 --decode > certificate.p12
          security create-keychain -p "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain
          security import certificate.p12 -k build.keychain -P "${{ secrets.MACOS_CERTIFICATE_PASSWORD }}" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain
          echo "APPLE_ID=${{ secrets.APPLE_ID }}" >> $GITHUB_ENV
          echo "APPLE_PASSWORD=${{ secrets.APPLE_PASSWORD }}" >> $GITHUB_ENV
          echo "APPLE_TEAM_ID=${{ secrets.APPLE_TEAM_ID }}" >> $GITHUB_ENV
      
      # Build application
      - name: Build application
        run: npm run tauri:build
      
      # macOS notarization
      - name: Notarize macOS app
        if: matrix.platform.os == 'macos-latest'
        run: |
          xcrun notarytool submit \
            src-tauri/target/release/bundle/dmg/*.dmg \
            --apple-id "${{ secrets.APPLE_ID }}" \
            --team-id "${{ secrets.APPLE_TEAM_ID }}" \
            --password "${{ secrets.APPLE_PASSWORD }}" \
            --wait
          xcrun stapler staple src-tauri/target/release/bundle/dmg/*.dmg
      
      # Linux checksums
      - name: Generate checksums
        if: matrix.platform.os == 'ubuntu-latest'
        run: |
          cd src-tauri/target/release/bundle
          sha256sum deb/*.deb appimage/*.AppImage > SHA256SUMS
      
      # Upload artifacts
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.platform.os }}-${{ matrix.platform.target }}
          path: |
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/release/bundle/**/*.deb
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/SHA256SUMS
      
      # Create release
      - name: Create release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/release/bundle/**/*.deb
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/SHA256SUMS
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

**Windows:**
- `WINDOWS_CERTIFICATE` - Base64-encoded .pfx file
- `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password

**macOS:**
- `MACOS_CERTIFICATE` - Base64-encoded .p12 file
- `MACOS_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_ID` - Your Apple ID email
- `APPLE_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Your team ID
- `KEYCHAIN_PASSWORD` - Temporary keychain password

**To encode certificates:**

```bash
# Windows
base64 -i certificate.pfx -o certificate.pfx.base64

# macOS
base64 -i certificate.p12 -o certificate.p12.base64
```

## Verification

### Verify Windows Signature

```powershell
# Using SignTool
signtool verify /pa Kiyya_1.0.0_x64_en-US.msi

# Using PowerShell
Get-AuthenticodeSignature Kiyya_1.0.0_x64_en-US.msi

# Check in Windows Explorer
# Right-click installer → Properties → Digital Signatures tab
```

### Verify macOS Signature

```bash
# Verify code signature
codesign --verify --deep --strict --verbose=2 Kiyya.app

# Check signature details
codesign -dv --verbose=4 Kiyya.app

# Verify Gatekeeper will accept it
spctl --assess --type execute --verbose=4 Kiyya.app

# Verify notarization
spctl --assess --type open --context context:primary-signature --verbose=4 Kiyya_1.0.0_x64.dmg

# Check stapled ticket
xcrun stapler validate Kiyya_1.0.0_x64.dmg
```

### Verify Linux Packages

```bash
# Verify checksums
sha256sum -c SHA256SUMS

# Verify GPG signature on Debian package
dpkg-sig --verify kiyya_1.0.0_amd64.deb

# Verify GPG signature on RPM package
rpm --checksig kiyya-1.0.0-1.x86_64.rpm

# Verify GPG signature on AppImage
gpg --verify kiyya_1.0.0_amd64.AppImage.asc kiyya_1.0.0_amd64.AppImage
```

## Troubleshooting

### Windows Issues

**"SignTool Error: No certificates were found that met all the given criteria"**
- Certificate not installed in correct store
- Install certificate: `certutil -user -p PASSWORD -importPFX certificate.pfx`

**"SignTool Error: The specified timestamp server either could not be reached or returned an invalid response"**
- Timestamp server is down or unreachable
- Try alternative timestamp server
- Ensure internet connection is stable

**"The digital signature of the object did not verify"**
- Certificate has expired
- Certificate was revoked
- Timestamp is invalid
- Re-sign with valid certificate

### macOS Issues

**"errSecInternalComponent" during signing**
- Keychain is locked
- Unlock keychain: `security unlock-keychain ~/Library/Keychains/login.keychain-db`

**"No identity found" error**
- Certificate not installed
- Wrong certificate type (need "Developer ID Application")
- Check installed certificates: `security find-identity -v -p codesigning`

**Notarization fails with "Invalid binary"**
- Binary not properly signed
- Missing hardened runtime
- Invalid entitlements
- Check notarization log for specific error

**"The application cannot be opened because the developer cannot be verified"**
- Application not notarized
- Notarization ticket not stapled
- User's Gatekeeper settings are strict
- Complete notarization process

### Linux Issues

**"gpg: signing failed: Inappropriate ioctl for device"**
- GPG agent not running or misconfigured
- Set GPG_TTY: `export GPG_TTY=$(tty)`
- Restart GPG agent: `gpgconf --kill gpg-agent`

**"dpkg-sig: no signature found"**
- Package not signed
- Wrong GPG key used
- Sign package with correct key

## Security Best Practices

### Certificate Storage

**DO:**
- Store certificates in secure password manager
- Use hardware security modules (HSM) for production
- Encrypt certificate files at rest
- Use strong passwords for certificate protection
- Rotate certificates before expiration

**DON'T:**
- Commit certificates to version control
- Share certificates via email or chat
- Store certificates in plain text
- Use weak passwords
- Reuse certificates across projects

### CI/CD Security

**DO:**
- Use GitHub Secrets or equivalent for credentials
- Limit access to signing secrets
- Use temporary keychains/stores in CI
- Clean up certificates after build
- Audit access to signing credentials
- Use separate certificates for CI vs manual signing

**DON'T:**
- Hardcode credentials in workflows
- Log certificate passwords
- Leave certificates in build artifacts
- Share CI credentials with developers
- Use production certificates in development

### Certificate Management

**DO:**
- Document certificate expiration dates
- Set up expiration reminders (90 days before)
- Test certificate renewal process
- Keep backup of certificates
- Document certificate passwords securely
- Maintain certificate inventory

**DON'T:**
- Let certificates expire without notice
- Lose certificate passwords
- Delete old certificates immediately (keep for verification)
- Use expired certificates
- Share certificate access unnecessarily

### Verification

**DO:**
- Verify signatures after signing
- Test signed applications on clean systems
- Document verification procedures
- Provide verification instructions to users
- Monitor for certificate revocation

**DON'T:**
- Skip verification steps
- Assume signing succeeded without checking
- Distribute unsigned builds as signed
- Ignore signature warnings

## Additional Resources

### Official Documentation

- **Windows:** [Microsoft Code Signing Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- **macOS:** [Apple Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- **Tauri:** [Tauri Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-windows)

### Tools

- **Windows:** SignTool (Windows SDK), certutil
- **macOS:** codesign, notarytool, stapler, security
- **Linux:** gpg, dpkg-sig, rpm, sha256sum

### Certificate Authorities

- **DigiCert:** https://www.digicert.com/code-signing/
- **Sectigo:** https://sectigo.com/ssl-certificates-tls/code-signing
- **GlobalSign:** https://www.globalsign.com/en/code-signing-certificate
- **SSL.com:** https://www.ssl.com/code-signing/

### Support

For code signing issues:
1. Check this documentation
2. Review platform-specific documentation
3. Check certificate authority support
4. Contact Tauri community
5. Review GitHub Issues for similar problems

## Checklist

Use this checklist before releasing:

### Windows
- [ ] Code signing certificate obtained
- [ ] Certificate installed in keychain
- [ ] Certificate thumbprint configured in tauri.conf.json
- [ ] Timestamp URL configured
- [ ] Build signed successfully
- [ ] Signature verified with SignTool
- [ ] Installer tested on clean Windows system
- [ ] No SmartScreen warnings (or documented)

### macOS
- [ ] Apple Developer account active
- [ ] Developer ID Application certificate installed
- [ ] Signing identity configured in tauri.conf.json
- [ ] Entitlements file created
- [ ] Build signed successfully
- [ ] Signature verified with codesign
- [ ] Application notarized
- [ ] Notarization ticket stapled
- [ ] DMG tested on clean macOS system
- [ ] No Gatekeeper warnings

### Linux
- [ ] SHA256 checksums generated
- [ ] Checksums file created
- [ ] GPG key created (optional)
- [ ] Packages signed with GPG (optional)
- [ ] Public key published
- [ ] Verification instructions provided
- [ ] Packages tested on target distributions

### General
- [ ] All signatures verified
- [ ] Verification instructions documented
- [ ] Release notes include signature information
- [ ] Users can verify authenticity
- [ ] Certificates backed up securely
- [ ] Expiration dates documented
- [ ] Renewal process documented

---

**Last Updated:** 2024
**Version:** 1.0.0
**Maintainer:** Kiyya Development Team
