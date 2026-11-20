import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  BriefcaseMedical,
  Cloud,
  CloudRain,
  Coins,
  Compass,
  Droplets,
  Eye,
  Heart,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  Moon,
  RotateCcw,
  ShoppingBag,
  Sliders,
  Smile,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Utensils,
  Zap,
} from 'lucide-react';
import { requestLandscapeOrientation } from './LandscapeGuard';
import { GameSaveState, QuestDefinition, WeatherType, ZoneId } from '../types/game';
import { ZONE_MAP, ZONES } from '../data/zones';
import { WorldInteractTarget } from '../engine/worldScene';
import { DrawerTab } from './SideDrawers';

interface HUDProps {
  state: GameSaveState;
  currentZoneId: ZoneId;
  currentWeather: WeatherType;
  activeQuest: QuestDefinition | null;
  proximityPrompt: { label: string; target: WorldInteractTarget } | null;
  onInteractPrompt: (target: WorldInteractTarget) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleGermGoggles: () => void;
  onTeleportZone: (zoneId: ZoneId) => void;
  onCycleWeather: () => void;
  onCycleDayPhase: () => void;
  onCelebrateFireworks: () => void;
  onRequestRestart: () => void;
  onExitGame: () => void;
  onJoystickMove: (x: number, y: number) => void;
}

function isDesktopWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const ua = nav.userAgent || '';
  const platform = nav.userAgentData?.platform || nav.platform || '';
  return /Windows|Win32|Win64|WOW64/i.test(ua) || /Windows|Win32|Win64/i.test(platform);
}

function isMobileTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDesktopWindows()) return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  const coarsePrimary =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const hasFinePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(any-pointer: fine)').matches;
  return coarsePrimary && !hasFinePointer;
}

