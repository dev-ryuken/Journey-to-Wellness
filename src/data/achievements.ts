import { GameSaveState } from '../types/game';
import { ZONES } from './zones';

export type AchievementCategory = 'crystals' | 'exploration' | 'knowledge' | 'mastery';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  target: number;
  unitLabel: string;
  evaluate: (state: GameSaveState, totalQuests: number, totalQuizzes: number) => {
    current: number;
    unlocked: boolean;
  };
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_quest',
    title: 'Helping Hand',
    description: 'Complete your first health quest for a Sunnybrook resident.',
    category: 'mastery',
    target: 1,
    unitLabel: 'Quest',
    evaluate: (state) => {
      const current = Math.min(1, state.completedQuestIds.length);
      return { current, unlocked: current >= 1 };
    },
  },
  {
    id: 'first_crystal',
    title: 'First Crystal Restored',
    description: 'Restore any 1 of the 5 Wellness Crystals at the fountain.',
    category: 'crystals',
    target: 1,
    unitLabel: 'Crystal',
    evaluate: (state) => {
      const current = Math.min(1, state.restoredCrystals.length);
      return { current, unlocked: current >= 1 };
    },
  },
  {
    id: 'village_explorer',
    title: 'Village Explorer',
    description: 'Visit all 8 districts across Sunnybrook and the northern ridge.',
    category: 'exploration',
    target: ZONES.length,
    unitLabel: 'Zones',
    evaluate: (state) => {
      const current = Math.min(ZONES.length, state.visitedZones?.length ?? 1);
      return { current, unlocked: current >= ZONES.length };
    },
  },
  {
    id: 'halfway_literacy',
    title: 'Curious Apprentice',
    description: 'Record at least 8 health facts in your Evidence Log.',
    category: 'knowledge',
    target: 8,
    unitLabel: 'Facts',
    evaluate: (state) => {
      const current = Math.min(8, Math.max(state.learnedFacts.length, state.completedQuestIds.length));
      return { current, unlocked: current >= 8 };
    },
  },
  {
    id: 'full_health_literacy',
    title: '100% Health Literacy',
    description: 'Collect every health fact across all quests in the Evidence Log.',
    category: 'knowledge',
    target: 16,
    unitLabel: 'Facts',
    evaluate: (state, totalQuests) => {
      const goal = totalQuests || 16;
      const count = Math.max(state.learnedFacts.length, state.completedQuestIds.length);
      const current = Math.min(goal, count);
      return { current, unlocked: current >= goal };
    },
  },
  {
    id: 'all_crystals',
    title: 'Crystal Guardian',
    description: 'Restore all 5 Wellness Crystals: Hygiene, Nutrition, Exercise, Rest, and Prevention.',
    category: 'crystals',
    target: 5,
    unitLabel: 'Crystals',
    evaluate: (state) => {
      const current = Math.min(5, state.restoredCrystals.length);
      return { current, unlocked: current >= 5 };
    },
  },
  {
    id: 'quiz_master',
    title: 'Wellness Wizard',
    description: 'Complete all 5 Chapter Quizzes with confidence.',
    category: 'knowledge',
    target: 5,
    unitLabel: 'Quizzes',
    evaluate: (state, _totalQuests, totalQuizzes) => {
      const goal = totalQuizzes || 5;
      const current = Math.min(goal, state.completedChapterQuizzes.length);
      return { current, unlocked: current >= goal };
    },
  },
  {
    id: 'gadget_apprentice',
    title: 'Equipped for Wellness',
    description: 'Unlock both the Healing Satchel and Germ Goggles tools.',
    category: 'mastery',
    target: 2,
    unitLabel: 'Tools',
    evaluate: (state) => {
      const current = Math.min(2, state.unlockedTools.length);
      return { current, unlocked: current >= 2 };
    },
  },
  {
    id: 'peak_vitality',
    title: 'Peak Vitality',
    description: 'Reach 90+ across Energy, Hygiene, Nutrition, and Mood at once.',
    category: 'mastery',
    target: 4,
    unitLabel: 'Meters',
    evaluate: (state) => {
      const m = state.meters;
      const metCount =
        (m.energy >= 90 ? 1 : 0) +
        (m.hygiene >= 90 ? 1 : 0) +
        (m.nutrition >= 90 ? 1 : 0) +
        (m.mood >= 90 ? 1 : 0);
      return { current: metCount, unlocked: metCount >= 4 };
    },
  },
  {
    id: 'fog_cleanser',
    title: 'Sunnybrook Savior',
    description: 'Clear the Grumble Fog in the Misty Forest finale.',
    category: 'crystals',
    target: 1,
    unitLabel: 'Finale',
    evaluate: (state) => {
      const current = state.gameCompleted ? 1 : 0;
      return { current, unlocked: current >= 1 };
    },
  },
];

export interface EvaluatedAchievement {
  def: AchievementDefinition;
  current: number;
  target: number;
  unlocked: boolean;
}

export function evaluateAchievements(
  state: GameSaveState,
  totalQuests = 16,
  totalQuizzes = 5
): EvaluatedAchievement[] {
  const savedUnlocked = new Set(state.unlockedAchievements ?? []);
  return ACHIEVEMENTS.map((def) => {
    const res = def.evaluate(state, totalQuests, totalQuizzes);
    const target = def.id === 'full_health_literacy' ? totalQuests || def.target : def.id === 'quiz_master' ? totalQuizzes || def.target : def.target;
    const unlocked = savedUnlocked.has(def.id) || res.unlocked;
    return {
      def,
      current: unlocked ? target : res.current,
      target,
      unlocked,
    };
  });
}
