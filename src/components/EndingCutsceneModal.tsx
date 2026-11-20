import React, { useState } from 'react';
import { Eye, FileText, Sparkles } from 'lucide-react';
import { GameSaveState } from '../types/game';

interface EndingCutsceneModalProps {
  state: GameSaveState;
  totalQuests: number;
  onTriggerFireworks: () => void;
  onEnterFreePlay: () => void;
}

export const EndingCutsceneModal: React.FC<EndingCutsceneModalProps> = ({
  state,
  totalQuests,
  onTriggerFireworks,
  onEnterFreePlay,
}) => {
  const [skyView, setSkyView] = useState(false);

  if (skyView) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 border border-slate-200 rounded-xl shadow-lg px-4 py-2.5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Sunnybrook Celebration · {state.completedQuestIds.length}/{totalQuests} Quests Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTriggerFireworks}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
            >
              Launch Fireworks
            </button>
            <button
              type="button"
              onClick={() => setSkyView(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Wellness Report</span>
            </button>
            <button
              type="button"
              onClick={onEnterFreePlay}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
            >
              Enter Free Play
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/20 p-3 sm:p-4 pointer-events-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sunnybrook Restored</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All quests complete! The Grumble Fog has lifted and fireworks fill the sky.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSkyView(true)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Watch Fireworks</span>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[52vh] overflow-y-auto hq-scroll">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border border-slate-200 rounded-lg py-2.5 text-center">
            <div className="px-2 py-1">
              <div className="text-[11px] text-slate-500">Apprentice</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{state.appearance.name}</div>
            </div>
            <div className="px-2 py-1">
              <div className="text-[11px] text-slate-500">Quests</div>
              <div className="text-xs font-mono-num font-semibold text-emerald-700 mt-0.5">
                {state.completedQuestIds.length}/{totalQuests}
              </div>
            </div>
            <div className="px-2 py-1">
              <div className="text-[11px] text-slate-500">Crystals</div>
              <div className="text-xs font-mono-num font-semibold text-slate-900 mt-0.5">
                {state.restoredCrystals.length}/5
              </div>
            </div>
            <div className="px-2 py-1">
              <div className="text-[11px] text-slate-500">Badges</div>
              <div className="text-xs font-mono-num font-semibold text-slate-900 mt-0.5">
                {state.badges.length}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Wellness Report</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {state.learnedFacts.map((item) => (
                <div key={item.questId} className="p-3 bg-white">
                  <div className="text-[11px] font-medium text-slate-500 capitalize">
                    {item.title} · {item.category}
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{item.fact}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Free Play, Quizzes & Fireworks unlocked</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTriggerFireworks}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium"
            >
              More Fireworks
            </button>
            <button
              type="button"
              onClick={onEnterFreePlay}
              className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold"
            >
              Enter Free Play
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
