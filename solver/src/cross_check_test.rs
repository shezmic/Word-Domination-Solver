#[cfg(test)]
mod tests {
    use crate::board::Board;
    use crate::gaddag::Gaddag;
    use crate::rack::Rack;
    use crate::movegen::MoveGenerator;
    use crate::moves::Direction;
    use std::str::FromStr;

    #[test]
    fn test_prevent_invalid_cross_words() {
        // Setup: Place "F_XT" horizontally
        // We want to test if placing 'I' at (4,5) is prevented when playing vertically
        // Board coordinates: 0-8. Let's use row 4.
        // F at (4,4), X at (4,6), T at (4,7)
        // Empty spot at (4,5)
        
        let mut board = Board::new();
        // We need to load the actual dictionary for this test to be meaningful
        // Assuming running from 'solver' directory
        let gaddag = Gaddag::load("../dictionary/dictionary.gaddag")
            .or_else(|_| Gaddag::load("dictionary.gaddag"))
            .expect("Failed to load dictionary");
        
        // Place F at (4,4)
        board.set_cell(4, 4, (b'F' - b'A' + 1) | 0b100_0000);
        // Place X at (4,6)
        board.set_cell(4, 6, (b'X' - b'A' + 1) | 0b100_0000);
        // Place T at (4,7)
        board.set_cell(4, 7, (b'T' - b'A' + 1) | 0b100_0000);
        
        // Update anchors and cross-checks
        board.update_anchors();
        board.recompute_all_cross_checks(&gaddag);
        
        // Verify that (4,5) has restricted cross-checks
        // The only valid letter between F and X is 'I' (FIX) or 'A' (FAX) or 'O' (FOX)?
        // Let's check what the mask allows.
        let pos = 4 * 9 + 5;
        let mask = board.cross_checks_v[pos];
        println!("Cross check mask at (4,5): {:b}", mask);
        
        // 'I' is the 9th letter (index 8)
        let i_idx = b'I' - b'A';
        let allows_i = (mask & (1 << i_idx)) != 0;
        println!("Allows 'I': {}", allows_i);
        
        // 'A' is index 0
        let allows_a = (mask & (1 << 0)) != 0;
        println!("Allows 'A': {}", allows_a);
        
        // 'Z' is index 25
        let allows_z = (mask & (1 << 25)) != 0;
        println!("Allows 'Z': {}", allows_z);
        
        // Now try to generate vertical moves with rack "TUX"
        // We want to play TUX vertically through (4,5)
        // If we play T at (3,5), U at (4,5), X at (5,5) -> Word TUX
        // But U at (4,5) forms F-U-X (FUX). Is FUX a word? 
        // If FUX is NOT a word, then U should be forbidden.
        
        // Wait, the user example was "TFIXT".
        // "The solver plays a valid word like "TUX" (Vertical), but in doing so, it places the 'T' next to an existing 'F' (Horizontal). The result is "TFIXT" (Horizontal)"
        // Ah, so the vertical word is TUX.
        // And it places T next to F.
        // So maybe F is at (4,4), and we play T at (4,5).
        // And then we have F-T... which is invalid.
        
        // Let's reproduce the "TFIXT" scenario exactly.
        // Existing: "F" at (4,4).
        // We play "TUX" vertically at col 5.
        // T at (4,5).
        // U at (5,5).
        // X at (6,5).
        // Horizontal word formed: "FT..." (Invalid).
        // So T should be forbidden at (4,5) if F is at (4,4) and nothing at (4,6).
        // Wait, if nothing is at (4,6), then "FT" is the word.
        // "FT" is not a word.
        
        // Let's setup: F at (4,4).
        // Rack: TUX.
        // Try to play TUX vertically at col 5, starting at row 4.
        
        let mut board2 = Board::new();
        board2.set_cell(4, 4, (b'F' - b'A' + 1) | 0b100_0000);
        board2.update_anchors();
        board2.recompute_all_cross_checks(&gaddag);
        
        // Rack::from_str is not implemented, so we construct manually
        // T=20, U=21, X=24
        let rack = Rack::from_tiles(vec![20, 21, 24]);
        let gen = MoveGenerator::new(&board2, &gaddag, &rack);
        let moves = gen.generate_all();
        
        for mv in moves {
            // Check if any move places 'T' at (4,5)
            // T is index 19 (20th letter)
            for &(pos, tile) in &mv.placements {
                if pos == 4 * 9 + 5 && tile == (b'T' - b'A' + 1) {
                    panic!("Solver generated invalid move placing T next to F: {:?}", mv);
                }
            }
        }
    }
}
