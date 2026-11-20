import { GameSaveState } from '../types/game';

const STORAGE_KEY = 'healthquest_sunnybrook_save_v1';

export const DEFAULT_SAVE_STATE: GameSaveState = {
  hasCreatedCharacter: false,
  appearance: {
    name: 'Avery',
    ageBracket: '8-10',
    skinTone: '#F1C29B',
    hairStyle: 'bob',
    hairColor: '#5C3A21',
    tunicColor: '#10B981',
    hatStyle: 'explorer',
  },
  playerPos: { x: 0, z: 6 },
  meters: {
    energy: 82,
    hygiene: 75,
    nutrition: 80,
    mood: 78,
  },
  xp: 0,
  level: 1,
  coins: 35,
  activeQuestId: 'q1_handwashing',
  completedQuestIds: [],
  completedChapterQuizzes: [],
  unlockedTools: [],
  germGogglesActive: false,
  inventory: {
    crisp_apple: 2,
    herbal_soap: 1,
  },
  badges: [],
  unlockedAchievements: [],
  visitedZones: ['town_square'],
  unlockedCosmetics: [],
  equippedCosmetic: null,
  learnedFacts: [],
  restoredCrystals: [],
  gameCompleted: false,
  freePlayDailyDone: [],
  failedAttempts: 0,
  dayTime: 0.28, // Pleasant sunny morning
  settings: {
    textSize: 'normal',
    reduceMotion: false,
    colorblindPalette: false,
    ttsEnabled: false,
    audioEnabled: true,
    performanceMode: false,
    autoDayNight: true,
  },
};

export function loadGameState(): GameSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE_STATE);
    const parsed = JSON.parse(raw) as Partial<GameSaveState>;
    return {
      ...structuredClone(DEFAULT_SAVE_STATE),
      ...parsed,
      visitedZones: Array.isArray(parsed.visitedZones) && parsed.visitedZones.length > 0
        ? parsed.visitedZones
        : [...DEFAULT_SAVE_STATE.visitedZones],
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : [],
      failedAttempts: typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0,
      appearance: {
        ...DEFAULT_SAVE_STATE.appearance,
        ...(parsed.appearance ?? {}),
      },
      meters: {
        ...DEFAULT_SAVE_STATE.meters,
        ...(parsed.meters ?? {}),
      },
      settings: {
        ...DEFAULT_SAVE_STATE.settings,
        ...(parsed.settings ?? {}),
      },
      inventory: {
        ...DEFAULT_SAVE_STATE.inventory,
        ...(parsed.inventory ?? {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE_STATE);
  }
}

export function saveGameState(state: GameSaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export interface ResetGameOptions {
  preserveCharacter?: boolean;
  preserveSettings?: boolean;
  currentState?: GameSaveState;
}

export function resetGameState(options?: ResetGameOptions): GameSaveState {
  const fresh = structuredClone(DEFAULT_SAVE_STATE);
  if (options?.preserveSettings && options.currentState) {
    fresh.settings = { ...options.currentState.settings };
  }
  if (options?.preserveCharacter && options.currentState) {
    fresh.hasCreatedCharacter = true;
    fresh.appearance = { ...options.currentState.appearance };
    saveGameState(fresh);
    return fresh;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  if (options?.preserveSettings) {
    saveGameState(fresh);
  }
  return fresh;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  miniGame: string;
  rewardCoins: number;
  rewardXp: number;
}

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'daily_handwash',
    title: '20-Second Scrub Sprint',
    description: 'Practice a sparkling 20-second handwash at the Town Square fountain.',
    miniGame: 'handwash_timer',
    rewardCoins: 35,
    rewardXp: 80,
  },
  {
    id: 'daily_rainbow',
    title: 'Festival Rainbow Lunch',
    description: 'Build a balanced Rainbow Plate with Baker Bea.',
    miniGame: 'rainbow_plate',
    rewardCoins: 40,
    rewardXp: 90,
  },
  {
    id: 'daily_breath',
    title: 'Afternoon Calm Reset',
    description: 'Take three calm belly breaths with Granny Luna.',
    miniGame: 'worry_breathing',
    rewardCoins: 35,
    rewardXp: 80,
  },
  {
    id: 'daily_field',
    title: 'Field Day Hurdle Jam',
    description: 'Hit the rhythm track with Coach Kiko for joyful cardio.',
    miniGame: 'field_day_rhythm',
    rewardCoins: 45,
    rewardXp: 100,
  },
];
