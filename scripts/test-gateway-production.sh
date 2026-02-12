#!/bin/bash
# Gateway Production Test Script
# This script runs a quick production test of the gateway failover mechanism

echo "=== Gateway Production Failover Test ==="
echo ""

# Change to src-tauri directory
cd "$(dirname "$0")/../src-tauri" || exit 1

echo "Running production gateway connectivity test..."
echo "This will make real network calls to Odysee API gateways."
echo ""

# Run the connectivity test with a reasonable timeout
export RUST_LOG=info
if cargo test test_production_gateway_connectivity -- --ignored --nocapture --test-threads=1; then
    echo ""
    echo "✓ Gateway connectivity test PASSED"
    echo ""
    
    # Run the failover mechanism test
    echo "Running failover mechanism test..."
    if cargo test test_production_failover_mechanism -- --ignored --nocapture --test-threads=1; then
        echo ""
        echo "✓ Failover mechanism test PASSED"
        echo ""
        echo "=== All Production Tests PASSED ==="
    else
        echo ""
        echo "✗ Failover mechanism test FAILED"
        echo "Check the output above for details."
        exit 1
    fi
else
    echo ""
    echo "✗ Gateway connectivity test FAILED"
    echo "Check the output above for details."
    echo ""
    echo "Possible causes:"
    echo "  - No internet connection"
    echo "  - Odysee gateways are down"
    echo "  - Firewall blocking connections"
    echo "  - Rate limiting (HTTP 429)"
    exit 1
fi

echo ""
echo "Gateway logs location:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  ~/Library/Application Support/kiyya-desktop/logs/gateway.log"
else
    echo "  ~/.local/share/kiyya-desktop/logs/gateway.log"
fi
echo ""
