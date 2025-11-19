import React, { useState, useEffect } from 'react';
import { useSolverStore } from './store';
import { X, RotateCcw, Save } from 'lucide-react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const SettingsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { customPoints, setCustomPoints, rackSize, setRackSize, theme, setTheme } = useSolverStore();

    const [localPoints, setLocalPoints] = useState<number[]>([...customPoints]);
    const [localRackSize, setLocalRackSize] = useState(rackSize);
    const [localTheme, setLocalTheme] = useState<'light' | 'dark' | 'system'>(theme);

    useEffect(() => {
        setLocalPoints([...customPoints]);
        setLocalRackSize(rackSize);
        setLocalTheme(theme);
    }, [customPoints, rackSize, theme]);

    const handlePointChange = (index: number, value: string) => {
        const num = parseInt(value);
        if (!isNaN(num) && num >= 0 && num <= 100) {
            const newPoints = [...localPoints];
            // Index 0 is blank, 1 is A (index 0 in LETTERS)
            newPoints[index] = num;
            setLocalPoints(newPoints);
        }
    };

    const handleSave = () => {
        setCustomPoints(localPoints);
        setRackSize(localRackSize);
        setTheme(localTheme);
        onClose();
    };

    const handleReset = () => {
        // Default values from backend
        const defaults = [0, 1, 4, 4, 2, 1, 4, 3, 4, 1, 10, 5, 2, 4, 2, 1, 4, 10, 1, 1, 1, 2, 5, 4, 8, 3, 10];
        setLocalPoints(defaults);
        setLocalRackSize(7);
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Game Settings</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Theme Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-200 mb-4">Theme</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setLocalTheme('light')}
                                className={`p-4 rounded-lg border-2 transition-all ${localTheme === 'light'
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex flex-col items-center space-y-2">
                                    <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                                    </svg>
                                    <span className="text-sm font-medium text-white">Light</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setLocalTheme('dark')}
                                className={`p-4 rounded-lg border-2 transition-all ${localTheme === 'dark'
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex flex-col items-center space-y-2">
                                    <svg className="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm font-medium text-white">Dark</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setLocalTheme('system')}
                                className={`p-4 rounded-lg border-2 transition-all ${localTheme === 'system'
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex flex-col items-center space-y-2">
                                    <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM3 17a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1z" />
                                    </svg>
                                    <span className="text-sm font-medium text-white">System</span>
                                </div>
                            </button>
                        </div>
                        <p className="text-sm text-slate-400 mt-2">Choose your preferred color scheme.</p>
                    </section>

                    {/* Rack Size Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200 mb-4">Rack Size</h3>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                min="5"
                                max="15"
                                value={localRackSize}
                                onChange={(e) => setLocalRackSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 w-12 text-center">{localRackSize}</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Number of tiles in your rack (5-15).</p>
                    </section>

                    {/* Tile Values Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200">Tile Point Values</h3>
                            <button
                                onClick={handleReset}
                                className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <RotateCcw size={16} />
                                <span>Reset to Defaults</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                            {/* Blank Tile */}
                            <div className="bg-gray-50 dark:bg-slate-700/50 p-2 rounded-lg border border-gray-200 dark:border-slate-600 flex flex-col items-center">
                                <span className="text-xs text-gray-600 dark:text-slate-400 mb-1">BLANK</span>
                                <input
                                    type="number"
                                    value={localPoints[0]}
                                    onChange={(e) => handlePointChange(0, e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-center text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Letters A-Z */}
                            {LETTERS.map((letter, i) => (
                                <div key={letter} className="bg-gray-50 dark:bg-slate-700/50 p-2 rounded-lg border border-gray-200 dark:border-slate-600 flex flex-col items-center">
                                    <span className="text-xs text-gray-600 dark:text-slate-400 mb-1">{letter}</span>
                                    <input
                                        type="number"
                                        value={localPoints[i + 1]}
                                        onChange={(e) => handlePointChange(i + 1, e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-center text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end space-x-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <Save size={18} />
                        <span>Save Changes</span>
                    </button>
                </div>

            </div>
        </div>
    );
};
