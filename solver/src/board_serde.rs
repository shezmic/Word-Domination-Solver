use crate::board::Board;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct SerializedBoard {
    pub letters: Vec<u8>,  // Flattened 9x9 grid
    pub bonuses: Vec<u8>,  // Flattened bonus map
}

impl Board {
    pub fn to_serialized(&self) -> SerializedBoard {
        let mut letters = Vec::with_capacity(81);
        let mut bonuses = Vec::with_capacity(81);
        
        for row in 0..9u8 {
            for col in 0..9u8 {
                letters.push(self.get_letter(row, col));
                bonuses.push(self.bonus_map[(row as usize * 9 + col as usize)]);
            }
        }
        
        SerializedBoard { letters, bonuses }
    }
    
    pub fn from_serialized(data: &SerializedBoard, gaddag: &crate::gaddag::Gaddag) -> Self {
        let mut board = Board::new();
        
        for (idx, (&letter, &bonus)) in data.letters.iter().zip(data.bonuses.iter()).enumerate() {
            let row = (idx / 9) as u8;
            let col = (idx % 9) as u8;
            
            if letter != 0 {
                board.set_cell(row, col, letter | 0b100_0000);
            }
            board.bonus_map[idx] = bonus;
        }
        
        board.active_boosters = [None; 4];
        board.update_anchors();
        
        // CRITICAL FIX: Recompute cross-checks for all rows
        // This is required because we just loaded a board state and the cross-checks
        // must be consistent with the placed tiles for move generation to work.
        unsafe {
            for row in 0..9 {
                board.recompute_cross_checks_row(row, gaddag);
            }
        }
        
        board
    }
}
