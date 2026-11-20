export type WeatherType = 'sunny' | 'cloudy' | 'rain';
export type WeatherMode = 'auto' | WeatherType;

export type CrystalCategory =
  | 'hygiene'
  | 'nutrition'
  | 'exercise'
  | 'rest'
  | 'prevention';

export type ZoneId =
  | 'town_square'
  | 'clinic'
  | 'market'
  | 'bathhouse'
  | 'sports_field'
  | 'cozy_cottage'
  | 'school'
  | 'misty_forest';

export type MiniGameType =
  | 'handwash_timer'
  | 'brush_sequence'
  | 'clean_water'
  | 'rainbow_plate'
  | 'sugar_sneak'
  | 'harvest_helper'
  | 'field_day_rhythm'
  | 'stretch_sequence'
  | 'walk_trail'
  | 'bedtime_sequence'
  | 'worry_breathing'
  | 'germ_detectives'
  | 'sneeze_safe'
  | 'vaccine_visit'
  | 'mosquito_patrol'
  | 'boss_fog';

export type AgeBracket = '8-10' | '11-14';

export interface PlayerAppearance {
  name: string;
  ageBracket: AgeBracket;
  skinTone: string;
  hairStyle: 'bob' | 'spiky' | 'braids' | 'curly';
  hairColor: string;
  tunicColor: string;
  hatStyle: 'none' | 'explorer' | 'beanie' | 'cap';
}

export interface HealthMeters {
  energy: number;
  hygiene: number;
  nutrition: number;
  mood: number;
}

export interface AccessibilitySettings {
  textSize: 'normal' | 'large' | 'xlarge';
  reduceMotion: boolean;
  colorblindPalette: boolean;
  ttsEnabled: boolean;
  audioEnabled: boolean;
  performanceMode: boolean; // 30 FPS cap + lighter shadows
  weatherMode?: WeatherMode;
  autoDayNight?: boolean;
}

export interface QuestReward {
  xp: number;
  coins: number;
  itemId?: string;
  unlockTool?: 'healing_satchel' | 'germ_goggles';
  crystalFragment?: CrystalCategory;
  badge?: string;
  meterBoost: Partial<HealthMeters>;
}

export interface QuestDefinition {
  id: string;
  number: number;
  title: string;
  category: CrystalCategory | 'final';
  zoneId: ZoneId;
  npcId: string;
  miniGame: MiniGameType;
  goal: string;
  steps: string[];
  didYouKnow: string;
  didYouKnowOlder: string;
  trustedAdultNote: string;
  prerequisiteQuestIds: string[];
  reward: QuestReward;
}

export interface NpcDialogueData {
  id: string;
  name: string;
  role: string;
  zoneId: ZoneId;
  personality: string;
  greeting: string;
  idleLines: string[];
  questIntro: Record<string, string>;
  questComplete: Record<string, string>;
  gentleHint: Record<string, string>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
}

export interface ChapterQuiz {
  category: CrystalCategory;
  title: string;
  subtitle: string;
  questions: QuizQuestion[];
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  subtitle: string;
  center: { x: number; z: number };
  elevation: number;
  radius: number;
  themeColor: string;
  ambientMood: 'warm' | 'fresh' | 'cozy' | 'misty';
  unlockRequirementCrystals: number;
}

export interface InventoryItemDef {
  id: string;
  name: string;
  category: 'food' | 'medicine' | 'tool' | 'cosmetic' | 'village';
  price: number;
  description: string;
  effectText: string;
  meterRestore?: Partial<HealthMeters>;
  iconKey: string;
}

export interface GameSaveState {
  hasCreatedCharacter: boolean;
  appearance: PlayerAppearance;
  playerPos: { x: number; z: number };
  meters: HealthMeters;
  xp: number;
  level: number;
  coins: number;
  activeQuestId: string | null;
  completedQuestIds: string[];
  completedChapterQuizzes: CrystalCategory[];
  unlockedTools: Array<'healing_satchel' | 'germ_goggles'>;
  germGogglesActive: boolean;
  inventory: Record<string, number>;
  badges: string[];
  unlockedAchievements: string[];
  visitedZones: ZoneId[];
  unlockedCosmetics: string[];
  equippedCosmetic: string | null;
  learnedFacts: Array<{ questId: string; title: string; category: string; fact: string }>;
  restoredCrystals: CrystalCategory[];
  gameCompleted: boolean;
  freePlayDailyDone: string[];
  failedAttempts: number;
  dayTime: number; // 0..1 day-night cycle
  settings: AccessibilitySettings;
}
