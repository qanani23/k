#!/usr/bin/env pwsh
# Canary PR Creation Script
# Purpose: Create canary PR branch with all proposed deletions for verification
# DO NOT MERGE - This is for verification only

param(
    [switch]$DryRun = $false,
    [switch]$Help = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }

function Show-Help {
    Write-Host @"
Canary PR Creation Script
==========================

Purpose: Create a canary PR branch with all proposed deletions for verification.
         This PR should NOT be merged - it's for verification only.

Usage:
    .\scripts\create_canary_pr.ps1 [-DryRun] [-Help]

Options:
    -DryRun     Show what would be done without making changes
    -Help       Show this help message

Process:
    1. Verify git status is clean
    2. Create canary branch: feature/stabilize/phase2-canary
    3. Apply all proposed deletions
    4. Run verification tests
    5. Commit changes
    6. Push to remote (if not dry run)
    7. Display PR creation instructions

After Creation:
    - Create PR on GitHub
    - Add label: "canary-pr-do-not-merge"
    - Wait 48 hours for CI and review
    - If all clear → Create actual deletion PR
    - If issues found → Document and adjust plan

"@
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Info "Canary PR Creation Script"
Write-Info "=========================="
Write-Info ""

if ($DryRun) {
    Write-Warning "DRY RUN MODE - No changes will be made"
    Write-Info ""
}

# Step 1: Verify git status
Write-Info "Step 1: Verifying git status..."

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Error "Git working directory is not clean. Please commit or stash changes first."
    Write-Host ""
    Write-Host "Uncommitted changes:"
    git status --short
    exit 1
}

Write-Success "Git working directory is clean"
Write-Info ""

# Step 2: Get current branch
$currentBranch = git branch --show-current
Write-Info "Current branch: $currentBranch"

# Step 3: Create canary branch
$canaryBranch = "feature/stabilize/phase2-canary"
Write-Info "Step 2: Creating canary branch: $canaryBranch"

if (-not $DryRun) {
    # Check if branch already exists
    $branchExists = git branch --list $canaryBranch
    if ($branchExists) {
        Write-Warning "Branch $canaryBranch already exists"
        $response = Read-Host "Delete and recreate? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            git branch -D $canaryBranch
            Write-Success "Deleted existing branch"
        } else {
            Write-Error "Aborted by user"
            exit 1
        }
    }
    
    git checkout -b $canaryBranch
    Write-Success "Created and switched to branch: $canaryBranch"
} else {
    Write-Info "[DRY RUN] Would create branch: $canaryBranch"
}

Write-Info ""

# Step 4: Apply deletions
Write-Info "Step 3: Applying proposed deletions..."
Write-Info ""

# Section 1: Delete dead code files
Write-Info "Section 1: Deleting dead code files..."

$filesToDelete = @(
    "src/components/PlayerModal.refactored.tsx",
    "src/lib/player/PlayerAdapter.ts"
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Write-Info "  Deleting: $file"
        if (-not $DryRun) {
            Remove-Item $file -Force
            git add $file
        }
    } else {
        Write-Warning "  File not found: $file"
    }
}

Write-Success "Dead code files deleted"
Write-Info ""

# Section 2: Remove unused structs (manual edit required)
Write-Info "Section 2: Unused structs require manual editing..."
Write-Warning "  The following structs need to be manually removed:"
Write-Host "    - src-tauri/src/error.rs: ErrorContext struct + methods"
Write-Host "    - src-tauri/src/gateway.rs: RangeRequest struct + methods"
Write-Host "    - src-tauri/src/gateway.rs: GatewayConfig struct"
Write-Host "    - src-tauri/src/encryption.rs: EncryptionConfig struct"
Write-Host "    - src-tauri/src/logging.rs: LoggingConfig struct"
Write-Info ""

# Section 3: Remove unused methods (manual edit required)
Write-Info "Section 3: Unused methods require manual editing..."
Write-Warning "  The following methods need to be manually removed:"
Write-Host "    - src-tauri/src/database.rs: update_content_access()"
Write-Host "    - src-tauri/src/database.rs: invalidate_cache_before()"
Write-Host "    - src-tauri/src/database.rs: cleanup_all()"
Write-Host "    - src-tauri/src/database.rs: rerun_migration()"
Write-Host "    - src-tauri/src/download.rs: get_connection()"
Write-Host "    - src-tauri/src/download.rs: return_connection()"
Write-Host "    - src-tauri/src/download.rs: get_content_length()"
Write-Host "    - src-tauri/src/logging.rs: init_logging_with_config()"
Write-Host "    - src-tauri/src/commands.rs: validate_cdn_reachability()"
Write-Host "    - src-tauri/src/error.rs: get_error_code()"
Write-Info ""

# Section 4: Remove unused fields (manual edit required)
Write-Info "Section 4: Unused fields require manual editing..."
Write-Warning "  The following fields need to be manually removed:"
Write-Host "    - src-tauri/src/download.rs: DownloadManager.connection_pool"
Write-Host "    - src-tauri/src/download.rs: DownloadManager.max_connections"
Write-Host "    - src-tauri/src/encryption.rs: EncryptedData.encrypted_size"
Write-Host "    - src-tauri/src/gateway.rs: GatewayClient.current_gateway"
Write-Host "    - src-tauri/src/server.rs: LocalServer.vault_path"
Write-Info ""

