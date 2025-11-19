# Word Domination Solver - Setup Guide

## Prerequisites

### 1. Install Rust Toolchain

The project requires Rust 1.75.0 or later.

**Windows:**
```powershell
# Download and run rustup-init.exe from https://rustup.rs/
# Or use winget:
winget install Rustlang.Rustup
```

**Linux/macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Verify Installation:**
```bash
cargo --version  # Should show 1.75.0 or later
rustc --version
```

### 2. Prepare Word Dictionary

Ensure `dictionary/lexicon.txt` contains your word list (one word per line, uppercase).

The provided sample has 10 words. For production, use:
- TWL06 (Tournament Word List)
- OSPD (Official Scrabble Players Dictionary)
- Or any custom word list (2-9 letters per word)

## Build Process

### Step 1: Compile GADDAG Dictionary

**CRITICAL**: This must be done first and only once (unless dictionary changes).

```bash
cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag
```

**Expected Output:**
```
Reading lexicon from dictionary/lexicon.txt...
Inserted 10 words
GADDAG has 45 nodes
Writing 408 bytes to dictionary/lexicon.gaddag...
Done!
```

**Validation:**
```bash
# Check file was created (should be 2-5MB for full dictionary)
ls -lh dictionary/lexicon.gaddag  # Unix
dir dictionary\lexicon.gaddag     # Windows
```

### Step 2: Build Solver

```bash
cargo build --release
```

**Expected Output:**
```
   Compiling protocol v0.1.0
   Compiling word-domination-solver v0.1.0
    Finished release [optimized] target(s) in X.XXs
```

### Step 3: Run Solver Server

```bash
cargo run --release --bin solver
```

**Expected Output:**
```
2024-01-XX...: Starting Word Domination Solver
2024-01-XX...: GADDAG loaded successfully
2024-01-XX...: Listening on 0.0.0.0:3000
```

## Testing the WebSocket API

### Using websocat (Recommended)

```bash
# Install websocat
cargo install websocat

# Test connection
echo '{"Analyze":{"board_hash":0,"rack":[3,15,23,0,0,0,0],"mode":"Greedy","time_budget_ms":1000}}' | websocat ws://localhost:3000/solve
```

### Using curl + wscat

```bash
npm install -g wscat
wscat -c ws://localhost:3000/solve
```

## Troubleshooting

### "cargo: command not found"
- Ensure Rust is installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Restart terminal after installation
- Add to PATH: `source $HOME/.cargo/env`

### "Failed to load GADDAG"
- Run Step 1 first to compile dictionary
- Check `dictionary/lexicon.gaddag` exists and is >100 bytes
- Verify `dictionary/lexicon.txt` has valid words

### "Port 3000 already in use"
- Change port in `solver/src/main.rs`: `"0.0.0.0:3001"`
- Or kill process: `lsof -ti:3000 | xargs kill` (Unix)

### Compilation Errors
- Update Rust: `rustup update`
- Clean build: `cargo clean && cargo build --release`
- Check Rust version: `rustc --version` (must be ≥1.75.0)

## Next Steps

1. **Run Integration Tests** (after implementation):
   ```bash
   cargo test --release
   ```

2. **Run Benchmarks** (after optimization):
   ```bash
   cargo bench
   ```

3. **Build Docker Image** (for deployment):
   ```bash
   docker build -t word-domination-solver .
   docker run -p 3000:3000 word-domination-solver
   ```

## Development Workflow

1. Make code changes in `solver/src/`
2. Rebuild: `cargo build --release`
3. Test: `cargo test`
4. Run: `cargo run --release --bin solver`
5. Benchmark: `cargo bench` (if performance-critical changes)

**Note**: Only recompile GADDAG if `dictionary/lexicon.txt` changes.
