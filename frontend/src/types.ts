/**
 * Type definitions for Word Domination Solver frontend
 * 
 * These types mirror the Rust protocol definitions and are used
 * for WebSocket communication with the backend solver.
 */

/** Analysis mode determines which search algorithm to use */
export type AnalysisMode =
  | { type: 'greedy' }               // Fast, immediate highest score
  | { type: 'beam'; width: number }   // Balanced quality/speed
  | { type: 'mcts'; width: number; depth: number }; // Best quality with lookahead

/** A scored move returned by the solver */
export interface ScoredMove {
  /** List of [position, tile] pairs where position is 0-80 and tile is 1-26 */
  placements: [number, number][];
  /** Total score including bonuses and cross-words */
  score: number;
  /** The word being played */
  word: string;
}

/** Board state representation */
export interface Board {
  /** 81-element array of tile values (0=empty, 1-26=A-Z) */
  letters: number[];
  /** 81-element array of bonus encodings */
  bonuses: number[];
}

/** Messages sent from frontend to backend */
export type ClientMsg =
  | { Analyze: { 
      board_hash: bigint; 
      rack: number[]; 
      mode: AnalysisMode; 
      time_budget_ms: bigint; 
      custom_points: number[] 
    } }
  | { UpdateBoard: { board: { letters: number[]; bonuses: number[] } } }
  | 'Cancel';

/** Messages sent from backend to frontend */
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
