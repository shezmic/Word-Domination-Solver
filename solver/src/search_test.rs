
#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::Board;
    use crate::gaddag::Gaddag;
    use crate::rack::Rack;
    use std::path::PathBuf;
    use std::sync::Arc;

    #[test]
    fn test_analyze_reproduction() {
        // 1. Load GADDAG
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push("../dictionary/lexicon.gaddag");
        
        println!("Loading GADDAG from: {:?}", d);
        let gaddag = Gaddag::load(d.to_str().unwrap()).expect("Failed to load GADDAG");
        
        // 2. Create Board
        let board = Board::new(); // Empty board
        
        // 3. Create Rack
        let rack = Rack::from_tiles(vec![1, 2, 3, 4, 5, 6, 7]); // A, B, C, D, E, F, G
        
        // 4. Config
        let config = SearchConfig {
            mode: AnalysisMode::Greedy,
            confidence_threshold: 100.0,
            time_budget_ms: 1000,
            points: None,
            round: 1,
        };
        
        // 5. Run Search
        let result = search(&board, &rack, &gaddag, &config, Duration::from_millis(1000));
        
        println!("Found {} moves", result.moves.len());
        if !result.moves.is_empty() {
            println!("Top move: {} ({})", result.moves[0].word, result.moves[0].score);
        }
        
        assert!(!result.moves.is_empty(), "Should find moves on empty board with valid rack");
    }
}
