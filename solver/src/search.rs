use crate::board::Board;
use crate::rack::Rack;
use crate::moves::{Move, ScoredMove, Direction};
use crate::movegen::MoveGenerator;
use crate::gaddag::Gaddag;
use protocol::AnalysisMode;
use std::time::{Duration, Instant};
use rayon::prelude::*;
use rand::SeedableRng;
use rand::rngs::SmallRng;

pub struct SearchConfig {
    pub mode: AnalysisMode,
    pub confidence_threshold: f32,
    pub time_budget_ms: u64,
    pub points: Option<[i8; 27]>,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            mode: AnalysisMode::default(),
            confidence_threshold: 100.0,
            time_budget_ms: 5000,
            points: None,
        }
    }
}

pub struct SearchResult {
    pub moves: Vec<ScoredMove>,
    pub confidence: f32,
    pub compute_time_ms: u16,
}

pub struct RolloutResult {
    pub future_potential: i32,
}

pub fn search(
    board: &Board,
    rack: &Rack,
    gaddag: &Gaddag,
    config: &SearchConfig,
    _time_budget: Duration,
) -> SearchResult {
    let start = Instant::now();
    
    let generator = MoveGenerator::new(board, gaddag, rack);
    let candidates = generator.generate_all();
    
    let width = match config.mode {
        AnalysisMode::Greedy => 1,
        AnalysisMode::Beam { width } => width as usize,
        AnalysisMode::BeamMCTS { width, .. } => width as usize,
    };

    let points = config.points.as_ref().unwrap_or(&crate::constants::LETTER_POINTS);
    
    let mut scored_moves: Vec<ScoredMove> = candidates
        .iter()
        .map(|mv| {
            let mut scored_mv = mv.clone();
            scored_mv.score = board.score_move(mv, points);
            ScoredMove::from_move(&scored_mv)
        })
        .collect();
    
    scored_moves.sort_by(|a, b| b.score.cmp(&a.score));
    scored_moves.truncate(width);
    
    // Phase 2: Adaptive MCTS rollouts
    if let AnalysisMode::BeamMCTS { width: _, rollout_depth } = config.mode {
        if scored_moves.len() >= 3 {
            let scores: Vec<i32> = scored_moves.iter().take(3).map(|m| m.score as i32).collect();
            let variance = population_variance(&scores);
            
            if variance > config.confidence_threshold {
                // Parallel rollouts for top-3 moves
                let top_moves: Vec<_> = scored_moves.iter().take(3).cloned().collect();
                
                let rollout_results: Vec<RolloutResult> = top_moves
                    .par_iter()
                    .map(|sm| {
                        // Reconstruct Move from ScoredMove
                        let mv = Move {
                            placements: sm.placements.clone(),
                            score: sm.score as i32,
                            word: sm.word.clone(),
                            start_row: 0,
                            start_col: 0,
                            direction: Direction::Horizontal,
                        };
                        monte_carlo_rollout(board, rack, gaddag, &mv, rollout_depth, points)
                    })
                    .collect();
                
                // Combine beam score with rollout evaluation
                for (i, sm) in scored_moves.iter_mut().take(3).enumerate() {
                    let rollout_bonus = (rollout_results[i].future_potential as f32 * 0.3) as i16;
                    sm.score += rollout_bonus;
                }
                
                // Re-sort after rollout adjustments
                scored_moves.sort_by(|a, b| b.score.cmp(&a.score));
            }
        }
    }
    
    let scores: Vec<i32> = scored_moves.iter().map(|m| m.score as i32).collect();
    let variance = population_variance(&scores);
    let confidence = 1.0 / (1.0 + variance);
    
    SearchResult {
        moves: scored_moves,
        confidence,
        compute_time_ms: start.elapsed().as_millis() as u16,
    }
}

fn monte_carlo_rollout(
    board: &Board,
    rack: &Rack,
    gaddag: &Gaddag,
    mv: &Move,
    depth: u8,
    points: &[i8; 27],
) -> RolloutResult {
    use rand::SeedableRng;
    use rand::rngs::SmallRng;
    
    let mut board_after = board.clone();
    board_after.play_move(mv);
    
    let mut total_future = 0i32;
    let seed = (board.hash() ^ mv.hash()) as u64;
    let mut rng = SmallRng::seed_from_u64(seed);
    
    for _ in 0..depth {
        // Refill rack
        let mut sim_rack = rack.clone();
        sim_rack.refill(&mut board_after.tile_bag, &mut rng);
        
        // Opponent move (greedy)
        let opp_gen = MoveGenerator::new(&board_after, gaddag, &sim_rack);
        let opp_moves = opp_gen.generate_all();
        
        if let Some(opp_move) = opp_moves.into_iter().max_by_key(|m| board_after.score_move(m, points)) {
            board_after.play_move(&opp_move);
        } else {
            break; // No more moves possible
        }
        
        // Our response
        sim_rack.refill(&mut board_after.tile_bag, &mut rng);
        let our_gen = MoveGenerator::new(&board_after, gaddag, &sim_rack);
        let our_moves = our_gen.generate_all();
        
        if let Some(our_move) = our_moves.into_iter().max_by_key(|m| board_after.score_move(m, points)) {
            total_future += board_after.score_move(&our_move, points);
            board_after.play_move(&our_move);
        } else {
            break;
        }
    }
    
    RolloutResult {
        future_potential: if depth > 0 { total_future / depth as i32 } else { 0 },
    }
}

#[inline(always)]
fn population_variance(values: &[i32]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    let mean = values.iter().sum::<i32>() as f32 / values.len() as f32;
    values.iter().map(|&v| (v as f32 - mean).powi(2)).sum::<f32>() / values.len() as f32
}
