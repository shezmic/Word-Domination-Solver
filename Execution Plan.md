# Word Domination Solver — Complete Execution Specification

## 1. Game Rules & State Modeling

### 1.1 Canonical Game Parameters
The solver must enforce these immutable constants:

```rust
// board.rs
pub const BOARD_SIZE: usize = 9;
pub const RACK_SIZE: usize = 7;
pub const MATCH_ROUNDS: u8 = 5;
pub const TURN_DURATION_SECS: u8 = 75;
pub const LENGTH_BONUS_THRESHOLD: usize = 7;
pub const LENGTH_BONUS_POINTS: i16 = 50;
pub const TOTAL_TILES: u16 = 102;

// tile_distribution.rs (English set)
pub static TILE_DISTRIBUTION: [(u8, u8); 27] = [
    (0, 2),  // Blank ×2
    (1, 9),  // A ×9
    (2, 2),  // B ×2
    // ... full distribution
    (26, 1), // Z ×1
];

pub static LETTER_POINTS: [i8; 27] = [
    0,   // Blank
    1,   // A
    4,   // B
    // ... mapping: index = letter (A=1, B=2, ... Z=26)
];
```

### 1.2 Booster System Architecture
Boosters are pre-selected modifiers that transform game rules. Model as a **composition of effect traits**:

```rust
// booster.rs
pub trait BoosterEffect {
    fn modify_score(&self, base_score: i32, word: &Word) -> i32;
    fn modify_board(&self, board: &mut Board);
    fn modify_tile_bag(&self, bag: &mut TileBag);
}

pub struct BoosterStack {
    pub effects: Vec<Box<dyn BoosterEffect>>,
}

// Example concrete booster
pub struct TripleWordStackEffect;
impl BoosterEffect for TripleWordStackEffect {
    fn modify_score(&self, base_score: i32, _word: &Word) -> i32 {
        base_score * 3
    }
    // No board/bag modifications
}
```

**Integration Rule**: Apply `BoosterStack` to `Board` *before* move generation, creating a **transformed board view** that the generator treats as immutable.

---

## 2. Core Data Structures: Bit-Level Specification

### 2.1 Board Representation
Exact memory layout for cache-line optimization:

```rust
// board.rs
use std::arch::x86_64::*; // For SIMD intrinsics

#[repr(C, align(64))]
pub struct Board {
    // 9×9 = 81 cells. Pack 8 cells per u64: 81*7 bits = 567 bits → 9 u64s
    // Bits per cell: 0-5 = letter index (0-26), bit 6 = occupied flag, bit 7 = unused
    pub letters: [u64; 9],
    
    // Bonus mapping: 2 bits type + 6 bits value (multiplier or flat points)
    // Type enum: 0=None, 1=DL, 2=TL, 3=DW, 4=TW
    pub bonus_map: [u8; BOARD_SIZE * BOARD_SIZE],
    
    // Cross-checks: 26-bit mask (A-Z) for each cell + direction
    // Precompute horizontal and vertical masks separately
    pub cross_checks_h: [u32; BOARD_SIZE * BOARD_SIZE],
    pub cross_checks_v: [u32; BOARD_SIZE * BOARD_SIZE],
    
    // 81-bit anchor mask: cells where a move can start
    pub anchors: u128,
    
    // Tile bag state
    pub tile_bag: TileBag,
    
    // Dynamic bonuses active this turn (max 4 simultaneous)
    pub active_boosters: [Option<ActiveBooster>; 4],
}

#[derive(Clone, Copy)]
pub struct TileBag {
    pub counts: [u8; 27],          // 0-26 = blank + A-Z
    pub cdf: [u16; 27],            // Precomputed cumulative distribution
    pub total: u16,                // Sum of counts
}

impl Board {
    // Returns the 7-bit cell encoding at (row, col)
    #[inline(always)]
    pub fn get_cell(&self, row: u8, col: u8) -> u8 {
        let idx = (row as usize) * BOARD_SIZE + (col as usize);
        let block = idx / 8;
        let offset = (idx % 8) * 7;
        ((self.letters[block] >> offset) & 0b111_1111) as u8
    }
    
    // Hash includes letters, bonuses, and active boosters for cache invalidation
    pub fn hash(&self) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        
        for &block in &self.letters {
            block.hash(&mut hasher);
        }
        for &bonus in &self.bonus_map {
            bonus.hash(&mut hasher);
        }
        for booster in &self.active_boosters {
            booster.is_some().hash(&mut hasher);
        }
        hasher.finish()
    }
}
```

