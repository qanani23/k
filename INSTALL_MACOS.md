# Kiyya Desktop - macOS Installation Guide

This guide provides step-by-step instructions for installing Kiyya Desktop on macOS systems.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
- [Method 1: DMG Installer (Recommended)](#method-1-dmg-installer-recommended)
- [Method 2: Application Bundle](#method-2-application-bundle)
- [First Launch](#first-launch)
- [Updating Kiyya](#updating-kiyya)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Data Locations](#data-locations)

## System Requirements

### Minimum Requirements

- **Operating System**: macOS 10.13 (High Sierra) or later
- **Processor**: Intel Core i3 or Apple M1
- **Memory**: 4 GB RAM
- **Storage**: 500 MB free disk space (plus space for downloaded content)
- **Graphics**: Metal-compatible graphics card
- **Internet**: Broadband internet connection for streaming

### Recommended Requirements

- **Operating System**: macOS 12 (Monterey) or later
- **Processor**: Intel Core i5 or Apple M1/M2
- **Memory**: 8 GB RAM or more
- **Storage**: 2 GB free disk space (plus space for downloaded content)
- **Graphics**: Metal 2-compatible graphics card
- **Internet**: High-speed broadband connection (10 Mbps or faster)

### Architecture Support

Kiyya Desktop is available for both Intel and Apple Silicon Macs:

- **Intel Macs**: `Kiyya_1.0.0_x64.dmg`
- **Apple Silicon (M1/M2/M3)**: `Kiyya_1.0.0_aarch64.dmg`

The application runs natively on both architectures for optimal performance.

## Installation Methods

Kiyya Desktop can be installed using two methods:

1. **DMG Installer** (Recommended) - Standard macOS disk image with drag-and-drop installation
2. **Application Bundle** - Direct `.app` bundle for advanced users

## Method 1: DMG Installer (Recommended)

The DMG installer is the recommended installation method for most users. It provides a familiar macOS installation experience.

### Step 1: Download the Installer

1. Visit the Kiyya releases page:
   ```
   https://github.com/YOURNAME/kiyya-releases/releases/latest
   ```

2. Under **Assets**, download the appropriate DMG for your Mac:
   
   **For Intel Macs**:
   ```
   Kiyya_1.0.0_x64.dmg
   ```
   
   **For Apple Silicon Macs (M1/M2/M3)**:
   ```
   Kiyya_1.0.0_aarch64.dmg
   ```
   
   The file size is approximately 12-18 MB.

3. **Optional**: Download the checksums file to verify the installer:
   ```
   SHA256SUMS
   ```

### Step 2: Verify the Download (Optional but Recommended)

To ensure the installer hasn't been tampered with:

1. Open Terminal (Applications → Utilities → Terminal)

2. Navigate to your Downloads folder:
   ```bash
   cd ~/Downloads
   ```

3. Calculate the checksum:
   ```bash
   shasum -a 256 Kiyya_1.0.0_x64.dmg
   ```
   
   Or for Apple Silicon:
   ```bash
   shasum -a 256 Kiyya_1.0.0_aarch64.dmg
   ```

4. Compare the output with the value in `SHA256SUMS` file
   - The hash values should match exactly

### Step 3: Open the DMG

1. **Locate the downloaded DMG** in your Downloads folder

2. **Double-click** the DMG file to mount it

3. A Finder window will open showing:
   - **Kiyya.app** icon
   - **Applications** folder shortcut (with arrow)

### Step 4: Install the Application

1. **Drag the Kiyya.app icon** to the **Applications** folder

2. Wait for the copy to complete (usually 5-10 seconds)

3. **Eject the DMG**:
   - Click the eject button next to "Kiyya" in Finder sidebar
   - Or drag the "Kiyya" disk icon to Trash

4. **Optional**: Delete the DMG file from Downloads to free up space

### Step 5: First Launch

See the [First Launch](#first-launch) section below.

## Method 2: Application Bundle

For advanced users who prefer to manage the application bundle directly.

### Step 1: Download the Application Bundle

1. Visit the Kiyya releases page:
   ```
   https://github.com/YOURNAME/kiyya-releases/releases/latest
   ```

2. Download the appropriate `.app.zip` file for your Mac:
   - `Kiyya_x64.app.zip` (Intel)
   - `Kiyya_aarch64.app.zip` (Apple Silicon)

### Step 2: Extract and Install

1. **Double-click** the `.zip` file to extract it

2. **Move Kiyya.app** to your Applications folder:
   ```bash
   mv ~/Downloads/Kiyya.app /Applications/
   ```

3. **Set executable permissions** (if needed):
   ```bash
   chmod +x /Applications/Kiyya.app/Contents/MacOS/Kiyya
   ```

### Step 3: First Launch

See the [First Launch](#first-launch) section below.

## First Launch

When you launch Kiyya for the first time, you'll encounter macOS security checks.

### 1. Gatekeeper Security Check

#### For Notarized Applications (Recommended)

If the application is properly notarized, you'll see:

```
"Kiyya" is an app downloaded from the Internet.
Are you sure you want to open it?
```

**Action**:
- Click **"Open"**
- The application will launch

#### For Non-Notarized Applications

If the application is not notarized, you'll see:

```
"Kiyya" cannot be opened because it is from an unidentified developer.
```

**Solution - Method 1** (Recommended):
1. Click **"OK"** to dismiss the dialog
2. Open **System Preferences** → **Security & Privacy**
3. Click the **"General"** tab
4. You'll see a message: "Kiyya was blocked from use because it is not from an identified developer"
5. Click **"Open Anyway"**
6. Click **"Open"** in the confirmation dialog

**Solution - Method 2** (Alternative):
1. Right-click (or Control-click) on **Kiyya.app** in Applications
2. Select **"Open"** from the context menu
3. Click **"Open"** in the confirmation dialog

**Solution - Method 3** (Command Line):
```bash
xattr -cr /Applications/Kiyya.app
```

Then launch the application normally.

### 2. Initial Setup

The application will:
- Create the application data directory
- Initialize the SQLite database
- Run database migrations
- Create the vault directory for downloads

This process takes 5-10 seconds.

### 3. Network Access Permission

macOS may ask for network access permission:

```
Do you want the application "Kiyya" to accept incoming network connections?
```

**Action**:
- Click **"Allow"**
- This is required for the local HTTP server that streams offline content

### 4. Application Window

The main application window will open showing:
- Navigation bar at the top
- Hero section with featured content
- Content rows organized by category
- Search functionality

### 5. Initial Content Load

The application will:
- Fetch content from the configured Odysee channel
- Display content organized by categories (Movies, Series, Sitcoms, Kids)
- Cache content locally for faster subsequent loads

This may take 10-30 seconds depending on your internet connection.

### 6. Explore the Application

You can now:
- Browse content by category
- Search for specific videos
- Play videos online
- Download videos for offline viewing
- Add content to favorites
- Adjust settings and preferences

## Updating Kiyya

Kiyya includes an automatic update checker that runs on startup.

### Automatic Update Notifications

1. **Optional Update Available**:
   - A notification appears in the top-right corner
   - Click **"Update Now"** to download the latest version
   - Or click **"Remind Me Later"** to defer for 24 hours

2. **Forced Update Required**:
   - A full-screen modal appears blocking access
   - This indicates a critical update is required
   - Click **"Update"** to open the download page
   - Or click **"Exit"** to close the application

### Manual Update Process

1. **Download the latest DMG** from the releases page

2. **Quit Kiyya** if it's running:
   - Press Cmd+Q
   - Or select Kiyya → Quit from the menu bar

3. **Open the new DMG** and drag Kiyya.app to Applications

4. **Replace the existing application**:
   - Click **"Replace"** when prompted
   - Your settings and downloaded content are preserved

5. **Launch the updated application**

### Update Troubleshooting

**Update check fails:**
- Check your internet connection
- Verify you can access GitHub in your browser
- Check macOS Firewall settings in System Preferences

**Update download fails:**
- Ensure you have sufficient disk space
- Try downloading manually from the releases page
- Check if your antivirus is blocking the download

**"Kiyya is damaged and can't be opened":**
- This may occur after updating
- Remove the quarantine attribute:
  ```bash
  xattr -cr /Applications/Kiyya.app
  ```
- Launch the application again

## Uninstallation

### Remove the Application

1. **Quit Kiyya** if it's running (Cmd+Q)

2. **Open Finder** and go to **Applications**

3. **Drag Kiyya.app to the Trash**
   - Or right-click and select "Move to Trash"

4. **Empty the Trash** to permanently delete

### Remove Application Data (Optional)

The application data (settings, downloads, favorites) is stored separately and not removed when you delete the app.

To completely remove all data:

1. **Open Finder**

2. **Press Cmd+Shift+G** (Go to Folder)

3. **Enter**:
   ```
   ~/Library/Application Support/Kiyya
   ```

4. **Delete the Kiyya folder**

**Warning**: This will permanently delete:
- All downloaded videos
- Favorites list
- Playback progress
- Application settings
- Database

### Remove Logs (Optional)

To remove log files:

1. **Press Cmd+Shift+G** in Finder

2. **Enter**:
   ```
   ~/Library/Logs/Kiyya
   ```

3. **Delete the Kiyya folder**

### Remove Preferences (Optional)

To remove application preferences:

1. **Press Cmd+Shift+G** in Finder

2. **Enter**:
   ```
   ~/Library/Preferences
   ```

3. **Delete files starting with** `com.kiyya.app`

### Complete Uninstallation Script

For a complete uninstallation, you can use this Terminal command:

```bash
# Quit the application
killall Kiyya 2>/dev/null

# Remove application
rm -rf /Applications/Kiyya.app

# Remove application data
rm -rf ~/Library/Application\ Support/Kiyya

# Remove logs
rm -rf ~/Library/Logs/Kiyya

# Remove preferences
rm -f ~/Library/Preferences/com.kiyya.app.*

# Remove caches
rm -rf ~/Library/Caches/com.kiyya.app

echo "Kiyya has been completely uninstalled"
```

## Troubleshooting

### Installation Issues

#### "Kiyya is damaged and can't be opened"

**Cause**: macOS Gatekeeper quarantine attribute

**Solution**:
```bash
xattr -cr /Applications/Kiyya.app
```

Then launch the application normally.

#### "The application cannot be opened"

**Cause**: Incorrect architecture (Intel vs Apple Silicon)

**Solution**:
1. Check your Mac's processor:
   - Click Apple menu → About This Mac
   - Look for "Chip" or "Processor"
   - Intel: Download x64 version
   - Apple Silicon (M1/M2/M3): Download aarch64 version

2. Download the correct version for your Mac

#### DMG won't mount

**Solutions**:
1. **Verify the download**:
   - Check file size matches expected size
   - Verify checksum

2. **Try mounting from Terminal**:
   ```bash
   hdiutil attach ~/Downloads/Kiyya_1.0.0_x64.dmg
   ```

3. **Re-download the DMG**:
   - The download may be corrupted
   - Clear browser cache and try again

#### "Operation not permitted" when copying to Applications

**Cause**: Insufficient permissions

**Solution**:
1. **Check Applications folder permissions**:
   - Right-click Applications → Get Info
   - Ensure you have Read & Write permissions

2. **Use Terminal to copy**:
   ```bash
   sudo cp -R /Volumes/Kiyya/Kiyya.app /Applications/
   ```

### Runtime Issues

#### Application won't start

**Solutions**:
1. **Check Console for errors**:
   - Open Console.app (Applications → Utilities)
   - Filter for "Kiyya"
   - Look for error messages

2. **Reset quarantine attributes**:
   ```bash
   xattr -cr /Applications/Kiyya.app
   ```

3. **Check permissions**:
   ```bash
   ls -la /Applications/Kiyya.app/Contents/MacOS/Kiyya
   ```
   
   Should show executable permissions (x)

4. **Reinstall**:
   - Delete Kiyya.app from Applications
   - Re-download and install

#### Application crashes on startup

**Solutions**:
1. **Delete database** (will be recreated):
   ```bash
   rm ~/Library/Application\ Support/Kiyya/kiyya.db
   ```

2. **Check crash logs**:
   ```bash
   open ~/Library/Logs/DiagnosticReports/
   ```
   
   Look for Kiyya crash reports

3. **Reset all application data**:
   ```bash
   rm -rf ~/Library/Application\ Support/Kiyya
   ```

4. **Check macOS version**:
   - Kiyya requires macOS 10.13 or later
   - Update macOS if needed

#### "Kiyya quit unexpectedly"

**Solutions**:
1. **Click "Reopen"** to try launching again

2. **Check crash report**:
   - Click "Report" to see details
   - Look for specific error messages

3. **Run from Terminal** to see error output:
   ```bash
   /Applications/Kiyya.app/Contents/MacOS/Kiyya
   ```

4. **Check for conflicting software**:
   - Antivirus software
   - VPN clients
   - Firewall applications

#### Firewall blocks internet access

**Solution**:
1. Open **System Preferences** → **Security & Privacy**
2. Click the **Firewall** tab
3. Click the lock icon and enter your password
4. Click **"Firewall Options"**
5. Click **"+"** to add an application
6. Select **Kiyya** from Applications
7. Ensure it's set to **"Allow incoming connections"**
8. Click **OK**

### Performance Issues

#### Slow startup

**Solutions**:
- Close other applications
- Check for macOS updates
- Ensure sufficient free disk space (at least 2 GB)
- Repair disk permissions:
  ```bash
  sudo diskutil repairPermissions /
  ```

#### Video playback stuttering

**Solutions**:
- Lower video quality in player settings
- Close other applications
- Update graphics drivers (if applicable)
- Check Activity Monitor for high CPU usage

#### High memory usage

**Solutions**:
- Close unused tabs/content
- Restart the application
- Check Activity Monitor for memory leaks
- Update to the latest version

### Gatekeeper Issues

#### "Apple cannot check it for malicious software"

**Cause**: Application not notarized

**Solution**:
1. Click **"Cancel"**
2. Right-click Kiyya.app → **"Open"**
3. Click **"Open"** in the confirmation dialog

Or use Terminal:
```bash
xattr -d com.apple.quarantine /Applications/Kiyya.app
```

#### Gatekeeper keeps blocking the app

**Temporary solution** (not recommended for security):
```bash
sudo spctl --master-disable
```

**Re-enable Gatekeeper** after launching:
```bash
sudo spctl --master-enable
```

## Data Locations

### Application Installation

**Standard location**:
```
/Applications/Kiyya.app
```

### Application Data

**Main data directory**:
```
~/Library/Application Support/Kiyya/
```

Full path:
```
/Users/YourUsername/Library/Application Support/Kiyya/
```

### Database

**SQLite database**:
```
~/Library/Application Support/Kiyya/kiyya.db
```

Contains:
- Content cache
- Favorites
- Playback progress
- Playlists
- Settings

### Downloaded Content

**Vault directory**:
```
~/Library/Application Support/Kiyya/vault/
```

Contains:
- Downloaded videos (encrypted or unencrypted)
- Offline content metadata

### Logs

**Log files**:
```
~/Library/Logs/Kiyya/
```

Files:
- `app.log` - Application logs
- `gateway.log` - API gateway logs
- `download.log` - Download logs

**Crash reports**:
```
~/Library/Logs/DiagnosticReports/
```

Look for files starting with `Kiyya`

### Preferences

**Application preferences**:
```
~/Library/Preferences/com.kiyya.app.plist
```

### Caches

**Application caches**:
```
~/Library/Caches/com.kiyya.app/
```

### Temporary Files

**Temporary downloads**:
```
~/Library/Application Support/Kiyya/vault/*.tmp
```

These are partial downloads that will be renamed when complete.

## Advanced Configuration

### Running from Terminal

You can launch Kiyya from Terminal with options:

```bash
# Launch normally
/Applications/Kiyya.app/Contents/MacOS/Kiyya

# Launch in debug mode
/Applications/Kiyya.app/Contents/MacOS/Kiyya --debug

# Specify custom data directory
/Applications/Kiyya.app/Contents/MacOS/Kiyya --data-dir ~/KiyyaData

# Launch with specific log level
/Applications/Kiyya.app/Contents/MacOS/Kiyya --log-level debug
```

### Environment Variables

You can set environment variables to customize behavior:

```bash
# Set custom data directory
export KIYYA_DATA_DIR=~/KiyyaData
/Applications/Kiyya.app/Contents/MacOS/Kiyya

# Enable debug logging
export KIYYA_DEBUG=true
/Applications/Kiyya.app/Contents/MacOS/Kiyya
```

### Creating a Launch Script

Create a script to launch Kiyya with custom settings:

```bash
#!/bin/bash
# Save as ~/bin/kiyya

export KIYYA_DEBUG=true
export KIYYA_LOG_LEVEL=debug
/Applications/Kiyya.app/Contents/MacOS/Kiyya "$@"
```

Make it executable:
```bash
chmod +x ~/bin/kiyya
```

Then launch with:
```bash
kiyya
```

### Accessing Hidden Library Folder

The Library folder is hidden by default in macOS. To access it:

**Method 1**: Go to Folder
1. Open Finder
2. Press **Cmd+Shift+G**
3. Enter: `~/Library`
4. Press Enter

**Method 2**: Show in Finder
1. Open Finder
2. Click **Go** menu while holding **Option** key
3. Select **Library**

**Method 3**: Make Library permanently visible
```bash
chflags nohidden ~/Library
```

## Security Considerations

### Gatekeeper and Notarization

Kiyya may trigger Gatekeeper warnings if not notarized. This is normal for new applications.

**To verify the application is safe**:
1. Download only from official sources
2. Verify checksums (SHA256)
3. Check the code signature:
   ```bash
   codesign -dv /Applications/Kiyya.app
   ```

### Code Signature Verification

To verify the application is properly signed:

```bash
# Check signature
codesign --verify --deep --strict /Applications/Kiyya.app

# View signature details
codesign -dv --verbose=4 /Applications/Kiyya.app

# Check if Gatekeeper will accept it
spctl --assess --type execute --verbose /Applications/Kiyya.app
```

### Antivirus False Positives

Some antivirus software may flag Kiyya as suspicious. This is a false positive.

**To resolve**:
1. Add Kiyya to antivirus exceptions
2. Report false positive to antivirus vendor
3. Download from official sources only

### Firewall Configuration

Kiyya requires internet access for:
- Fetching content from Odysee
- Checking for updates
- Streaming videos

**Required domains**:
- `*.odysee.com`
- `*.lbry.tv`
- `raw.githubusercontent.com` (for updates)

### Privacy and Data Collection

Kiyya does not collect or transmit:
- Personal information
- Usage statistics
- Analytics data
- Telemetry

All data stays on your Mac.

## Accessibility

### VoiceOver Support

Kiyya includes full VoiceOver support:

1. **Enable VoiceOver**:
   - Press **Cmd+F5**
   - Or go to System Preferences → Accessibility → VoiceOver

2. **Navigate the application**:
   - Use **VO+Arrow keys** to navigate
   - Press **VO+Space** to activate elements

### Keyboard Navigation

Full keyboard navigation is supported:

- **Tab**: Move between elements
- **Shift+Tab**: Move backwards
- **Space/Enter**: Activate buttons
- **Arrow keys**: Navigate lists and carousels
- **Cmd+F**: Focus search
- **Esc**: Close modals

### Reduced Motion

If you have "Reduce Motion" enabled in Accessibility settings, Kiyya will automatically disable animations.

**To enable Reduce Motion**:
1. Open **System Preferences** → **Accessibility**
2. Select **Display**
3. Check **"Reduce motion"**

## Getting Help

### Documentation

- **User Guide**: README.md in application bundle
- **FAQ**: Check GitHub Issues for common questions
- **Release Notes**: CHANGELOG.md for version history

### Support Channels

- **GitHub Issues**: Report bugs and request features
- **Community**: Join the Telegram channel (link in app)
- **Email**: support@kiyya.app (if configured)

### Reporting Issues

When reporting issues, include:
1. macOS version (e.g., macOS 13.2 Ventura)
2. Mac model and processor (Intel or Apple Silicon)
3. Kiyya version (found in Kiyya → About)
4. Steps to reproduce the issue
5. Error messages or screenshots
6. Log files from `~/Library/Logs/Kiyya/`
7. Crash reports from `~/Library/Logs/DiagnosticReports/`

### Collecting Diagnostic Information

To collect diagnostic information for support:

```bash
# Create a diagnostic bundle
mkdir ~/Desktop/kiyya-diagnostics

# Copy logs
cp -R ~/Library/Logs/Kiyya ~/Desktop/kiyya-diagnostics/

# Copy crash reports
cp ~/Library/Logs/DiagnosticReports/Kiyya* ~/Desktop/kiyya-diagnostics/ 2>/dev/null

# Get system information
system_profiler SPSoftwareDataType SPHardwareDataType > ~/Desktop/kiyya-diagnostics/system-info.txt

# Get application info
codesign -dv /Applications/Kiyya.app 2>&1 > ~/Desktop/kiyya-diagnostics/app-signature.txt

# Create archive
cd ~/Desktop
zip -r kiyya-diagnostics.zip kiyya-diagnostics/

echo "Diagnostic bundle created: ~/Desktop/kiyya-diagnostics.zip"
```

## Additional Resources

- **Official Website**: https://kiyya.app (if available)
- **GitHub Repository**: https://github.com/YOURNAME/kiyya-desktop
- **Release Downloads**: https://github.com/YOURNAME/kiyya-releases/releases
- **Documentation**: https://github.com/YOURNAME/kiyya-desktop/tree/main/docs
- **Apple Developer**: https://developer.apple.com/documentation/

## macOS Version Compatibility

| macOS Version | Codename | Supported | Notes |
|---------------|----------|-----------|-------|
| 14.x | Sonoma | ✅ Yes | Fully supported |
| 13.x | Ventura | ✅ Yes | Fully supported |
| 12.x | Monterey | ✅ Yes | Fully supported |
| 11.x | Big Sur | ✅ Yes | Fully supported |
| 10.15 | Catalina | ✅ Yes | Requires notarization |
| 10.14 | Mojave | ✅ Yes | May require workarounds |
| 10.13 | High Sierra | ⚠️ Limited | Minimum version |
| 10.12 | Sierra | ❌ No | Not supported |

---

**Last Updated**: 2024
**Version**: 1.0.0
**Platform**: macOS 10.13+ (Intel and Apple Silicon)
