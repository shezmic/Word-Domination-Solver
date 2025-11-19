import { create } from 'zustand';
import type { Board, ScoredMove, AnalysisMode } from './types';
import { encodeClientMsg, decodeServerMsg } from './bincode';

interface SolverState {
  board: Board;
  rack: number[];
  isAnalyzing: boolean;
  rankedMoves: ScoredMove[];
  ws: WebSocket | null;
  currentBoardHash: bigint | null; // Changed to bigint for 64-bit hash
  confidence: number;
  computeTime: number;
  typingDirection: 'horizontal' | 'vertical';
  selectedCell: { r: number; c: number } | null;
  filterBySelected: boolean;
  sortBy: 'score' | 'length' | 'tiles';
  minScore: number;
  minLength: number;
  customPoints: number[];
  rackSize: number;
  theme: 'light' | 'dark' | 'system';

  connect: () => void;
  disconnect: () => void;
  updateBoard: (board: Board) => void;
  updateRack: (rack: number[]) => void;
  analyze: (mode: AnalysisMode, timeBudget: number) => void;
  cancel: () => void;
  setTile: (row: number, col: number, letter: number) => void;
  setBonus: (row: number, col: number, bonusType: number, multiplier: number) => void;
  toggleTypingDirection: () => void;
  setSelectedCell: (cell: { r: number; c: number } | null) => void;
  toggleFilterBySelected: () => void;
  setSortBy: (sort: 'score' | 'length' | 'tiles') => void;
  setMinScore: (score: number) => void;
  setMinLength: (length: number) => void;
  setCustomPoints: (points: number[]) => void;
  setRackSize: (size: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  applyMove: (move: ScoredMove) => void;
  clearBoard: () => void;
  setRackFromText: (text: string) => void;
  pendingAnalysis: { mode: AnalysisMode; timeBudget: number } | null;
  reconnectTimeoutId: number | null;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/api/solve';

export const useSolverStore = create<SolverState>((set, get) => ({
  board: {
    letters: Array(81).fill(0),
    bonuses: Array(81).fill(0),
  },
  rack: [0, 0, 0, 0, 0, 0, 0],
  isAnalyzing: false,
  rankedMoves: [],
  ws: null,
  currentBoardHash: null,
  confidence: 0,
  computeTime: 0,
  typingDirection: 'horizontal',
  selectedCell: null,
  filterBySelected: false,
  sortBy: 'score',
  minScore: 0,
  minLength: 0,
  customPoints: [0, 1, 4, 4, 2, 1, 4, 3, 4, 1, 10, 5, 2, 4, 2, 1, 4, 10, 1, 1, 1, 2, 5, 4, 8, 3, 10],
  rackSize: 7,
  theme: 'system',
  pendingAnalysis: null,
  reconnectTimeoutId: null,

  connect: () => {
    const { ws, reconnectTimeoutId } = get();
    if (ws) return; // Already connected or connecting

    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      set({ reconnectTimeoutId: null });
    }

    const socket = new WebSocket(WS_URL);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      console.log('Connected to solver');
    };

    socket.onmessage = (event) => {
      try {
        const msg = decodeServerMsg(event.data);

        if (msg.type === 'Result') {
          set({
            rankedMoves: msg.moves,
            confidence: msg.confidence,
            computeTime: msg.compute_time_ms,
            isAnalyzing: false,
          });
        } else if (msg.type === 'Progress') {
          console.log(`Progress: ${msg.moves_evaluated} moves, best: ${msg.best_score}`);
        } else if (msg.type === 'BoardStored') {
          set({ currentBoardHash: msg.board_hash });

          // Check if we have a pending analysis waiting for this hash
          const { pendingAnalysis, ws, rack, customPoints } = get();
          if (pendingAnalysis && ws && ws.readyState === WebSocket.OPEN) {
            console.log('Triggering pending analysis for hash:', msg.board_hash);
            const encoded = encodeClientMsg({
              Analyze: {
                board_hash: msg.board_hash,
                rack,
                mode: pendingAnalysis.mode,
                time_budget_ms: BigInt(pendingAnalysis.timeBudget),
                custom_points: customPoints,
              }
            });
            ws.send(encoded);
            set({ pendingAnalysis: null, isAnalyzing: true });
          }
        } else if (msg.type === 'Error') {
          console.error('Server error:', msg.message);
          set({ isAnalyzing: false, pendingAnalysis: null });
        }
      } catch (e) {
        console.error('Failed to decode message:', e);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('Disconnected from solver, attempting reconnect in 1s...');
      set({ ws: null });
      const timeoutId = setTimeout(() => {
        get().connect();
      }, 1000);
      set({ reconnectTimeoutId: timeoutId as unknown as number }); // setTimeout returns NodeJS.Timeout in Node, number in browser
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws, reconnectTimeoutId } = get();
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      set({ reconnectTimeoutId: null });
    }
    if (ws) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
      set({ ws: null });
    }
  },

  updateBoard: (board) => {
    const { ws } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const encoded = encodeClientMsg({ UpdateBoard: { board } });
    ws.send(encoded);

    set({ board });
  },

  updateRack: (rack) => {
    set({ rack });
  },

  analyze: (mode, timeBudget) => {
    const { ws, currentBoardHash, rack, board } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot analyze: WebSocket not connected');
      return;
    }

    // Helper to send analyze request
    const sendAnalyze = (hash: bigint) => {
      console.log('Sending analyze request for hash:', hash);
      const encoded = encodeClientMsg({
        Analyze: {
          board_hash: hash,
          rack,
          mode,
          time_budget_ms: BigInt(timeBudget),
          custom_points: get().customPoints,
        }
      });
      ws.send(encoded);
      set({ isAnalyzing: true });
    };

    // Update board first if needed
    if (currentBoardHash === null) {
      console.log('Board hash is null, updating board and queueing analysis...');
      get().updateBoard(board);
      set({ pendingAnalysis: { mode, timeBudget }, isAnalyzing: true });
    } else {
      sendAnalyze(currentBoardHash);
    }
  },

