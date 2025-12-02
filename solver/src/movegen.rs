use crate::board::Board;
use crate::rack::Rack;
use crate::moves::{Move, Direction};
use crate::gaddag::{Gaddag, DELIMITER};
use crate::constants::BOARD_SIZE;

/// Move generator using GADDAG traversal
/// 
/// Generates all valid moves by:
/// 1. Finding anchor squares (empty cells adjacent to occupied cells)
/// 2. For each anchor, traversing GADDAG to find valid word placements
/// 3. Respecting cross-check constraints from perpendicular words
pub struct MoveGenerator<'a> {
    board: &'a Board,
    gaddag: &'a Gaddag,
    rack: &'a Rack,
}

impl<'a> MoveGenerator<'a> {
    pub fn new(board: &'a Board, gaddag: &'a Gaddag, rack: &'a Rack) -> Self {
        Self { board, gaddag, rack }
    }
    
    pub fn generate_all(&self) -> Vec<Move> {
        // Pre-allocate for typical game positions (average ~500 moves possible)
        let mut moves = Vec::with_capacity(500);
        
        if self.board.is_empty() {
            self.generate_first_move(&mut moves);
        } else {
            self.generate_anchor_based(&mut moves);
        }
        
        moves
    }
    
    fn generate_first_move(&self, moves: &mut Vec<Move>) {
        // First move must pass through center (4,4)
        let center_row = 4u8;
        let center_col = 4u8;
        
        self.generate_at_anchor(center_row, center_col, Direction::Horizontal, moves);
        self.generate_at_anchor(center_row, center_col, Direction::Vertical, moves);
    }
    
    fn generate_anchor_based(&self, moves: &mut Vec<Move>) {
        let mut anchors = self.board.anchors;
        
        // Iterate over set bits efficiently
        while anchors != 0 {
            let pos = anchors.trailing_zeros() as u8;
            anchors &= !(1u128 << pos); // Clear the bit
            
            let row = pos / BOARD_SIZE as u8;
            let col = pos % BOARD_SIZE as u8;
            
            // Optimization: Check if we can actually place tiles here
            // (Anchors should be empty by definition, but double check)
            if !self.board.is_occupied(row, col) {
                self.generate_at_anchor(row, col, Direction::Horizontal, moves);
                self.generate_at_anchor(row, col, Direction::Vertical, moves);
            }
        }
    }
    
    #[inline(always)]
    fn generate_at_anchor(&self, row: u8, col: u8, dir: Direction, moves: &mut Vec<Move>) {
        let root = self.gaddag.root_offset();
        
        // Cross-check for the anchor square
        let pos = row as usize * BOARD_SIZE + col as usize;
        let cross_mask = match dir {
            Direction::Horizontal => self.board.cross_checks_h[pos],
            Direction::Vertical => self.board.cross_checks_v[pos],
        };
        
        let mut rack_counts = [0u8; 27];
        for &t in self.rack.tiles.iter() {
            if t > 0 { rack_counts[t as usize] += 1; }
        }
        
        // Try all valid tiles at the anchor
        for tile in 1..=26 {
            if rack_counts[tile as usize] == 0 && rack_counts[0] == 0 {
                continue;
            }
            
            if (cross_mask & (1 << (tile - 1))) == 0 {
                continue;
            }
            
            if let Some(node) = self.gaddag.traverse(root, tile) {
                let used_blank = rack_counts[tile as usize] == 0;
                if used_blank { rack_counts[0] -= 1; } else { rack_counts[tile as usize] -= 1; }
                
                let mut current_word = String::new();
                current_word.push(((tile - 1) + b'A') as char);
                
                let mut placements = Vec::with_capacity(8);
                placements.push((pos as u8, tile)); // TODO: Mark blank?
                
                // Go Left
                self.go_left(row, col, row, col, dir, node, &mut rack_counts, &mut placements, &mut current_word, moves);
                
                // Restore rack
                if used_blank { rack_counts[0] += 1; } else { rack_counts[tile as usize] += 1; }
            }
        }
    }
    
