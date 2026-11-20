import React from 'react';
import { Play, RotateCcw, UserPlus } from 'lucide-react';
import { GameSaveState } from '../types/game';

interface GameSessionModalProps {
  mode: 'restart' | 'exited';
  state: GameSaveState;
  onResume: () => void;
  onConfirmRestart: () => void;
  onNewCharacter: () => void;
}

export const GameSessionModal: React.FC<GameSessionModalProps> = ({
  mode,
  state,
  onResume,
  onConfirmRestart,
  onNewCharacter,
}) => {
  const isExitScreen = mode === 'exited';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto ${
        isExitScreen ? 'bg-slate-900/55' : 'bg-slate-900/45'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-session-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 id="game-session-title" className="text-base font-bold text-slate-900">
            {isExitScreen ? 'HealthQuest: Journey to Wellness' : 'Restart Game?'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isExitScreen
              ? 'Your progress is saved on this device.'
              : 'Reset quests, Crystals, coins, and logs back to Quest 1.'}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 divide-x divide-slate-100 border border-slate-200 rounded-lg py-2.5 text-center">
            <div className="px-2">
              <div className="text-[11px] text-slate-500">Apprentice</div>
              <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                {state.appearance.name} · Lv.{state.level}
              </div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-500">Crystals</div>
              <div className="text-xs font-mono-num font-semibold text-emerald-700 mt-0.5">
                {state.restoredCrystals.length}/5
              </div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-500">Quests</div>
              <div className="text-xs font-mono-num font-semibold text-slate-900 mt-0.5">
                {state.completedQuestIds.length}/16
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {isExitScreen ? (
              <>
                <button
                  type="button"
                  onClick={onResume}
                  className="w-full px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onConfirmRestart}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNewCharacter}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New Character</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onConfirmRestart}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart Now</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onNewCharacter}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New Character</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResume}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
