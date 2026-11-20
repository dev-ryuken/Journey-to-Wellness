import React from 'react';
import { AlertCircle, Heart, RotateCcw } from 'lucide-react';

interface TriesIndicatorProps {
  mistakes: number;
  maxMistakes: number;
  label?: string;
}

export const TriesIndicator: React.FC<TriesIndicatorProps> = ({
  mistakes,
  maxMistakes,
  label = 'Tries',
}) => {
  const remaining = Math.max(0, maxMistakes - mistakes);
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1.5" aria-label={`${remaining} of ${maxMistakes} tries remaining`}>
        <div className="flex items-center gap-1">
          {Array.from({ length: maxMistakes }).map((_, idx) => {
            const active = idx < remaining;
            return (
              <Heart
                key={idx}
                className={`w-3.5 h-3.5 ${
                  active ? 'text-rose-600 fill-rose-600' : 'text-slate-300'
                }`}
              />
            );
          })}
        </div>
        <span className="font-mono-num text-[11px] text-slate-600">
          {remaining}/{maxMistakes}
        </span>
      </div>
    </div>
  );
};

interface ChallengeFailedViewProps {
  title?: string;
  reason: string;
  onRetry: () => void;
  onExit: () => void;
}

export const ChallengeFailedView: React.FC<ChallengeFailedViewProps> = ({
  title = 'Challenge Failed',
  reason,
  onRetry,
  onExit,
}) => {
  return (
    <div className="py-6 text-center space-y-4">
      <div className="w-11 h-11 mx-auto rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{reason}</p>
        <p className="text-[11px] text-rose-700 font-medium pt-1">
          Setback penalty: -10 Energy · -12 Mood
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Return to Village
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
};
