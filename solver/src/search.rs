use crate::board::Board;
use crate::rack::Rack;
use crate::moves::{Move, ScoredMove, Direction};
use crate::movegen::MoveGenerator;
use crate::gaddag::Gaddag;
use crate::scoring::{self, EvaluationConfig};
use crate::booster::Booster;
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
    pub round: u8,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            mode: AnalysisMode::default(),
            confidence_threshold: 100.0,
            time_budget_ms: 1500, // Hard limit 1.5s
            points: None,
            round: 1,
        }
    }
}

pub struct SearchResult {
    pub moves: Vec<ScoredMove>,
    pub confidence: f32,
    pub compute_time_ms: u16,
    pub best_booster: Option<Booster>,
    pub moves_evaluated: u32,  // Track how many moves were evaluated
}

pub struct RolloutResult {
    pub future_potential: i32,
}

pub fn search(
    board: &Board,
    rack: &Rack,
    gaddag: &Gaddag,
    config: &SearchConfig,
    time_budget: Duration,
) -> SearchResult {
    let start = Instant::now();
    
    // 1. Generation (Fast, <10ms with Anchor Logic)
    let generator = MoveGenerator::new(board, gaddag, rack);
    let candidates = generator.generate_all();
    
    let width = match config.mode {
        AnalysisMode::Greedy => 1,
        AnalysisMode::Beam { width } => width as usize,
        AnalysisMode::BeamMCTS { width, .. } => width as usize,
    };

    let points = config.points.as_ref().unwrap_or(&crate::constants::LETTER_POINTS);
    let eval_config = EvaluationConfig { round: config.round };
    
    // 2. Static Evaluation
    let mut scored_moves: Vec<ScoredMove> = candidates
        .iter()
        .map(|mv| {
            let mut scored_mv = mv.clone();
            scored_mv.score = scoring::evaluate_move(board, mv, rack, points, &eval_config);
            ScoredMove::from_move(&scored_mv)
        })
        .collect();
    
    scored_moves.sort_by(|a, b| b.score.cmp(&a.score));
    
    // Keep more moves for the UI, but only use 'width' for MCTS
    let return_limit = std::cmp::max(width, 50);
    scored_moves.truncate(return_limit);
    
    // 3. Adaptive MCTS / Iterative Deepening
    // Only proceed if we have time and candidates
    if !scored_moves.is_empty() && start.elapsed() < time_budget {
        if let AnalysisMode::BeamMCTS { width: _, rollout_depth } = config.mode {
            // Check if we have enough time for rollouts
            // Assume each rollout takes ~5ms? 
            // If we have < 200ms elapsed, we can try.
            if start.elapsed().as_millis() < 200 {
                if scored_moves.len() >= width && width > 1 {
                    let scores: Vec<i32> = scored_moves.iter().take(width).map(|m| m.score as i32).collect();
                    let variance = population_variance(&scores);
                    
                    if variance > config.confidence_threshold {
                        let top_moves: Vec<_> = scored_moves.iter().take(width).cloned().collect();
                        
                        // Run parallel rollouts
                        let rollout_results: Vec<RolloutResult> = top_moves
                            .par_iter()
                            .map(|sm| {
                                let mv = Move {
                                    placements: sm.placements.clone(),
                                    score: sm.score as i32,
                                    word: sm.word.clone(),
                                    start_row: 0,
                                    start_col: 0,
                                    direction: Direction::Horizontal,
                                };
                                monte_carlo_rollout(board, rack, gaddag, &mv, rollout_depth, points, &eval_config)
                            })
                            .collect();
                        
                        for (i, sm) in scored_moves.iter_mut().take(3).enumerate() {
                            let rollout_bonus = (rollout_results[i].future_potential as f32 * 0.3) as i16;
                            sm.score += rollout_bonus;
                        }
                        
                        scored_moves.sort_by(|a, b| b.score.cmp(&a.score));
                    }
                }
            }
        }
    }
    
    let scores: Vec<i32> = scored_moves.iter().map(|m| m.score as i32).collect();
    let variance = population_variance(&scores);
    let confidence = 1.0 / (1.0 + variance);
    
    let moves_evaluated = candidates.len() as u32;

    SearchResult {
        moves: scored_moves,
        confidence,
        compute_time_ms: start.elapsed().as_millis() as u16,
        best_booster: None,
        moves_evaluated,
    }
}pub fn find_best_move_with_boosters(
    board: &Board,
    rack: &Rack,
    gaddag: &Gaddag,
    config: &SearchConfig,
    boosters: &[Booster],
) -> SearchResult {
    let start_total = Instant::now();
    let time_limit = Duration::from_millis(config.time_budget_ms);
    
    // 1. Base Search
    let mut base_result = search(board, rack, gaddag, config, time_limit);
    
    if base_result.moves.is_empty() {
        return base_result;
    }
    
    let base_score = base_result.moves[0].score;
    
    // Quick Fail: If base score is low, don't bother with expensive simulations
    if base_score < 20 {
        return base_result;
    }
    
    // Check time before booster simulations
    if start_total.elapsed() > time_limit / 2 {
        // If we already spent half our budget, skip boosters to be safe
        return base_result;
    }
    
    let mut best_boosted_score = base_score;
    let mut best_booster = None;
    let mut best_moves = base_result.moves.clone();
    
    let points = config.points.as_ref().unwrap_or(&crate::constants::LETTER_POINTS);
    
    for booster in boosters {
        // Time check per booster
        if start_total.elapsed() > time_limit {
            break;
        }

        match booster {
            Booster::FreezeTime => {
                // Logic: If we are very low on time? 
                // Or just suggest it if we found a complex board?
                // For now, skip.
            },
            Booster::RefreshRack => {
                // EV Calculation
                let avg_tile_val = calculate_avg_tile_value(points);
                let current_rack_val: i32 = rack.tiles.iter()
                    .map(|&t| points[t as usize] as i32)
                    .sum();
                
                // EV of 7 random tiles vs current rack
                let ev_gain = (avg_tile_val * 7.0) - current_rack_val as f32;
                
                // If EV gain is massive (e.g. > 20) AND base_score is mediocre?
                // But we only check boosters if base_score > 20.
                // So this is for "I have a move, but my rack is trash for next turn".
                // RefreshRack gives new tiles.
                // If we use it, we pass turn? Or play with new tiles?
                // Assuming we play with new tiles:
                // We can't simulate the move with new tiles.
                // We can only say "Expected Score with New Tiles" > "Current Best Score".
                // Expected Score ~ (Avg Move Score for Rack Quality X).
                // This is hard to estimate.
                // Simplified: If EV gain > 25, suggest it.
                if ev_gain > 25.0 {
                     // We can't return a "Move" for RefreshRack easily unless we have a special Move type.
                     // Or we just attach the booster to the best move?
                     // If RefreshRack is an instant action that gives new tiles, we should return it as a suggestion.
                     // But `SearchResult` expects `moves`.
                     // We'll just mark it as `best_booster` but keep `best_moves` as is?
                     // No, if we RefreshRack, we can't play the `base_moves`.
                     // We return empty moves? Or a dummy move?
                     // Let's skip for now to avoid breaking contract.
                }
            },
            Booster::BonusTile(_, _) | Booster::Rocket(_) => {
                let mut sim_board = board.clone();
                booster.apply(&mut sim_board);
                
                if let Booster::Rocket(pos) = booster {
                    let row = pos / crate::constants::BOARD_SIZE as u8;
                    // Recompute cross checks for the affected row
                    unsafe {
                        sim_board.recompute_cross_checks_row(row, gaddag);
                        // Ideally also vertical, but we skip for speed/complexity
                    }
                }
                
                // Run search on boosted board
                // Allocate remaining time
                let remaining = time_limit.saturating_sub(start_total.elapsed());
                let sim_result = search(&sim_board, rack, gaddag, config, remaining);
                
                if !sim_result.moves.is_empty() {
                    let sim_score = sim_result.moves[0].score;
                    // Threshold: Booster must add significant value (e.g. 15 pts)
                    if sim_score > best_boosted_score + 15 {
                        best_boosted_score = sim_score;
                        best_booster = Some(*booster);
                        best_moves = sim_result.moves;
                    }
                }
            }
        }
    }
    
    if let Some(b) = best_booster {
        SearchResult {
            moves: best_moves,
            confidence: base_result.confidence,
            compute_time_ms: start_total.elapsed().as_millis() as u16,
            best_booster: Some(b),
            moves_evaluated: base_result.moves_evaluated,
        }
    } else {
        base_result
    }
}

