import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { MiniGameType } from '../../types/game';
import { audioEngine } from '../../engine/audio';
import { shuffleArray } from '../../utils/shuffle';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface SequenceGameProps {
  mode: Extract<MiniGameType, 'brush_sequence' | 'stretch_sequence' | 'bedtime_sequence' | 'sneeze_safe'>;
  hint: string;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

const MAX_MISTAKES = 3;

const SEQUENCE_DECKS: Record<
  SequenceGameProps['mode'],
  { prompt: string; steps: string[]; gentleWrong: string }
> = {
  brush_sequence: {
    prompt: 'Tap the 5 tooth-brushing steps in the healthiest order:',
    steps: [
      'Put a pea-sized drop of fluoride toothpaste on your brush',
      'Brush outer, inner, and chewing surfaces gently in circles for 2 minutes',
      'Brush your tongue gently to freshen breath',
      'Spit out the foam (no need to swallow)',
      'Rinse your toothbrush clean and put it upright to dry',
    ],
    gentleWrong: 'Wrong order! Think about what comes right next from start to finish.',
  },
  stretch_sequence: {
    prompt: 'Guide the stiff villager through a safe warm-up sequence in order:',
    steps: [
      'Take 3 calm breaths and check that your shoes are tied safely',
      'March lightly in place for 1 minute to warm muscles gently',
      'Do slow shoulder rolls and arm circles',
      'Do gentle calf and hamstring stretches without bouncing',
      'Sip a little water and begin active play!',
    ],
    gentleWrong: 'Wrong order! Warm muscles up gently before stretching.',
  },
  bedtime_sequence: {
    prompt: 'Build Sleepy Sam’s calm, screen-free bedtime routine in order:',
    steps: [
      'Turn off bright screens 30–60 minutes before sleep',
      'Wash face, change into cozy pajamas, and brush teeth',
      'Dim the bedroom lights and read a calm story',
      'Take slow belly breaths under a cozy blanket',
      'Drift off for 9–12 hours of restful sleep',
    ],
    gentleWrong: 'Wrong order! Screens go off first so the brain knows nighttime is starting.',
  },
  sneeze_safe: {
    prompt: 'Put Teacher Tam’s Sneeze-Safe & Mask Care steps in the best order:',
    steps: [
      'Feel a tickle? Grab a clean tissue or raise your bent elbow',
      'Cover your nose and mouth into the tissue or elbow',
      'Toss used tissues straight into a lined trash bin',
      'Wash hands with soap and water for 20 seconds (or use sanitizer)',
      'Wear a clean, snug mask if you have cough symptoms near others',
    ],
    gentleWrong: 'Wrong order! Cover safely, toss the tissue, then wash your hands.',
  },
};

export const SequenceGame: React.FC<SequenceGameProps> = ({
  mode,
  hint,
  onComplete,
  onFail,
  onCancel,
}) => {
  const deck = SEQUENCE_DECKS[mode];
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const shuffledIndices = useMemo(() => {
    void shuffleSeed;
    let mixed = shuffleArray(deck.steps.map((_, i) => i));
    if (mixed.every((val, i) => val === i)) {
      mixed = [mixed[2], mixed[0], mixed[4], mixed[1], mixed[3]];
    }
    return mixed;
  }, [deck.steps, shuffleSeed]);

  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string>(deck.prompt);

  const reset = () => {
    setShuffleSeed((s) => s + 1);
    setSelectedOrder([]);
    setMistakes(0);
    setFailed(false);
    setMessage(deck.prompt);
  };

  const handlePick = (stepIdx: number) => {
    if (failed || selectedOrder.includes(stepIdx)) return;
    const expectedNext = selectedOrder.length;
    if (stepIdx === expectedNext) {
      audioEngine.playChime('success');
      const next = [...selectedOrder, stepIdx];
      setSelectedOrder(next);
      if (next.length === deck.steps.length) {
        setMessage('Perfect sequence! Every step is in the healthiest order.');
      } else {
        setMessage(`Step ${next.length} locked in. Pick step ${next.length + 1}.`);
      }
    } else {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      if (nextMistakes >= MAX_MISTAKES) {
        audioEngine.playChime('fail');
        setFailed(true);
        onFail('Too many steps selected out of order.');
      } else {
        audioEngine.playChime('hint');
        setMessage(`${deck.gentleWrong} (${MAX_MISTAKES - nextMistakes} tries left)`);
      }
    }
  };

  if (failed) {
    return (
      <ChallengeFailedView
        title="Sequence Failed"
        reason="You made 3 ordering mistakes before finishing the routine. Review the proper order from start to finish and try again."
        onRetry={reset}
        onExit={onCancel}
      />
    );
  }

  const isFinished = selectedOrder.length === deck.steps.length;

  return (
    <div className="space-y-2.5">
      <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} />

      <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
        {message}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
        {/* Selected slots */}
        <div className="space-y-1.5">
          {deck.steps.map((stepText, idx) => {
            const filled = idx < selectedOrder.length;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs leading-snug ${
                  filled
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium'
                    : 'bg-white border-dashed border-slate-200 text-slate-400'
                }`}
              >
                <span className="font-mono-num w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 shrink-0">
                  {idx + 1}
                </span>
                <span>{filled ? stepText : `Step ${idx + 1}`}</span>
              </div>
            );
          })}
        </div>

        {/* Choices or Completion */}
        {!isFinished ? (
          <div className="space-y-1.5">
            {shuffledIndices.map((idx) => {
              const used = selectedOrder.includes(idx);
              if (used) return null;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePick(idx)}
                  className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-xs font-medium text-slate-800 leading-snug transition-colors"
                >
                  {deck.steps[idx]}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 space-y-3 border border-emerald-200 bg-emerald-50/40 rounded-xl">
            <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Complete Quest
            </button>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="truncate">Hint: {hint}</span>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 hover:text-slate-900 font-medium">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button type="button" onClick={onCancel} className="hover:text-slate-900 font-medium">
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
