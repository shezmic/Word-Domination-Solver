use crate::constants::*;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::arch::x86_64::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BonusType {
    None = 0,
    DoubleLetter = 1,
    TripleLetter = 2,
    DoubleWord = 3,
    TripleWord = 4,
}

#[repr(C, align(64))]
#[derive(Clone)]
pub struct Board {
    // 9×9 = 81 cells, packed efficiently
    pub letters: [u64; 9],
    
    // Bonus mapping: 2 bits type + 6 bits multiplier value
    pub bonus_map: [u8; BOARD_SIZE * BOARD_SIZE],
    
    // Cross-checks: 26-bit mask (A-Z) for each cell
    pub cross_checks_h: [u32; BOARD_SIZE * BOARD_SIZE],
    pub cross_checks_v: [u32; BOARD_SIZE * BOARD_SIZE],
    
    // Anchor mask: cells where a move can start
    pub anchors: u128,
    
    // Tile bag state
    pub tile_bag: TileBag,
    
    // Active boosters (max 4 simultaneous)
    pub active_boosters: [Option<crate::booster::ActiveBooster>; 4],
}

#[derive(Clone, Copy, Debug)]
pub struct TileBag {
    pub counts: [u8; 27],
    pub cdf: [u16; 27],
    pub total: u16,
}

impl TileBag {
    pub fn new() -> Self {
        let mut counts = [0u8; 27];
        let mut cdf = [0u16; 27];
        let mut total = 0u16;
        
        for &(letter, count) in TILE_DISTRIBUTION.iter() {
            counts[letter as usize] = count;
            total += count as u16;
        }
        
        // Precompute CDF for faster sampling
        let mut cumsum = 0u16;
        for i in 0..27 {
            cumsum += counts[i] as u16;
            cdf[i] = cumsum;
        }
        
        Self { counts, cdf, total }
    }
    
    pub fn draw(&mut self, letter: u8) -> bool {
        if letter > 26 || self.counts[letter as usize] == 0 {
            return false;
        }
        self.counts[letter as usize] -= 1;
        self.total -= 1;
        true
    }
    
    pub fn return_tile(&mut self, letter: u8) {
        if letter <= 26 {
            self.counts[letter as usize] += 1;
            self.total += 1;
        }
    }
}

impl Board {
    pub fn new() -> Self {
        Self {
            letters: [0u64; 9],
            bonus_map: [0u8; BOARD_SIZE * BOARD_SIZE],
            cross_checks_h: [0xFFFFFFFF; BOARD_SIZE * BOARD_SIZE],
            cross_checks_v: [0xFFFFFFFF; BOARD_SIZE * BOARD_SIZE],
            anchors: 0,
            tile_bag: TileBag::new(),
            active_boosters: [None; 4],
        }
    }
    
    #[inline(always)]
    pub fn get_cell(&self, row: u8, col: u8) -> u8 {
        let idx = (row as usize) * BOARD_SIZE + (col as usize);
        let block = idx / 8;
        let offset = (idx % 8) * 7;
        ((self.letters[block] >> offset) & 0b111_1111) as u8
    }
    
    #[inline(always)]
    pub fn set_cell(&mut self, row: u8, col: u8, value: u8) {
        let idx = (row as usize) * BOARD_SIZE + (col as usize);
        let block = idx / 8;
        let offset = (idx % 8) * 7;
        
        // Clear the 7 bits first
        self.letters[block] &= !(0b111_1111u64 << offset);
        // Set new value
        self.letters[block] |= (value as u64 & 0b111_1111) << offset;
    }
    
    pub fn is_occupied(&self, row: u8, col: u8) -> bool {
        let cell = self.get_cell(row, col);
        (cell & 0b100_0000) != 0
    }
    
    pub fn get_letter(&self, row: u8, col: u8) -> u8 {
        let cell = self.get_cell(row, col);
        cell & 0b11_1111
    }
    
    pub fn set_bonus(&mut self, row: u8, col: u8, bonus_type: BonusType, multiplier: u8) {
        let idx = (row as usize) * BOARD_SIZE + (col as usize);
        self.bonus_map[idx] = ((multiplier << 2) | (bonus_type as u8)) as u8;
    }
    
    pub fn get_bonus(&self, row: u8, col: u8) -> (BonusType, u8) {
        let idx = (row as usize) * BOARD_SIZE + (col as usize);
        let value = self.bonus_map[idx];
        let bonus_type = match value & 0b11 {
            1 => BonusType::DoubleLetter,
            2 => BonusType::TripleLetter,
            3 => BonusType::DoubleWord,
            4 => BonusType::TripleWord,
            _ => BonusType::None,
        };
        (bonus_type, value >> 2)
    }
    
