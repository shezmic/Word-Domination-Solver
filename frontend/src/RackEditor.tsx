import React from 'react';
import { useSolverStore } from './store';

export const RackEditor: React.FC = () => {
  const { rack, updateRack, setRackFromText } = useSolverStore();
  const [rackText, setRackText] = React.useState('');

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

      {/* Text Input for Quick Entry */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Quick Entry (type letters)
        </label>
        <input
          type="text"
          value={rackText}
          onChange={(e) => {
            const text = e.target.value.toUpperCase();
            setRackText(text);
            setRackFromText(text);
          }}
          placeholder="Type your rack letters (e.g., HELLO)"
          className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-gray-200 font-medium uppercase"
          maxLength={7}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">Use ? or space for blank tiles</p>
      </div>

      {/* Individual Tile Inputs */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Individual Tiles
        </label>
        <div className="flex gap-2 flex-wrap justify-center p-4 bg-[#8b5cf6]/10 rounded-xl border border-[#8b5cf6]/20">
          {rack.map((tile, idx) => (
            <div key={idx} className="relative group">
              <input
                type="text"
                maxLength={1}
                value={tile > 0 ? String.fromCharCode(tile - 1 + 65) : ''}
                onChange={(e) => handleTileChange(idx, e.target.value)}
                className="w-12 h-12 text-center text-2xl font-bold bg-[#e8c39e] border-b-4 border-[#c69c72] rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:scale-105 uppercase text-[#3f2e18] placeholder-gray-400/50"
                placeholder="·"
              />
              {tile > 0 && (
                <span className="absolute bottom-1 right-1 text-[10px] font-bold text-[#3f2e18] pointer-events-none select-none">
                  {useSolverStore.getState().customPoints[tile]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
