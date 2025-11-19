use crate::board::{Board, BonusType};
use crate::moves::Move;
use crate::constants::*;
use crate::rack::Rack;

pub struct EvaluationConfig {
    pub round: u8,
}

impl Board {
    pub fn score_move(&self, mv: &Move, points: &[i8; 27]) -> i32 {
        let mut total = 0i32;
        let mut word_multiplier = 1u8;
        let tiles_used = mv.placements.len();
        
        // Track cross-words
        let mut cross_words: Vec<(String, Vec<u8>)> = vec![];
        
        // Iterate over placed tiles
        for &(pos, tile) in &mv.placements {
            let row = pos / BOARD_SIZE as u8;
            let col = pos % BOARD_SIZE as u8;
            
            let letter_score = points[tile as usize] as i32;
            let mut tile_score = letter_score;
            
            // Apply letter bonuses
            let (bonus_type, multiplier) = self.get_bonus(row, col);
            match bonus_type {
                BonusType::DoubleLetter => tile_score *= multiplier as i32,
                BonusType::TripleLetter => tile_score *= multiplier as i32,
                BonusType::DoubleWord => word_multiplier *= multiplier,
                BonusType::TripleWord => word_multiplier *= multiplier,
                BonusType::None => {},
            }
            
            // Check for perpendicular cross-word
            if let Some((cross_word, cross_positions)) = self.get_cross_word(pos, mv.direction) {
                if cross_word.len() > 1 {
                    cross_words.push((cross_word, cross_positions));
                }
            }
            
            total += tile_score;
        }
        
        // Apply word multiplier to main word
        total *= word_multiplier as i32;
        
        // Score all cross-words with their own bonuses
        for (_cross_word, cross_positions) in cross_words {
            let mut cross_score = 0i32;
            let mut cross_word_mult = 1u8;
            
            for &pos in &cross_positions {
                let tile = self.get_cell_from_pos(pos) & 0b11_1111;
                let mut letter_score = points[tile as usize] as i32;
                
                // Apply letter bonuses to cross-word tiles
                let (bonus_type, multiplier) = self.get_bonus(
                    pos / BOARD_SIZE as u8,
                    pos % BOARD_SIZE as u8
                );
                match bonus_type {
                    BonusType::DoubleLetter => letter_score *= multiplier as i32,
                    BonusType::TripleLetter => letter_score *= multiplier as i32,
                    BonusType::DoubleWord => cross_word_mult *= multiplier,
                    BonusType::TripleWord => cross_word_mult *= multiplier,
                    BonusType::None => {},
                }
                
                cross_score += letter_score;
            }
            
            cross_score *= cross_word_mult as i32;
            total += cross_score;
        }
        
        // Length bonus
        if tiles_used >= LENGTH_BONUS_THRESHOLD {
            total += LENGTH_BONUS_POINTS as i32;
        }
        
        // Apply booster word-level effects
        for booster in &self.active_boosters {
            if let Some(b) = booster {
                total = apply_booster_effect(total, &mv.word, b);
            }
        }
        
        total
    }
}

fn apply_booster_effect(score: i32, _word: &str, booster: &crate::booster::ActiveBooster) -> i32 {
    use crate::booster::ActiveBooster;
    
    match booster {
        ActiveBooster::TripleWord => score * 3,
        ActiveBooster::DoubleLetter => score, // Applied per-letter already
        ActiveBooster::OpenAnchor => score, // Affects board state, not score
    }
}

// --- Phase 2: Static Evaluation ---

pub fn evaluate_move(
    board: &Board,
    mv: &Move,
    rack: &Rack,
    points: &[i8; 27],
    config: &EvaluationConfig,
) -> i32 {
    let raw_score = board.score_move(mv, points);
    
    // 1. Leave Evaluation
    let leave_score = calculate_leave_score(rack, mv, config.round);
    
    // 2. Safety Evaluation
    let safety_penalty = calculate_safety_penalty(board, mv);
    
    raw_score + leave_score - safety_penalty
}

fn calculate_leave_score(rack: &Rack, mv: &Move, round: u8) -> i32 {
    if round >= 5 {
        return 0; // Greedy in final round
    }
    
    // Determine remaining tiles
    let mut counts = [0u8; 27];
    for &t in rack.tiles.iter() {
        if t > 0 { counts[t as usize] += 1; }
    }
    
    // Remove placed tiles
    for &(_, tile) in &mv.placements {
        if counts[tile as usize] > 0 {
            counts[tile as usize] -= 1;
        } else if counts[0] > 0 {
            counts[0] -= 1;
        }
    }
    
    let mut leave_val = 0;
    for i in 0..27 {
        leave_val += counts[i] as i32 * LEAVE_VALUES[i] as i32;
    }
    
    // Round 4 discount
    if round == 4 {
        leave_val /= 2;
    }
    
    leave_val
}

fn calculate_safety_penalty(board: &Board, mv: &Move) -> i32 {
    let mut penalty = 0;
    
    // Check neighbors of placed tiles
    for &(pos, _) in &mv.placements {
        let row = pos / BOARD_SIZE as u8;
        let col = pos % BOARD_SIZE as u8;
        
        // Check 4 directions
        let neighbors = [
            (row.wrapping_sub(1), col),
            (row + 1, col),
            (row, col.wrapping_sub(1)),
            (row, col + 1),
        ];
        
        for &(r, c) in &neighbors {
            if r < BOARD_SIZE as u8 && c < BOARD_SIZE as u8 && !board.is_occupied(r, c) {
                // Empty neighbor - check if it's a multiplier
                let (bonus_type, _) = board.get_bonus(r, c);
                match bonus_type {
                    BonusType::TripleWord => penalty += 25,
                    BonusType::DoubleWord => penalty += 15,
                    BonusType::TripleLetter => penalty += 8,
                    BonusType::DoubleLetter => penalty += 8,
                    BonusType::None => {},
                }
            }
        }
    }
    
    penalty
}
