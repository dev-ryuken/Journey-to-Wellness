import React from 'react';
import { X } from 'lucide-react';
import { NpcDialogueData, QuestDefinition } from '../../types/game';
import { HandwashTimerGame } from './HandwashTimerGame';
import { SequenceGame } from './SequenceGame';
import { NutritionAndWaterGames } from './NutritionAndWaterGames';
import { FitnessAndTrailGames } from './FitnessAndTrailGames';
import { BreathingAndPreventionGames } from './BreathingAndPreventionGames';

interface MiniGameRouterModalProps {
  quest: QuestDefinition;
  npc?: NpcDialogueData;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

export const MiniGameRouterModal: React.FC<MiniGameRouterModalProps> = ({
  quest,
  npc,
  onComplete,
  onFail,
  onCancel,
}) => {
  const hint = npc?.gentleHint[quest.id] ?? 'Take your time—watch your tries carefully!';

  const renderGame = () => {
    switch (quest.miniGame) {
      case 'handwash_timer':
        return <HandwashTimerGame hint={hint} onComplete={onComplete} onFail={onFail} onCancel={onCancel} />;
      case 'brush_sequence':
      case 'stretch_sequence':
      case 'bedtime_sequence':
      case 'sneeze_safe':
        return <SequenceGame mode={quest.miniGame} hint={hint} onComplete={onComplete} onFail={onFail} onCancel={onCancel} />;
      case 'clean_water':
      case 'rainbow_plate':
      case 'sugar_sneak':
      case 'harvest_helper':
        return <NutritionAndWaterGames mode={quest.miniGame} hint={hint} onComplete={onComplete} onFail={onFail} onCancel={onCancel} />;
      case 'field_day_rhythm':
      case 'walk_trail':
        return <FitnessAndTrailGames mode={quest.miniGame} hint={hint} onComplete={onComplete} onFail={onFail} onCancel={onCancel} />;
      case 'worry_breathing':
      case 'germ_detectives':
      case 'vaccine_visit':
      case 'mosquito_patrol':
      case 'boss_fog':
        return <BreathingAndPreventionGames mode={quest.miniGame} hint={hint} onComplete={onComplete} onFail={onFail} onCancel={onCancel} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-2 sm:p-4">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">{quest.title}</h2>
            <span className="text-[11px] font-medium text-slate-500 capitalize">
              {quest.category === 'final' ? 'Final Challenge' : quest.category} · Quest {quest.number}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close mini-game"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-4">{renderGame()}</div>
      </div>
    </div>
  );
};
