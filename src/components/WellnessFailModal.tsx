import React from 'react';
import { AlertTriangle, HeartPulse, RotateCcw } from 'lucide-react';
import { HealthMeters } from '../types/game';

interface WellnessFailModalProps {
  depletedMeter: keyof HealthMeters;
  coins: number;
  failedAttempts: number;
  onRecover: () => void;
  onRequestRestart: () => void;
}

const METER_COPY: Record<
  keyof HealthMeters,
  { title: string; detail: string; tip: string }
> = {
  energy: {
    title: 'Energy Depleted',
    detail: 'Your energy reached 0%. Running on empty makes every task harder.',
    tip: 'Rest at the Clinic, eat wholesome snacks, or finish quests to restore energy.',
  },
  hygiene: {
    title: 'Hygiene Critical',
    detail: 'Your hygiene reached 0% from skipped handwashing and grime.',
    tip: 'Use Herbal Soap from your Satchel or visit the Bathhouse and Fountain.',
  },
  nutrition: {
    title: 'Nutrition Depleted',
    detail: 'Your nutrition reached 0%. Your body needs steady healthy fuel.',
    tip: 'Keep Crisp Apples or Rainbow Smoothies in your Satchel from Pip’s Shop.',
  },
  mood: {
    title: 'Overwhelmed & Exhausted',
    detail: 'Your mood reached 0% after repeated setbacks without rest.',
    tip: 'Take calm breathing breaks, pace your challenges, and restore balance.',
  },
};

export const WellnessFailModal: React.FC<WellnessFailModalProps> = ({
  depletedMeter,
  coins,
  failedAttempts,
  onRecover,
  onRequestRestart,
}) => {
  const copy = METER_COPY[depletedMeter];
  const recoveryCost = Math.min(15, coins);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wellness-fail-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 id="wellness-fail-title" className="text-base font-bold text-slate-900">
              {copy.title}
            </h2>
            <p className="text-xs text-slate-500">Sunnybrook Clinic Recovery</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{copy.detail}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{copy.tip}</p>

          <div className="grid grid-cols-2 divide-x divide-slate-100 border border-slate-200 rounded-lg py-2.5 text-center">
            <div className="px-2">
              <div className="text-[11px] text-slate-500">Setbacks</div>
              <div className="text-xs font-mono-num font-semibold text-slate-900 mt-0.5">
                {failedAttempts}
              </div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-500">Clinic Fee</div>
              <div className="text-xs font-mono-num font-semibold text-rose-700 mt-0.5">
                {recoveryCost > 0 ? `-${recoveryCost} Coins` : 'Free'}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onRecover}
              className="w-full px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <HeartPulse className="w-4 h-4" />
              <span>Recover at Clinic (55% All Meters)</span>
            </button>
            <button
              type="button"
              onClick={onRequestRestart}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Adventure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
