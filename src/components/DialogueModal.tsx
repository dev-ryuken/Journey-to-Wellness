import React, { useEffect, useMemo, useRef } from 'react';
import {
  Cloud,
  CloudRain,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  X,
} from 'lucide-react';
import { AgeBracket, NpcDialogueData, QuestDefinition, WeatherType } from '../types/game';
import { audioEngine } from '../engine/audio';
import { getDayPhase, pickNpcGreetingModifier } from '../data/greetingModifiers';

interface DialogueModalProps {
  npc: NpcDialogueData;
  quest: QuestDefinition | null;
  completedQuestIds: string[];
  ageBracket: AgeBracket;
  weather: WeatherType;
  dayTime: number;
  justCompletedQuest?: QuestDefinition | null;
  onStartQuest: (quest: QuestDefinition) => void;
  onClose: () => void;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npc,
  quest,
  completedQuestIds,
  ageBracket,
  weather,
  dayTime,
  justCompletedQuest,
  onStartQuest,
  onClose,
}) => {
  const isCompletion = Boolean(justCompletedQuest);
  const activeDisplayQuest = justCompletedQuest ?? quest;

  // Snapshot weather & time of day when the conversation opens so background ticks don't re-roll the line
  const envRef = useRef({ weather, dayTime });
  envRef.current = { weather, dayTime };

  const envSnapshot = useMemo(() => {
    const w = envRef.current.weather;
    const dt = envRef.current.dayTime;
    const phase = getDayPhase(dt);
    const modifier = isCompletion ? '' : pickNpcGreetingModifier(npc.id, w, dt);
    return { weather: w, phase, modifier };
  }, [npc.id, quest?.id, justCompletedQuest?.id, isCompletion]);

  const mainLine = isCompletion && justCompletedQuest
    ? npc.questComplete[justCompletedQuest.id] ?? npc.greeting
    : quest
    ? npc.questIntro[quest.id] ?? npc.greeting
    : npc.idleLines[completedQuestIds.length % npc.idleLines.length] ?? npc.greeting;

  const fullSpokenLine = envSnapshot.modifier
    ? `${envSnapshot.modifier} ${mainLine}`
    : mainLine;

  useEffect(() => {
    audioEngine.speak(`${npc.name} says: ${fullSpokenLine}`);
  }, [npc.name, fullSpokenLine]);

  const factText =
    justCompletedQuest &&
    (ageBracket === '11-14' ? justCompletedQuest.didYouKnowOlder : justCompletedQuest.didYouKnow);

  const EnvIcon =
    envSnapshot.weather === 'rain'
      ? CloudRain
      : envSnapshot.weather === 'cloudy'
      ? Cloud
      : envSnapshot.phase === 'night'
      ? Moon
      : envSnapshot.phase === 'sunrise'
      ? Sunrise
      : envSnapshot.phase === 'sunset'
      ? Sunset
      : Sun;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/45 p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[92vh] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{npc.name}</h2>
            <p className="text-xs text-slate-500">{npc.role}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => audioEngine.speak(fullSpokenLine)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Read dialogue aloud"
              title="Read aloud"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Close dialogue"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto hq-scroll flex-1">
          {envSnapshot.modifier && (
            <div className="flex items-start gap-2 text-xs text-slate-500 italic">
              <EnvIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>“{envSnapshot.modifier}”</span>
            </div>
          )}

          <p className="text-[15px] text-slate-800 leading-relaxed">{mainLine}</p>

          {isCompletion && justCompletedQuest && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-700">Did You Know?</div>
                <p className="text-sm text-slate-700 leading-relaxed">{factText}</p>
              </div>

              {justCompletedQuest.trustedAdultNote && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {justCompletedQuest.trustedAdultNote}
                </p>
              )}

              <div className="flex flex-wrap gap-2.5 text-xs font-mono-num text-slate-600 pt-1">
                <span>+{justCompletedQuest.reward.xp} XP</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>+{justCompletedQuest.reward.coins} Coins</span>
                {justCompletedQuest.reward.crystalFragment && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-sans font-semibold text-emerald-700 capitalize">
                      Restored {justCompletedQuest.reward.crystalFragment} Crystal
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {!isCompletion && activeDisplayQuest && (
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <div className="text-xs font-semibold text-emerald-700">
                Quest {activeDisplayQuest.number} · {activeDisplayQuest.title}
              </div>
              <p className="text-xs sm:text-sm text-slate-600">{activeDisplayQuest.goal}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          {!isCompletion && quest ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => onStartQuest(quest)}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                Start Quest
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
