import React, { useState } from 'react';
import { useSolverStore } from './store';
import type { AnalysisMode } from './types';

export const Controls: React.FC = () => {
  const { analyze, cancel, isAnalyzing, selectedCell, filterBySelected, toggleFilterBySelected } = useSolverStore();
  const [mode, setMode] = useState<string>('beam');
  const [beamWidth, setBeamWidth] = useState(50);
  const [rolloutDepth, setRolloutDepth] = useState(3);
  const [timeBudget, setTimeBudget] = useState(5000);

  const handleAnalyze = () => {
    let analysisMode: AnalysisMode;

    switch (mode) {
      case 'greedy':
        analysisMode = { type: 'greedy' };
        break;
      case 'beam':
        analysisMode = { type: 'beam', width: beamWidth };
        break;
      case 'beamMCTS':
        analysisMode = { type: 'mcts', width: beamWidth, depth: rolloutDepth };
        break;
      default:
        analysisMode = { type: 'greedy' };
    }

    analyze(analysisMode, timeBudget);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-2 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Analysis Settings</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-gray-200 font-medium"
          >
            <option value="greedy">⚡ Greedy (Fastest)</option>
            <option value="beam">🔍 Beam Search</option>
            <option value="beamMCTS">🎯 Beam + MCTS (Best Quality)</option>
          </select>
        </div>

        {(mode === 'beam' || mode === 'beamMCTS') && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Beam Width
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">({beamWidth})</span>
            </label>
            <input
              type="number"
              value={beamWidth}
              onChange={(e) => setBeamWidth(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-gray-200"
            />
          </div>
        )}

        {mode === 'beamMCTS' && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Rollout Depth
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">({rolloutDepth})</span>
            </label>
            <input
              type="number"
              value={rolloutDepth}
              onChange={(e) => setRolloutDepth(Number(e.target.value))}
              min={1}
              max={10}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-gray-200"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Time Budget
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">({(timeBudget / 1000).toFixed(1)}s)</span>
          </label>
          <input
            type="number"
            value={timeBudget}
            onChange={(e) => setTimeBudget(Number(e.target.value))}
            min={100}
            max={60000}
            step={100}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Targeted Solving Filter */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter by Selected Cell
            </label>
            <button
              onClick={toggleFilterBySelected}
              disabled={!selectedCell}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${filterBySelected && selectedCell ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                } ${!selectedCell ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${filterBySelected && selectedCell ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>
          {!selectedCell && (
            <p className="text-xs text-gray-500 mt-1 ml-6">Select a cell on board to enable</p>
          )}
          {selectedCell && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Showing moves at {String.fromCharCode(65 + selectedCell.c)}{selectedCell.r + 1}
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        {isAnalyzing ? (
          <button
            onClick={cancel}
            className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Analysis
          </button>
        ) : (
          <button
            onClick={handleAnalyze}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Analyze Position
          </button>
        )}
      </div>
    </div>
  );
};
