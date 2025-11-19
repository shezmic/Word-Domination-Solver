use serde::{Serialize, Deserialize};
use crate::constants::RACK_SIZE;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    Horizontal,
    Vertical,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Move {
    pub placements: Vec<(u8, u8)>, // (position, tile)
    pub score: i32,
    pub word: String,
    pub start_row: u8,
    pub start_col: u8,
    pub direction: Direction,
}

impl Move {
    pub fn new(
        placements: Vec<(u8, u8)>,
        word: String,
        start_row: u8,
        start_col: u8,
        direction: Direction,
    ) -> Self {
        Self {
            placements,
            score: 0,
            word,
            start_row,
            start_col,
            direction,
        }
    }
    
    pub fn hash(&self) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        
        for &(pos, tile) in &self.placements {
            pos.hash(&mut hasher);
            tile.hash(&mut hasher);
        }
        
        hasher.finish()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScoredMove {
    pub placements: Vec<(u8, u8)>,
    pub score: i16,
    pub word: String,
}

impl ScoredMove {
    pub fn from_move(mv: &Move) -> Self {
        Self {
            placements: mv.placements.clone(),
            score: mv.score as i16,
            word: mv.word.clone(),
        }
    }
}

impl Ord for ScoredMove {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.score.cmp(&other.score)
    }
}

impl PartialOrd for ScoredMove {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
