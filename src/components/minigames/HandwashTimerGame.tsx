import React, { useEffect, useRef, useState } from 'react';
import { Droplets, Sparkles, CheckCircle2 } from 'lucide-react';
import { audioEngine } from '../../engine/audio';
import { ChallengeFailedView } from './ChallengeFailedView';

interface HandwashTimerGameProps {
  hint: string;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

interface ZoneInfo {
  id: string;
  label: string;
  tip: string;
}

const HAND_ZONES: ZoneInfo[] = [
  { id: 'palms', label: 'Palms', tip: 'Rub palm to palm in circles' },
  { id: 'backs', label: 'Backs of Hands', tip: 'Interlace fingers over the back of each hand' },
  { id: 'between', label: 'Between Fingers', tip: 'Scrub webs between every finger' },
  { id: 'thumbs', label: 'Thumbs', tip: 'Twist and scrub around both thumbs' },
  { id: 'nails', label: 'Fingertips & Nails', tip: 'Rub fingertips gently against opposite palm' },
];

export const HandwashTimerGame: React.FC<HandwashTimerGameProps> = ({
  hint,
  onComplete,
  onFail,
  onCancel,
}) => {
  const [phase, setPhase] = useState<'soap' | 'scrub' | 'rinse' | 'done' | 'failed'>('soap');
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [overtimeLeft, setOvertimeLeft] = useState<number | null>(null);
  const [scrubbed, setScrubbed] = useState<Record<string, number>>({
    palms: 0,
    backs: 0,
    between: 0,
    thumbs: 0,
    nails: 0,
  });
  const [feedback, setFeedback] = useState('First, wet your hands and pump a squirt of soap!');
  const timerRef = useRef<number | null>(null);
  const failedReportedRef = useRef(false);

  const allZonesClean = HAND_ZONES.every((z) => scrubbed[z.id] >= 100);

  useEffect(() => {
    if (phase !== 'scrub') return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        return 0;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Overtime countdown if 20s expires before all 5 hand zones are scrubbed
  useEffect(() => {
    if (phase !== 'scrub' || secondsLeft > 0 || allZonesClean) return;
    if (overtimeLeft === null) {
      setOvertimeLeft(10);
      setFeedback('Finish scrubbing the remaining hand zones within 10 seconds before the soap dries!');
      return;
    }
    if (overtimeLeft <= 0) {
      if (!failedReportedRef.current) {
        failedReportedRef.current = true;
        audioEngine.playChime('fail');
        setPhase('failed');
        onFail('Handwashing ran out of time before all 5 zones were scrubbed.');
      }
      return;
    }
    const id = window.setTimeout(() => {
      setOvertimeLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, secondsLeft, allZonesClean, overtimeLeft, onFail]);

  useEffect(() => {
    if (phase === 'scrub' && secondsLeft === 0 && allZonesClean) {
      audioEngine.playChime('success');
      setOvertimeLeft(null);
      setPhase('rinse');
      setFeedback('20 seconds complete and every zone is bubbly! Tap Rinse & Dry.');
    }
  }, [phase, secondsLeft, allZonesClean]);

  const handleSoap = () => {
    audioEngine.playChime('bubble');
    setPhase('scrub');
    setFeedback('Scrub all 5 hand zones before the 20-second timer and grace window end!');
  };

  const handleScrubZone = (zone: ZoneInfo) => {
    if (phase !== 'scrub') return;
    audioEngine.playChime('bubble');
    setScrubbed((prev) => {
      const next = Math.min(100, (prev[zone.id] ?? 0) + 34);
      return { ...prev, [zone.id]: next };
    });
    setFeedback(`${zone.label}: ${zone.tip}`);
  };

  const handleRinse = () => {
    audioEngine.playChime('crystal');
    setPhase('done');
    setFeedback('Sparkling clean! You defeated the sticky Grumble Dust!');
  };

  const handleRetry = () => {
    failedReportedRef.current = false;
    setPhase('soap');
    setSecondsLeft(20);
    setOvertimeLeft(null);
    setScrubbed({ palms: 0, backs: 0, between: 0, thumbs: 0, nails: 0 });
    setFeedback('First, wet your hands and pump a squirt of soap!');
  };

  if (phase === 'failed') {
    return (
      <ChallengeFailedView
        title="Soap Dried Too Early"
        reason="You ran out of time before scrubbing all 5 hand zones. Scrub palms, backs, webs, thumbs, and fingertips steadily during the 20-second wash."
        onRetry={handleRetry}
        onExit={onCancel}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-600">
            {overtimeLeft !== null ? 'Grace Window' : '20-Second Bubble Timer'}
          </div>
          <div className="text-xs sm:text-sm text-slate-900 mt-0.5 leading-snug">{feedback}</div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`font-mono-num text-2xl font-bold leading-none ${
              overtimeLeft !== null ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {overtimeLeft !== null ? `${overtimeLeft}s` : `${secondsLeft}s`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {overtimeLeft !== null ? 'Finish now!' : 'Goal: 20s'}
          </div>
        </div>
      </div>

      {phase === 'soap' && (
        <div className="text-center py-3 space-y-2.5">
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Wet your hands with clean water and pump soap to start the 20-second scrub.
          </p>
          <button
            type="button"
            onClick={handleSoap}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors"
          >
            <Droplets className="w-4 h-4" />
            Wet Hands & Pump Soap
          </button>
        </div>
      )}

      {phase === 'scrub' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HAND_ZONES.map((zone) => {
              const pct = scrubbed[zone.id] ?? 0;
              const clean = pct >= 100;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleScrubZone(zone)}
                  className={`text-left p-2.5 rounded-xl border transition-all active:scale-95 ${
                    clean
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-semibold text-xs sm:text-sm leading-tight">{zone.label}</span>
                    <span className="font-mono-num text-[11px] font-bold shrink-0">
                      {clean ? 'Clean' : `${pct}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        clean ? 'bg-emerald-700' : 'bg-slate-800'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">{zone.tip}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            Tap each hand zone 3 times to build full soap lather before time runs out.
          </p>
        </div>
      )}

      {phase === 'rinse' && (
        <div className="text-center py-3 space-y-2.5">
          <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-xs sm:text-sm">
            <Sparkles className="w-4 h-4" />
            All 5 zones scrubbed for 20 seconds!
          </div>
          <div>
            <button
              type="button"
              onClick={handleRinse}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-sm"
            >
              Rinse with Clean Water & Dry
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="text-center py-3 space-y-2.5">
          <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
          <p className="text-sm sm:text-base font-semibold text-slate-900">
            Hands sparkling clean!
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
          >
            Claim Reward
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="truncate">Hint: {hint}</span>
        <button type="button" onClick={onCancel} className="text-slate-600 hover:text-slate-900 font-medium shrink-0">
          Exit
        </button>
      </div>
    </div>
  );
};
