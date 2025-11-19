export type AnalysisMode =
  | { type: 'greedy' }
  | { type: 'beam'; width: number }
  | { type: 'mcts'; width: number; depth: number };

export interface ScoredMove {
  placements: [number, number][];
  score: number;
  word: string;
}

export interface Board {
  letters: number[];
  bonuses: number[];
}

export type ClientMsg =
  | { Analyze: { board_hash: bigint; rack: number[]; mode: AnalysisMode; time_budget_ms: bigint; custom_points: number[] } }
  | { UpdateBoard: { board: { letters: number[]; bonuses: number[] } } }
  | 'Cancel';

export type ServerMsg =
  | { Progress: { moves_evaluated: number; best_score: number } }
  | { Result: { moves: ScoredMove[]; confidence: number; compute_time_ms: number } }
  | { BoardStored: { board_hash: number } }
  | { Error: string };

export interface SolverState {
  board: Board;
  rack: number[];
  isAnalyzing: boolean;
  rankedMoves: ScoredMove[];
  ws: WebSocket | null;
  currentBoardHash: bigint | null;
  confidence: number;
  computeTime: number;
}
