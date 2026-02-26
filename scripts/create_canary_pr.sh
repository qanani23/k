#!/bin/bash
# Canary PR Creation Script
# Purpose: Create canary PR branch with all proposed deletions for verification
# DO NOT MERGE - This is for verification only

set -e

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function write_success() { echo -e "${GREEN}✅ $1${NC}"; }
function write_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
function write_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function write_error() { echo -e "${RED}❌ $1${NC}"; }

function show_help() {
    cat << EOF
Canary PR Creation Script
==========================

Purpose: Create a canary PR branch with all proposed deletions for verification.
         This PR should NOT be merged - it's for verification only.

Usage:
    ./scripts/create_canary_pr.sh [--dry-run] [--help]

Options:
    --dry-run   Show what would be done without making changes
    --help      Show this help message

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

EOF
}

DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            write_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

write_info "Canary PR Creation Script"
write_info "=========================="
echo ""

if [ "$DRY_RUN" = true ]; then
    write_warning "DRY RUN MODE - No changes will be made"
    echo ""
fi

# Step 1: Verify git status
write_info "Step 1: Verifying git status..."

if [ -n "$(git status --porcelain)" ]; then
    write_error "Git working directory is not clean. Please commit or stash changes first."
    echo ""
    echo "Uncommitted changes:"
    git status --short
    exit 1
fi

write_success "Git working directory is clean"
echo ""

# Step 2: Get current branch
CURRENT_BRANCH=$(git branch --show-current)
write_info "Current branch: $CURRENT_BRANCH"

# Step 3: Create canary branch
CANARY_BRANCH="feature/stabilize/phase2-canary"
write_info "Step 2: Creating canary branch: $CANARY_BRANCH"

if [ "$DRY_RUN" = false ]; then
    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/$CANARY_BRANCH"; then
        write_warning "Branch $CANARY_BRANCH already exists"
        read -p "Delete and recreate? (y/N): " response
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            git branch -D "$CANARY_BRANCH"
            write_success "Deleted existing branch"
        else
            write_error "Aborted by user"
            exit 1
        fi
    fi
    
    git checkout -b "$CANARY_BRANCH"
    write_success "Created and switched to branch: $CANARY_BRANCH"
else
    write_info "[DRY RUN] Would create branch: $CANARY_BRANCH"
fi

echo ""

# Step 4: Apply deletions
write_info "Step 3: Applying proposed deletions..."
echo ""

# Section 1: Delete dead code files
write_info "Section 1: Deleting dead code files..."

