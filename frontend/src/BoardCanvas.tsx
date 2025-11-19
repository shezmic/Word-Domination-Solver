import React, { useRef, useEffect, useState } from 'react';
import { useSolverStore } from './store';
import { ScoredMove } from './types';

const CELL_SIZE = 40;
const BOARD_SIZE = 9;
const CANVAS_SIZE = CELL_SIZE * BOARD_SIZE;

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { board, rankedMoves, setTile, typingDirection, toggleTypingDirection, selectedCell, setSelectedCell } = useSolverStore();
  const [hoveredMove] = useState<ScoredMove | null>(null);

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
          // Tile background
          ctx.fillStyle = '#fef3c7'; // amber-100
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
          ctx.fill();

          // Tile text
          ctx.fillStyle = '#1f2937'; // gray-800
          ctx.font = 'bold 20px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const char = String.fromCharCode('A'.charCodeAt(0) + letter - 1);
          ctx.fillText(char, x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 1);
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

    // Draw moves (top move or hovered move)
    const move = hoveredMove || (rankedMoves.length > 0 ? rankedMoves[0] : null);
    if (move) {
      for (const [pos, tile] of move.placements) {
        const r = Math.floor(pos / BOARD_SIZE);
        const c = pos % BOARD_SIZE;
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;

        // Ghost tile background
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'; // green-500
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
        ctx.fill();

        // Ghost tile letter
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const char = String.fromCharCode('A'.charCodeAt(0) + tile - 1);
        ctx.fillText(char, x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 1);
      }
    }

  }, [board, rankedMoves, selectedCell, hoveredMove]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      setSelectedCell({ r, c });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <div className="flex flex-col items-center gap-4 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="relative shadow-lg rounded-lg overflow-hidden bg-gray-800 ring-1 ring-gray-900/5">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onClick={handleClick}
          className="cursor-pointer block"
        />
      </div>
      <p className="text-sm text-gray-500 font-medium">
        Click to select • Type to place • Enter to rotate
      </p>
    </div>
  );
};