# Section 5: Remove unused constants (manual edit required)
Write-Info "Section 5: Unused constants require manual editing..."
Write-Warning "  The following constants need to be manually removed:"
Write-Host "    - src-tauri/src/encryption.rs: KEYRING_SERVICE"
Write-Host "    - src-tauri/src/encryption.rs: KEYRING_USER"
Write-Host "    - src-tauri/src/encryption.rs: KEY_SIZE"
Write-Info ""

# Section 6: Remove unused imports (manual edit required)
Write-Info "Section 6: Unused imports require manual editing..."
Write-Warning "  The following imports need to be manually removed:"
Write-Host "    - src-tauri/src/download.rs: futures_util::StreamExt"
Write-Host "    - src-tauri/src/gateway.rs: SecurityEvent (if not used)"
Write-Host "    - src-tauri/src/gateway.rs: log_security_event (if not used)"
Write-Info ""

# Section 7: Fix unused variables (manual edit required)
Write-Info "Section 7: Unused variables require manual editing..."
Write-Warning "  The following variables need to be fixed:"
Write-Host "    - src/lib/idle.ts: Remove IdleCallback type"
Write-Host "    - src/lib/memoryManager.ts: Remove or use 'now' variable"
Write-Host "    - src/hooks/useContent.ts: Remove or use 'seriesKey' variable"
Write-Info ""

Write-Warning "MANUAL EDITING REQUIRED"
Write-Info "This script has deleted the dead code files, but the remaining deletions"
Write-Info "require manual editing of source files. Please:"
Write-Info ""
Write-Info "1. Edit the files listed above to remove unused code"
Write-Info "2. Run verification tests: make test"
Write-Info "3. Commit changes: git add . && git commit"
Write-Info "4. Push to remote: git push origin $canaryBranch"
Write-Info "5. Create PR on GitHub with label 'canary-pr-do-not-merge'"
Write-Info ""

# Step 5: Verification instructions
Write-Info "Step 4: Verification instructions..."
Write-Info ""
Write-Info "After manual edits, run these verification commands:"
Write-Info ""
Write-Host "  # Backend verification"
Write-Host "  cd src-tauri"
Write-Host "  cargo build"
Write-Host "  cargo test"
Write-Host "  cargo clippy"
Write-Host ""
Write-Host "  # Frontend verification"
Write-Host "  cd .."
Write-Host "  npm run lint"
Write-Host "  npm test"
Write-Host ""
Write-Host "  # Full test suite"
Write-Host "  make test"
Write-Info ""

# Step 6: Commit instructions
Write-Info "Step 5: Commit instructions..."
Write-Info ""
Write-Info "After verification passes, commit with:"
Write-Info ""
Write-Host "  git add ."
Write-Host "  git commit -m 'canary: Propose code deletions for verification"
Write-Host ""
Write-Host "  DO NOT MERGE - This is a canary PR for verification only."
Write-Host ""
Write-Host "  Proposed deletions:"
Write-Host "  - 2 dead code files (~937 lines)"
Write-Host "  - 5 unused structs (~130 lines)"
Write-Host "  - 10 unused methods (~150 lines)"
Write-Host "  - 5 unused fields"
Write-Host "  - 3 unused constants"
Write-Host "  - 3 unused imports"
Write-Host "  - 3 unused variables"
Write-Host ""
Write-Host "  Total: ~1,247 lines of dead code"
Write-Host ""
Write-Host "  See stabilization/CANARY_PR_DELETIONS.md for full details."
Write-Host "  '"
Write-Info ""

# Step 7: Push instructions
Write-Info "Step 6: Push instructions..."
Write-Info ""
Write-Info "After commit, push with:"
Write-Info ""
Write-Host "  git push origin $canaryBranch"
Write-Info ""

# Step 8: PR creation instructions
Write-Info "Step 7: PR creation instructions..."
Write-Info ""
Write-Info "Create PR on GitHub:"
Write-Info ""
Write-Host "  1. Go to GitHub repository"
Write-Host "  2. Click 'New Pull Request'"
Write-Host "  3. Select base: main, compare: $canaryBranch"
Write-Host "  4. Title: '[CANARY - DO NOT MERGE] Phase 2 Code Deletions Verification'"
Write-Host "  5. Add label: 'canary-pr-do-not-merge'"
Write-Host "  6. Add description from stabilization/CANARY_PR_DELETIONS.md"
Write-Host "  7. Request reviews from team"
Write-Host "  8. Wait 48 hours for CI and review"
Write-Info ""

# Step 9: Next steps
Write-Info "Step 8: Next steps..."
Write-Info ""
Write-Info "After 48-hour review period:"
Write-Info ""
Write-Host "  ✅ If all clear:"
Write-Host "     - Create actual deletion PR"
Write-Host "     - Apply same deletions"
Write-Host "     - Merge to main"
Write-Host ""
Write-Host "  ❌ If issues found:"
Write-Host "     - Document hidden dependencies"
Write-Host "     - Adjust deletion plan"
Write-Host "     - Update CANARY_PR_DELETIONS.md"
Write-Host "     - Create new canary PR if needed"
Write-Info ""

Write-Success "Canary PR creation process initiated"
Write-Info ""
Write-Warning "REMEMBER: This is a CANARY PR - DO NOT MERGE"
Write-Info "Purpose: Verification only, allow 48 hours for review"
Write-Info ""

if ($DryRun) {
    Write-Info "[DRY RUN] No changes were made"
    Write-Info "Run without -DryRun to apply changes"
}

exit 0
