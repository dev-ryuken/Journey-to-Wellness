import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Droplets, Footprints, Zap } from 'lucide-react';
import { audioEngine } from '../../engine/audio';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface FitnessAndTrailGamesProps {
  mode: 'field_day_rhythm' | 'walk_trail';
  hint: string;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

const MAX_MISTAKES = 3;

export const FitnessAndTrailGames: React.FC<FitnessAndTrailGamesProps> = ({
  mode,
  hint,
  onComplete,
  onFail,
  onCancel,
}) => {
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  // --- FIELD DAY FITNESS (Side-view 2.5D obstacle rhythm track) ---
  const [hurdlesCleared, setHurdlesCleared] = useState(0);
  const [markerX, setMarkerX] = useState(95);
  const [jumping, setJumping] = useState(false);
  const [fieldMsg, setFieldMsg] = useState('Press Jump (or Spacebar) when the hurdle enters the green jump zone.');
  const targetHurdles = 6;
  const animRef = useRef<number>(0);

  const triggerFailure = (reason: string) => {
    audioEngine.playChime('fail');
    setFailed(reason);
    onFail(reason);
  };

  useEffect(() => {
    if (mode !== 'field_day_rhythm' || hurdlesCleared >= targetHurdles || failed) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setMarkerX((prev) => {
        const next = prev - dt * 46;
        // Passed the runner without jumping -> tripped on hurdle!
        if (next < 10) {
          setMistakes((m) => {
            const nm = m + 1;
            if (nm >= MAX_MISTAKES) {
              triggerFailure('You tripped on 3 hurdles! Time your jumps when the hurdle enters the green zone.');
            } else {
              audioEngine.playChime('hint');
              setFieldMsg(`Tripped on a hurdle! (${MAX_MISTAKES - nm} tries left)`);
            }
            return nm;
          });
          return 96;
        }
        return next;
      });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hurdlesCleared, failed]);

  const handleJump = () => {
    if (jumping || hurdlesCleared >= targetHurdles || failed) return;
    setJumping(true);
    setTimeout(() => setJumping(false), 380);

    if (markerX >= 14 && markerX <= 36) {
      audioEngine.playChime('success');
      const next = hurdlesCleared + 1;
      setHurdlesCleared(next);
      setMarkerX(96);
      setFieldMsg(
        next >= targetHurdles
          ? 'Awesome stamina! You cleared every hurdle in rhythm.'
          : `Great leap! Hurdle ${next}/${targetHurdles} cleared.`
      );
    } else {
      const nm = mistakes + 1;
      setMistakes(nm);
      if (nm >= MAX_MISTAKES) {
        triggerFailure('Too many mistimed jumps! Wait until the hurdle reaches the green jump zone.');
      } else {
        audioEngine.playChime('hint');
        setFieldMsg(`Too early or late! Wait for the green zone. (${MAX_MISTAKES - nm} tries left)`);
      }
    }
  };

  useEffect(() => {
    if (mode !== 'field_day_rhythm' || failed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, markerX, jumping, hurdlesCleared, mistakes, failed]);

  // --- WALK THE TRAIL (Cadence + Hydration) ---
  const [steps, setSteps] = useState(0);
  const [hydration, setHydration] = useState(85);
  const [trailMsg, setTrailMsg] = useState('Step steadily up to Sunnybrook Overlook—sip water before hydration runs dry.');
  const goalSteps = 18;

  const handleReset = () => {
    setMistakes(0);
    setFailed(null);
    setHurdlesCleared(0);
    setMarkerX(95);
    setJumping(false);
    setFieldMsg('Press Jump (or Spacebar) when the hurdle enters the green jump zone.');
    setSteps(0);
    setHydration(85);
    setTrailMsg('Step steadily up to Sunnybrook Overlook—sip water before hydration runs dry.');
  };

  if (failed) {
    return (
      <ChallengeFailedView
        title={mode === 'field_day_rhythm' ? 'Hurdle Run Failed' : 'Trail Dehydration'}
        reason={failed}
        onRetry={handleReset}
        onExit={onCancel}
      />
    );
  }

  if (mode === 'field_day_rhythm') {
    const done = hurdlesCleared >= targetHurdles;
    return (
      <div className="space-y-2.5">
        <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} label="Footing" />
        <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <div className="text-xs sm:text-sm font-medium text-slate-800">{fieldMsg}</div>
          <div className="font-mono-num text-sm sm:text-base font-bold text-slate-900 shrink-0">
            {hurdlesCleared}/{targetHurdles}
          </div>
        </div>

        {/* Side-view 2.5D Track Scene */}
        <div className="relative h-32 sm:h-36 rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-b from-sky-100 via-emerald-50 to-orange-200">
          <div className="absolute bottom-10 inset-x-0 h-10 bg-emerald-600/20 rounded-t-full" />
          <div className="absolute bottom-0 inset-x-0 h-10 bg-[#D96D49] border-t-4 border-white/70" />
          <div
            className="absolute bottom-2 h-12 border-2 border-dashed border-emerald-600 bg-emerald-400/25 rounded-lg"
            style={{ left: '16%', width: '18%' }}
          />
          <div
            className="absolute bottom-9 w-9 h-10 rounded-xl bg-emerald-700 border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-xs transition-transform duration-150"
            style={{
              left: '22%',
              transform: jumping ? 'translateY(-42px)' : 'translateY(0px)',
            }}
          >
            <Zap className="w-4 h-4" />
          </div>
          {!done && (
            <div
              className="absolute bottom-9 w-3.5 h-9 bg-white border-2 border-orange-600 rounded-sm shadow"
              style={{ left: `${markerX}%` }}
            >
              <div className="w-full h-2 bg-orange-500" />
            </div>
          )}
        </div>

        {!done ? (
          <div className="text-center">
            <button
              type="button"
              onClick={handleJump}
              className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition-transform"
            >
              Jump Hurdle (Spacebar)
            </button>
          </div>
        ) : (
          <div className="text-center py-1.5 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Claim Field Day Reward
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">Hint: {hint}</span>
          <button type="button" onClick={onCancel} className="font-medium hover:text-slate-900 shrink-0">Exit</button>
        </div>
      </div>
    );
  }

  // Walk the Trail
  const trailDone = steps >= goalSteps;
  const pct = Math.round((steps / goalSteps) * 100);
  return (
    <div className="space-y-2.5">
      <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} label="Hydration Safety" />
      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
        {trailMsg}
      </div>

      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
          <span>Trail Progress</span>
          <span className="font-mono-num">{steps}/{goalSteps} Steps ({pct}%)</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-700 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center justify-between text-xs font-medium text-slate-700 pt-0.5">
          <span>Hydration Level</span>
          <span className="font-mono-num">{hydration}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${hydration < 30 ? 'bg-rose-600' : 'bg-sky-600'}`}
            style={{ width: `${hydration}%` }}
          />
        </div>
      </div>

      {!trailDone ? (
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (hydration < 25) {
                const nm = mistakes + 1;
                setMistakes(nm);
                if (nm >= MAX_MISTAKES) {
                  triggerFailure('You ignored low hydration warnings and became dehydrated on the trail!');
                } else {
                  audioEngine.playChime('hint');
                  setTrailMsg(`Hydration critically low! Sip water before stepping again. (${MAX_MISTAKES - nm} warnings left)`);
                }
                return;
              }
              audioEngine.playChime('tap');
              const nextSteps = steps + 1;
              const nextHydration = Math.max(0, hydration - 10);
              setSteps(nextSteps);
              setHydration(nextHydration);
              if (nextSteps >= goalSteps) {
                audioEngine.playChime('crystal');
                setTrailMsg('You reached Sunnybrook Overlook hydrated and energized!');
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm active:scale-95"
          >
            <Footprints className="w-4 h-4" />
            Step Steady
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playChime('bubble');
              setHydration((h) => Math.min(100, h + 35));
              setTrailMsg('Refreshing sip of clean spring water! Ready to keep hiking.');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm active:scale-95"
          >
            <Droplets className="w-4 h-4 text-sky-600" />
            Sip Water (+35%)
          </button>
        </div>
      ) : (
        <div className="text-center py-1.5 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
          >
            Restore Fitness Crystal
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="truncate">Hint: {hint}</span>
        <button type="button" onClick={onCancel} className="font-medium hover:text-slate-900 shrink-0">Exit</button>
      </div>
    </div>
  );
};
