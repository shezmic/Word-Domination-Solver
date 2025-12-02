import React, { useRef, useEffect } from 'react';
import { useSolverStore } from './store';

const CELL_SIZE = 40;
const BOARD_SIZE = 9;
const CANVAS_SIZE = CELL_SIZE * BOARD_SIZE;

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    board, rankedMoves, setTile, typingDirection, toggleTypingDirection,
    selectedCell, setSelectedCell, customPoints,
    activeMove, setActiveMove, lockedCoordinate, setLockedCoordinate
  } = useSolverStore();

  // Draw board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid and bonuses
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        const idx = r * BOARD_SIZE + c;

        // Draw cell background based on bonus
        const bonusVal = board.bonuses[idx];
        const bonusType = bonusVal & 0b11;

        let color = '#374151'; // gray-700
        if (bonusType === 1) color = '#93c5fd'; // DL - blue-300
        if (bonusType === 2) color = '#2563eb'; // TL - blue-600
        if (bonusType === 3) color = '#fca5a5'; // DW - red-300
        if (bonusType === 4) color = '#dc2626'; // TW - red-600

        ctx.fillStyle = color;
        // Add a small gap for grid effect
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        // Draw bonus text
        if (bonusType > 0) {
          ctx.fillStyle = bonusType % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let text = '';
          if (bonusType === 1) text = 'DL';
          if (bonusType === 2) text = 'TL';
          if (bonusType === 3) text = 'DW';
          if (bonusType === 4) text = 'TW';
          ctx.fillText(text, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        }

        // Draw letter
        const letter = board.letters[idx];
        if (letter > 0) {
          // Tile background - Light Beige/Wood color to match reference "T, E, S, T" tiles
          // Reference image shows a light beige/orange tint for tiles.
          // Let's use a color similar to the reference: #F3D299 or similar.
          // Actually, looking at the reference "T E S T", they are light beige.
          // The user also mentioned "current green color" in previous prompts, but now says "copy that design".
          // The reference design has beige tiles for the placed word "TEST".
          // The "Results" card has "TEST" in dark text.
          // The board has "2W", "3L" etc.
          // The user's image 1 shows "TEST" on board with beige tiles.
          // So I will switch to beige tiles.

          ctx.fillStyle = '#e8c39e'; // Beige/Wood color
          ctx.beginPath();
          // Add shadow for 3D effect
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetY = 2;
          ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6);
          ctx.fill();

          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Tile text - Dark Brown/Black for contrast
          ctx.fillStyle = '#3f2e18'; // Dark brown
          ctx.font = 'bold 22px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const char = String.fromCharCode('A'.charCodeAt(0) + letter - 1);
          // Adjust y slightly for visual centering with subscript
          ctx.fillText(char, x + CELL_SIZE / 2, y + CELL_SIZE / 2 - 2);

          // Tile point value (subscript) - Dark Brown/Black
          const points = customPoints[letter];
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillStyle = '#3f2e18';
          // Position in bottom right
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(points.toString(), x + CELL_SIZE - 5, y + CELL_SIZE - 4);
        }
      }
    }

    // Highlight selected cell
    if (selectedCell) {
      const x = selectedCell.c * CELL_SIZE;
      const y = selectedCell.r * CELL_SIZE;
      ctx.strokeStyle = '#fbbf24'; // amber-400
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

      // Draw typing direction indicator
      ctx.fillStyle = 'rgba(251, 191, 36, 0.5)'; // amber-400 with opacity
      ctx.beginPath();
      if (typingDirection === 'horizontal') {
        // Right arrow
        ctx.moveTo(x + CELL_SIZE - 8, y + CELL_SIZE / 2);
        ctx.lineTo(x + CELL_SIZE - 14, y + CELL_SIZE / 2 - 4);
        ctx.lineTo(x + CELL_SIZE - 14, y + CELL_SIZE / 2 + 4);
      } else {
        // Down arrow
        ctx.moveTo(x + CELL_SIZE / 2, y + CELL_SIZE - 8);
        ctx.lineTo(x + CELL_SIZE / 2 - 4, y + CELL_SIZE - 14);
        ctx.lineTo(x + CELL_SIZE / 2 + 4, y + CELL_SIZE - 14);
      }
      ctx.fill();
    }

    // === TACTICAL OVERLAY SYSTEM ===

    // Layer 1: Phantom (Active Move Preview)
    if (activeMove) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;

      for (const [pos, tile] of activeMove.placements) {
        const r = Math.floor(pos / BOARD_SIZE);
        const c = pos % BOARD_SIZE;
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        const idx = r * BOARD_SIZE + c;

        // Skip if cell already occupied
        if (board.letters[idx] > 0) continue;

        // Phantom tile background - Gold
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6);
        ctx.fill();

        // Phantom letter - Dark text
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const char = String.fromCharCode('A'.charCodeAt(0) + tile - 1);
        ctx.fillText(char, x + CELL_SIZE / 2, y + CELL_SIZE / 2 - 2);

        // Phantom point value
        const points = customPoints[tile];
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(points.toString(), x + CELL_SIZE - 5, y + CELL_SIZE - 4);
      }

      ctx.restore();
    }

    // Layer 2: Hotspots (Move Indicators)
    if (rankedMoves.length > 0) {
      // Create move clusters
      const moveClusters = new Map<number, typeof rankedMoves>();
      rankedMoves.slice(0, 20).forEach(move => {
        const startPos = move.placements[0][0];
        if (!moveClusters.has(startPos)) moveClusters.set(startPos, []);
        moveClusters.get(startPos)!.push(move);
      });

      // Draw hotspot dots
      moveClusters.forEach((moves, pos) => {
        const r = Math.floor(pos / BOARD_SIZE);
        const c = pos % BOARD_SIZE;
        const x = c * CELL_SIZE + CELL_SIZE - 12;
        const y = r * CELL_SIZE + 12;

        // Determine color by best move rank in cluster
        const bestRank = rankedMoves.indexOf(moves[0]);
        const color = bestRank < 3 ? '#FFD700' :
          bestRank < 10 ? '#C0C0C0' : '#4A90E2';

        // Draw dot (increased size)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw count if multiple moves at this position
        if (moves.length > 1) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(moves.length.toString(), x, y);
        }
      });
    }

  }, [board, rankedMoves, selectedCell, activeMove, customPoints, typingDirection]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cellIndex = r * BOARD_SIZE + c;

      // Check if this cell has moves (hotspot)
      const moveClusters = new Map<number, typeof rankedMoves>();
      rankedMoves.slice(0, 20).forEach(move => {
        const startPos = move.placements[0][0];
        if (!moveClusters.has(startPos)) moveClusters.set(startPos, []);
        moveClusters.get(startPos)!.push(move);
      });

      const cluster = moveClusters.get(cellIndex);

      if (cluster) {
        // Left click - lock to this cell and show best move
        setLockedCoordinate(cellIndex);
        setActiveMove(cluster[0]);
      } else {
        // Clicked empty area - clear lock but keep selection for typing
        setLockedCoordinate(null);
        setSelectedCell({ r, c });
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent browser context menu

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cellIndex = r * BOARD_SIZE + c;

      // Right click - unlock if this is the locked coordinate
      if (lockedCoordinate === cellIndex) {
        setLockedCoordinate(null);
        // Reset to best move
        if (rankedMoves.length > 0) {
          setActiveMove(rankedMoves[0]);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only cycle if a coordinate is locked
    if (lockedCoordinate === null) return;

    // Get cluster for locked coordinate
    const moveClusters = new Map<number, typeof rankedMoves>();
    rankedMoves.slice(0, 20).forEach(move => {
      const startPos = move.placements[0][0];
      if (!moveClusters.has(startPos)) moveClusters.set(startPos, []);
      moveClusters.get(startPos)!.push(move);
    });

    const cluster = moveClusters.get(lockedCoordinate);
    if (!cluster || !activeMove) return;

    // Only prevent default if we're actually going to cycle
    e.preventDefault();

    // Cycle through moves
    const currentIdx = cluster.indexOf(activeMove);
    let nextIdx;

    if (e.deltaY > 0) {
      // Scroll down - next move
      nextIdx = (currentIdx + 1) % cluster.length;
    } else {
      // Scroll up - previous move
      nextIdx = (currentIdx - 1 + cluster.length) % cluster.length;
    }

    setActiveMove(cluster[nextIdx]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Escape key globally to clear selections
    if (e.key === 'Escape') {
      setSelectedCell(null);
      setLockedCoordinate(null);
      if (rankedMoves.length > 0) {
        setActiveMove(rankedMoves[0]);
      }
      return;
    }
    
    if (!selectedCell) return;

    const { r, c } = selectedCell;

    if (e.key >= 'a' && e.key <= 'z') {
      const letter = e.key.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;
      setTile(r, c, letter);

      // Advance selection
      if (typingDirection === 'horizontal') {
        setSelectedCell({ r, c: Math.min(BOARD_SIZE - 1, c + 1) });
      } else {
        setSelectedCell({ r: Math.min(BOARD_SIZE - 1, r + 1), c });
      }
    } else if (e.key === 'Backspace') {
      setTile(r, c, 0);
      // Move back
      if (typingDirection === 'horizontal') {
        setSelectedCell({ r, c: Math.max(0, c - 1) });
      } else {
        setSelectedCell({ r: Math.max(0, r - 1), c });
      }
    } else if (e.key === 'Delete' || e.key === ' ') {
      setTile(r, c, 0);
    } else if (e.key === 'Enter') {
      toggleTypingDirection();
    } else if (e.key === 'ArrowUp') {
      setSelectedCell({ r: Math.max(0, r - 1), c });
    } else if (e.key === 'ArrowDown') {
      setSelectedCell({ r: Math.min(BOARD_SIZE - 1, r + 1), c });
    } else if (e.key === 'ArrowLeft') {
      setSelectedCell({ r, c: Math.max(0, c - 1) });
    } else if (e.key === 'ArrowRight') {
      setSelectedCell({ r, c: Math.min(BOARD_SIZE - 1, c + 1) });
    }
  };

  const handleDoubleClick = () => {
    // Double-click anywhere on board to clear phantom ghost
    setActiveMove(null);
    setLockedCoordinate(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Only preview on hover if no coordinate is locked
    if (lockedCoordinate !== null) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cellIndex = r * BOARD_SIZE + c;

      // Check if this cell has moves
      const moveClusters = new Map<number, typeof rankedMoves>();
      rankedMoves.slice(0, 20).forEach(move => {
        const startPos = move.placements[0][0];
        if (!moveClusters.has(startPos)) moveClusters.set(startPos, []);
        moveClusters.get(startPos)!.push(move);
      });

      const cluster = moveClusters.get(cellIndex);
      if (cluster) {
        // Preview best move from this cluster
        setActiveMove(cluster[0]);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Board with Coordinates */}
      <div className="inline-flex flex-col">
        {/* Top row - Column labels (A-I) */}
        <div className="flex">
          <div className="w-6"></div> {/* Empty corner */}
          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((letter) => (
            <div
              key={letter}
              className="text-center font-semibold text-gray-600 dark:text-gray-400 text-sm"
              style={{ width: `${CELL_SIZE}px` }}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Board row with left labels */}
        <div className="flex">
          {/* Left column - Row labels (1-9) */}
          <div className="flex flex-col justify-around pr-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <div
                key={num}
                className="text-center font-semibold text-gray-600 dark:text-gray-400 text-sm"
                style={{ height: `${CELL_SIZE}px`, lineHeight: `${CELL_SIZE}px` }}
              >
                {num}
              </div>
            ))}
          </div>

          {/* The actual board */}
          <div className="relative shadow-lg rounded-lg overflow-hidden bg-gray-800 ring-1 ring-gray-900/5">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onWheel={handleWheel}
              onMouseMove={handleMouseMove}
              className="cursor-pointer block"
              role="grid"
              aria-label="Word Domination game board - 9x9 grid. Use arrow keys to navigate, letters to place tiles."
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 font-medium">
        Left-click hotspot to lock • Scroll to cycle • Right-click to unlock • Escape to clear
      </p>

      {/* Hotspot Legend */}
      {rankedMoves.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Hotspot Colors:</div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#FFD700]"></div>
              <span className="text-gray-700 dark:text-gray-300">Top 3</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#C0C0C0]"></div>
              <span className="text-gray-700 dark:text-gray-300">Ranks 4-10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#4A90E2]"></div>
              <span className="text-gray-700 dark:text-gray-300">Ranks 11-20</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