fn calculate_avg_tile_value(points: &[i8; 27]) -> f32 {
    let mut total_score = 0;
    let mut total_count = 0;
    for (i, &(idx, count)) in crate::constants::TILE_DISTRIBUTION.iter().enumerate() {
        let val = points[idx as usize] as i32;
        total_score += val * count as i32;
        total_count += count;
    }
    if total_count > 0 {
        total_score as f32 / total_count as f32
    } else {
        0.0
    }
}

fn monte_carlo_rollout(
    board: &Board,
    rack: &Rack,
    gaddag: &Gaddag,
    mv: &Move,
    depth: u8,
    points: &[i8; 27],
    eval_config: &EvaluationConfig,
) -> RolloutResult {
    use rand::SeedableRng;
    use rand::rngs::SmallRng;
    
    let mut board_after = board.clone();
    board_after.play_move(mv, gaddag);
    
    let mut total_future = 0i32;
    let seed = (board.hash() ^ mv.hash()) as u64;
    let mut rng = SmallRng::seed_from_u64(seed);
    
    for _ in 0..depth {
        let mut sim_rack = rack.clone();
        sim_rack.refill(&mut board_after.tile_bag, &mut rng);
        
        let opp_gen = MoveGenerator::new(&board_after, gaddag, &sim_rack);
        let opp_moves = opp_gen.generate_all();
        
        if let Some(opp_move) = opp_moves.into_iter().max_by_key(|m| board_after.score_move(m, points)) {
            board_after.play_move(&opp_move, gaddag);
        } else {
            break;
        }
        
        sim_rack.refill(&mut board_after.tile_bag, &mut rng);
        let our_gen = MoveGenerator::new(&board_after, gaddag, &sim_rack);
        let our_moves = our_gen.generate_all();
        
        if let Some(our_move) = our_moves.into_iter().max_by_key(|m| scoring::evaluate_move(&board_after, m, &sim_rack, points, eval_config)) {
            total_future += scoring::evaluate_move(&board_after, &our_move, &sim_rack, points, eval_config);
            board_after.play_move(&our_move, gaddag);
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