export const HUD: React.FC<HUDProps> = ({
  state,
  currentZoneId,
  currentWeather,
  activeQuest,
  proximityPrompt,
  onInteractPrompt,
  onOpenDrawer,
  onToggleGermGoggles,
  onTeleportZone,
  onCycleWeather,
  onCycleDayPhase,
  onCelebrateFireworks,
  onRequestRestart,
  onExitGame,
  onJoystickMove,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsHovered, setStatsHovered] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showTouchJoystick, setShowTouchJoystick] = useState(() => isMobileTouchDevice());
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyActiveRef = useRef(false);

  useEffect(() => {
    const syncTouchMode = () => {
      setShowTouchJoystick(isMobileTouchDevice());
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !isDesktopWindows()) {
        setShowTouchJoystick(true);
      } else if (e.pointerType === 'mouse' && isDesktopWindows()) {
        setShowTouchJoystick(false);
      }
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
      if (
        statsContainerRef.current &&
        !statsContainerRef.current.contains(e.target as Node)
      ) {
        setStatsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setMenuOpen(false);
        setStatsOpen(false);
        setMapExpanded(false);
        return;
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        setMenuOpen(false);
        setStatsOpen(false);
        if (isDesktopWindows()) {
          setShowTouchJoystick(false);
        }
      }
    };
    window.addEventListener('resize', syncTouchMode);
    window.addEventListener('orientationchange', syncTouchMode);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', syncTouchMode);
      window.removeEventListener('orientationchange', syncTouchMode);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Auto-hide menu contents after brief idle when open and not hovered
  useEffect(() => {
    if (!menuOpen || menuHovered) return;
    const timer = window.setTimeout(() => {
      setMenuOpen(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [menuOpen, menuHovered]);

  // Auto-hide stats contents after brief idle when open and not hovered
  useEffect(() => {
    if (!statsOpen || statsHovered) return;
    const timer = window.setTimeout(() => {
      setStatsOpen(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [statsOpen, statsHovered]);

  const currentZone = ZONE_MAP[currentZoneId] ?? ZONES[0];
  const cb = state.settings.colorblindPalette;
  const WeatherIcon = currentWeather === 'rain' ? CloudRain : currentWeather === 'cloudy' ? Cloud : Sun;
  const weatherLabel =
    currentWeather === 'rain' ? 'Rain' : currentWeather === 'cloudy' ? 'Cloudy' : 'Sunny';

  const tDay = ((state.dayTime % 1) + 1) % 1;
  const dayPhase =
    tDay < 0.1 || tDay >= 0.8
      ? { label: 'Night', Icon: Moon }
      : tDay < 0.3
      ? { label: 'Sunrise', Icon: Sunrise }
      : tDay < 0.65
      ? { label: 'Noon', Icon: Sun }
      : { label: 'Sunset', Icon: Sunset };
  const DayPhaseIcon = dayPhase.Icon;

  const hasLowMeter = Object.values(state.meters).some((v) => v <= 25);

  const meterRows = [
    {
      label: 'Energy',
      val: state.meters.energy,
      icon: Zap,
      barClass: state.meters.energy <= 25 ? 'bg-rose-500' : cb ? 'bg-[#E69F00]' : 'bg-amber-500',
    },
    {
      label: 'Hygiene',
      val: state.meters.hygiene,
      icon: Droplets,
      barClass: state.meters.hygiene <= 25 ? 'bg-rose-500' : cb ? 'bg-[#56B4E9]' : 'bg-sky-500',
    },
    {
      label: 'Nutrition',
      val: state.meters.nutrition,
      icon: Utensils,
      barClass: state.meters.nutrition <= 25 ? 'bg-rose-500' : cb ? 'bg-[#009E73]' : 'bg-emerald-600',
    },
    {
      label: 'Mood',
      val: state.meters.mood,
      icon: Smile,
      barClass: state.meters.mood <= 25 ? 'bg-rose-500' : cb ? 'bg-[#CC79A7]' : 'bg-violet-500',
    },
  ];

  const handleJoystickPointer = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });
    onJoystickMove(dx / maxR, dy / maxR);
  };

  const openFromMenu = (tab: DrawerTab) => {
    setMenuOpen(false);
    setMenuHovered(false);
    setStatsOpen(false);
    setStatsHovered(false);
    onOpenDrawer(tab);
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* Top Row: Top-Left Auto-Hiding Menu & Stats, Top-Right Environment Strip */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        {/* Top-Left Corner: Auto-Hiding Menu + Auto-Hiding Stats */}
        <div className="pointer-events-auto flex items-start gap-2">
          <div
            ref={menuContainerRef}
            className="relative"
            onMouseEnter={() => setMenuHovered(true)}
            onMouseLeave={() => setMenuHovered(false)}
          >
            <button
              type="button"
              onClick={() => {
                setStatsOpen(false);
                setMenuOpen((prev) => !prev);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Open game menu"
              className={`h-9 px-3 rounded-xl border text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors ${
                menuOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white/92 border-slate-900/10 text-slate-800 hover:bg-white hover:text-slate-950'
              }`}
            >
              <Menu className="w-3.5 h-3.5" />
              <span>Menu</span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-11 w-44 bg-white/96 border border-slate-900/10 rounded-xl p-1.5 shadow-lg flex flex-col gap-0.5 z-40"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('quests')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 text-slate-500" />
                  <span>Quests</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('journal')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>Journal</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('bag')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <BriefcaseMedical className="w-3.5 h-3.5 text-slate-500" />
                  <span>Satchel</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('shop')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                  <span>Shop</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('quizzes')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-slate-500" />
                  <span>Quizzes</span>
                </button>
                {state.unlockedTools.includes('germ_goggles') && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setMenuHovered(false);
                      onToggleGermGoggles();
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 text-left transition-colors ${
                      state.germGogglesActive
                        ? 'bg-emerald-700 text-white'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Goggles</span>
                    </span>
                    <span className="text-[10px] opacity-80">
                      {state.germGogglesActive ? 'On' : 'Off'}
                    </span>
                  </button>
                )}
                <div className="my-0.5 border-t border-slate-100" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openFromMenu('settings')}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-2 text-left transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Settings</span>
                </button>
              </div>
            )}
          </div>

          {/* Auto-Hiding Stats Toggle & Dropdown */}
          <div
            ref={statsContainerRef}
            className="relative"
            onMouseEnter={() => setStatsHovered(true)}
            onMouseLeave={() => setStatsHovered(false)}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setStatsOpen((prev) => !prev);
              }}
              aria-expanded={statsOpen}
              aria-label={hasLowMeter ? 'Open player stats (low wellness warning)' : 'Open player stats'}
              className={`h-9 px-3 rounded-xl border text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors ${
                statsOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : hasLowMeter
                  ? 'bg-rose-50/95 border-rose-300 text-rose-800 hover:bg-rose-100'
                  : 'bg-white/92 border-slate-900/10 text-slate-800 hover:bg-white hover:text-slate-950'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Stats</span>
              {!statsOpen && hasLowMeter && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" aria-hidden="true" />
              )}
            </button>

            {statsOpen && (
              <div className="absolute left-0 top-11 w-[216px] sm:w-[240px] bg-white/96 border border-slate-900/10 rounded-xl px-3 py-2.5 shadow-lg z-40">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100">
                  <div className="truncate text-xs">
                    <span className="font-semibold text-slate-900">{state.appearance.name}</span>
                    <span className="text-slate-400 mx-1" aria-hidden="true">·</span>
                    <span className="text-slate-500 font-mono-num">Lv.{state.level}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono-num font-semibold text-slate-700 shrink-0">
                    <Coins className="w-3.5 h-3.5 text-slate-500" />
                    <span>{state.coins}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {meterRows.map((m) => {
                    const Icon = m.icon;
                    const isLow = m.val <= 25;
                    return (
                      <div key={m.label} className="space-y-0.5">
                        <div className={`flex items-center justify-between text-[10px] ${isLow ? 'text-rose-700 font-semibold' : 'text-slate-600'}`}>
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Icon className={`w-2.5 h-2.5 ${isLow ? 'text-rose-500' : 'text-slate-400'}`} />
                            {m.label}
                          </span>
                          <span className={`font-mono-num ${isLow ? 'text-rose-700' : 'text-slate-700'}`}>{Math.round(m.val)}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${m.barClass}`} style={{ width: `${m.val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeQuest && (
                  <button
                    type="button"
                    onClick={() => openFromMenu('quests')}
                    className="mt-2 pt-1.5 border-t border-slate-100 w-full text-left flex items-center justify-between gap-2 group"
                  >
                    <span className="text-[11px] text-slate-700 truncate group-hover:text-emerald-700 transition-colors">
                      <span className="font-mono-num font-semibold text-emerald-700">
                        {state.restoredCrystals.length}/5
                      </span>
                      <span className="text-slate-300 mx-1" aria-hidden="true">·</span>
                      <span className="font-medium">{activeQuest.title}</span>
                    </span>
                    <Compass className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0 transition-colors" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Compact Environment & Utility Strip */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="bg-white/92 border border-slate-900/10 rounded-xl px-2.5 py-1.5 shadow-sm flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-1">
              <span className="font-semibold text-slate-900 whitespace-nowrap">
                {currentZone.name.replace('Sunnybrook ', '')}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={onCycleDayPhase}
                title="Shift time of day"
                className="inline-flex items-center gap-1 hover:text-slate-900 whitespace-nowrap transition-colors"
              >
                <DayPhaseIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{dayPhase.label}</span>
              </button>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={onCycleWeather}
                title="Change weather"
                className="inline-flex items-center gap-1 hover:text-slate-900 whitespace-nowrap transition-colors"
              >
                <WeatherIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{weatherLabel}</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-0.5 shrink-0">
              {state.gameCompleted && (
                <button
                  type="button"
                  onClick={onCelebrateFireworks}
                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  aria-label="Launch celebration fireworks"
                  title="Celebration Fireworks"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMapExpanded((v) => !v)}
                className={`p-1.5 rounded-lg transition-colors ${
                  mapExpanded
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                aria-label="Toggle village mini-map"
                title="Village Map"
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void requestLandscapeOrientation();
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Lock landscape fullscreen"
                title="Landscape Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRequestRestart}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Restart game"
                title="Restart Game"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onExitGame}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Exit game"
                title="Exit Game"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {mapExpanded && (
            <div className="bg-white/95 border border-slate-900/10 rounded-xl p-3 shadow-lg w-60">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-2">
                <span>Fast Travel</span>
                <span className="text-slate-400">Tap zone</span>
              </div>
              <div className="relative h-40 rounded-lg bg-slate-50 border border-slate-200/80 overflow-hidden">
                {ZONES.map((z) => {
                  const leftPct = ((z.center.x + 32) / 64) * 100;
                  const topPct = ((z.center.z + 40) / 70) * 100;
                  const isHere = z.id === currentZoneId;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        onTeleportZone(z.id);
                        setMapExpanded(false);
                      }}
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                      className={`-translate-x-1/2 -translate-y-1/2 absolute px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                        isHere
                          ? 'bg-emerald-700 text-white border-emerald-700 z-10'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {z.name.replace('Sunnybrook ', '')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Area: Touch Joystick (left on mobile) + Contextual Proximity Interact Prompt */}
      <div className="relative flex items-end justify-center">
        {showTouchJoystick && (
          <div
            ref={joyRef}
            onPointerDown={(e) => {
              setMenuOpen(false);
              setStatsOpen(false);
              joyActiveRef.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              handleJoystickPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (joyActiveRef.current) handleJoystickPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              joyActiveRef.current = false;
              setJoyKnob({ x: 0, y: 0 });
              onJoystickMove(0, 0);
            }}
            onPointerCancel={() => {
              joyActiveRef.current = false;
              setJoyKnob({ x: 0, y: 0 });
              onJoystickMove(0, 0);
            }}
            style={{
              left: 'max(0.75rem, env(safe-area-inset-left))',
              bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
            className="pointer-events-auto fixed z-30 w-24 h-24 rounded-full bg-white/75 border border-slate-900/15 shadow-sm flex items-center justify-center touch-none"
            aria-label="Movement joystick"
          >
            <div
              className="w-9 h-9 rounded-full bg-slate-900/80 shadow-sm pointer-events-none"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>
        )}

        {proximityPrompt && (
          <div className="pointer-events-auto flex flex-col items-center">
            <button
              type="button"
              onClick={() => onInteractPrompt(proximityPrompt.target)}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2 transition-transform active:scale-95"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>{proximityPrompt.label}</span>
              <span className="text-emerald-200 font-mono-num text-[11px] hidden sm:inline">E</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
