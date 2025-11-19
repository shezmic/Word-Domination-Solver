# Word Domination Solver - Knowledge Base

## Tile Indexing Convention

**Critical**: The project uses 1-based indexing for letters:
- Index 0 = Blank tile
- Index 1 = 'A', Index 2 = 'B', ..., Index 26 = 'Z'
- Conversion: `letter_index = (letter_char - b'A') + 1`
- Reverse: `letter_char = (letter_index - 1) + b'A'`

This is used consistently across:
- `TILE_DISTRIBUTION` array
- `LETTER_POINTS` array
- Rack tile storage
- Move placements
- GADDAG traversal

## Build System

- Use `CARGO_MANIFEST_DIR` for path resolution in build.rs, not relative paths
- GADDAG compilation is placeholder only - dictionary uses simple HashSet currently
- Workspace does NOT include `ocr` crate yet (to be added later)

## Dictionary Implementation

- Primary: GADDAG (memory-mapped, not yet implemented)
- Fallback: SimpleDictionary (HashSet-based, case-insensitive)
- Words stored in `dictionary/lexicon.txt`, one per line, uppercase

## WebSocket Protocol

- Uses bincode serialization for efficiency
- Board state serialization via `board_serde.rs`
- Client sends rack as `[u8; 7]` using tile indexing scheme above

## Move Generation

- Current implementation is simplified placeholder
- TODO: Implement proper GADDAG-based generation with prefix/suffix extension
- Anchors are cells adjacent to occupied cells
- Cross-checks constrain valid letter placements

## Known Limitations

1. GADDAG compiler created but needs to be run manually first
2. Move generation needs full bidirectional GADDAG traversal
3. Board state caching implemented with DashMap
4. Cross-word scoring implemented
5. OCR pipeline not implemented
6. Frontend not created

## Critical Next Steps

1. **Install Rust**: Download from https://rustup.rs/ (Windows) or use curl installer (Linux/Mac)
2. **Run GADDAG Compiler**: `cargo run --release --bin gaddag_compiler dictionary/lexicon.txt dictionary/lexicon.gaddag`
3. **Commit GADDAG**: Add the compiled `dictionary/lexicon.gaddag` file to git (2-5MB)
4. **Fix Move Generation**: Implement bidirectional GADDAG traversal in movegen.rs
5. **Test End-to-End**: Verify moves are generated and scored correctly
6. **Add Integration Tests**: Test GADDAG validation, move generation, scoring

## Build Prerequisites

- Rust 1.75.0+ must be installed before any cargo commands will work
- GADDAG must be compiled before the solver can run
- The GADDAG file should be committed to avoid recompilation

## Build Automation

- Use `build.sh` (Unix) or `build.bat` (Windows) for automated setup
- These scripts check for Rust, compile GADDAG if needed, and build solver
- Manual steps documented in SETUP.md for troubleshooting

## Current Implementation Status

- **70% Complete**: Infrastructure and type system done
- **Blocked**: Rust not installed on current system
- **Critical Work Needed**: Move generation (40-80 hrs), cross-word bonuses (10-20 hrs)
- See IMPLEMENTATION_STATUS.md for detailed breakdown

## Testing Strategy

- Use small test lexicon for development
- Test with empty board first (requires center cell placement)
- Verify scoring calculation with known examples
- Check bonus application order: letter → word → length
