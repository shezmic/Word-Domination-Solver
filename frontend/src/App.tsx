/**
 * Word Domination Solver - Frontend Application
 *
 * Version: 0.1.0
 * Status: Stable - Production Ready
 * Last Updated: 2025-01-19
 */

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { BoardCanvas } from './BoardCanvas';
import { RackEditor } from './RackEditor';
import { MoveList } from './MoveList';
import { Controls } from './Controls';
import { SettingsDialog } from './SettingsDialog';
import { useSolverStore } from './store';


function App() {
  const { connect, disconnect, theme } = useSolverStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 dark:bg-blue-500 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-none">Word Domination Solver</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI-powered move analysis</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="Settings"
          >
            <Settings size={18} />
            <span className="hidden sm:inline font-medium text-sm">Settings</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
          {/* Left Column: Board + Controls */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 overflow-auto">
            {/* Board Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex justify-center flex-shrink-0">
              <BoardCanvas />
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <RackEditor />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <Controls />
              </div>
            </div>
          </div>

          {/* Right Column: Move List (Scrollable) */}
          <div className="lg:col-span-5 xl:col-span-4 h-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
              <MoveList />
            </div>
          </div>
        </div>
      </main>

      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}

export default App;