### 2.2 GADDAG Dictionary: On-Disk Format
Build at compile-time via `build.rs`. Exact file structure:

```rust
// gaddag.rs
pub const GADDAG_MAGIC: &[u8; 8] = b"WDGADDAG";
pub const GADDAG_VERSION: u32 = 1;

#[repr(C)]
pub struct GaddagHeader {
    pub magic: [u8; 8],
    pub version: u32,
    pub node_count: u32,
    pub root_offset: u32,
    pub letter_mapping: [u8; 26], // Maps A-Z to internal indices
    pub _padding: [u8; 2],
}

// Node layout: 8 bytes per node
// - Bits 0-25: edge_mask (which letters have edges)
// - Bit 26: is_terminal
// - Bits 27-31: size_flag (encodes edge list size; 0x1F = extended)
// - Bytes 4-7: child_offset or extended_list_offset (u32)
pub const NODE_SIZE: usize = 8;

pub struct Gaddag {
    pub mmap: memmap2::Mmap,
}

impl Gaddag {
    // Zero-copy traversal: returns None if letter not found
    #[inline(always)]
    pub fn traverse(&self, node_offset: usize, letter: u8) -> Option<usize> {
        if letter == 0 || letter > 26 {
            return None;
        }
        let start = node_offset;
        let node = &self.mmap[start..start + NODE_SIZE];
        let edge_mask = u32::from_le_bytes(node[0..4].try_into().unwrap());
        
        // Check if letter exists in edge mask
        if (edge_mask & (1 << (letter - 1))) == 0 {
            return None;
        }
        
        // Fast path: small node, compute offset directly
        let size_flag = edge_mask >> 27;
        if size_flag != 0x1F {
            let child_offset = u32::from_le_bytes(node[4..8].try_into().unwrap());
            return Some(child_offset as usize + ((letter - 1) as usize * 4));
        }
        
        // Extended node: binary search in edge list
        let ext_offset = u32::from_le_bytes(node[4..8].try_into().unwrap()) as usize;
        // Implementation omitted for brevity, but must be O(log n)
        unimplemented!()
    }
}
```

**Build Integration**: `build.rs` compiles lexicon at compile-time:

```rust
// build.rs
fn main() {
    let lexicon_path = env!("LEXICON_PATH");
    let out_dir = env::var("OUT_DIR").unwrap();
    let gaddag_path = format!("{}/lexicon.gaddag", out_dir);
    
    // Compile GADDAG if not exists or source newer
    if should_rebuild(lexicon_path, &gaddag_path) {
        let gaddag = GaddagCompiler::compile(lexicon_path);
        gaddag.write_to_file(&gaddag_path);
    }
    
    // Expose path as compile-time constant
    println!("cargo:rustc-env=GADDAG_PATH={}", gaddag_path);
}
```

---

## 3. Move Generation Engine

### 3.1 Generator Architecture
Generate moves in two phases: **anchor enumeration** and **GADDAG traversal**:

