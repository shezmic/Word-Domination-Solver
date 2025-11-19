use serde::{Serialize, Deserialize};

const RACK_SIZE: usize = 7;

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum AnalysisMode {
    Greedy,
    Beam { width: u8 },
    BeamMCTS { width: u8, rollout_depth: u8 },
}

impl Default for AnalysisMode {
    fn default() -> Self {
        AnalysisMode::BeamMCTS { width: 50, rollout_depth: 3 }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum ClientMsg {
    Analyze {
        board_hash: u64,
        rack: Vec<u8>,
        mode: AnalysisMode,
        time_budget_ms: u64,
        custom_points: Option<[i8; 27]>,
    },
    UpdateBoard {
        board: SerializedBoardData,
    },
    Cancel,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum ServerMsg {
    Progress {
        moves_evaluated: u32,
        best_score: i16,
    },
    Result {
        moves: Vec<ScoredMove>,
        confidence: f32,
        compute_time_ms: u16,
    },
    BoardStored {
        board_hash: u64,
    },
    Error(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScoredMove {
    pub placements: Vec<(u8, u8)>,
    pub score: i16,
    pub word: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SerializedBoardData {
    pub letters: Vec<u8>,
    pub bonuses: Vec<u8>,
}
