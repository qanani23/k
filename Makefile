# Makefile for Kiyya Desktop Stabilization
# Cross-platform build automation

.PHONY: help build-backend build-frontend build test clean audit snapshot format check-format coverage security-audit ipc-smoke validate-workflow test-backup-restore

# Default target
help:
	@echo "Kiyya Desktop - Stabilization Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  build-backend       - Build Rust backend (cargo build)"
	@echo "  build-frontend      - Build frontend (npm run build)"
	@echo "  build               - Build both backend and frontend"
	@echo "  test                - Run all tests (backend + frontend lint)"
	@echo "  clean               - Clean build artifacts"
	@echo "  audit               - Generate audit report"
	@echo "  snapshot            - Create database backup"
	@echo "  test-backup-restore - Test backup creation and restoration"
	@echo "  format              - Format code (Rust + JS/TS)"
	@echo "  check-format        - Check code formatting without changes"
	@echo "  coverage            - Measure test coverage"
	@echo "  security-audit      - Run security audit (cargo audit)"
	@echo "  ipc-smoke           - Run IPC smoke test"
	@echo "  validate-workflow   - Validate GitHub Actions workflow"
	@echo ""

# Build targets
build-backend:
	@echo "Building Rust backend..."
	cd src-tauri && cargo build

build-frontend:
	@echo "Building frontend..."
	npm run build

build: build-backend build-frontend
	@echo "Build complete!"

# Test targets
test:
	@echo "Running backend tests..."
	cd src-tauri && cargo test
	@echo "Running frontend lint..."
	npm run lint
	@echo "All tests passed!"

# Clean target
clean:
	@echo "Cleaning build artifacts..."
	cd src-tauri && cargo clean
	@echo "Cleaning node_modules and dist..."
	@if exist node_modules rmdir /s /q node_modules 2>nul || rm -rf node_modules
	@if exist dist rmdir /s /q dist 2>nul || rm -rf dist
	@echo "Clean complete!"

# Audit target
audit:
	@echo "Generating audit report..."
	@if exist scripts\generate_audit_report.ps1 (powershell -ExecutionPolicy Bypass -File scripts\generate_audit_report.ps1) else (bash scripts/generate_audit_report.sh)
	@echo "Audit report generated!"

# Snapshot target
snapshot:
	@echo "Creating database backup..."
	@if exist scripts\db_snapshot.ps1 (powershell -ExecutionPolicy Bypass -File scripts\db_snapshot.ps1) else (bash scripts/db_snapshot.sh)
	@echo "Database backup created!"

# Format targets
format:
	@echo "Formatting Rust code..."
	cd src-tauri && cargo fmt
	@echo "Formatting frontend code..."
	npm run format || npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}"
	@echo "Code formatting complete!"

check-format:
	@echo "Checking Rust code formatting..."
	cd src-tauri && cargo fmt -- --check
	@echo "Checking frontend code formatting..."
	npm run format:check || npx prettier --check "src/**/*.{js,jsx,ts,tsx,json,css,md}"
	@echo "Format check complete!"

# Coverage target
coverage:
	@echo "Measuring test coverage..."
	@echo "Installing cargo-tarpaulin if needed..."
	@cargo tarpaulin --version 2>nul || cargo install cargo-tarpaulin
	@echo "Running coverage measurement..."
	cd src-tauri && cargo tarpaulin --out Xml --out Html --output-dir ../stabilization
	@echo "Coverage report generated in stabilization/tarpaulin-report.html"

# Security audit target
security-audit:
	@echo "Running security audit..."
	cd src-tauri && cargo audit
	@echo "Security audit complete!"

# IPC smoke test target
ipc-smoke:
	@echo "Running IPC smoke test..."
	@if exist scripts\ipc_smoke_test.js (node scripts/ipc_smoke_test.js) else if exist scripts\ipc_smoke_test.ps1 (powershell -ExecutionPolicy Bypass -File scripts\ipc_smoke_test.ps1) else (bash scripts/ipc_smoke_test.sh)
	@echo "IPC smoke test complete!"

# Workflow validation target
validate-workflow:
	@echo "Validating GitHub Actions workflow..."
	@if exist scripts\validate-workflow.js (node scripts/validate-workflow.js) else (echo "Workflow validation script not found")
	@echo "Workflow validation complete!"

# Backup restoration test target
test-backup-restore:
	@echo "Testing backup creation and restoration..."
	@if exist scripts\test_backup_restore.js (node scripts/test_backup_restore.js) else (echo "Backup restore test script not found")
	@echo "Backup restoration test complete!"
