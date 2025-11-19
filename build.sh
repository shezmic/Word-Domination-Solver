#!/bin/bash
set -e

echo "====================================================="
echo "Word Domination Solver - Build Script"
echo "====================================================="
echo ""

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "ERROR: Cargo not found!"
    echo ""
    echo "Please install Rust first:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "Then restart your terminal and run this script again."
    exit 1
fi

echo "✓ Rust toolchain found: $(cargo --version)"
echo ""

# Step 1: Compile GADDAG if needed
if [ ! -f "dictionary/lexicon.gaddag" ] || [ "$1" = "--recompile-gaddag" ]; then
    echo "Step 1: Compiling GADDAG dictionary..."
    echo "----------------------------------------"
    
    if [ ! -f "dictionary/lexicon.txt" ]; then
        echo "ERROR: dictionary/lexicon.txt not found!"
        exit 1
    fi
    
    cargo build --release --bin gaddag_compiler
    cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag
    
    echo ""
    echo "✓ GADDAG compiled successfully"
    echo ""
else
    echo "Step 1: Using existing GADDAG dictionary"
    echo "  (Use --recompile-gaddag to force recompilation)"
    echo ""
fi

# Step 2: Build solver
echo "Step 2: Building solver..."
echo "----------------------------------------"
cargo build --release
echo ""
echo "✓ Solver built successfully"
echo ""

# Step 3: Show next steps
echo "====================================================="
echo "Build Complete!"
echo "====================================================="
echo ""
echo "To run the solver server:"
echo "  ./target/release/solver"
echo ""
echo "Or use:"
echo "  cargo run --release --bin solver"
echo ""
echo "The server will listen on http://localhost:3000"
echo ""