  cancel: () => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoded = encodeClientMsg('Cancel');
      ws.send(encoded);
    }
    set({ isAnalyzing: false, pendingAnalysis: null });
  },

  setTile: (row: number, col: number, letter: number) => {
    const { board } = get();
    const newBoard = { ...board };
    const idx = row * 9 + col;
    newBoard.letters = [...board.letters];
    newBoard.letters[idx] = letter;
    set({ board: newBoard, currentBoardHash: null }); // Reset hash on change
  },

  setBonus: (row: number, col: number, bonusType: number, multiplier: number) => {
    const { board } = get();
    const newBoard = { ...board };
    const idx = row * 9 + col;
    newBoard.bonuses = [...board.bonuses];
    newBoard.bonuses[idx] = (multiplier << 2) | bonusType;
    set({ board: newBoard, currentBoardHash: null }); // Reset hash on change
  },

  toggleTypingDirection: () => {
    set((state) => ({
      typingDirection: state.typingDirection === 'horizontal' ? 'vertical' : 'horizontal',
    }));
  },

  setSelectedCell: (cell) => {
    set({ selectedCell: cell });
  },

  toggleFilterBySelected: () => {
    set((state) => ({ filterBySelected: !state.filterBySelected }));
  },

  setSortBy: (sortBy) => set({ sortBy }),
  setMinScore: (minScore) => set({ minScore }),
  setMinLength: (minLength) => set({ minLength }),

  setCustomPoints: (customPoints) => set({ customPoints }),

  setRackSize: (rackSize) => {
    set((state) => {
      // Resize rack array if needed
      let newRack = [...state.rack];
      if (newRack.length < rackSize) {
        newRack = [...newRack, ...Array(rackSize - newRack.length).fill(0)];
      } else if (newRack.length > rackSize) {
        newRack = newRack.slice(0, rackSize);
      }
      return { rackSize, rack: newRack };
    });
  },

  setTheme: (theme) => set({ theme }),

  applyMove: (move) => {
    const { board } = get();
    const newBoard = { ...board };
    newBoard.letters = [...board.letters];

    // Apply each placement from the move
    for (const [pos, tile] of move.placements) {
      newBoard.letters[pos] = tile;
    }

    set({ board: newBoard, currentBoardHash: null });
  },

  clearBoard: () => {
    set({
      board: {
        letters: Array(81).fill(0),
        bonuses: Array(81).fill(0),
      },
      currentBoardHash: null,
      rankedMoves: [],
    });
  },

  setRackFromText: (text) => {
    const { rackSize } = get();
    const newRack = Array(rackSize).fill(0);
    const upperText = text.toUpperCase();

    for (let i = 0; i < Math.min(upperText.length, rackSize); i++) {
      const char = upperText[i];
      if (char >= 'A' && char <= 'Z') {
        newRack[i] = char.charCodeAt(0) - 'A'.charCodeAt(0) + 1; // A=1, B=2, ..., Z=26
      } else if (char === '?' || char === ' ' || char === '_') {
        newRack[i] = 0; // Blank tile
      }
    }

    set({ rack: newRack });
  },
}));
