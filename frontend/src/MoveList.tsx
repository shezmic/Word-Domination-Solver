import React from 'react';
import { useSolverStore } from './store';

export const MoveList: React.FC = () => {
  const {
    rankedMoves, isAnalyzing, confidence, computeTime,
    selectedCell, filterBySelected,
    sortBy, minScore, minLength,
    setSortBy, setMinScore, setMinLength
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
        <p className="mt-6 text-lg font-medium text-gray-700">Analyzing position...</p>
        <p className="mt-2 text-sm text-gray-500">Finding the best moves</p>
      </div>
    );
  }

  if (filteredMoves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <div className="bg-gray-100 p-4 rounded-full mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-700">No moves found</p>
        <p className="text-sm text-gray-500 mt-2">
          {filterBySelected && selectedCell
            ? "No moves use the selected cell. Try selecting a different cell or disabling the filter."
            : "Configure the board and rack, then analyze"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            Top Moves
            {filterBySelected && selectedCell && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Filtered: {String.fromCharCode(65 + selectedCell.c)}{selectedCell.r + 1})
              </span>
            )}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="text-xs font-medium text-blue-700 mb-1">Confidence</div>
            <div className="text-2xl font-bold text-blue-900">{(confidence * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
            <div className="text-xs font-medium text-purple-700 mb-1">Compute Time</div>
            <div className="text-2xl font-bold text-purple-900">{computeTime}ms</div>
          </div>
        </div>

        {/* Filters & Sort */}
        <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="score">Sort by Score</option>
              <option value="length">Sort by Length</option>
              <option value="tiles">Sort by Tiles Used</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Score: {minScore}</label>
              <input
                type="range"
                min="0"
                max="50"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Length: {minLength}</label>
              <input
                type="range"
                min="0"
                max="9"
                value={minLength}
                onChange={(e) => setMinLength(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredMoves.map((move, idx) => (
          <div
            key={idx}
            className={`group relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] ${idx === 0
              ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 hover:border-yellow-500'
              : 'bg-white border-gray-200 hover:border-blue-400'
              }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${idx === 0
                ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md'
                : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700'
                }`}>
                {idx === 0 ? '👑' : `#${idx + 1}`}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <h4 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                    {move.word}
                  </h4>
                  {idx === 0 && (
                    <span className="text-xs font-semibold text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full">
                      BEST
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600 font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {move.score} pts
                  </div>
                  <div className="text-gray-500">
                    {move.placements.length} tile{move.placements.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className={`absolute top-0 right-0 w-1 h-full ${idx === 0 ? 'bg-gradient-to-b from-yellow-400 to-amber-500' : 'bg-blue-400 opacity-0 group-hover:opacity-100'
              } transition-opacity`}></div>
          </div>
        ))}
      </div>
    </div>
  );
};