```rust
// movegen.rs
pub struct MoveGenerator<'a> {
    board: &'a Board,
    gaddag: &'a Gaddag,
    rack: &'a Rack,
}

impl<'a> MoveGenerator<'a> {
    pub fn generate_all(&self) -> Vec<Move> {
        let mut moves = Vec::with_capacity(100);
        
        // Iterate over anchor cells using bit operations
        let anchors = self.board.anchors;
        for pos in 0..(BOARD_SIZE * BOARD_SIZE) {
            if (anchors >> pos) & 1 == 1 {
                self.generate_at_anchor(pos as u8, Direction::Horizontal, &mut moves);
                self.generate_at_anchor(pos as u8, Direction::Vertical, &mut moves);
            }
        }
        moves
    }
    
    #[inline(always)]
    fn generate_at_anchor(&self, pos: u8, dir: Direction, moves: &mut Vec<Move>) {
        let cross_mask = match dir {
            Direction::Horizontal => self.board.cross_checks_h[pos as usize],
            Direction::Vertical => self.board.cross_checks_v[pos as usize],
        };
        
        // For each possible rack tile, traverse GADDAG
        for (rack_idx, &tile) in self.rack.tiles.iter().enumerate() {
            if tile == 0 { continue; } // Empty rack slot
            
            // Check if tile fits cross-check constraints
            if cross_mask != 0 && (cross_mask & (1 << (tile - 1))) == 0 {
                continue;
            }
            
            // GADDAG traversal: extend word from anchor in both directions
            self.extend_word(pos, dir, tile, rack_idx, self.gaddag.root_offset(), moves);
        }
    }
}
```

### 3.2 Cross-Check Computation (SIMD)
Compute entire row/column cross-checks in parallel:

```rust
// board.rs
use std::arch::x86_64::*;

impl Board {
    pub fn recompute_cross_checks_row(&mut self, row: u8) {
        let row_start = row as usize * BOARD_SIZE;
        let row_end = row_start + BOARD_SIZE;
        
        // Load row into SIMD register (16x u8)
        let mut letters = [0u8; 16];
        for (i, &cell) in self.letters[row_start..row_end].iter().enumerate() {
            letters[i] = cell & 0b11111; // Extract letter index only
        }
        
        // Compute gaps (empty cells)
        let gaps = self.find_gaps_simd(letters);
        
        // For each gap, compute valid letters using GADDAG
        unroll! { for i in 0..BOARD_SIZE {
            if gaps & (1 << i) != 0 {
                let pos = row_start + i;
                self.cross_checks_h[pos] = self.compute_cross_check_mask(pos);
            }
        }}
    }
    
    #[target_feature(enable = "avx2")]
    unsafe fn find_gaps_simd(&self, letters: [u8; 16]) -> u16 {
        let vec = _mm_loadu_si128(letters.as_ptr() as *const __m128i);
        let zeros = _mm_set1_epi8(0);
        let mask = _mm_cmpeq_epi8(vec, zeros);
        _mm_movemask_epi8(mask) as u16
    }
}
```

---

## 4. Scoring & Bonus System

### 4.1 Scoring Function
Apply bonuses in strict order: letter → word → length → booster:

```rust
// score.rs
impl Board {
    pub fn score_move(&self, mv: &Move) -> i32 {
        let mut total = 0i32;
        let mut word_multiplier = 1u8;
        let mut tiles_used = 0u8;
        
        // Iterate over placed tiles
        for &(pos, tile) in &mv.placements {
            let letter_score = LETTER_POINTS[tile as usize] as i32;
            let mut tile_score = letter_score;
            
            // Apply letter bonuses
            match self.bonus_map[pos as usize] {
                b if b & 0b11 == 1 => tile_score *= (b >> 2) as i32, // DL
                b if b & 0b11 == 2 => tile_score *= (b >> 2) as i32, // TL
                _ => {}
            }
            
            // Apply booster effects
            for booster in &self.active_boosters {
                if let Some(b) = booster {
                    tile_score = b.modify_letter_score(tile_score, pos);
                }
            }
            
            total += tile_score;
            tiles_used += 1;
            
            // Check for word bonuses on this cell
            match self.bonus_map[pos as usize] {
                b if b & 0b11 == 3 => word_multiplier *= (b >> 2) as u8, // DW
                b if b & 0b11 == 4 => word_multiplier *= (b >> 2) as u8, // TW
                _ => {}
            }
        }
        
        total *= word_multiplier as i32;
        
        // Length bonus
        if tiles_used >= LENGTH_BONUS_THRESHOLD as u8 {
            total += LENGTH_BONUS_POINTS as i32;
        }
        
        // Booster word-level effects
        for booster in &self.active_boosters {
            if let Some(b) = booster {
                total = b.modify_word_score(total, &mv.word);
            }
        }
        
        total
    }
}
```

