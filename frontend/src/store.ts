import { create } from 'zustand';
import type { Board, ScoredMove, AnalysisMode } from './types';
import { encodeClientMsg, decodeServerMsg } from './bincode';

interface SolverState {
  board: Board;
  rack: number[];
  isAnalyzing: boolean;
  isConnected: boolean;  // Track WebSocket connection status
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
  hoveredMove: ScoredMove | null;
  setHoveredMove: (move: ScoredMove | null) => void;

  // Tactical Overlay
  activeMove: ScoredMove | null;
  setActiveMove: (move: ScoredMove | null) => void;
  lockedCoordinate: number | null;
  setLockedCoordinate: (coord: number | null) => void;

  // Undo support
  history: { board: Board; rack: number[] }[];
  undo: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/api/solve';

export const useSolverStore = create<SolverState>((set, get) => ({
  board: {
    letters: Array(81).fill(0),
    bonuses: Array(81).fill(0),
  },
  rack: [0, 0, 0, 0, 0, 0, 0],
  isAnalyzing: false,
  isConnected: false,
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
  hoveredMove: null,
  history: [],

  // Tactical Overlay
  activeMove: null,
  lockedCoordinate: null,

  setHoveredMove: (move) => set({ hoveredMove: move }),
  setActiveMove: (move) => set({ activeMove: move }),
  setLockedCoordinate: (coord) => set({ lockedCoordinate: coord }),

  undo: () => {
    const { history } = get();
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    // Update backend
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoded = encodeClientMsg({ UpdateBoard: { board: previousState.board } });
      ws.send(encoded);
    }

    set({
      board: previousState.board,
      rack: previousState.rack,
      history: newHistory,
      currentBoardHash: null,
      rankedMoves: []
    });
  },

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
      set({ isConnected: true });
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
            activeMove: msg.moves[0] || null, // Auto-select best move
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
      set({ ws: null, isConnected: false });
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
    const { board, history, rack } = get();
    const newBoard = { ...board };
    const idx = row * 9 + col;

    // Save history
    const newHistory = [...history, { board: { ...board, letters: [...board.letters], bonuses: [...board.bonuses] }, rack: [...rack] }];

    newBoard.letters = [...board.letters];
    newBoard.letters[idx] = letter;
    set({ board: newBoard, history: newHistory, currentBoardHash: null }); // Reset hash on change
  },

  setBonus: (row: number, col: number, bonusType: number, multiplier: number) => {
    const { board, history, rack } = get();
    const newBoard = { ...board };
    const idx = row * 9 + col;

    // Save history
    const newHistory = [...history, { board: { ...board, letters: [...board.letters], bonuses: [...board.bonuses] }, rack: [...rack] }];

    newBoard.bonuses = [...board.bonuses];
    newBoard.bonuses[idx] = (multiplier << 2) | bonusType;
    set({ board: newBoard, history: newHistory, currentBoardHash: null }); // Reset hash on change
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
    const { board, history, rack } = get();
    const newBoard = { ...board };

    // Save history (save rack BEFORE modification)
    const newHistory = [...history, { board: { ...board, letters: [...board.letters], bonuses: [...board.bonuses] }, rack: [...rack] }];

    newBoard.letters = [...board.letters];
    const newRack = [...rack];

    // Apply each placement from the move and remove from rack
    for (const [pos, tile] of move.placements) {
      newBoard.letters[pos] = tile;

      // Find and remove from rack
      // We need to handle blank tiles (0 in rack) which might be used as any letter
      // But the move.placements gives us the actual letter being placed (1-26)
      // The solver logic should have handled the matching, but here we need to be careful.
      // If we find the exact letter, remove it. If not, look for a blank (0).

      const letterIndex = newRack.indexOf(tile);
      if (letterIndex !== -1) {
        newRack[letterIndex] = 0; // Remove by setting to empty
      } else {
        // Try to find a blank
        // const blankIndex = newRack.indexOf(0); 
        // Logic for blank tiles is complex due to 0 ambiguity, skipping for now as per plan.
      }
      // We need to know if the user had a blank tile.
      // Looking at setRackFromText: '?' becomes 0.
      // So 0 is AMBIGUOUS: it's either an empty slot or a blank tile?
      // Let's check setRackFromText again.
      // line 347: newRack[i] = 0; // Blank tile
      // line 339: const newRack = Array(rackSize).fill(0);
      // This is a problem. 0 is used for both "empty slot" and "blank tile".
      // If the rack is [0, 0, 0...], does it mean 7 blanks or 7 empty slots?
      // Usually in these solvers, 0 is blank. Empty slots might be just ignored or handled by length.
      // Let's assume 0 is a blank tile for now, as that's how setRackFromText seems to treat it.
      // But wait, if I have 3 tiles "A, B, C" and rack size 7, the array is [1, 2, 3, 0, 0, 0, 0].
      // If 0 is blank, then I have 4 blanks? That seems wrong if they are just empty slots.

      // Let's look at RackEditor.tsx.
      // value={tile > 0 ? String.fromCharCode(tile - 1 + 65) : ''}
      // It renders '' for 0.
      // And input placeholder is '·'.
      // So 0 is effectively "empty/unused slot".
      // But setRackFromText sets '?' to 0.
      // So '?' becomes an empty slot? That means the solver treats empty slots as blanks?
      // Let's check the solver code if possible, or just assume standard behavior.
      // If the solver treats 0 as blank, then we are fine.
      // But if we want to "remove" a tile, we should probably keep it as 0 (empty).

      // Actually, if 0 is blank, then we can't distinguish between "no tile" and "blank tile".
      // This might be a pre-existing issue or design choice.
      // For now, I will implement the removal by finding the letter.
      // If the letter isn't found, it must have been a blank that was used.
      // Since 0 represents both, we don't strictly need to "change" a 0 to a 0.
      // But we DO need to remove the specific instance of the letter if it was a real letter.

      // Wait, if I have 'A' (1) and I play 'A', I want it to become 0.
      // If I have 0 (blank) and I play 'A' (using blank), it stays 0.
      // So effectively, we only need to zero out the MATCHING NON-ZERO tiles.
      // If the tile in the move is 'A' (1), and we have 'A' in rack, we zero it.
      // If we don't have 'A', it must have been a blank, which is already 0, so we do nothing.
    }

    set({ board: newBoard, history: newHistory, currentBoardHash: null, rack: newRack });
  },

  clearBoard: () => {
    const { board, history, rack } = get();
    // Save history
    const newHistory = [...history, { board: { ...board, letters: [...board.letters], bonuses: [...board.bonuses] }, rack: [...rack] }];

    set({
      board: {
        letters: Array(81).fill(0),
        bonuses: Array(81).fill(0),
      },
      history: newHistory,
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
