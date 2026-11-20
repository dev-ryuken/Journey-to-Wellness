import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import questsData from './data/quests.json';
import dialoguesData from './data/dialogues.json';
import quizzesData from './data/quizzes.json';
import {
  ChapterQuiz,
  CrystalCategory,
  GameSaveState,
  HealthMeters,
  NpcDialogueData,
  PlayerAppearance,
  QuestDefinition,
  WeatherType,
  ZoneId,
} from './types/game';
import {
  DailyChallenge,
  loadGameState,
  resetGameState,
  saveGameState,
} from './data/storage';
import { ITEM_MAP } from './data/items';
import { evaluateAchievements } from './data/achievements';
import { SunnybrookWorldEngine, WorldInteractTarget } from './engine/worldScene';
import { audioEngine } from './engine/audio';
import { LoadingScreen } from './components/LoadingScreen';
import { CharacterCreator } from './components/CharacterCreator';
import { HUD } from './components/HUD';
import { DialogueModal } from './components/DialogueModal';
import { MiniGameRouterModal } from './components/minigames/MiniGameRouterModal';
import { ChapterQuizModal } from './components/minigames/ChapterQuizModal';
import { MemoryMatchModal } from './components/minigames/MemoryMatchModal';
import { DrawerTab, SideDrawers } from './components/SideDrawers';
import { EndingCutsceneModal } from './components/EndingCutsceneModal';
import { GameSessionModal } from './components/GameSessionModal';
import { WellnessFailModal } from './components/WellnessFailModal';
import { LandscapeGuard, requestLandscapeOrientation } from './components/LandscapeGuard';

const QUESTS = questsData as unknown as QuestDefinition[];
const NPCS = dialoguesData as unknown as NpcDialogueData[];
const QUIZZES = quizzesData as unknown as ChapterQuiz[];

