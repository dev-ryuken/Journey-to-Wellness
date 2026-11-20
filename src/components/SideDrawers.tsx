import React from 'react';
import {
  Award,
  CheckCircle2,
  Coins,
  Eye,
  Lock,
  LogOut,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  ChapterQuiz,
  CrystalCategory,
  GameSaveState,
  QuestDefinition,
  ZoneId,
} from '../types/game';
import { ITEMS, ITEM_MAP } from '../data/items';
import { DAILY_CHALLENGES, DailyChallenge } from '../data/storage';
import { audioEngine } from '../engine/audio';
import { AchievementBoard } from './AchievementBoard';
import { EvidenceLogPanel } from './EvidenceLogPanel';

export type DrawerTab =
  | 'quests'
  | 'journal'
  | 'bag'
  | 'shop'
  | 'quizzes'
  | 'settings';

interface SideDrawersProps {
  activeTab: DrawerTab;
  state: GameSaveState;
  quests: QuestDefinition[];
  quizzes: ChapterQuiz[];
  onClose: () => void;
  onSelectQuest: (quest: QuestDefinition) => void;
  onTeleportZone: (zoneId: ZoneId) => void;
  onUseItem: (itemId: string) => void;
  onBuyItem: (itemId: string) => void;
  onEquipCosmetic: (itemId: string | null) => void;
  onToggleGermGoggles: () => void;
  onStartQuiz: (quiz: ChapterQuiz) => void;
  onStartDaily: (challenge: DailyChallenge) => void;
  onStartMemoryMatch: () => void;
  onUpdateSettings: (patch: Partial<GameSaveState['settings']>) => void;
  onChangeDayTime: (val: number) => void;
  onResetSave: () => void;
  onExitGame: () => void;
}

