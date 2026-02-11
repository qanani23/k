# Environment Variables Setup

This document explains the environment variables configuration for the Kiyya desktop application.

## Overview

The application uses environment variables for configuration to keep sensitive information and deployment-specific settings separate from the codebase. All environment variables are defined in the `.env` file at the project root.

## Required Environment Variables

### Core API Configuration

- **VITE_ODYSSEE_PROXY**: Primary Odysee API gateway URL
  - Format: `https://api.na-backend.odysee.com/api/v1/proxy`
  - Used for all Odysee API calls

- **VITE_CHANNEL_ID**: Odysee channel identifier for content discovery
  - Format: `@YourChannelName` (must include @ prefix)
  - This is the single source of all content in the application

- **VITE_UPDATE_MANIFEST_URL**: URL for application update checks
  - Format: `https://raw.githubusercontent.com/YOURNAME/kiyya-releases/main/version.json`
  - Must point to a public GitHub repository's raw content

### Application Metadata

- **APP_NAME** / **VITE_APP_NAME**: Application display name
  - Value: `Kiyya`
  - Used in UI and window titles

- **APP_VERSION** / **VITE_APP_VERSION**: Current application version
  - Format: Semantic versioning (e.g., `1.0.0`)
  - Must match package.json and tauri.conf.json versions

### Optional Configuration

- **VITE_TELEGRAM_LINK**: Community Telegram channel link
- **VITE_CACHE_TTL_MS**: Cache timeout in milliseconds (default: 1800000 = 30 minutes)
- **VITE_MAX_CACHE_ITEMS**: Maximum cached items (default: 200)
- **VITE_GATEWAY_FALLBACKS**: Comma-separated fallback gateway URLs
- **VITE_NETWORK_TIMEOUT_MS**: API request timeout (default: 10000ms)
- **VITE_DEFAULT_THEME**: Default UI theme (`dark` or `light`)
- **VITE_DEFAULT_VIDEO_QUALITY**: Default video quality (`480p`, `720p`, `1080p`, `auto`)

## Environment Variable Prefixes

The application uses Vite's environment variable system with the following prefixes:

- **VITE_**: Variables exposed to the frontend React application
- **TAURI_**: Variables used by the Tauri build system
- **APP_**: Legacy variables (maintained for compatibility)

## Setup Instructions

1. **Copy the template**: The `.env` file contains template values
2. **Update values**: Replace placeholder values with your actual configuration
3. **Never commit secrets**: The `.env` file should not contain real secrets in version control
4. **Use .env.local**: For local development, create a `.env.local` file with your actual values

## Validation

The application includes automated tests to validate environment variable configuration:

```bash
npm run test tests/unit/env.test.ts
```

This test verifies:
- All required variables are defined
- URL formats are correct
- Version numbers follow semantic versioning
- Boolean values are valid
- Default values are reasonable

## Security Considerations

- **No secrets in frontend**: Only VITE_ prefixed variables are exposed to the client
- **URL validation**: API URLs are validated for correct format
- **Network restrictions**: Tauri configuration restricts network access to approved domains
- **File system restrictions**: Access is limited to the application data folder

## Troubleshooting

### Variables not available in frontend
- Ensure variables have the `VITE_` prefix
- Check that the variable is defined in `.env`
- Restart the development server after changes

### Version mismatch errors
- Ensure `APP_VERSION`/`VITE_APP_VERSION` matches `package.json` and `tauri.conf.json`
- Use semantic versioning format (major.minor.patch)

### Network errors
- Verify `VITE_ODYSSEE_PROXY` URL is accessible
- Check that gateway URLs in `VITE_GATEWAY_FALLBACKS` are valid
- Ensure network restrictions in `tauri.conf.json` allow the domains

## Development vs Production

### Development
- Use `TAURI_DEBUG=true` for verbose logging
- Set `VITE_LOG_LEVEL=debug` for detailed logs
- Use local or test gateway URLs

### Production
- Set `TAURI_DEBUG=false` or remove the variable
- Use production gateway URLs
- Ensure update manifest URL points to public repository
- Verify all URLs use HTTPS