    pub fn hash(&self) -> u64 {
        let mut hasher = DefaultHasher::new();
        for &block in &self.letters {
            block.hash(&mut hasher);
        }
        for &bonus in &self.bonus_map {
            bonus.hash(&mut hasher);
        }
        hasher.finish()
    }
    
    pub fn play_move(&mut self, mv: &crate::moves::Move) {
        for &(pos, tile) in &mv.placements {
            let row = pos / crate::constants::BOARD_SIZE as u8;
            let col = pos % crate::constants::BOARD_SIZE as u8;
            
            // Set cell with occupied flag (bit 6)
            let value = tile | 0b100_0000;
            self.set_cell(row, col, value);
        }
        
        // Update anchors after placing tiles
        self.update_anchors();
    }
    
    
    pub fn get_cross_word(&self, pos: u8, direction: crate::moves::Direction) -> Option<(String, Vec<u8>)> {
        use crate::moves::Direction;
        let row = (pos / BOARD_SIZE as u8) as i8;
        let col = (pos % BOARD_SIZE as u8) as i8;
        
        // Determine perpendicular direction
        let (dr, dc) = match direction {
            Direction::Horizontal => (1i8, 0i8), // Check vertically
            Direction::Vertical => (0i8, 1i8),   // Check horizontally
        };
        
        // Find start of cross-word by going backwards
        let mut start_r = row;
        let mut start_c = col;
        while start_r - dr >= 0 && start_r - dr < BOARD_SIZE as i8 &&
              start_c - dc >= 0 && start_c - dc < BOARD_SIZE as i8 &&
              self.is_occupied((start_r - dr) as u8, (start_c - dc) as u8) {
            start_r -= dr;
            start_c -= dc;
        }
        
        // Collect cross-word
        let mut word = String::new();
        let mut positions = Vec::new();
        let mut curr_r = start_r;
        let mut curr_c = start_c;
        
        while curr_r >= 0 && curr_r < BOARD_SIZE as i8 &&
              curr_c >= 0 && curr_c < BOARD_SIZE as i8 &&
              (self.is_occupied(curr_r as u8, curr_c as u8) || 
               (curr_r == row && curr_c == col)) {
            let letter = self.get_letter(curr_r as u8, curr_c as u8);
            if letter > 0 && letter <= 26 {
                word.push((b'A' + letter - 1) as char);
            }
            let pos_val = (curr_r as u8) * BOARD_SIZE as u8 + (curr_c as u8);
            positions.push(pos_val);
            curr_r += dr;
            curr_c += dc;
        }
        
        if word.len() > 1 {
            Some((word, positions))
        } else {
            None
        }
    }
    
    pub fn update_anchors(&mut self) {
        self.anchors = 0;
        
        for row in 0..BOARD_SIZE as u8 {
            for col in 0..BOARD_SIZE as u8 {
                if !self.is_occupied(row, col) {
                    // Check if adjacent to an occupied cell
                    let mut is_anchor = false;
                    
                    if row > 0 && self.is_occupied(row - 1, col) {
                        is_anchor = true;
                    }
                    if row < (BOARD_SIZE - 1) as u8 && self.is_occupied(row + 1, col) {
                        is_anchor = true;
                    }
                    if col > 0 && self.is_occupied(row, col - 1) {
                        is_anchor = true;
                    }
                    if col < (BOARD_SIZE - 1) as u8 && self.is_occupied(row, col + 1) {
                        is_anchor = true;
                    }
                    
                    if is_anchor {
                        let pos = row as usize * BOARD_SIZE + col as usize;
                        self.anchors |= 1u128 << pos;
                    }
                }
            }
        }
    }
    
    pub fn get_cell_from_pos(&self, pos: u8) -> u8 {
        let row = pos / BOARD_SIZE as u8;
        let col = pos % BOARD_SIZE as u8;
        self.get_cell(row, col)
    }
    
    pub fn is_empty(&self) -> bool {
        for row in 0..BOARD_SIZE as u8 {
            for col in 0..BOARD_SIZE as u8 {
                if self.is_occupied(row, col) {
                    return false;
                }
            }
        }
        true
    }
    