export const SideDrawers: React.FC<SideDrawersProps> = ({
  activeTab,
  state,
  quests,
  quizzes,
  onClose,
  onSelectQuest,
  onTeleportZone,
  onUseItem,
  onBuyItem,
  onEquipCosmetic,
  onToggleGermGoggles,
  onStartQuiz,
  onStartDaily,
  onStartMemoryMatch,
  onUpdateSettings,
  onChangeDayTime,
  onResetSave,
  onExitGame,
}) => {
  const completedSet = new Set(state.completedQuestIds);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[88vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Minimal Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'quests' && 'Quests'}
            {activeTab === 'journal' && 'Wellness Journal'}
            {activeTab === 'bag' && 'Satchel & Tools'}
            {activeTab === 'shop' && 'Wellness Shop'}
            {activeTab === 'quizzes' && 'Quizzes & Daily Play'}
            {activeTab === 'settings' && 'Settings'}
          </h2>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono-num font-semibold text-slate-600">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              {state.coins}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto hq-scroll space-y-6">
          {activeTab === 'quests' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Complete quests across all 5 wellness chapters to restore Sunnybrook’s Crystals and clear the Misty Forest.
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {quests.map((q) => {
                  const isDone = completedSet.has(q.id);
                  const isUnlocked = q.prerequisiteQuestIds.every((pre) => completedSet.has(pre));
                  const isActive = state.activeQuestId === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive ? 'bg-slate-50/80' : 'bg-white'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-slate-500 capitalize">
                          Quest {q.number} · {q.category} · {q.zoneId.replace('_', ' ')}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">{q.title}</h3>
                        <p className="text-xs text-slate-600">{q.goal}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        ) : isUnlocked ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectQuest(q);
                                onTeleportZone(q.zoneId);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              Travel
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectQuest(q)}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
                            >
                              Play
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Lock className="w-3.5 h-3.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="space-y-7">
              {/* Crystal progress */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-slate-900">Wellness Crystals</h3>
                  <span className="text-xs font-mono-num text-slate-500">
                    {state.restoredCrystals.length}/5 Restored
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['hygiene', 'nutrition', 'exercise', 'rest', 'prevention'] as CrystalCategory[]).map((cat) => {
                    const has = state.restoredCrystals.includes(cat);
                    return (
                      <div
                        key={cat}
                        className={`px-3 py-2.5 rounded-lg border text-center ${
                          has
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="text-xs font-semibold capitalize">{cat}</div>
                        <div className="text-[11px] mt-0.5">{has ? 'Restored' : 'Dimmed'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <AchievementBoard
                  state={state}
                  totalQuests={quests.length}
                  totalQuizzes={quizzes.length}
                />
              </div>

              <div className="border-t border-slate-100 pt-6">
                <EvidenceLogPanel state={state} quests={quests} />
              </div>
            </div>
          )}

          {activeTab === 'bag' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Tools</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Germ Goggles</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {state.unlockedTools.includes('germ_goggles')
                          ? 'Reveals glowing 3D germ particles across the village.'
                          : 'Unlock via Quest 12: Germ Detectives'}
                      </div>
                    </div>
                    {state.unlockedTools.includes('germ_goggles') && (
                      <button
                        type="button"
                        onClick={onToggleGermGoggles}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                          state.germGogglesActive
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {state.germGogglesActive ? 'On' : 'Off'}
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="text-sm font-semibold text-slate-900">Healing Satchel</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {state.unlockedTools.includes('healing_satchel')
                        ? 'Equipped. Boosts item restoration by +10%.'
                        : 'Unlock via Quest 11: Worry Clouds'}
                    </div>
                  </div>
                </div>
              </div>

              {state.unlockedCosmetics.filter((c) => c.startsWith('cosmetic_')).length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Outfits</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEquipCosmetic(null)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium ${
                        !state.equippedCosmetic
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Default Outfit
                    </button>
                    {state.unlockedCosmetics
                      .filter((c) => c.startsWith('cosmetic_'))
                      .map((cid) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => onEquipCosmetic(cid)}
                          className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium ${
                            state.equippedCosmetic === cid
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {ITEM_MAP[cid]?.name ?? cid}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Supplies</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(state.inventory)
                    .filter(([, qty]) => qty > 0)
                    .map(([id, qty]) => {
                      const item = ITEM_MAP[id];
                      if (!item) return null;
                      return (
                        <div
                          key={id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {item.name}{' '}
                              <span className="font-mono-num text-xs text-slate-400">×{qty}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.effectText}</div>
                          </div>
                          {item.meterRestore && (
                            <button
                              type="button"
                              onClick={() => onUseItem(id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium shrink-0"
                            >
                              Use
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shop' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ITEMS.map((item) => {
                const ownedUpgrade =
                  (item.category === 'cosmetic' || item.category === 'village') &&
                  state.unlockedCosmetics.includes(item.id);
                const canAfford = state.coins >= item.price;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                        <span className="font-mono-num text-xs font-semibold text-slate-600">
                          {item.price} Coins
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                      <div className="text-xs font-medium text-emerald-700 mt-1.5">{item.effectText}</div>
                    </div>
                    <button
                      type="button"
                      disabled={ownedUpgrade || !canAfford}
                      onClick={() => onBuyItem(item.id)}
                      className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                        ownedUpgrade
                          ? 'bg-slate-50 text-emerald-700 border border-slate-200'
                          : canAfford
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {ownedUpgrade ? 'Owned' : canAfford ? 'Purchase' : 'Insufficient Coins'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'quizzes' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Healthy Habits Memory Match</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Match habit pairs anytime to earn +30 Coins.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartMemoryMatch();
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
                >
                  Play
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2.5">
                  Chapter Quizzes
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {quizzes.map((quiz) => {
                    const done = state.completedChapterQuizzes.includes(quiz.category);
                    return (
                      <div
                        key={quiz.category}
                        className="p-4 bg-white flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{quiz.title}</div>
                          <div className="text-xs text-slate-500">{quiz.subtitle}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartQuiz(quiz);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                            done
                              ? 'bg-white text-emerald-700 border border-slate-200 hover:bg-slate-50'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          }`}
                        >
                          {done ? 'Replay' : 'Start Quiz'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {state.gameCompleted && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2.5">
                    Daily Challenges
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DAILY_CHALLENGES.map((dc) => {
                      const done = state.freePlayDailyDone.includes(dc.id);
                      return (
                        <div key={dc.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{dc.title}</div>
                            <p className="text-xs text-slate-500 mt-0.5">{dc.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartDaily(dc);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
                          >
                            {done ? 'Replay' : `Play (+${dc.rewardCoins} Coins)`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Time of Day */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                  <span>Time of Day</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num text-slate-500 font-normal">
                      {state.dayTime < 0.1 || state.dayTime >= 0.8
                        ? 'Night'
                        : state.dayTime < 0.3
                        ? 'Sunrise'
                        : state.dayTime < 0.65
                        ? 'Noon'
                        : 'Sunset'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          autoDayNight: !(state.settings.autoDayNight ?? true),
                        })
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                        (state.settings.autoDayNight ?? true)
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {(state.settings.autoDayNight ?? true) ? 'Auto' : 'Paused'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.dayTime}
                  onChange={(e) => onChangeDayTime(parseFloat(e.target.value))}
                  className="w-full accent-emerald-700"
                />
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                  {([
                    { label: 'Sunrise', val: 0.18 },
                    { label: 'Noon', val: 0.5 },
                    { label: 'Sunset', val: 0.74 },
                    { label: 'Night', val: 0.92 },
                  ] as const).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onChangeDayTime(preset.val)}
                      className="py-1 px-2 rounded-md text-xs font-medium text-slate-700 hover:bg-white transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weather Mode */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>Weather</span>
                  <span className="text-xs font-normal text-slate-500">
                    {(state.settings.weatherMode ?? 'auto') === 'auto' ? 'Dynamic cycle' : 'Manual'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                  {([
                    { id: 'auto', label: 'Auto' },
                    { id: 'sunny', label: 'Sunny' },
                    { id: 'cloudy', label: 'Cloudy' },
                    { id: 'rain', label: 'Rain' },
                  ] as const).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onUpdateSettings({ weatherMode: w.id })}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        (state.settings.weatherMode ?? 'auto') === w.id
                          ? 'bg-white shadow-sm text-slate-900'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accessibility Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Text Size</div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['normal', 'large', 'xlarge'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onUpdateSettings({ textSize: sz })}
                        className={`py-1 rounded-md text-xs font-medium capitalize ${
                          state.settings.textSize === sz ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !state.settings.audioEnabled;
                    audioEngine.setEnabled(next);
                    onUpdateSettings({ audioEnabled: next });
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Audio</div>
                    <div className="text-xs text-slate-500">Music, footsteps & wildlife</div>
                  </div>
                  <span className={`text-xs font-semibold ${state.settings.audioEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state.settings.audioEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !state.settings.ttsEnabled;
                    audioEngine.setTtsEnabled(next);
                    onUpdateSettings({ ttsEnabled: next });
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Read-Aloud</div>
                    <div className="text-xs text-slate-500">Spoken NPC dialogue</div>
                  </div>
                  <span className={`text-xs font-semibold ${state.settings.ttsEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state.settings.ttsEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ reduceMotion: !state.settings.reduceMotion })}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Reduce Motion</div>
                    <div className="text-xs text-slate-500">Minimal transitions</div>
                  </div>
                  <span className={`text-xs font-semibold ${state.settings.reduceMotion ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state.settings.reduceMotion ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ colorblindPalette: !state.settings.colorblindPalette })}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Colorblind Palette</div>
                    <div className="text-xs text-slate-500">High-contrast meter tones</div>
                  </div>
                  <span className={`text-xs font-semibold ${state.settings.colorblindPalette ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state.settings.colorblindPalette ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ performanceMode: !state.settings.performanceMode })}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Battery Saver</div>
                    <div className="text-xs text-slate-500">30 FPS cap</div>
                  </div>
                  <span className={`text-xs font-semibold ${state.settings.performanceMode ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state.settings.performanceMode ? 'On' : 'Off'}
                  </span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">Move: WASD, Arrows, Click, or Touch Pad</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onExitGame}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Exit</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResetSave}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