export default function App() {
  const [gameState, setGameState] = useState<GameSaveState>(() => loadGameState());
  const [loadPct, setLoadPct] = useState(5);
  const [loadLabel, setLoadLabel] = useState('Starting Sunnybrook...');
  const [worldReady, setWorldReady] = useState(false);

  const [currentZoneId, setCurrentZoneId] = useState<ZoneId>('town_square');
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny');
  const [proximityPrompt, setProximityPrompt] = useState<{
    label: string;
    target: WorldInteractTarget;
  } | null>(null);

  const [activeDrawer, setActiveDrawer] = useState<DrawerTab | null>(null);
  const [dialogueState, setDialogueState] = useState<{
    npc: NpcDialogueData;
    quest: QuestDefinition | null;
    justCompletedQuest?: QuestDefinition | null;
  } | null>(null);
  const [playingQuest, setPlayingQuest] = useState<QuestDefinition | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<ChapterQuiz | null>(null);
  const [showMemoryMatch, setShowMemoryMatch] = useState(false);
  const [showEndingCutscene, setShowEndingCutscene] = useState(false);
  const [sessionOverlay, setSessionOverlay] = useState<'restart' | 'exited' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SunnybrookWorldEngine | null>(null);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;
  const burnoutChimedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  }, []);

  const depletedMeter = useMemo<keyof HealthMeters | null>(() => {
    if (
      !worldReady ||
      !gameState.hasCreatedCharacter ||
      sessionOverlay === 'exited' ||
      sessionOverlay === 'restart'
    ) {
      return null;
    }
    const keys: (keyof HealthMeters)[] = ['energy', 'hygiene', 'nutrition', 'mood'];
    return keys.find((k) => gameState.meters[k] <= 0) ?? null;
  }, [worldReady, gameState.hasCreatedCharacter, gameState.meters, sessionOverlay]);

  useEffect(() => {
    if (depletedMeter) {
      setDialogueState(null);
      setPlayingQuest(null);
      setActiveQuiz(null);
      setShowMemoryMatch(false);
      setActiveDrawer(null);
      engineRef.current?.setCinematicMode('none');
      if (!burnoutChimedRef.current) {
        burnoutChimedRef.current = true;
        audioEngine.playChime('fail');
      }
    } else {
      burnoutChimedRef.current = false;
    }
  }, [depletedMeter]);

  // Passive exploration meter decay when roaming freely
  useEffect(() => {
    if (
      !worldReady ||
      !gameState.hasCreatedCharacter ||
      sessionOverlay !== null ||
      Boolean(dialogueState) ||
      Boolean(playingQuest) ||
      Boolean(activeQuiz) ||
      showMemoryMatch ||
      Boolean(activeDrawer) ||
      showEndingCutscene ||
      Boolean(depletedMeter)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        meters: {
          energy: Math.max(0, prev.meters.energy - 2),
          hygiene: Math.max(0, prev.meters.hygiene - 1),
          nutrition: Math.max(0, prev.meters.nutrition - 1),
          mood: Math.max(0, prev.meters.mood - 1),
        },
      }));
    }, 20000);

    return () => window.clearInterval(timer);
  }, [
    worldReady,
    gameState.hasCreatedCharacter,
    sessionOverlay,
    dialogueState,
    playingQuest,
    activeQuiz,
    showMemoryMatch,
    activeDrawer,
    showEndingCutscene,
    depletedMeter,
  ]);

  // Persist save state & apply accessibility classes
  useEffect(() => {
    saveGameState(gameState);
    const root = document.documentElement;
    root.classList.remove('text-scale-lg', 'text-scale-xl', 'reduce-motion');
    if (gameState.settings.textSize === 'large') root.classList.add('text-scale-lg');
    if (gameState.settings.textSize === 'xlarge') root.classList.add('text-scale-xl');
    if (gameState.settings.reduceMotion) root.classList.add('reduce-motion');

    audioEngine.setEnabled(gameState.settings.audioEnabled && sessionOverlay !== 'exited');
    audioEngine.setTtsEnabled(gameState.settings.ttsEnabled);
    audioEngine.setAmbientEnvironment(currentZoneId, currentWeather, gameState.dayTime);
    audioEngine.setMusicContext(
      playingQuest ? 'minigame' : currentZoneId === 'misty_forest' ? 'forest' : 'village',
      gameState.restoredCrystals.length
    );
  }, [gameState, playingQuest, currentZoneId, currentWeather, sessionOverlay]);

  // Evaluate and persist milestone achievement unlocks with celebratory feedback
  useEffect(() => {
    if (!gameState.hasCreatedCharacter) return;
    const evaluated = evaluateAchievements(gameState, QUESTS.length, QUIZZES.length);
    const prevSet = new Set(gameState.unlockedAchievements ?? []);
    const newlyUnlocked = evaluated.filter((item) => item.unlocked && !prevSet.has(item.def.id));
    if (newlyUnlocked.length === 0) return;

    const nextIds = Array.from(new Set([...prevSet, ...newlyUnlocked.map((item) => item.def.id)]));
    setGameState((prev) => ({
      ...prev,
      unlockedAchievements: nextIds,
    }));

    audioEngine.playChime('success');
    const first = newlyUnlocked[0].def.title;
    showToast(
      newlyUnlocked.length === 1
        ? `Achievement Unlocked: ${first}!`
        : `Achievements Unlocked: ${first} (+${newlyUnlocked.length - 1} more)!`
    );
  }, [gameState, showToast]);

  const getNextQuestForNpc = useCallback((npcId: string, completedIds: string[]) => {
    const done = new Set(completedIds);
    return (
      QUESTS.find(
        (q) =>
          q.npcId === npcId &&
          !done.has(q.id) &&
          q.prerequisiteQuestIds.every((pre) => done.has(pre))
      ) ?? null
    );
  }, []);

  const handleWorldInteract = useCallback(
    (target: WorldInteractTarget) => {
      const st = stateRef.current;
      audioEngine.playChime('tap');

      if (target.type === 'quest_board') {
        setActiveDrawer('quests');
        return;
      }
      if (target.type === 'shop') {
        setActiveDrawer('shop');
        return;
      }
      if (target.type === 'fountain') {
        setActiveDrawer('journal');
        return;
      }
      if (target.type === 'boss_arena') {
        const bossQuest = QUESTS.find((q) => q.id === 'q16_clear_grumble_fog')!;
        if (st.restoredCrystals.length < 5) {
          showToast(
            `Restore all 5 Wellness Crystals first (${st.restoredCrystals.length}/5) to dispel the Misty Forest barrier!`
          );
          return;
        }
        if (st.completedQuestIds.includes(bossQuest.id)) {
          setShowMemoryMatch(true);
          return;
        }
        const elder = NPCS.find((n) => n.id === 'elder_rowan')!;
        setDialogueState({ npc: elder, quest: bossQuest });
        return;
      }
      if (target.type === 'npc') {
        const npc = NPCS.find((n) => n.id === target.npcId);
        if (!npc) return;
        const nextQ = getNextQuestForNpc(npc.id, st.completedQuestIds);
        setDialogueState({ npc, quest: nextQ });
      }
    },
    [getNextQuestForNpc, showToast]
  );

  // Mount Three.js 2.5D world once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new SunnybrookWorldEngine(container, stateRef.current, {
      onLoadProgress: (pct, label) => {
        setLoadPct(pct);
        setLoadLabel(label);
        if (pct >= 100) {
          window.setTimeout(() => setWorldReady(true), 220);
        }
      },
      onZoneChange: (zoneId) => {
        setCurrentZoneId(zoneId);
        setGameState((prev) => {
          const cur = prev.visitedZones ?? [];
          if (cur.includes(zoneId)) return prev;
          return { ...prev, visitedZones: [...cur, zoneId] };
        });
      },
      onWeatherChange: (weather) => {
        setCurrentWeather(weather);
      },
      onDayTimeChange: (dayTime) => {
        setGameState((prev) => ({ ...prev, dayTime }));
      },
      onInteract: handleWorldInteract,
      onProximityPrompt: (prompt) => {
        setProximityPrompt(prompt);
      },
      onPlayerMove: (x, z) => {
        setGameState((prev) => ({ ...prev, playerPos: { x, z } }));
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleWorldInteract]);

  // Sync state changes to Three.js engine
  useEffect(() => {
    engineRef.current?.syncState(gameState, QUESTS);
  }, [gameState]);

  const activeQuest = useMemo(() => {
    if (gameState.activeQuestId && !gameState.completedQuestIds.includes(gameState.activeQuestId)) {
      return QUESTS.find((q) => q.id === gameState.activeQuestId) ?? null;
    }
    const done = new Set(gameState.completedQuestIds);
    return (
      QUESTS.find(
        (q) => !done.has(q.id) && q.prerequisiteQuestIds.every((pre) => done.has(pre))
      ) ?? null
    );
  }, [gameState.activeQuestId, gameState.completedQuestIds]);

  const handleCompleteCharacterCreation = (appearance: PlayerAppearance) => {
    setGameState((prev) => {
      const next = { ...prev, hasCreatedCharacter: true, appearance };
      engineRef.current?.rebuildPlayerAppearance(next);
      return next;
    });
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      void requestLandscapeOrientation();
    }
    audioEngine.startMusic();
    showToast('Talk to Elder Rowan by the fountain to start Quest 1!');
  };

  const handleQuestComplete = () => {
    if (!playingQuest) return;
    const completedQ = playingQuest;
    setPlayingQuest(null);

    // Check if this was a Free Play daily replay
    if (gameState.completedQuestIds.includes(completedQ.id)) {
      setGameState((prev) => ({
        ...prev,
        coins: prev.coins + 35,
        xp: prev.xp + 75,
      }));
      showToast('Free Play bonus: +35 Coins & +75 XP!');
      return;
    }

    const fact =
      gameState.appearance.ageBracket === '11-14'
        ? completedQ.didYouKnowOlder
        : completedQ.didYouKnow;

    let unlockedCrystal: CrystalCategory | undefined = completedQ.reward.crystalFragment;
    const isBossOrFinal = completedQ.id === 'q16_clear_grumble_fog';
    const predictedDoneCount = gameState.completedQuestIds.includes(completedQ.id)
      ? gameState.completedQuestIds.length
      : gameState.completedQuestIds.length + 1;
    const newlyCompletedAllQuests =
      !gameState.gameCompleted && (isBossOrFinal || predictedDoneCount >= QUESTS.length);

    setGameState((prev) => {
      const nextCompleted = Array.from(new Set([...prev.completedQuestIds, completedQ.id]));
      const nextXp = prev.xp + completedQ.reward.xp;
      const nextLevel = Math.floor(nextXp / 220) + 1;
      const nextCoins = prev.coins + completedQ.reward.coins;
      const nextInventory = { ...prev.inventory };
      if (completedQ.reward.itemId) {
        nextInventory[completedQ.reward.itemId] = (nextInventory[completedQ.reward.itemId] ?? 0) + 1;
      }
      const nextTools = completedQ.reward.unlockTool
        ? Array.from(new Set([...prev.unlockedTools, completedQ.reward.unlockTool]))
        : prev.unlockedTools;
      const nextBadges = completedQ.reward.badge
        ? Array.from(new Set([...prev.badges, completedQ.reward.badge]))
        : prev.badges;
      const nextCrystals = unlockedCrystal
        ? Array.from(new Set([...prev.restoredCrystals, unlockedCrystal]))
        : prev.restoredCrystals;
      const nextFacts = prev.learnedFacts.some((f) => f.questId === completedQ.id)
        ? prev.learnedFacts
        : [
            ...prev.learnedFacts,
            {
              questId: completedQ.id,
              title: completedQ.title,
              category: completedQ.category,
              fact,
            },
          ];

      const boost = completedQ.reward.meterBoost;
      const nextMeters = {
        energy: Math.min(100, prev.meters.energy + (boost.energy ?? 0)),
        hygiene: Math.min(100, prev.meters.hygiene + (boost.hygiene ?? 0)),
        nutrition: Math.min(100, prev.meters.nutrition + (boost.nutrition ?? 0)),
        mood: Math.min(100, prev.meters.mood + (boost.mood ?? 0)),
      };

      // Pick next unlocked quest
      const doneSet = new Set(nextCompleted);
      const upcoming = QUESTS.find(
        (q) => !doneSet.has(q.id) && q.prerequisiteQuestIds.every((pre) => doneSet.has(pre))
      );

      return {
        ...prev,
        xp: nextXp,
        level: nextLevel,
        coins: nextCoins,
        completedQuestIds: nextCompleted,
        activeQuestId: upcoming?.id ?? null,
        inventory: nextInventory,
        unlockedTools: nextTools,
        germGogglesActive:
          completedQ.reward.unlockTool === 'germ_goggles' ? true : prev.germGogglesActive,
        badges: nextBadges,
        restoredCrystals: nextCrystals,
        learnedFacts: nextFacts,
        meters: nextMeters,
        gameCompleted: prev.gameCompleted || isBossOrFinal || nextCompleted.length >= QUESTS.length,
      };
    });

    if (newlyCompletedAllQuests || isBossOrFinal) {
      audioEngine.playChime('crystal');
      audioEngine.playCelebrationFanfare();
      engineRef.current?.setCinematicMode('ending_sweep');
      engineRef.current?.triggerCelebrationFireworks(10);
      setShowEndingCutscene(true);
      showToast('All 16 Quests Complete! Sunnybrook Celebration Fireworks!');
      return;
    }

    const npc = NPCS.find((n) => n.id === completedQ.npcId) ?? NPCS[0];
    setDialogueState({ npc, quest: null, justCompletedQuest: completedQ });

    if (unlockedCrystal) {
      showToast(`Wellness Crystal Restored: ${unlockedCrystal.toUpperCase()}! Chapter Quiz ready!`);
    }
  };

  const handleUseItem = (itemId: string) => {
    const item = ITEM_MAP[itemId];
    if (!item?.meterRestore) return;
    audioEngine.playChime('success');
    const bonusMult = gameState.unlockedTools.includes('healing_satchel') ? 1.15 : 1.0;

    setGameState((prev) => {
      const qty = prev.inventory[itemId] ?? 0;
      if (qty <= 0) return prev;
      return {
        ...prev,
        inventory: { ...prev.inventory, [itemId]: qty - 1 },
        meters: {
          energy: Math.min(100, prev.meters.energy + Math.round((item.meterRestore?.energy ?? 0) * bonusMult)),
          hygiene: Math.min(100, prev.meters.hygiene + Math.round((item.meterRestore?.hygiene ?? 0) * bonusMult)),
          nutrition: Math.min(100, prev.meters.nutrition + Math.round((item.meterRestore?.nutrition ?? 0) * bonusMult)),
          mood: Math.min(100, prev.meters.mood + Math.round((item.meterRestore?.mood ?? 0) * bonusMult)),
        },
      };
    });
    showToast(`Used ${item.name}!`);
  };

  const handleBuyItem = (itemId: string) => {
    const item = ITEM_MAP[itemId];
    if (!item || gameState.coins < item.price) return;
    audioEngine.playChime('success');

    setGameState((prev) => {
      if (item.category === 'cosmetic' || item.category === 'village') {
        const nextUnlocked = Array.from(new Set([...prev.unlockedCosmetics, item.id]));
        return {
          ...prev,
          coins: prev.coins - item.price,
          unlockedCosmetics: nextUnlocked,
          equippedCosmetic: item.category === 'cosmetic' ? item.id : prev.equippedCosmetic,
        };
      }
      return {
        ...prev,
        coins: prev.coins - item.price,
        inventory: {
          ...prev.inventory,
          [item.id]: (prev.inventory[item.id] ?? 0) + 1,
        },
      };
    });
    showToast(`Purchased ${item.name}!`);
  };

  const handleStartDaily = (dc: DailyChallenge) => {
    const syntheticQuest: QuestDefinition = {
      id: QUESTS.find((q) => q.miniGame === dc.miniGame)?.id ?? 'q1_handwashing',
      number: 0,
      title: dc.title,
      category: 'hygiene',
      zoneId: 'town_square',
      npcId: 'elder_rowan',
      miniGame: dc.miniGame as QuestDefinition['miniGame'],
      goal: dc.description,
      steps: [],
      didYouKnow: '',
      didYouKnowOlder: '',
      trustedAdultNote: '',
      prerequisiteQuestIds: [],
      reward: { xp: dc.rewardXp, coins: dc.rewardCoins, meterBoost: { mood: 15 } },
    };
    setGameState((prev) => ({
      ...prev,
      freePlayDailyDone: Array.from(new Set([...prev.freePlayDailyDone, dc.id])),
    }));
    setPlayingQuest(syntheticQuest);
  };

  const performRestartGame = useCallback(
    (withNewCharacter = false) => {
      const fresh = resetGameState({
        preserveCharacter: !withNewCharacter,
        preserveSettings: true,
        currentState: stateRef.current,
      });
      setDialogueState(null);
      setPlayingQuest(null);
      setActiveQuiz(null);
      setShowMemoryMatch(false);
      setShowEndingCutscene(false);
      setActiveDrawer(null);
      setSessionOverlay(null);
      setCurrentZoneId('town_square');
      setCurrentWeather('sunny');
      setGameState(fresh);
      engineRef.current?.resetWorld(fresh);
      audioEngine.unlock();
      if (fresh.settings.audioEnabled) {
        audioEngine.setEnabled(true);
        audioEngine.startMusic();
      }
      audioEngine.playChime('tap');
      showToast(
        withNewCharacter
          ? 'Create your new Health Apprentice to begin!'
          : 'Game restarted! Talk to Elder Rowan to begin Quest 1.'
      );
    },
    [showToast]
  );

  const handleExitGame = useCallback(() => {
    saveGameState(stateRef.current);
    setDialogueState(null);
    setPlayingQuest(null);
    setActiveQuiz(null);
    setShowMemoryMatch(false);
    setShowEndingCutscene(false);
    setActiveDrawer(null);
    engineRef.current?.setCelebrationActive(false);
    engineRef.current?.setCinematicMode('none');
    audioEngine.stopMusic();
    setSessionOverlay('exited');
  }, []);

  const handleLaunchCelebrationFireworks = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playCelebrationFanfare();
    engineRef.current?.triggerCelebrationFireworks(10);
    showToast('Sunnybrook celebration fireworks!');
  }, [showToast]);

  const handleChallengeFail = useCallback(
    (reason: string) => {
      setGameState((prev) => ({
        ...prev,
        failedAttempts: (prev.failedAttempts ?? 0) + 1,
        meters: {
          ...prev.meters,
          energy: Math.max(0, prev.meters.energy - 10),
          mood: Math.max(0, prev.meters.mood - 12),
        },
      }));
      showToast(`Challenge failed (${reason}) — -10 Energy, -12 Mood`);
    },
    [showToast]
  );

  const handleRecoverAtClinic = useCallback(() => {
    setGameState((prev) => {
      const fee = Math.min(15, prev.coins);
      return {
        ...prev,
        coins: Math.max(0, prev.coins - fee),
        meters: {
          energy: 55,
          hygiene: 55,
          nutrition: 55,
          mood: 55,
        },
      };
    });
    engineRef.current?.teleportToZone('clinic');
    audioEngine.playChime('success');
    showToast('Recovered at Sunnybrook Clinic! All meters restored to 55%.');
  }, [showToast]);

  const handleResumeFromExit = useCallback(() => {
    setSessionOverlay(null);
    if (stateRef.current.settings.audioEnabled) {
      audioEngine.unlock();
      audioEngine.setEnabled(true);
      audioEngine.startMusic();
    }
    showToast('Welcome back to Sunnybrook!');
  }, [showToast]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#D8ECFA]">
      {/* Dedicated Three.js WebGL Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {!worldReady && <LoadingScreen progress={loadPct} label={loadLabel} />}

      {worldReady && !gameState.hasCreatedCharacter && (
        <CharacterCreator
          initial={gameState.appearance}
          onComplete={handleCompleteCharacterCreation}
        />
      )}

      {worldReady && gameState.hasCreatedCharacter && sessionOverlay !== 'exited' && (
        <HUD
          state={gameState}
          currentZoneId={currentZoneId}
          currentWeather={currentWeather}
          activeQuest={activeQuest}
          proximityPrompt={proximityPrompt}
          onInteractPrompt={handleWorldInteract}
          onOpenDrawer={(tab) => setActiveDrawer(tab)}
          onToggleGermGoggles={() =>
            setGameState((p) => ({ ...p, germGogglesActive: !p.germGogglesActive }))
          }
          onTeleportZone={(zid) => {
            engineRef.current?.teleportToZone(zid);
            showToast(`Traveled to ${zid.replace('_', ' ')}`);
          }}
          onCycleWeather={() => {
            const next = engineRef.current?.triggerRandomWeather();
            if (next) {
              setGameState((p) => ({
                ...p,
                settings: { ...p.settings, weatherMode: 'auto' },
              }));
              showToast(
                `Weather shifted to ${
                  next === 'rain' ? 'Light Rain' : next === 'cloudy' ? 'Cloudy' : 'Sunny'
                }`
              );
            }
          }}
          onCycleDayPhase={() => {
            const phases = [
              { label: 'Sunrise', val: 0.18 },
              { label: 'Noon', val: 0.5 },
              { label: 'Sunset', val: 0.74 },
              { label: 'Night', val: 0.92 },
            ];
            const cur = ((stateRef.current.dayTime % 1) + 1) % 1;
            const nextIdx =
              cur < 0.1 || cur >= 0.8
                ? 0
                : cur < 0.3
                ? 1
                : cur < 0.65
                ? 2
                : 3;
            const next = phases[nextIdx];
            setGameState((p) => ({ ...p, dayTime: next.val }));
            showToast(`Time shifted to ${next.label}`);
          }}
          onCelebrateFireworks={handleLaunchCelebrationFireworks}
          onRequestRestart={() => setSessionOverlay('restart')}
          onExitGame={handleExitGame}
          onJoystickMove={(x, y) => engineRef.current?.setVirtualJoystick(x, y)}
        />
      )}

      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900/95 text-white text-xs font-medium shadow-md pointer-events-none max-w-[90vw] truncate">
          {toastMsg}
        </div>
      )}

      {/* NPC Dialogue Modal */}
      {dialogueState && (
        <DialogueModal
          npc={dialogueState.npc}
          quest={dialogueState.quest}
          completedQuestIds={gameState.completedQuestIds}
          ageBracket={gameState.appearance.ageBracket}
          weather={currentWeather}
          dayTime={gameState.dayTime}
          justCompletedQuest={dialogueState.justCompletedQuest}
          onStartQuest={(q) => {
            setDialogueState(null);
            setGameState((prev) => ({ ...prev, activeQuestId: q.id }));
            if (q.id === 'q16_clear_grumble_fog') {
              engineRef.current?.setCinematicMode('boss_focus');
            }
            setPlayingQuest(q);
          }}
          onClose={() => {
            const completed = dialogueState.justCompletedQuest;
            setDialogueState(null);
            // Offer chapter 5-question quiz when a Crystal is restored!
            if (completed?.reward.crystalFragment) {
              const quiz = QUIZZES.find((qz) => qz.category === completed.reward.crystalFragment);
              if (quiz && !gameState.completedChapterQuizzes.includes(quiz.category)) {
                setActiveQuiz(quiz);
              }
            }
          }}
        />
      )}

      {/* Active Quest Mini-Game */}
      {playingQuest && (
        <MiniGameRouterModal
          quest={playingQuest}
          npc={NPCS.find((n) => n.id === playingQuest.npcId)}
          onComplete={handleQuestComplete}
          onFail={handleChallengeFail}
          onCancel={() => {
            engineRef.current?.setCinematicMode('none');
            setPlayingQuest(null);
          }}
        />
      )}

      {/* 5-Question Chapter Quiz */}
      {activeQuiz && (
        <ChapterQuizModal
          quiz={activeQuiz}
          onComplete={() => {
            const cat = activeQuiz.category;
            setActiveQuiz(null);
            setGameState((prev) => ({
              ...prev,
              coins: prev.coins + 50,
              xp: prev.xp + 100,
              completedChapterQuizzes: Array.from(new Set([...prev.completedChapterQuizzes, cat])),
            }));
            showToast('Wellness Wizard Quiz mastered! +50 Coins & +100 XP!');
          }}
          onFail={handleChallengeFail}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {/* Bonus Memory Match */}
      {showMemoryMatch && (
        <MemoryMatchModal
          onComplete={() => {
            setShowMemoryMatch(false);
            setGameState((prev) => ({
              ...prev,
              coins: prev.coins + 30,
              xp: prev.xp + 60,
            }));
            showToast('Memory Match cleared! +30 Coins & +60 XP!');
          }}
          onFail={handleChallengeFail}
          onClose={() => setShowMemoryMatch(false)}
        />
      )}

      {/* Side Drawers (Quests, Journal, Bag, Shop, Quizzes, Accessibility) */}
      {activeDrawer && (
        <SideDrawers
          activeTab={activeDrawer}
          state={gameState}
          quests={QUESTS}
          quizzes={QUIZZES}
          onClose={() => setActiveDrawer(null)}
          onSelectQuest={(q) => {
            setActiveDrawer(null);
            setGameState((p) => ({ ...p, activeQuestId: q.id }));
            setPlayingQuest(q);
          }}
          onTeleportZone={(zid) => engineRef.current?.teleportToZone(zid)}
          onUseItem={handleUseItem}
          onBuyItem={handleBuyItem}
          onEquipCosmetic={(cid) =>
            setGameState((p) => ({ ...p, equippedCosmetic: cid }))
          }
          onToggleGermGoggles={() =>
            setGameState((p) => ({ ...p, germGogglesActive: !p.germGogglesActive }))
          }
          onStartQuiz={(qz) => setActiveQuiz(qz)}
          onStartDaily={handleStartDaily}
          onStartMemoryMatch={() => setShowMemoryMatch(true)}
          onUpdateSettings={(patch) =>
            setGameState((p) => ({
              ...p,
              settings: { ...p.settings, ...patch },
            }))
          }
          onChangeDayTime={(val) =>
            setGameState((p) => ({ ...p, dayTime: val }))
          }
          onResetSave={() => {
            setActiveDrawer(null);
            setSessionOverlay('restart');
          }}
          onExitGame={handleExitGame}
        />
      )}

      {/* Wellness Meter Depletion / Burnout Recovery Screen */}
      {depletedMeter && !sessionOverlay && (
        <WellnessFailModal
          depletedMeter={depletedMeter}
          coins={gameState.coins}
          failedAttempts={gameState.failedAttempts ?? 0}
          onRecover={handleRecoverAtClinic}
          onRequestRestart={() => setSessionOverlay('restart')}
        />
      )}

      {/* Restart Confirmation / Exit Game Screen */}
      {sessionOverlay && (
        <GameSessionModal
          mode={sessionOverlay}
          state={gameState}
          onResume={() => {
            if (sessionOverlay === 'exited') {
              handleResumeFromExit();
            } else {
              setSessionOverlay(null);
            }
          }}
          onConfirmRestart={() => performRestartGame(false)}
          onNewCharacter={() => performRestartGame(true)}
        />
      )}

      {/* Ending Cutscene & Wellness Report */}
      {showEndingCutscene && (
        <EndingCutsceneModal
          state={gameState}
          totalQuests={QUESTS.length}
          onTriggerFireworks={handleLaunchCelebrationFireworks}
          onEnterFreePlay={() => {
            setShowEndingCutscene(false);
            engineRef.current?.setCelebrationActive(false);
            engineRef.current?.setCinematicMode('none');
            engineRef.current?.teleportToZone('town_square');
            showToast('Welcome to Free Play Mode! Tap the sparkle button anytime for fireworks!');
          }}
        />
      )}
      {/* Mobile Landscape Orientation Guard */}
      <LandscapeGuard />
    </div>
  );
}
