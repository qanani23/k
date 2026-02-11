# Changelog

All notable changes to Kiyya Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Kiyya Desktop streaming application
- Content discovery from configured Odysee channel
- Video playback with quality selection
- Download management with offline playback
- Series organization with playlist support
- Local HTTP server for offline streaming
- Gateway failover for API resilience
- Update checking with forced update support
- Emergency disable mechanism
- Comprehensive testing suite (unit, property-based, E2E)

### Security
- Network access restricted to approved Odysee domains
- Filesystem access restricted to application data folder
- Optional AES-GCM encryption for downloads
- Input sanitization for SQL injection protection
- Security logging for audit trails

## [1.0.0] - 2024-01-01

### Added
- Initial release