    #[allow(clippy::too_many_arguments)]
    fn go_left(
        &self,
        anchor_row: u8,
        anchor_col: u8,
        curr_row: u8,
        curr_col: u8,
        dir: Direction,
        node: usize,
        rack_counts: &mut [u8; 27],
        placements: &mut Vec<(u8, u8)>,
        current_word: &mut String,
        moves: &mut Vec<Move>,
    ) {
        let (dr, dc) = match dir {
            Direction::Horizontal => (0i8, -1i8),
            Direction::Vertical => (-1i8, 0i8),
        };
        
        let next_r_i = curr_row as i8 + dr;
        let next_c_i = curr_col as i8 + dc;
        
        // If off board, switch to going right
        if next_r_i < 0 || next_c_i < 0 || next_r_i >= 9 || next_c_i >= 9 {
            self.go_right_start(anchor_row, anchor_col, dir, node, rack_counts, placements, current_word, moves);
            return;
        }
        
        let r = next_r_i as u8;
        let c = next_c_i as u8;
        
        if self.board.is_occupied(r, c) {
            // Must match existing tile
            let letter = self.board.get_letter(r, c);
            if let Some(next_node) = self.gaddag.traverse(node, letter) {
                current_word.insert(0, ((letter - 1) + b'A') as char);
                self.go_left(anchor_row, anchor_col, r, c, dir, next_node, rack_counts, placements, current_word, moves);
                current_word.remove(0);
            }
        } else {
            // Empty square: can stop or place tile
            
            // Option 1: Stop going left, switch to right
            self.go_right_start(anchor_row, anchor_col, dir, node, rack_counts, placements, current_word, moves);
            
            // Option 2: Place a tile
            let pos = r as usize * BOARD_SIZE + c as usize;
            let cross_mask = match dir {
                Direction::Horizontal => self.board.cross_checks_h[pos],
                Direction::Vertical => self.board.cross_checks_v[pos],
            };
            
            for tile in 1..=26 {
                if (rack_counts[tile as usize] > 0 || rack_counts[0] > 0) && (cross_mask & (1 << (tile - 1))) != 0 {
                    if let Some(next_node) = self.gaddag.traverse(node, tile) {
                        let used_blank = rack_counts[tile as usize] == 0;
                        if used_blank { rack_counts[0] -= 1; } else { rack_counts[tile as usize] -= 1; }
                        
                        current_word.insert(0, ((tile - 1) + b'A') as char);
                        placements.push((pos as u8, tile));
                        
                        self.go_left(anchor_row, anchor_col, r, c, dir, next_node, rack_counts, placements, current_word, moves);
                        
                        placements.pop();
                        current_word.remove(0);
                        if used_blank { rack_counts[0] += 1; } else { rack_counts[tile as usize] += 1; }
                    }
                }
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn go_right_start(
        &self,
        anchor_row: u8,
        anchor_col: u8,
        dir: Direction,
        node: usize,
        rack_counts: &mut [u8; 27],
        placements: &mut Vec<(u8, u8)>,
        current_word: &mut String,
        moves: &mut Vec<Move>,
    ) {
        if let Some(mid_node) = self.gaddag.traverse(node, DELIMITER) {
            let (dr, dc) = match dir {
                Direction::Horizontal => (0i8, 1i8),
                Direction::Vertical => (1i8, 0i8),
            };
            // Start right part from anchor + 1
            let start_r = anchor_row as i8 + dr;
            let start_c = anchor_col as i8 + dc;
            
            self.go_right(start_r, start_c, dir, mid_node, rack_counts, placements, current_word, moves);
        }
    }
    
    #[allow(clippy::too_many_arguments)]
    fn go_right(
        &self,
        curr_r: i8,
        curr_c: i8,
        dir: Direction,
        node: usize,
        rack_counts: &mut [u8; 27],
        placements: &mut Vec<(u8, u8)>,
        current_word: &mut String,
        moves: &mut Vec<Move>,
    ) {
        // Check if valid word
        if self.gaddag.is_terminal(node) {
            // Check boundary conditions
            let can_stop = if curr_r < 0 || curr_c < 0 || curr_r >= 9 || curr_c >= 9 {
                true
            } else {
                !self.board.is_occupied(curr_r as u8, curr_c as u8)
            };
            
            if can_stop && !placements.is_empty() {
                // Valid move found
                let (dr, dc) = match dir {
                    Direction::Horizontal => (0i8, 1i8),
                    Direction::Vertical => (1i8, 0i8),
                };
                
                // Calculate start position of the word
                // Word ends at (curr_r - dr, curr_c - dc)
                let len = current_word.len() as i8;
                let end_r = curr_r - dr;
                let end_c = curr_c - dc;
                let start_r = end_r - (len - 1) * dr;
                let start_c = end_c - (len - 1) * dc;
                
                moves.push(Move::new(
                    placements.clone(),
                    current_word.clone(),
                    start_r as u8,
                    start_c as u8,
                    dir
                ));
            }
        }
        
        // Continue extending right
        if curr_r < 0 || curr_c < 0 || curr_r >= 9 || curr_c >= 9 {
            return;
        }
        
        let r = curr_r as u8;
        let c = curr_c as u8;
        let (dr, dc) = match dir {
            Direction::Horizontal => (0i8, 1i8),
            Direction::Vertical => (1i8, 0i8),
        };
        
        if self.board.is_occupied(r, c) {
            let letter = self.board.get_letter(r, c);
            if let Some(next_node) = self.gaddag.traverse(node, letter) {
                current_word.push(((letter - 1) + b'A') as char);
                self.go_right(curr_r + dr, curr_c + dc, dir, next_node, rack_counts, placements, current_word, moves);
                current_word.pop();
            }
        } else {
            // Place tile
            let pos = r as usize * BOARD_SIZE + c as usize;
            let cross_mask = match dir {
                Direction::Horizontal => self.board.cross_checks_h[pos],
                Direction::Vertical => self.board.cross_checks_v[pos],
            };
            
            for tile in 1..=26 {
                if (rack_counts[tile as usize] > 0 || rack_counts[0] > 0) && (cross_mask & (1 << (tile - 1))) != 0 {
                    if let Some(next_node) = self.gaddag.traverse(node, tile) {
                        let used_blank = rack_counts[tile as usize] == 0;
                        if used_blank { rack_counts[0] -= 1; } else { rack_counts[tile as usize] -= 1; }
                        
                        current_word.push(((tile - 1) + b'A') as char);
                        placements.push((pos as u8, tile));
                        
                        self.go_right(curr_r + dr, curr_c + dc, dir, next_node, rack_counts, placements, current_word, moves);
                        
                        placements.pop();
                        current_word.pop();
                        if used_blank { rack_counts[0] += 1; } else { rack_counts[tile as usize] += 1; }
                    }
                }
            }
        }
    }
}

