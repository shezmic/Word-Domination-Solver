# Word Domination Solver

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/word-domination-solver)
[![Status](https://img.shields.io/badge/status-stable-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A high-performance solver for Word Domination, a Scrabble-like word game.

**Status**: Production Ready ✅
**Last Updated**: January 2025

## Features

- **Fast Move Generation**: Uses GADDAG data structure for efficient word lookup
- **Beam Search**: Finds optimal moves with configurable beam width
- **WebSocket API**: Real-time analysis via WebSocket connection
- **Bonus Support**: Handles all bonus types (DL, TL, DW, TW)
- **Length Bonuses**: Automatically applies 7+ letter bonuses

## Project Structure

```
.
├── solver/          # Main solver engine (Rust)
├── protocol/        # WebSocket protocol definitions
├── ocr/            # OCR for board recognition (future)
├── dictionary/     # Word lexicon files
└── frontend/       # React frontend (future)
```

## Building

### Prerequisites

1. **Install Rust** (1.75.0 or later):
   - Windows: Download from https://rustup.rs/ and run `rustup-init.exe`
   - Linux/Mac: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
   - Verify: `cargo --version`

2. **Lexicon file**: Ensure `dictionary/lexicon.txt` exists with word list (one word per line)

### Quick Start

Use the automated build scripts:

```bash
# Unix/Mac
chmod +x build.sh
./build.sh

# Windows
build.bat
```

### Manual Build Steps

If you prefer manual control:

```bash
# 1. Compile the GADDAG dictionary (first time only)
cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag

# 2. Build the solver
cargo build --release

# 3. Run the solver server
cargo run --release --bin solver
```

The GADDAG compilation creates a ~2-5MB binary file that gets committed to the repository. After the first compilation, you only need to rebuild the solver.

The server will start on `http://localhost:3000`.

## WebSocket Protocol

### Client Messages

```rust
ClientMsg::Analyze {
    board_hash: u64,           // Board state identifier
    rack: [u8; 7],            // Player tiles (0=empty, 1-26=A-Z)
    mode: u8,                  // 0=Greedy, 1=Beam, 2=Beam+MCTS
    time_budget_ms: u16,      // Max computation time
}
```

### Server Messages

```rust
ServerMsg::Result {
    moves: Vec<ScoredMove>,    // Ranked list of moves
    confidence: f32,           // Confidence score
    compute_time_ms: u16,     // Actual computation time
}
```

## Performance

- Move generation: <10ms for typical positions
- Beam search (width=10): <50ms
- Memory usage: ~50MB (includes GADDAG)

## Configuration

Edit `solver/src/search.rs` to adjust:

- `beam_width`: Number of top moves to consider (default: 10)
- `rollout_k`: Number of moves to simulate (default: 3)
- `rollout_depth`: Simulation depth (default: 2)

## Frontend

The project includes a React TypeScript frontend for interactive use.

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3001

**Features:**
- Interactive board editor
- Rack management
- Real-time move analysis
- Multiple search modes (Greedy, Beam, Beam+MCTS)
- Move visualization

See `frontend/README.md` for detailed documentation.

## License

MIT
