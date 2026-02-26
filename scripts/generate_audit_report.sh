#!/bin/bash
# Cross-platform automated audit script for Unix/Linux/macOS
# Generates comprehensive audit report for codebase stabilization

set -e

echo "=========================================="
echo "Kiyya Desktop - Automated Audit Report"
echo "=========================================="
echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""

# Create output directory
AUDIT_DIR="stabilization"
mkdir -p "$AUDIT_DIR"

# Output files
WARNINGS_FILE="$AUDIT_DIR/audit_warnings.txt"
CLIPPY_FILE="$AUDIT_DIR/audit_clippy.txt"
COMMANDS_FILE="$AUDIT_DIR/tauri_command_defs.txt"
BUILDER_FILE="$AUDIT_DIR/tauri_builder.txt"
DYNAMIC_PATTERNS_FILE="$AUDIT_DIR/dynamic_invocation_patterns.txt"
JSON_REPORT="$AUDIT_DIR/audit_report.json"

echo "Step 1: Capturing cargo build warnings..."
cd src-tauri
cargo build 2>&1 | tee "../$WARNINGS_FILE"
cd ..
echo "✓ Build warnings saved to $WARNINGS_FILE"
echo ""

echo "Step 2: Running cargo clippy..."
cd src-tauri
cargo clippy --all-targets --all-features 2>&1 | tee "../$CLIPPY_FILE"
cd ..
echo "✓ Clippy output saved to $CLIPPY_FILE"
echo ""

echo "Step 3: Discovering Tauri commands..."
if command -v rg &> /dev/null; then
    rg "#\[tauri::command\]" -n src-tauri/src/ > "$COMMANDS_FILE" 2>&1 || echo "No Tauri commands found" > "$COMMANDS_FILE"
    echo "✓ Tauri command definitions saved to $COMMANDS_FILE"
else
    echo "⚠ ripgrep (rg) not found. Skipping Tauri command discovery."
    echo "Install ripgrep: https://github.com/BurntSushi/ripgrep" > "$COMMANDS_FILE"
fi
echo ""

echo "Step 4: Finding Tauri builder registrations..."
if command -v rg &> /dev/null; then
    rg "invoke_handler\(|tauri::Builder" -n src-tauri/src/ > "$BUILDER_FILE" 2>&1 || echo "No builder registrations found" > "$BUILDER_FILE"
    echo "✓ Tauri builder registrations saved to $BUILDER_FILE"
else
    echo "⚠ ripgrep (rg) not found. Skipping builder registration discovery."
fi
echo ""

echo "Step 5: Detecting dynamic invocation patterns..."
if command -v rg &> /dev/null; then
    echo "=== Dynamic Invocation Pattern Detection ===" > "$DYNAMIC_PATTERNS_FILE"
    echo "" >> "$DYNAMIC_PATTERNS_FILE"
    
    echo "Searching for template literal patterns (fetch_\${type})..." >> "$DYNAMIC_PATTERNS_FILE"
    rg 'fetch_\$\{.*?\}' -n src/ >> "$DYNAMIC_PATTERNS_FILE" 2>&1 || echo "No template literal patterns found" >> "$DYNAMIC_PATTERNS_FILE"
    echo "" >> "$DYNAMIC_PATTERNS_FILE"
    
    echo "Searching for array join patterns (['fetch', type].join('_'))..." >> "$DYNAMIC_PATTERNS_FILE"
    rg "\[.*fetch.*\]\.join\(" -n src/ >> "$DYNAMIC_PATTERNS_FILE" 2>&1 || echo "No array join patterns found" >> "$DYNAMIC_PATTERNS_FILE"
    echo "" >> "$DYNAMIC_PATTERNS_FILE"
    
    echo "Searching for general dynamic invoke patterns..." >> "$DYNAMIC_PATTERNS_FILE"
    rg "invoke\(.*\$\{" -n src/ >> "$DYNAMIC_PATTERNS_FILE" 2>&1 || echo "No general dynamic patterns found" >> "$DYNAMIC_PATTERNS_FILE"
    
    # Check if any patterns were found
    if grep -q "src/" "$DYNAMIC_PATTERNS_FILE"; then
        echo "⚠ MANUAL REVIEW REQUIRED: Dynamic invocation patterns detected!"
        echo "   See $DYNAMIC_PATTERNS_FILE for details"
    else
        echo "✓ No dynamic invocation patterns detected"
    fi
    echo "✓ Dynamic pattern analysis saved to $DYNAMIC_PATTERNS_FILE"