FILES_TO_DELETE=(
    "src/components/PlayerModal.refactored.tsx"
    "src/lib/player/PlayerAdapter.ts"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        write_info "  Deleting: $file"
        if [ "$DRY_RUN" = false ]; then
            rm -f "$file"
            git add "$file"
        fi
    else
        write_warning "  File not found: $file"
    fi
done

write_success "Dead code files deleted"
echo ""

# Section 2: Remove unused structs (manual edit required)
write_info "Section 2: Unused structs require manual editing..."
write_warning "  The following structs need to be manually removed:"
echo "    - src-tauri/src/error.rs: ErrorContext struct + methods"
echo "    - src-tauri/src/gateway.rs: RangeRequest struct + methods"
echo "    - src-tauri/src/gateway.rs: GatewayConfig struct"
echo "    - src-tauri/src/encryption.rs: EncryptionConfig struct"
echo "    - src-tauri/src/logging.rs: LoggingConfig struct"
echo ""

# Section 3: Remove unused methods (manual edit required)
write_info "Section 3: Unused methods require manual editing..."
write_warning "  The following methods need to be manually removed:"
echo "    - src-tauri/src/database.rs: update_content_access()"
echo "    - src-tauri/src/database.rs: invalidate_cache_before()"
echo "    - src-tauri/src/database.rs: cleanup_all()"
echo "    - src-tauri/src/database.rs: rerun_migration()"
echo "    - src-tauri/src/download.rs: get_connection()"
echo "    - src-tauri/src/download.rs: return_connection()"
echo "    - src-tauri/src/download.rs: get_content_length()"
echo "    - src-tauri/src/logging.rs: init_logging_with_config()"
echo "    - src-tauri/src/commands.rs: validate_cdn_reachability()"
echo "    - src-tauri/src/error.rs: get_error_code()"
echo ""

# Section 4: Remove unused fields (manual edit required)
write_info "Section 4: Unused fields require manual editing..."
write_warning "  The following fields need to be manually removed:"
echo "    - src-tauri/src/download.rs: DownloadManager.connection_pool"
echo "    - src-tauri/src/download.rs: DownloadManager.max_connections"
echo "    - src-tauri/src/encryption.rs: EncryptedData.encrypted_size"
echo "    - src-tauri/src/gateway.rs: GatewayClient.current_gateway"
echo "    - src-tauri/src/server.rs: LocalServer.vault_path"
echo ""

# Section 5: Remove unused constants (manual edit required)
write_info "Section 5: Unused constants require manual editing..."
write_warning "  The following constants need to be manually removed:"
echo "    - src-tauri/src/encryption.rs: KEYRING_SERVICE"
echo "    - src-tauri/src/encryption.rs: KEYRING_USER"
echo "    - src-tauri/src/encryption.rs: KEY_SIZE"
echo ""

# Section 6: Remove unused imports (manual edit required)
write_info "Section 6: Unused imports require manual editing..."
write_warning "  The following imports need to be manually removed:"
echo "    - src-tauri/src/download.rs: futures_util::StreamExt"
echo "    - src-tauri/src/gateway.rs: SecurityEvent (if not used)"
echo "    - src-tauri/src/gateway.rs: log_security_event (if not used)"
echo ""

# Section 7: Fix unused variables (manual edit required)
write_info "Section 7: Unused variables require manual editing..."
write_warning "  The following variables need to be fixed:"
echo "    - src/lib/idle.ts: Remove IdleCallback type"
echo "    - src/lib/memoryManager.ts: Remove or use 'now' variable"
echo "    - src/hooks/useContent.ts: Remove or use 'seriesKey' variable"
echo ""

write_warning "MANUAL EDITING REQUIRED"
write_info "This script has deleted the dead code files, but the remaining deletions"
write_info "require manual editing of source files. Please:"
echo ""
write_info "1. Edit the files listed above to remove unused code"
write_info "2. Run verification tests: make test"
write_info "3. Commit changes: git add . && git commit"
write_info "4. Push to remote: git push origin $CANARY_BRANCH"
write_info "5. Create PR on GitHub with label 'canary-pr-do-not-merge'"
echo ""

# Step 5: Verification instructions
write_info "Step 4: Verification instructions..."
echo ""
write_info "After manual edits, run these verification commands:"
echo ""
echo "  # Backend verification"
echo "  cd src-tauri"
echo "  cargo build"
echo "  cargo test"
echo "  cargo clippy"
echo ""
echo "  # Frontend verification"
echo "  cd .."
echo "  npm run lint"
echo "  npm test"
echo ""
echo "  # Full test suite"
echo "  make test"
echo ""

# Step 6: Commit instructions
write_info "Step 5: Commit instructions..."
echo ""
write_info "After verification passes, commit with:"
echo ""
cat << 'EOF'
  git add .
  git commit -m 'canary: Propose code deletions for verification

  DO NOT MERGE - This is a canary PR for verification only.

  Proposed deletions:
  - 2 dead code files (~937 lines)
  - 5 unused structs (~130 lines)
  - 10 unused methods (~150 lines)
  - 5 unused fields
  - 3 unused constants
  - 3 unused imports
  - 3 unused variables

  Total: ~1,247 lines of dead code

  See stabilization/CANARY_PR_DELETIONS.md for full details.
  '
EOF
echo ""

# Step 7: Push instructions
write_info "Step 6: Push instructions..."
echo ""
write_info "After commit, push with:"
echo ""
echo "  git push origin $CANARY_BRANCH"
echo ""

# Step 8: PR creation instructions
write_info "Step 7: PR creation instructions..."
echo ""
write_info "Create PR on GitHub:"
echo ""
echo "  1. Go to GitHub repository"
echo "  2. Click 'New Pull Request'"
echo "  3. Select base: main, compare: $CANARY_BRANCH"
echo "  4. Title: '[CANARY - DO NOT MERGE] Phase 2 Code Deletions Verification'"
echo "  5. Add label: 'canary-pr-do-not-merge'"
echo "  6. Add description from stabilization/CANARY_PR_DELETIONS.md"
echo "  7. Request reviews from team"
echo "  8. Wait 48 hours for CI and review"
echo ""

# Step 9: Next steps
write_info "Step 8: Next steps..."
echo ""
write_info "After 48-hour review period:"
echo ""
echo "  ✅ If all clear:"
echo "     - Create actual deletion PR"
echo "     - Apply same deletions"
echo "     - Merge to main"
echo ""
echo "  ❌ If issues found:"
echo "     - Document hidden dependencies"
echo "     - Adjust deletion plan"
echo "     - Update CANARY_PR_DELETIONS.md"
echo "     - Create new canary PR if needed"
echo ""

write_success "Canary PR creation process initiated"
echo ""
write_warning "REMEMBER: This is a CANARY PR - DO NOT MERGE"
write_info "Purpose: Verification only, allow 48 hours for review"
echo ""

if [ "$DRY_RUN" = true ]; then
    write_info "[DRY RUN] No changes were made"
    write_info "Run without --dry-run to apply changes"
fi

exit 0