### 4.2 Word Validation Against Dictionary
Use GADDAG to validate entire word:

```rust
impl Board {
    pub fn is_word_valid(&self, word: &str) -> bool {
        let mut node = self.gaddag.root_offset();
        
        // Forward traversal
        for ch in word.bytes() {
            let letter = (ch - b'A' + 1) as u8;
            if let Some(next) = self.gaddag.traverse(node, letter) {
                node = next;
            } else {
                return false;
            }
        }
        
        // Check terminal
        self.gaddag.is_terminal(node)
    }
}
```

---

## 5. Search Algorithm: Beam + Adaptive Rollouts

### 5.1 Beam Search Core
```rust
// search.rs
pub struct SearchConfig {
    pub beam_width: usize,
    pub rollout_k: usize,
    pub rollout_depth: u8,
    pub confidence_threshold: f32,
}

pub struct SearchResult {
    pub moves: Vec<ScoredMove>,
    pub confidence: f32,
    pub compute_time_ms: u16,
}

pub fn search(
    board: &Board,
    rack: &Rack,
    config: &SearchConfig,
    time_budget: Duration,
) -> SearchResult {
    let start = Instant::now();
    
    // Phase 1: Beam search
    let mut beam = BinaryHeap::with_capacity(config.beam_width);
    let candidates = MoveGenerator::new(board, rack).generate_all();
    
    for mv in candidates {
        let score = board.score_move(&mv);
        beam.push(ScoredMove { mv, score });
        if beam.len() > config.beam_width {
            beam.pop(); // Remove lowest
        }
    }
    
    // Phase 2: Adaptive rollouts
    let scores: Vec<i32> = beam.iter().take(3).map(|m| m.score).collect();
    let variance = population_variance(&scores);
    
    if variance > config.confidence_threshold {
        let top_moves: Vec<_> = beam.into_sorted_vec().into_iter().take(config.rollout_k).collect();
        
        // Parallel rollouts using rayon
        let rollout_results: Vec<RolloutResult> = top_moves
            .par_iter()
            .map(|sm| monte_carlo_rollout(board, rack, &sm.mv, config.rollout_depth))
            .collect();
        
        // Combine scores
        beam = top_moves.into_iter().zip(rollout_results).map(|(sm, rr)| {
            ScoredMove {
                score: sm.score + (rr.future_potential as f32 * config.rollout_weight) as i32,
                ..sm
            }
        }).collect();
    }
    
    let moves = beam.into_sorted_vec();
    SearchResult {
        confidence: 1.0 / (1.0 + variance),
        compute_time_ms: start.elapsed().as_millis() as u16,
        moves,
    }
}

#[inline(always)]
fn population_variance(values: &[i32]) -> f32 {
    if values.is_empty() { return 0.0; }
    let mean = values.iter().sum::<i32>() as f32 / values.len() as f32;
    values.iter().map(|&v| (v as f32 - mean).powi(2)).sum::<f32>() / values.len() as f32
}
```

