# Kiyya Desktop - Windows Installation Guide

This guide provides step-by-step instructions for installing Kiyya Desktop on Windows systems.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
- [Method 1: MSI Installer (Recommended)](#method-1-msi-installer-recommended)
- [Method 2: Portable Executable](#method-2-portable-executable)
- [First Launch](#first-launch)
- [Updating Kiyya](#updating-kiyya)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Data Locations](#data-locations)

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10 (64-bit) or later
- **Processor**: Intel Core i3 or equivalent
- **Memory**: 4 GB RAM
- **Storage**: 500 MB free disk space (plus space for downloaded content)
- **Graphics**: DirectX 11 compatible graphics card
- **Internet**: Broadband internet connection for streaming

### Recommended Requirements

- **Operating System**: Windows 11 (64-bit)
- **Processor**: Intel Core i5 or equivalent
- **Memory**: 8 GB RAM or more
- **Storage**: 2 GB free disk space (plus space for downloaded content)
- **Graphics**: DirectX 12 compatible graphics card
- **Internet**: High-speed broadband connection (10 Mbps or faster)

## Installation Methods

Kiyya Desktop can be installed using two methods:

1. **MSI Installer** (Recommended) - Traditional Windows installer with automatic updates
2. **Portable Executable** - Standalone executable that doesn't require installation

## Method 1: MSI Installer (Recommended)

The MSI installer is the recommended installation method for most users. It provides automatic updates, Start Menu integration, and easy uninstallation.

### Step 1: Download the Installer

1. Visit the Kiyya releases page:
   ```
   https://github.com/YOURNAME/kiyya-releases/releases/latest
   ```

2. Under **Assets**, download the Windows installer:
   ```
   Kiyya_1.0.0_x64_en-US.msi
   ```
   
   The file size is approximately 15-20 MB.

3. **Optional**: Download the checksums file to verify the installer:
   ```
   SHA256SUMS
   ```

### Step 2: Verify the Download (Optional but Recommended)

To ensure the installer hasn't been tampered with:

1. Open PowerShell in the download folder:
   - Right-click in the folder while holding Shift
   - Select "Open PowerShell window here"

2. Calculate the checksum:
   ```powershell
   Get-FileHash Kiyya_1.0.0_x64_en-US.msi -Algorithm SHA256
   ```

3. Compare the output with the value in `SHA256SUMS` file
   - The hash values should match exactly

### Step 3: Run the Installer

1. **Locate the downloaded file** in your Downloads folder

2. **Double-click** `Kiyya_1.0.0_x64_en-US.msi` to start the installer

3. **Windows SmartScreen Warning** (if unsigned):
   - You may see "Windows protected your PC"
   - Click **"More info"**
   - Click **"Run anyway"**
   
   **Note**: This warning appears for unsigned applications. Once the application is code-signed, this warning will not appear.

4. **User Account Control (UAC) Prompt**:
   - Click **"Yes"** to allow the installer to make changes
   - This is required to install the application

### Step 4: Installation Wizard

1. **Welcome Screen**:
   - Click **"Next"** to continue

2. **License Agreement**:
   - Read the license agreement
   - Select **"I accept the terms in the License Agreement"**
   - Click **"Next"**

3. **Installation Location**:
   - Default location: `C:\Program Files\Kiyya\`
   - To change location, click **"Browse"** and select a folder
   - Ensure you have at least 500 MB free space
   - Click **"Next"**

4. **Ready to Install**:
   - Review your installation choices
   - Click **"Install"** to begin installation

5. **Installation Progress**:
   - Wait for the installation to complete (usually 30-60 seconds)
   - Do not close the installer window

6. **Completion**:
   - Check **"Launch Kiyya"** to start the application immediately
   - Click **"Finish"**

### Step 5: First Launch

See the [First Launch](#first-launch) section below.

## Method 2: Portable Executable

The portable executable is ideal for users who want to run Kiyya without installation or from a USB drive.

### Step 1: Download the Executable

1. Visit the Kiyya releases page:
   ```
   https://github.com/YOURNAME/kiyya-releases/releases/latest
   ```

2. Under **Assets**, download the portable executable:
   ```
   Kiyya.exe
   ```
   
   The file size is approximately 15-20 MB.

### Step 2: Create Application Folder

1. Create a folder for Kiyya:
   ```
   C:\Users\YourUsername\Kiyya\
   ```
   
   Or any location you prefer.

2. Move `Kiyya.exe` to this folder

### Step 3: Run the Application

1. **Double-click** `Kiyya.exe` to launch

2. **Windows SmartScreen Warning** (if unsigned):
   - You may see "Windows protected your PC"
   - Click **"More info"**
   - Click **"Run anyway"**

3. **Windows Defender Firewall**:
   - If prompted, click **"Allow access"**
   - This allows Kiyya to access the internet

### Step 4: First Launch

See the [First Launch](#first-launch) section below.

### Portable Mode Notes

- **Application data** is stored in:
  ```
  %APPDATA%\Kiyya\
  ```
  
- **Downloaded content** is stored in:
  ```
  %APPDATA%\Kiyya\vault\
  ```

- To make it fully portable, you can manually move these folders to the application directory

## First Launch

When you launch Kiyya for the first time:

### 1. Initial Setup

The application will:
- Create the application data directory
- Initialize the SQLite database
- Run database migrations
- Create the vault directory for downloads

This process takes 5-10 seconds.

### 2. Windows Defender Firewall

You may see a Windows Defender Firewall prompt:

```
Windows Defender Firewall has blocked some features of this app
```

**Action Required:**
- Check **"Private networks"** (recommended)
- Check **"Public networks"** (optional, for public Wi-Fi)
- Click **"Allow access"**

This allows Kiyya to:
- Fetch content from Odysee
- Check for application updates
- Stream video content

### 3. Application Window

The main application window will open showing:
- Navigation bar at the top
- Hero section with featured content
- Content rows organized by category
- Search functionality

### 4. Initial Content Load

The application will:
- Fetch content from the configured Odysee channel
- Display content organized by categories (Movies, Series, Sitcoms, Kids)
- Cache content locally for faster subsequent loads

This may take 10-30 seconds depending on your internet connection.

### 5. Explore the Application

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

1. **Download the latest installer** from the releases page

2. **Close Kiyya** if it's running

3. **Run the new installer**:
   - For MSI: Double-click the new `.msi` file
   - The installer will automatically upgrade the existing installation
   - Your settings and downloaded content are preserved

4. **For portable version**:
   - Download the new `Kiyya.exe`
   - Replace the old executable with the new one
   - Your data in `%APPDATA%\Kiyya\` is preserved

### Update Troubleshooting

**Update check fails:**
- Check your internet connection
- Verify you can access GitHub in your browser
- Check Windows Firewall settings

**Update download fails:**
- Ensure you have sufficient disk space
- Try downloading manually from the releases page
- Check your antivirus isn't blocking the download

## Uninstallation

### Uninstall MSI Installation

#### Method 1: Windows Settings (Windows 10/11)

1. Open **Settings** (Windows + I)
2. Go to **Apps** → **Apps & features**
3. Search for **"Kiyya"**
4. Click on **Kiyya**
5. Click **"Uninstall"**
6. Click **"Uninstall"** again to confirm
7. Follow the uninstallation wizard

#### Method 2: Control Panel

1. Open **Control Panel**
2. Go to **Programs** → **Programs and Features**
3. Find **Kiyya** in the list
4. Right-click and select **"Uninstall"**
5. Follow the uninstallation wizard

#### Method 3: Original Installer

1. Run the original `.msi` installer
2. Select **"Remove"** option
3. Follow the uninstallation wizard

### Remove Portable Installation

1. Delete the `Kiyya.exe` file
2. Delete the application folder

### Remove Application Data (Optional)

The uninstaller does not remove your application data (settings, downloads, favorites) by default. To completely remove all data:

1. Open File Explorer
2. Navigate to:
   ```
   %APPDATA%\Kiyya\
   ```
   
   Or paste this in the address bar:
   ```
   C:\Users\YourUsername\AppData\Roaming\Kiyya\
   ```

3. Delete the entire **Kiyya** folder

**Warning**: This will permanently delete:
- All downloaded videos
- Favorites list
- Playback progress
- Application settings
- Database

## Troubleshooting

### Installation Issues

#### "Windows protected your PC" warning won't go away

**Cause**: Application is not code-signed

**Solution**:
1. Click **"More info"**
2. Click **"Run anyway"**
3. If the option is not available, check your Windows SmartScreen settings:
   - Open Windows Security
   - Go to App & browser control
   - Click "Reputation-based protection settings"
   - Ensure "Check apps and files" is not set to "Block"

#### "This app can't run on your PC"

**Cause**: You're trying to run a 64-bit application on 32-bit Windows

**Solution**:
- Kiyya requires 64-bit Windows
- Check your Windows version:
  - Press Windows + Pause/Break
  - Look for "System type"
  - Must show "64-bit operating system"

#### Installation fails with error code

**Common error codes**:
- **1603**: General installation error
  - Run installer as Administrator (right-click → "Run as administrator")
  - Disable antivirus temporarily
  - Ensure sufficient disk space

- **1618**: Another installation is in progress
  - Wait for other installations to complete
  - Restart your computer
  - Try again

- **2502/2503**: Insufficient permissions
  - Run installer as Administrator
  - Check folder permissions

### Runtime Issues

#### Application won't start

**Solutions**:
1. **Check Windows Event Viewer**:
   - Press Windows + X
   - Select "Event Viewer"
   - Go to Windows Logs → Application
   - Look for Kiyya errors

2. **Run as Administrator**:
   - Right-click Kiyya shortcut
   - Select "Run as administrator"

3. **Check antivirus**:
   - Your antivirus may be blocking Kiyya
   - Add Kiyya to antivirus exceptions

4. **Reinstall**:
   - Uninstall Kiyya
   - Restart your computer
   - Install again

#### "VCRUNTIME140.dll is missing"

**Cause**: Microsoft Visual C++ Redistributable not installed

**Solution**:
1. Download Visual C++ Redistributable:
   ```
   https://aka.ms/vs/17/release/vc_redist.x64.exe
   ```

2. Run the installer
3. Restart your computer
4. Launch Kiyya again

#### Application crashes on startup

**Solutions**:
1. **Delete database** (will be recreated):
   ```
   %APPDATA%\Kiyya\kiyya.db
   ```

2. **Check logs**:
   ```
   %APPDATA%\Kiyya\logs\app.log
   ```

3. **Reset settings**:
   - Delete the entire `%APPDATA%\Kiyya\` folder
   - Restart Kiyya

#### Firewall blocks internet access

**Solution**:
1. Open **Windows Defender Firewall**
2. Click **"Allow an app through firewall"**
3. Click **"Change settings"**
4. Find **Kiyya** in the list
5. Check both **Private** and **Public** boxes
6. Click **OK**

### Performance Issues

#### Slow startup

**Solutions**:
- Disable startup programs using Task Manager
- Check for Windows updates
- Ensure sufficient free disk space (at least 2 GB)
- Run disk cleanup

#### Video playback stuttering

**Solutions**:
- Lower video quality in player settings
- Close other applications
- Update graphics drivers
- Check CPU usage in Task Manager

#### High memory usage

**Solutions**:
- Close unused tabs/content
- Restart the application
- Check for memory leaks in Task Manager
- Update to the latest version

## Data Locations

### Application Installation

**MSI Installation**:
```
C:\Program Files\Kiyya\
```

**Portable**:
```
Wherever you placed Kiyya.exe
```

### Application Data

**Main data directory**:
```
%APPDATA%\Kiyya\
```

Full path:
```
C:\Users\YourUsername\AppData\Roaming\Kiyya\
```

### Database

**SQLite database**:
```
%APPDATA%\Kiyya\kiyya.db
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
%APPDATA%\Kiyya\vault\
```

Contains:
- Downloaded videos (encrypted or unencrypted)
- Offline content metadata

### Logs

**Log files**:
```
%APPDATA%\Kiyya\logs\
```

Files:
- `app.log` - Application logs
- `gateway.log` - API gateway logs
- `download.log` - Download logs

### Temporary Files

**Temporary downloads**:
```
%APPDATA%\Kiyya\vault\*.tmp
```

These are partial downloads that will be renamed when complete.

## Advanced Configuration

### Running from Command Line

You can launch Kiyya with command-line options:

```cmd
# Launch in debug mode
Kiyya.exe --debug

# Specify custom data directory
Kiyya.exe --data-dir "D:\KiyyaData"

# Launch with specific log level
Kiyya.exe --log-level debug
```

### Environment Variables

You can set environment variables to customize behavior:

```cmd
# Set custom data directory
set KIYYA_DATA_DIR=D:\KiyyaData
Kiyya.exe

# Enable debug logging
set KIYYA_DEBUG=true
Kiyya.exe
```

### Registry Settings

Kiyya stores some settings in the Windows Registry:

```
HKEY_CURRENT_USER\Software\Kiyya
```

**Warning**: Only modify registry settings if you know what you're doing.

## Security Considerations

### Windows Defender SmartScreen

Kiyya may trigger SmartScreen warnings if not code-signed. This is normal for new applications.

**To verify the application is safe**:
1. Download only from official sources
2. Verify checksums (SHA256)
3. Check the digital signature (if signed)

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

## Getting Help

### Documentation

- **User Guide**: README.md in installation directory
- **FAQ**: Check GitHub Issues for common questions
- **Release Notes**: CHANGELOG.md for version history

### Support Channels

- **GitHub Issues**: Report bugs and request features
- **Community**: Join the Telegram channel (link in app)
- **Email**: support@kiyya.app (if configured)

### Reporting Issues

When reporting issues, include:
1. Windows version (Windows 10/11, build number)
2. Kiyya version (found in Settings → About)
3. Steps to reproduce the issue
4. Error messages or screenshots
5. Log files from `%APPDATA%\Kiyya\logs\`

## Additional Resources

- **Official Website**: https://kiyya.app (if available)
- **GitHub Repository**: https://github.com/YOURNAME/kiyya-desktop
- **Release Downloads**: https://github.com/YOURNAME/kiyya-releases/releases
- **Documentation**: https://github.com/YOURNAME/kiyya-desktop/tree/main/docs

---

**Last Updated**: 2024
**Version**: 1.0.0
**Platform**: Windows 10/11 (64-bit)
