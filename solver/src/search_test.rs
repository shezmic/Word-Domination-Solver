
#[cfg(test)]
mod tests {
    use crate::search::{search, SearchConfig};
    use protocol::AnalysisMode;
    use crate::board::Board;
    use crate::gaddag::Gaddag;
    use crate::rack::Rack;
    use std::path::PathBuf;
    use std::time::Duration;

    #[test]
    fn test_updates_reproduction() {
        // 1. Load GADDAG
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push("../dictionary/dictionary.gaddag");
        
        println!("Loading GADDAG from: {:?}", d);
        let gaddag = Gaddag::load(d.to_str().unwrap()).expect("Failed to load GADDAG");
        
        // 2. Verify Dictionary Content
        assert!(gaddag.is_word_valid("UPDATES"), "UPDATES should be valid");
        assert!(!gaddag.is_word_valid("TADU"), "TADU should be invalid");
        assert!(!gaddag.is_word_valid("PEAD"), "PEAD should be invalid");
        assert!(!gaddag.is_word_valid("SP"), "SP should be invalid");

        // 3. Create Board
        let board = Board::new(); // Empty board
        
        // 4. Create Rack "UPDATES"
        // U=21, P=16, D=4, A=1, T=20, E=5, S=19
        let rack = Rack::from_tiles(vec![21, 16, 4, 1, 20, 5, 19]); 
        
        // 5. Config
        let config = SearchConfig {
            mode: AnalysisMode::Greedy,
            confidence_threshold: 100.0,
            time_budget_ms: 5000,
            points: None,
            round: 1,
        };
        
        // 6. Run Search
        let result = search(&board, &rack, &gaddag, &config, Duration::from_millis(5000));
        
        println!("Found {} moves", result.moves.len());
        
        let mut found_updates = false;
        for m in &result.moves {
            if m.word == "UPDATES" {
                found_updates = true;
                println!("Found UPDATES with score {}", m.score);
                break;
            }
        }
        
        assert!(found_updates, "Should find UPDATES");
    }
}