    // SIMD-optimized cross-check computation
    // This function identifies empty cells in a row that need cross-check updates
    #[target_feature(enable = "avx2")]
    pub unsafe fn recompute_cross_checks_row(&mut self, row: u8, gaddag: &crate::gaddag::Gaddag) {
        let row_start = row as usize * BOARD_SIZE;
        
        // Load row into SIMD register (16x u8)
        // We need to construct a temporary array because our packed format is hard to load directly
        let mut letters = [0u8; 16];
        for i in 0..BOARD_SIZE {
            letters[i] = self.get_letter(row, i as u8);
        }
        
        let vec = _mm_loadu_si128(letters.as_ptr() as *const __m128i);
        let zeros = _mm_set1_epi8(0);
        let mask = _mm_cmpeq_epi8(vec, zeros);
        let gaps = _mm_movemask_epi8(mask) as u16;
        
        // For each gap, compute valid letters using GADDAG
        for i in 0..BOARD_SIZE {
            if gaps & (1 << i) != 0 {
                let pos = row_start + i;
                self.cross_checks_h[pos] = self.compute_cross_check_mask(pos as u8, true, gaddag);
            }
        }
    }
    
    // Compute cross-check mask for a specific position
    pub fn compute_cross_check_mask(&self, pos: u8, horizontal: bool, gaddag: &crate::gaddag::Gaddag) -> u32 {
        let mut mask = 0;
        
        // Check perpendicular word
        // If horizontal=true, we are placing horizontally, so we check vertical cross-word
        let (dr, dc) = if horizontal { (1i8, 0i8) } else { (0i8, 1i8) };
        
        let row = (pos / BOARD_SIZE as u8) as i8;
        let col = (pos % BOARD_SIZE as u8) as i8;
        
        // Check if there are neighbors in perpendicular direction
        let has_prev = if horizontal { row > 0 && self.is_occupied((row-1) as u8, col as u8) } 
                       else { col > 0 && self.is_occupied(row as u8, (col-1) as u8) };
        let has_next = if horizontal { row < 8 && self.is_occupied((row+1) as u8, col as u8) }
                       else { col < 8 && self.is_occupied(row as u8, (col+1) as u8) };
                       
        if !has_prev && !has_next {
            return 0x3FFFFFF; // All letters valid if no cross-word
        }
        
        // Construct the cross-word parts
        // Go backwards
        let mut prefix = Vec::new();
        let mut curr_row = row - dr;
        let mut curr_col = col - dc;
        while curr_row >= 0 && curr_col >= 0 && curr_row < 9 && curr_col < 9 {
            if !self.is_occupied(curr_row as u8, curr_col as u8) { break; }
            prefix.push(self.get_letter(curr_row as u8, curr_col as u8));
            curr_row -= dr;
            curr_col -= dc;
        }
        // Prefix is reversed (closest to anchor first)
        
        // Go forwards
        let mut suffix = Vec::new();
        curr_row = row + dr;
        curr_col = col + dc;
        while curr_row >= 0 && curr_col >= 0 && curr_row < 9 && curr_col < 9 {
            if !self.is_occupied(curr_row as u8, curr_col as u8) { break; }
            suffix.push(self.get_letter(curr_row as u8, curr_col as u8));
            curr_row += dr;
            curr_col += dc;
        }
        
        // Try all 26 letters
        for letter in 1..=26 {
            // Validate: Rev(Prefix) + Letter + Suffix
            // Using GADDAG:
            // Anchor is the letter we are placing? 
            // No, GADDAG allows checking any word.
            // We can check: Letter -> Rev(Prefix) -> Delim -> Suffix
            
            // 1. Start with candidate letter
            if let Some(mut node) = gaddag.traverse(gaddag.root_offset(), letter) {
                // 2. Traverse reversed prefix
                let mut valid = true;
                for &p in &prefix {
                    if let Some(next) = gaddag.traverse(node, p) {
                        node = next;
                    } else {
                        valid = false;
                        break;
                    }
                }
                
                if valid {
                    // 3. Traverse Delimiter
                    if let Some(mut node) = gaddag.traverse(node, crate::gaddag::DELIMITER) {
                        // 4. Traverse Suffix
                        for &s in &suffix {
                            if let Some(next) = gaddag.traverse(node, s) {
                                node = next;
                            } else {
                                valid = false;
                                break;
                            }
                        }
                        
                        if valid && gaddag.is_terminal(node) {
                            mask |= 1 << (letter - 1);
                        }
                    }
                }
            }
        }
        
        mask
    }
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}
