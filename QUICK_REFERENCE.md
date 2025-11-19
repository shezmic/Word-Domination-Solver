# Word Domination Solver - Quick Reference

## First Time Setup

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Unix/Mac
# OR download from https://rustup.rs/ for Windows

# 2. Run automated build
./build.sh        # Unix/Mac
build.bat         # Windows

# 3. Start server
cargo run --release --bin solver
```

## Common Commands

### Building
```bash
# Full rebuild
cargo clean && cargo build --release

# Quick rebuild (after code changes)
cargo build --release

# Build specific component
cargo build --release -p solver
cargo build --release -p protocol
```

### Running
```bash
# Run server (development)
cargo run --bin solver

# Run server (optimized)
cargo run --release --bin solver

# Run directly
./target/release/solver        # Unix
.\target\release\solver.exe    # Windows
```

### GADDAG Management
```bash
# Compile dictionary
cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag

# Force recompile
./build.sh --recompile-gaddag     # Unix
build.bat --recompile-gaddag      # Windows

# Check GADDAG size
ls -lh dictionary/lexicon.gaddag  # Unix
dir dictionary\lexicon.gaddag     # Windows
```

### Testing (when implemented)
```bash
# Run all tests
cargo test --release

# Run specific test
cargo test --release test_name

# Run with output
cargo test --release -- --nocapture
```

### Benchmarking (when implemented)
```bash
# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench bench_name

# Save baseline
cargo bench -- --save-baseline main
```

## WebSocket API Testing

### Using websocat
```bash
# Install
cargo install websocat

# Test Analyze (Greedy mode)
echo '{"Analyze":{"board_hash":0,"rack":[3,15,23,0,0,0,0],"mode":"Greedy","time_budget_ms":1000}}' | websocat ws://localhost:3000/solve

# Test Analyze (Beam mode)
echo '{"Analyze":{"board_hash":0,"rack":[3,15,23,0,0,0,0],"mode":{"Beam":{"width":50}},"time_budget_ms":5000}}' | websocat ws://localhost:3000/solve

# Test UpdateBoard
echo '{"UpdateBoard":{"board":{"letters":[0,0,0,...],"bonuses":[0,0,0,...]}}}' | websocat ws://localhost:3000/solve
```

## File Locations

```
Key Files:
  solver/src/main.rs           - Server entry point
  solver/src/api.rs            - WebSocket handlers
  solver/src/movegen.rs        - Move generation (needs work)
  solver/src/scoring.rs        - Scoring logic
  protocol/src/lib.rs          - Message types
  dictionary/lexicon.txt       - Word list (editable)
  dictionary/lexicon.gaddag    - Compiled dictionary (binary)

Documentation:
  README.md                    - Quick start guide
  SETUP.md                     - Detailed setup instructions
  IMPLEMENTATION_STATUS.md     - Current progress
  Execution Plan.md            - Complete specifications
  Execution Review.md          - Implementation guidance
  knowledge.md                 - Project knowledge base
```

## Troubleshooting

### Build Fails
```bash
# Update Rust
rustup update

# Clean and rebuild
cargo clean
cargo build --release

# Check Rust version
rustc --version  # Must be >=1.75.0
```

### GADDAG Not Found
```bash
# Compile it
cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag

# Verify it exists
test -f dictionary/lexicon.gaddag && echo "Found" || echo "Missing"  # Unix
if exist dictionary\lexicon.gaddag echo Found                        # Windows
```

### Server Won't Start
```bash
# Check if port is in use
lsof -i :3000     # Unix
netstat -ano | findstr :3000  # Windows

# Change port in solver/src/main.rs:
# "0.0.0.0:3000" -> "0.0.0.0:3001"
```

## Performance Tips

```bash
# Always use --release for production
cargo build --release
cargo run --release

# Enable native CPU optimizations
export RUSTFLAGS="-C target-cpu=native"  # Unix
set RUSTFLAGS=-C target-cpu=native        # Windows
cargo build --release

# Profile for bottlenecks
cargo install flamegraph
cargo flamegraph --bin solver
```

## Next Development Steps

1. **Install Rust** (if not done)
2. **Compile GADDAG** using build script
3. **Implement proper move generation** in `solver/src/movegen.rs`
4. **Add cross-word bonus scoring** in `solver/src/scoring.rs`
5. **Write integration tests** in `solver/tests/`
6. **Optimize with benchmarks**

See IMPLEMENTATION_STATUS.md for detailed task breakdown.
