//! Protocol definitions for Word Domination Solver
//! 
//! This crate defines the message types used for communication between
//! the frontend and backend via WebSocket with bincode serialization.

use serde::{Serialize, Deserialize};

const RACK_SIZE: usize = 7;

/// Analysis mode determines the search algorithm used
#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum AnalysisMode {
    /// Fast greedy search - finds highest immediate score
    Greedy,
    /// Beam search with configurable width for better move quality
    Beam { width: u8 },
    /// Beam search with Monte Carlo rollouts for strategic evaluation
    BeamMCTS { width: u8, rollout_depth: u8 },
}

impl Default for AnalysisMode {
    fn default() -> Self {
        AnalysisMode::BeamMCTS { width: 50, rollout_depth: 3 }
    }
}

/// Messages sent from client (frontend) to server (backend)
#[derive(Serialize, Deserialize, Debug)]
pub enum ClientMsg {
    /// Request move analysis for a given board position
    Analyze {
        /// Hash of the board state (used for caching)
        board_hash: u64,
        /// Current rack tiles (0=blank, 1-26=A-Z)
        rack: Vec<u8>,
        /// Search algorithm to use
        mode: AnalysisMode,
        /// Maximum time to spend on analysis in milliseconds
        time_budget_ms: u64,
        /// Optional custom point values for tiles
        custom_points: Option<[i8; 27]>,
    },
    /// Update the board state
    UpdateBoard {
        board: SerializedBoardData,
    },
    /// Cancel the current analysis
    Cancel,
}

/// Messages sent from server (backend) to client (frontend)
#[derive(Serialize, Deserialize, Debug)]
pub enum ServerMsg {
    /// Progress update during analysis
    Progress {
        moves_evaluated: u32,
        best_score: i16,
    },
    /// Analysis complete with results
    Result {
        moves: Vec<ScoredMove>,
        confidence: f32,
        compute_time_ms: u16,
    },
    /// Board state successfully stored
    BoardStored {
        board_hash: u64,
    },
    /// Error occurred during processing
    Error(String),
}

/// A move with its computed score
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScoredMove {
    /// List of (position, tile) pairs for tiles to place
    /// Position is 0-80 (row*9+col), tile is 1-26 for A-Z
    pub placements: Vec<(u8, u8)>,
    /// Total score including bonuses and cross-words
    pub score: i16,
    /// The word being played
    pub word: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SerializedBoardData {
    pub letters: Vec<u8>,
    pub bonuses: Vec<u8>,
}
