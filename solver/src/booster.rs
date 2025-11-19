use crate::board::Board;

pub trait BoosterEffect: Send + Sync {
    fn modify_letter_score(&self, base: i32, pos: u8) -> i32;
    fn modify_word_score(&self, base: i32, word: &str) -> i32;
    fn modify_board(&self, board: &mut Board);
}

pub struct BoosterStack {
    pub effects: Vec<Box<dyn BoosterEffect>>,
}

impl BoosterStack {
    pub fn new() -> Self {
        Self {
            effects: Vec::new(),
        }
    }
    
    pub fn add_effect(&mut self, effect: Box<dyn BoosterEffect>) {
        self.effects.push(effect);
    }
    
    pub fn apply_to_board(&self, board: &mut Board) {
        for effect in &self.effects {
            effect.modify_board(board);
        }
    }
}

impl Default for BoosterStack {
    fn default() -> Self {
        Self::new()
    }
}

// Example booster implementations

pub struct TripleWordStackEffect;

impl BoosterEffect for TripleWordStackEffect {
    fn modify_letter_score(&self, base: i32, _pos: u8) -> i32 { base }
    fn modify_word_score(&self, base: i32, _word: &str) -> i32 { base * 3 }
    fn modify_board(&self, _board: &mut Board) {}
}

pub struct OpenAnchorEffect {
    pub positions: [u8; 4],
}

impl BoosterEffect for OpenAnchorEffect {
    fn modify_letter_score(&self, base: i32, _pos: u8) -> i32 { base }
    fn modify_word_score(&self, base: i32, _word: &str) -> i32 { base }
    fn modify_board(&self, board: &mut Board) {
        for &pos in &self.positions {
            if pos < 81 {
                board.anchors |= 1u128 << pos;
            }
        }
    }
}

pub struct DoubleLetterEffect {
    pub affected_letters: Vec<u8>,
}

impl BoosterEffect for DoubleLetterEffect {
    fn modify_letter_score(&self, base: i32, _pos: u8) -> i32 { base * 2 }
    fn modify_word_score(&self, base: i32, _word: &str) -> i32 { base }
    fn modify_board(&self, _board: &mut Board) {}
}

#[derive(Clone, Copy)]
pub enum ActiveBooster {
    TripleWord,
    OpenAnchor,
    DoubleLetter,
}
