import React from 'react';
import { useSolverStore } from './store';

export const MoveList: React.FC = () => {
  const {
    rankedMoves, isAnalyzing, computeTime,
    selectedCell, filterBySelected,
    sortBy, minScore, minLength,
    applyMove, setHoveredMove, activeMove
  } = useSolverStore();

  // Filter and sort moves
  const filteredMoves = React.useMemo(() => {
    let moves = rankedMoves;

    // 1. Filter by selected cell
    if (filterBySelected && selectedCell) {
      const targetIdx = selectedCell.r * 9 + selectedCell.c;
      moves = moves.filter(move =>
        move.placements.some(([pos]) => pos === targetIdx)
      );
    }

    // 2. Filter by min score
    if (minScore > 0) {
      moves = moves.filter(move => move.score >= minScore);
    }

    // 3. Filter by min length
    if (minLength > 0) {
      moves = moves.filter(move => move.word.length >= minLength);
    }

    // 4. Sort
    return [...moves].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'length') return b.word.length - a.word.length;
      if (sortBy === 'tiles') return b.placements.length - a.placements.length;
      return 0;
    });
  }, [rankedMoves, selectedCell, filterBySelected, minScore, minLength, sortBy]);

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-transparent border-b-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
        </div>
        <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">Analyzing position...</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Finding the best moves</p>
      </div>
    );
  }

  if (filteredMoves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No moves found</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {filterBySelected && selectedCell
            ? "No moves use the selected cell. Try selecting a different cell or disabling the filter."
            : "Configure the board and rack, then analyze"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Results Card - Shows Active Move */}
      {activeMove && (
        <div className="p-6 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Results</h2>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">Selected Move:</div>
            <div className="text-5xl font-black text-gray-800 dark:text-white tracking-wide mb-6">
              {activeMove.word}
            </div>

            <div className="flex items-center justify-center gap-12 w-full">
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Points:</div>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {activeMove.score}
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Time:</div>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {(computeTime / 1000).toFixed(2)}s
                </div>
              </div>
            </div>

            <button
              onClick={() => applyMove(activeMove)}
              className="mt-6 w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Play Move
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Other Moves List - Scrollable Cutout */}
      <div className="flex-1 min-h-0 p-4">
        {filteredMoves.length > 1 && (
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 mb-2">Alternative Moves</div>
        )}

        <div className="h-full overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {filteredMoves.slice(1).map((move, idx) => (
            <div
              key={idx + 1}
              onClick={() => applyMove(move)}
              onMouseEnter={() => setHoveredMove(move)}
              onMouseLeave={() => setHoveredMove(null)}
              className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 text-sm">
                    #{idx + 2}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{move.word}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{move.placements.length} tiles</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{move.score}</div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      applyMove(move);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
