#[cfg(test)]
mod tests {
    use crate::board::Board;
    use crate::gaddag::Gaddag;
    use crate::rack::Rack;
    use crate::movegen::MoveGenerator;
    use crate::moves::Direction;
    use std::path::PathBuf;

    #[test]
    fn test_repro_invalid_fn() {
        // 1. Load GADDAG
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push("../dictionary/dictionary.gaddag");
        let gaddag = Gaddag::load(d.to_str().unwrap()).expect("Failed to load GADDAG");

        // 2. Check if "FN" is in dictionary
        let is_fn_valid = gaddag.is_word_valid("FN");
        println!("Is 'FN' valid? {}", is_fn_valid);
        
        // 3. Setup Board with 'F'
        let mut board = Board::new();
        // Place 'F' at (4, 4)
        let f_idx = b'F' - b'A' + 1;
        board.set_cell(4, 4, f_idx | 0b100_0000); // Set F and occupied bit
        
        // Update anchors and cross-checks
        board.update_anchors();
        board.recompute_all_cross_checks(&gaddag);
        
        // 4. Check cross-check at (4, 5) for Vertical move
        // We want to place 'N' at (4, 5) vertically.
        // This means we are checking if 'N' is valid given Horizontal neighbor 'F' at (4, 4).
        // So we check cross_checks_v[4*9 + 5].
        
        let pos = 4 * 9 + 5;
        let mask = board.cross_checks_v[pos];
        let n_idx = b'N' - b'A' + 1; // 14
        let n_bit = 1 << (n_idx - 1);
        
        println!("Cross-check mask at (4,5): {:b}", mask);
        println!("Is 'N' allowed? {}", (mask & n_bit) != 0);
        
        if is_fn_valid {
             println!("WARNING: 'FN' is in the dictionary! The solver is technically correct, but the dictionary is bad.");
        } else {
            assert!((mask & n_bit) == 0, "'N' should NOT be allowed next to 'F' if 'FN' is invalid");
        }
    }
}