### 5.2 Monte Carlo Rollout
```rust
fn monte_carlo_rollout(
    board: &Board,
    rack: &Rack,
    mv: &Move,
    depth: u8,
) -> RolloutResult {
    let mut board_after = board.clone();
    board_after.play_move(mv);
    
    let mut total_future = 0i32;
    let mut rng = XorShift64::new((board.hash() ^ mv.hash()) as u64);
    
    for _ in 0..depth {
        // Draw random tiles to refill rack
        let mut sim_rack = rack.clone();
        sim_rack.refill(&board_after.tile_bag, &mut rng);
        
        // Opponent move: use lightweight heuristic
        let opp_move = generate_greedy_move(&board_after, &sim_rack);
        board_after.play_move(&opp_move);
        
        // Our response
        sim_rack.refill(&board_after.tile_bag, &mut rng);
        let our_move = generate_greedy_move(&board_after, &sim_rack);
        total_future += board_after.score_move(&our_move);
    }
    
    RolloutResult {
        future_potential: total_future / depth as i32,
    }
}
```

---

## 6. OCR & Bonus Detection Pipeline

### 6.1 WASM CNN Inference
```rust
// ocr/src/lib.rs (compiled to WASM)
use tract_onnx::prelude::*;

static MODEL: &[u8] = include_bytes!("../model/tile_classifier.onnx");

pub fn recognize_tile(image: &[u8; 32*32]) -> ([f32; 27], u8) {
    let model = Model::new(MODEL).unwrap().into_optimized().unwrap();
    let input = tensor1(image).into_shape([1, 32, 32, 1]).unwrap();
    let result = model.run(input).unwrap();
    
    let confidences: [f32; 27] = result.to_array_view().unwrap().into_raw_vec().try_into().unwrap();
    let predicted = confidences.iter().enumerate().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).unwrap().0 as u8;
    (confidences, predicted)
}
```

### 6.2 Bonus Detection via HSV
```rust
// ocr/src/bonus_detection.rs
pub fn detect_bonus_color(pixels: &[u8; 5*5*3]) -> Option<BonusType> {
    let mut h_sum = 0u32;
    for chunk in pixels.chunks_exact(3) {
        let (h, _, _) = rgb_to_hsv(chunk[0], chunk[1], chunk[2]);
        h_sum += h as u32;
    }
    let avg_hue = (h_sum / 25) as u8;
    
    match avg_hue {
        30..=60 => Some(BonusType::DoubleLetter),
        240..=300 => Some(BonusType::TripleWord),
        _ => None,
    }
}
```

**Frontend Integration**:
- Canvas tile size: 32×32 captured as `ImageData`
- Pass to WASM: `Module.recognize_tile(image_data.data)`
- Confidence threshold: `< 0.9` triggers manual edit UI

---

## 7. API & WebSocket Protocol

### 7.1 Message Types (bincode-serialized)
```rust
// protocol.rs
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub enum ClientMsg {
    Analyze {
        board_hash: u64,
        rack: [u8; RACK_SIZE],      // 0 = empty slot, 1-26 = A-Z
        mode: u8,                    // 0=Greedy, 1=Beam, 2=Beam+MCTS
        time_budget_ms: u16,
    },
    Cancel,
}

#[derive(Serialize, Deserialize)]
pub enum ServerMsg {
    Progress {
        moves_evaluated: u32,
        best_score_i16: i16,
    },
    Result {
        moves: Vec<ScoredMove>,
        confidence: f32,
        compute_time_ms: u16,
    },
    Error(String),
}

#[derive(Serialize, Deserialize)]
pub struct ScoredMove {
    pub placements: [(u8, u8); RACK_SIZE], // (pos, tile)
    pub score: i16,
    pub word: String,
}
```

