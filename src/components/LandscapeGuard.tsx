import React, { useEffect, useState } from 'react';
import { Maximize2, Smartphone } from 'lucide-react';

export async function requestLandscapeOrientation(): Promise<boolean> {
  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be blocked in some iframes/browsers; still try orientation lock
  }

  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (orient?.lock) {
      await orient.lock('landscape');
      return true;
    }
  } catch {
    // Some mobile browsers (e.g. iOS Safari) disallow programmatic lock
  }
  return false;
}

export const LandscapeGuard: React.FC = () => {
  const [needsRotate, setNeedsRotate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
      const ua = nav.userAgent || '';
      const platform = nav.userAgentData?.platform || nav.platform || '';
      const isWindows = /Windows|Win32|Win64|WOW64/i.test(ua) || /Windows|Win32|Win64/i.test(platform);
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
      const coarse =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      const hasFinePointer =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(any-pointer: fine)').matches;
      const isMobileLike = !isWindows && (isMobileUA || (coarse && !hasFinePointer));
      const isPortrait = window.innerHeight > window.innerWidth;

      if (!isPortrait) {
        setDismissed(false);
        setNeedsRotate(false);
      } else {
        setNeedsRotate(isMobileLike && isPortrait);
      }
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!needsRotate || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/92 text-white flex items-center justify-center p-6 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landscape-guard-title"
    >
      <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-slate-200 rotate-90" />
        </div>

        <div className="space-y-1">
          <h2 id="landscape-guard-title" className="text-base font-semibold text-white">
            Rotate to Landscape
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            HealthQuest plays best horizontally for the village view and touch joystick.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              void requestLandscapeOrientation();
            }}
            className="w-full px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Switch to Landscape</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full px-4 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            Continue in Portrait
          </button>
        </div>
      </div>
    </div>
  );
};
