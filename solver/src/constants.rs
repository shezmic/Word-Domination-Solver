// Core game parameters
pub const BOARD_SIZE: usize = 9;
pub const RACK_SIZE: usize = 7;
pub const MATCH_ROUNDS: u8 = 5;
pub const TURN_DURATION_SECS: u8 = 75;
pub const LENGTH_BONUS_THRESHOLD: usize = 7;
pub const LENGTH_BONUS_POINTS: i16 = 50;
pub const TOTAL_TILES: u16 = 102;

// TILE INDEXING SCHEME:
// - Index 0 = Blank tile
// - Index 1 = 'A', Index 2 = 'B', ..., Index 26 = 'Z'
// - To convert: letter_index = (letter - b'A') + 1
// - To convert back: letter = (letter_index - 1) + b'A'

// Tile distribution for English (letter_index, count)
pub static TILE_DISTRIBUTION: [(u8, u8); 27] = [
    (0, 2),   // Blank ×2
    (1, 9),   // A ×9
    (2, 2),   // B ×2
    (3, 2),   // C ×2
    (4, 4),   // D ×4
    (5, 12),  // E ×12
    (6, 2),   // F ×2
    (7, 3),   // G ×3
    (8, 2),   // H ×2
    (9, 9),   // I ×9
    (10, 1),  // J ×1
    (11, 1),  // K ×1
    (12, 4),  // L ×4
    (13, 2),  // M ×2
    (14, 6),  // N ×6
    (15, 8),  // O ×8
    (16, 2),  // P ×2
    (17, 1),  // Q ×1
    (18, 6),  // R ×6
    (19, 4),  // S ×4
    (20, 6),  // T ×6
    (21, 4),  // U ×4
    (22, 2),  // V ×2
    (23, 2),  // W ×2
    (24, 1),  // X ×1
    (25, 2),  // Y ×2
    (26, 1),  // Z ×1
];

// Letter point values (0 = blank, 1 = A, 2 = B, ..., 26 = Z)
pub static LETTER_POINTS: [i8; 27] = [
    0,  // Blank
    1,  // A
    4,  // B
    4,  // C
    2,  // D
    1,  // E
    4,  // F
    3,  // G
    4,  // H
    1,  // I
    10, // J
    5,  // K
    2,  // L
    4,  // M
    2,  // N
    1,  // O
    4,  // P
    10, // Q
    1,  // R
    1,  // S
    1,  // T
    2,  // U
    5,  // V
    4,  // W
    8,  // X
    3,  // Y
    10, // Z
];

// Leave values for static evaluation (approximate)
// Prioritize keeping S, E, R, Blanks
pub static LEAVE_VALUES: [i8; 27] = [
    25, // Blank (Keep!)
    1,  // A
    -2, // B
    -2, // C
    0,  // D
    4,  // E (Keep)
    -2, // F
    -2, // G
    0,  // H
    1,  // I
    -3, // J
    -3, // K
    0,  // L
    0,  // M
    0,  // N
    1,  // O
    -2, // P
    -6, // Q (Burn it!)
    3,  // R (Keep)
    8,  // S (Keep!)
    0,  // T
    -3, // U
    -3, // V
    -3, // W
    -2, // X
    -2, // Y
    -2, // Z
];
