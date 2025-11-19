import React from 'react';
import { useSolverStore } from './store';

export const RackEditor: React.FC = () => {
  const { rack, updateRack } = useSolverStore();

  const handleTileChange = (index: number, value: string) => {
    const newRack = [...rack];
    if (value === '' || value === ' ') {
      newRack[index] = 0;
    } else if (/[A-Z]/i.test(value)) {
      const letter = value.toUpperCase().charCodeAt(0) - 64; // A=1, B=2, etc.
      newRack[index] = letter;
    }
    updateRack(newRack);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Your Rack</h3>
      </div>
      <div className="flex gap-2 flex-wrap">
        {rack.map((tile, idx) => (
          <div key={idx} className="relative group">
            <input
              type="text"
              maxLength={1}
              value={tile > 0 ? String.fromCharCode(tile - 1 + 65) : ''}
              onChange={(e) => handleTileChange(idx, e.target.value)}
              className="w-14 h-14 text-center text-2xl font-bold bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-2 border-amber-200 dark:border-amber-700 rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md hover:scale-105 uppercase text-gray-800 dark:text-amber-100"
              placeholder="·"
            />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-300 dark:bg-amber-600 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
