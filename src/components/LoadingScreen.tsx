import React from 'react';

interface LoadingScreenProps {
  progress: number;
  label: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, label }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAFAF8] text-slate-900 p-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            HealthQuest
          </h1>
          <p className="text-xs text-slate-500">Journey to Wellness</p>
        </div>

        <div className="space-y-2">
          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-700 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{label}</span>
            <span className="font-mono-num text-slate-700">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