### 7.2 Axum WebSocket Handler
```rust
// api.rs
use axum::{extract::ws::{WebSocket, Message}, Router, routing::get};
use tokio::time::{sleep, Duration, timeout};

pub async fn ws_handler(mut ws: WebSocket) {
    let (mut tx, mut rx) = ws.split();
    let search_state = Arc::new(Mutex::new(None::<SearchHandle>>));
    
    loop {
        tokio::select! {
            msg = rx.next() => {
                match msg {
                    Some(Ok(Message::Binary(data))) => {
                        let msg: ClientMsg = bincode::deserialize(&data).unwrap();
                        match msg {
                            ClientMsg::Analyze { board_hash, rack, mode, time_budget_ms } => {
                                // Cancel any existing search
                                if let Some(handle) = search_state.lock().await.take() {
                                    handle.abort();
                                }
                                
                                let board = fetch_board_from_cache(board_hash).await;
                                let handle = spawn_search(board, rack, mode, time_budget_ms);
                                *search_state.lock().await = Some(handle);
                            }
                            ClientMsg::Cancel => {
                                if let Some(handle) = search_state.lock().await.take() {
                                    handle.abort();
                                }
                            }
                        }
                    }
                    _ => break,
                }
            }
            _ = sleep(Duration::from_secs(30)) => break, // Timeout
        }
    }
}
```

---

## 8. Frontend React Integration

### 8.1 State Management with Zustand
```typescript
// store.ts
import { create } from 'zustand';

interface SolverState {
  board: Board;
  rack: number[];
  isAnalyzing: boolean;
  rankedMoves: ScoredMove[];
  ws: WebSocket | null;
  
  analyze: (timeBudget: number) => void;
  cancel: () => void;
  connect: () => void;
}

export const useSolverStore = create<SolverState>((set, get) => ({
  board: initializeEmptyBoard(),
  rack: [0,0,0,0,0,0,0],
  isAnalyzing: false,
  rankedMoves: [],
  ws: null,
  
  connect: () => {
    const ws = new WebSocket('ws://localhost:3000/solve');
    ws.binaryType = 'arraybuffer';
    
    ws.onmessage = (event) => {
      const msg = ServerMsg.decode(event.data);
      if (msg.type === 'Result') {
        set({ rankedMoves: msg.moves, isAnalyzing: false });
      }
    };
    
    set({ ws });
  },
  
  analyze: (timeBudget) => {
    const { ws, board, rack } = get();
    if (!ws) return;
    
    const msg: ClientMsg = {
      type: 'Analyze',
      board_hash: hashBoard(board),
      rack: rack.map(letterToIndex),
      mode: 2, // Beam+MCTS
      time_budget_ms: timeBudget,
    };
    
    ws.send(bincodeEncode(msg));
    set({ isAnalyzing: true });
  },
  
  cancel: () => {
    get().ws?.send(bincodeEncode({ type: 'Cancel' }));
    set({ isAnalyzing: false });
  },
}));
```

### 8.2 Canvas-Based Board Rendering
```typescript
// BoardCanvas.tsx
const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { board, rankedMoves } = useSolverStore();
  
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d');
    renderBoard(ctx, board, rankedMoves[0]); // Show top move preview
    
    // Capture tile for OCR on click
    canvasRef.current!.onclick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const imageData = ctx.getImageData(x, y, 32, 32);
      recognizeTileInWASM(imageData.data);
    };
  }, [board, rankedMoves]);
  
  return <canvas ref={canvasRef} width={288} height={288} />; // 9*32
};
```

---

## 9. Build & Deployment Environment

### 9.1 Rust Toolchain Configuration
```toml
# rust-toolchain.toml
[toolchain]
channel = "1.75.0"
components = ["rustfmt", "clippy", "llvm-tools"]
targets = ["wasm32-unknown-unknown"]

# Cargo.toml workspace
[workspace]
members = ["solver", "ocr", "protocol"]
resolver = "2"

# solver/Cargo.toml
[dependencies]
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
bincode = "1.3"
memmap2 = "0.9"
rayon = "1.8"
tract-onnx = { version = "0.21", optional = true }
metrics = "0.21"
tracing = "0.1"

[features]
default = ["ocr"]
ocr = ["tract-onnx"]
```

