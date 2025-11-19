use crate::board::{Board, BonusType};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Booster {
    FreezeTime,
    BonusTile(BonusType, u8), // Type, Location (0-80)
    Rocket(u8),               // Location (0-80)
    RefreshRack,
}

impl Booster {
    pub fn apply(&self, board: &mut Board) {
        match self {
            Booster::BonusTile(bonus_type, pos) => {
                let row = pos / crate::constants::BOARD_SIZE as u8;
                let col = pos % crate::constants::BOARD_SIZE as u8;
                // Multiplier is implied by type? 
                // BonusType enum doesn't store multiplier, but board set_bonus needs it.
                // DL=2, TL=3, DW=2, TW=3.
                let multiplier = match bonus_type {
                    BonusType::DoubleLetter | BonusType::DoubleWord => 2,
                    BonusType::TripleLetter | BonusType::TripleWord => 3,
                    _ => 1,
                };
                board.set_bonus(row, col, *bonus_type, multiplier);
            },
            Booster::Rocket(pos) => {
                let row = pos / crate::constants::BOARD_SIZE as u8;
                let col = pos % crate::constants::BOARD_SIZE as u8;
                // Clear the cell
                // We need to be careful if we remove a tile that breaks board connectivity?
                // In Word Domination, you can destroy tiles.
                // We just set it to empty.
                // But we must preserve the bonus if any?
                // Usually Rocket destroys the tile but keeps the bonus underneath?
                // Or destroys everything?
                // Assuming it destroys the tile (makes it empty).
                // We need to clear the letter bits but keep bonus bits?
                // `set_cell` overwrites the letter bits (0-6) and occupied bit (7).
                // `bonus_map` is separate.
                // So we just set cell to 0.
                board.set_cell(row, col, 0);
                
                // We also need to update anchors because connectivity changed!
                board.update_anchors();
                
                // And cross-checks!
                // Since board changed, we should technically recompute cross-checks.
                // But `Board` doesn't have a reference to GADDAG.
                // So we can't recompute cross-checks here easily.
                // The caller must handle recomputing cross-checks if they modify the board structure.
                // For now, we just modify the board state.
            },
            Booster::FreezeTime => {
                // No board change
            },
            Booster::RefreshRack => {
                // No board change
            },
        }
    }
}

// Legacy support if needed, or we can remove ActiveBooster
// The scoring.rs used ActiveBooster. We should update scoring.rs if we remove it.
// But scoring.rs uses `active_boosters` field on Board.
// We should probably update `Board` to use the new `Booster` enum or a simplified version for active effects.
// Actually, `ActiveBooster` in `booster.rs` was:
// pub enum ActiveBooster { TripleWord, OpenAnchor, DoubleLetter }
// These seem to be "passive" effects or "active" in the sense of "currently active on board".
// The new `Booster` enum represents the "Card" you play.
// Once played, `BonusTile` changes the board permanently (until end of game).
// `Rocket` changes board permanently.
// `FreezeTime` is a one-time effect on time.
// `RefreshRack` is a one-time effect on rack.
//
// So `active_boosters` in `Board` might be for something else?
// In the original code, `active_boosters` seemed to be for "Global Effects" like "All words are Triple Word".
// If Word Domination has such boosters, we keep `ActiveBooster`.
// But the user request focused on `BonusTile`, `Rocket`, `FreezeTime`, `RefreshRack`.
// These are "Instant" effects.
//
// So I will keep `ActiveBooster` for now to avoid breaking `scoring.rs` (which iterates `active_boosters`),
// but I will define `Booster` for the new logic.

#[derive(Clone, Copy)]
pub enum ActiveBooster {
    TripleWord,
    OpenAnchor,
    DoubleLetter,
}
