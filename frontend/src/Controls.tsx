import React, { useState } from 'react';
import { useSolverStore } from './store';
import type { AnalysisMode } from './types';

export const Controls: React.FC = () => {
  const { analyze, cancel, isAnalyzing, clearBoard, undo, history } = useSolverStore();
  const [mode, setMode] = useState<string>('beam');

  const handleAnalyze = () => {
    let analysisMode: AnalysisMode;

    switch (mode) {
      case 'greedy':
        analysisMode = { type: 'greedy' };
        break;
      case 'beam':
        analysisMode = { type: 'beam', width: 50 };
        break;
      case 'beamMCTS':
        analysisMode = { type: 'mcts', width: 50, depth: 3 };
        break;
      default:
        analysisMode = { type: 'greedy' };
    }

    analyze(analysisMode, 5000);
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
            <option value="beamMCTS">🎯 Beam + MCTS (Best)</option>
          </select>
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

      {/* Undo and Clear Board Buttons */}
      <div className="pt-2 grid grid-cols-2 gap-3">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className={`px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 transition-all duration-200 flex items-center justify-center gap-2 ${history.length === 0
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]'
            }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Undo
        </button>

        <button
          onClick={clearBoard}
          className="px-4 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg shadow-sm hover:shadow-md hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Board
        </button>
      </div>
    </div>
  );
};