### 9.2 Multi-Stage Dockerfile
```dockerfile
# Dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y protobuf-compiler

# Copy build files first for layer caching
COPY Cargo.toml Cargo.lock build.rs ./
COPY src/build/ src/build/
COPY dictionary/lexicon.txt dictionary/

# Pre-compile GADDAG at build time
RUN cargo build --release --bin build_gaddag
RUN ./target/release/build_gaddag dictionary/lexicon.txt dictionary/lexicon.gaddag

# Build solver
COPY . .
RUN cargo build --release --bin solver

# Runtime stage
FROM gcr.io/distroless/cc-debian12:latest
COPY --from=builder /app/target/release/solver /usr/local/bin/solver
COPY --from=builder /app/dictionary/lexicon.gaddag /usr/share/solver/lexicon.gaddag
COPY --from=builder /app/ocr/model /usr/share/solver/model

USER nonroot:nonroot
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/solver"]
```

### 9.3 GitHub Actions CI
```yaml
# .github/workflows/ci.yml
name: CI

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo build --release
      - run: cargo clippy -- -D warnings
      - run: cargo fmt -- --check
  
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: cargo bench -- --save-baseline main
      - uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'cargo'
          output-file-path: target/criterion/reports/
          fail-on-alert: true
          alert-threshold: '110%'
```

---

## 10. Performance Optimization Standards

### 10.1 Inlining & Branching Rules
- All hot-path functions (`get_cell`, `traverse`, `sample`) **must** be `#[inline(always)]`.
- Prefer `match` over `if-else` for predictable branching.
- Use `unlikely!()` macro from `std::intrinsics` for error paths.

### 10.2 Cache Optimization
- Board size (128 bytes) must fit in **2 cache lines**. Verify with `std::mem::size_of::<Board>()`.
- Cross-check caches must be **NUMA-aware**: allocate on the socket where the thread runs.

### 10.3 Lock-Free Concurrency
- Use `crossbeam::atomic::AtomicCell` for shared counters in rollouts.
- WebSocket state uses `Arc<Mutex<>>` but **never** hold lock across await points.

### 10.4 SIMD Requirements
- Cross-check gap detection **must** use AVX2 `_mm_cmpeq_epi8`.
- Compile with `RUSTFLAGS="-C target-cpu=native"` in production.

### 10.5 WebSocket Binary Protocol
- Use `bincode` with `serde` **only** for message types. Never serialize `Board` struct directly.
- Set `ws.max_message_size(Some(1024 * 1024))` to prevent OOM from malicious clients.

---

## 11. Coding Standards

### 11.1 Error Handling
- Use `thiserror` for domain errors. **No `unwrap()` in production code**.
- Critical errors (OCR failure, invalid board) must emit `tracing::error!()` with context.

### 11.2 Logging & Tracing
```rust
// In every public function
#[tracing::instrument(skip(board, rack), fields(board_hash = %board.hash()))]
pub fn search(board: &Board, rack: &Rack) -> Result<Vec<Move>> {
    tracing::info!(rack_tiles = ?rack.tiles, "Starting move generation");
    // ...
}
```

### 11.3 Documentation
- Every `pub` item must have rustdoc with **at least one example**.
- Unsafe blocks must have `# Safety` section explaining invariants.

### 11.4 Dependencies
- **No dependencies with >1ms compile-time impact** unless justified.
- Pin exact versions in `Cargo.toml`; use `cargo update --precise` for upgrades.

---

## 12. Final Integration Checklist

Before running the solver:

- [ ] `lexicon.txt` placed in `dictionary/` and committed to repo.
- [ ] `build.rs` generates `lexicon.gaddag` at `$OUT_DIR`.
- [ ] CNN model (`tile_classifier.onnx`) <1MB and placed in `ocr/model/`.
- [ ] `RUST_LOG=solver=info` configured in deployment.
- [ ] Prometheus scraping endpoint at `/metrics` mounted in axum.
- [ ] WebSocket endpoint `/solve` exposed on port 3000.
- [ ] Frontend served on port 3001 with `VITE_WS_URL=ws://localhost:3000/solve`.
