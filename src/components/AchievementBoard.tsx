import React, { useMemo, useState } from 'react';
import {
  Award,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Compass,
  Gem,
  GraduationCap,
  HeartPulse,
  Lock,
  ShieldCheck,
  Sun,
  Wrench,
} from 'lucide-react';
import { GameSaveState } from '../types/game';
import { ACHIEVEMENTS, evaluateAchievements } from '../data/achievements';

interface AchievementBoardProps {
  state: GameSaveState;
  totalQuests: number;
  totalQuizzes: number;
}

type BadgeFilter = 'all' | 'unlocked' | 'locked';

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_quest: Award,
  first_crystal: Gem,
  village_explorer: Compass,
  halfway_literacy: BookOpen,
  full_health_literacy: BookCheck,
  all_crystals: ShieldCheck,
  quiz_master: GraduationCap,
  gadget_apprentice: Wrench,
  peak_vitality: HeartPulse,
  fog_cleanser: Sun,
};

export const AchievementBoard: React.FC<AchievementBoardProps> = ({
  state,
  totalQuests,
  totalQuizzes,
}) => {
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const cb = state.settings.colorblindPalette;

  const evaluated = useMemo(
    () => evaluateAchievements(state, totalQuests, totalQuizzes),
    [state, totalQuests, totalQuizzes]
  );

  const unlockedCount = useMemo(
    () => evaluated.filter((item) => item.unlocked).length,
    [evaluated]
  );

  const filtered = useMemo(() => {
    if (filter === 'unlocked') return evaluated.filter((item) => item.unlocked);
    if (filter === 'locked') return evaluated.filter((item) => !item.unlocked);
    return evaluated;
  }, [evaluated, filter]);

  const pct = ACHIEVEMENTS.length > 0 ? Math.round((unlockedCount / ACHIEVEMENTS.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Minimal Unboxed Header */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Achievements</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {unlockedCount} of {ACHIEVEMENTS.length} milestones unlocked
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            {([
              { id: 'all', label: `All (${evaluated.length})` },
              { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
              { id: 'locked', label: `Locked (${evaluated.length - unlockedCount})` },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${cb ? 'bg-[#009E73]' : 'bg-emerald-700'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Milestone Badge Cards */}
      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500">
          {filter === 'unlocked'
            ? 'No milestones unlocked yet. Explore Sunnybrook to earn your first badge.'
            : 'All milestone achievements unlocked.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map(({ def, current, target, unlocked }) => {
            const Icon = BADGE_ICONS[def.id] ?? Award;
            const progressPct = target > 0 ? Math.round((current / target) * 100) : 0;

            return (
              <div
                key={def.id}
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  unlocked
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200/70 bg-slate-50/40'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                    unlocked
                      ? cb
                        ? 'bg-[#009E73]/10 border-[#009E73]/30 text-[#0072B2]'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {unlocked ? <Icon className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`text-xs font-semibold leading-snug ${
                        unlocked ? 'text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {def.title}
                    </h4>
                    {unlocked ? (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          cb ? 'text-[#0072B2]' : 'text-emerald-700'
                        }`}
                        aria-label="Unlocked"
                      />
                    ) : (
                      <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                        {current}/{target}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">{def.description}</p>

                  {!unlocked && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            cb ? 'bg-[#56B4E9]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono-num text-slate-400 whitespace-nowrap">
                        {def.unitLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quest Merit Ribbons (unboxed inline metadata) */}
      {state.badges.length > 0 && (
        <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Quest Ribbons:</span>
          {state.badges.map((b, i) => (
            <span key={b}>
              {i > 0 && <span aria-hidden="true" className="text-slate-300 mr-2">·</span>}
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