else
    echo "⚠ ripgrep (rg) not found. Skipping dynamic pattern detection."
fi
echo ""

echo "Step 6: Generating structured JSON report..."
cat > "$JSON_REPORT" << 'EOF'
{
  "audit_metadata": {
    "timestamp": "",
    "platform": "unix",
    "script_version": "1.0.0"
  },
  "summary": {
    "total_warnings": 0,
    "clippy_warnings": 0,
    "tauri_commands_found": 0,
    "dynamic_patterns_found": false
  },
  "files": {
    "warnings": "",
    "clippy": "",
    "commands": "",
    "builder": "",
    "dynamic_patterns": ""
  }
}
EOF

# Update JSON with actual data
if command -v jq &> /dev/null; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    WARNING_COUNT=$(grep -c "warning:" "$WARNINGS_FILE" 2>/dev/null || echo "0")
    CLIPPY_COUNT=$(grep -c "warning:" "$CLIPPY_FILE" 2>/dev/null || echo "0")
    COMMAND_COUNT=$(grep -c "#\[tauri::command\]" "$COMMANDS_FILE" 2>/dev/null || echo "0")
    DYNAMIC_FOUND=$(grep -q "src/" "$DYNAMIC_PATTERNS_FILE" 2>/dev/null && echo "true" || echo "false")
    
    jq --arg ts "$TIMESTAMP" \
       --arg wc "$WARNING_COUNT" \
       --arg cc "$CLIPPY_COUNT" \
       --arg tc "$COMMAND_COUNT" \
       --arg df "$DYNAMIC_FOUND" \
       --arg wf "$WARNINGS_FILE" \
       --arg cf "$CLIPPY_FILE" \
       --arg cmdf "$COMMANDS_FILE" \
       --arg bf "$BUILDER_FILE" \
       --arg dpf "$DYNAMIC_PATTERNS_FILE" \
       '.audit_metadata.timestamp = $ts |
        .summary.total_warnings = ($wc | tonumber) |
        .summary.clippy_warnings = ($cc | tonumber) |
        .summary.tauri_commands_found = ($tc | tonumber) |
        .summary.dynamic_patterns_found = ($df == "true") |
        .files.warnings = $wf |
        .files.clippy = $cf |
        .files.commands = $cmdf |
        .files.builder = $bf |
        .files.dynamic_patterns = $dpf' \
       "$JSON_REPORT" > "${JSON_REPORT}.tmp" && mv "${JSON_REPORT}.tmp" "$JSON_REPORT"
    
    echo "✓ Structured JSON report saved to $JSON_REPORT"
else
    echo "⚠ jq not found. JSON report created with template data only."
    echo "   Install jq for full JSON report: https://stedolan.github.io/jq/"
fi
echo ""

echo "=========================================="
echo "Audit Report Generation Complete!"
echo "=========================================="
echo ""
echo "Output files:"
echo "  - $WARNINGS_FILE"
echo "  - $CLIPPY_FILE"
echo "  - $COMMANDS_FILE"
echo "  - $BUILDER_FILE"
echo "  - $DYNAMIC_PATTERNS_FILE"
echo "  - $JSON_REPORT"
echo ""
echo "Next steps:"
echo "  1. Review $WARNINGS_FILE for unused code"
echo "  2. Review $CLIPPY_FILE for code quality issues"
echo "  3. Check $DYNAMIC_PATTERNS_FILE for manual review items"
echo "  4. Use $JSON_REPORT for automated processing"
echo ""
