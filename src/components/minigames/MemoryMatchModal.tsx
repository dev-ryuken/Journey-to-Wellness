import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, X } from 'lucide-react';
import { audioEngine } from '../../engine/audio';
import { shuffleArray } from '../../utils/shuffle';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface MemoryMatchModalProps {
  onComplete: () => void;
  onFail: (reason: string) => void;
  onClose: () => void;
}

interface CardPair {
  pairId: string;
  label: string;
  tag: string;
}

const MAX_MISMATCHES = 6;

const MEMORY_CARDS: CardPair[] = [
  { pairId: 'handwash', label: '20-Second Soap Scrub', tag: 'Healthy Habit' },
  { pairId: 'handwash', label: 'Stops Sticky Germs', tag: 'Match' },
  { pairId: 'plate', label: 'Rainbow Plate Meal', tag: 'Balanced Fuel' },
  { pairId: 'plate', label: 'Vitamins & Steady Energy', tag: 'Match' },
  { pairId: 'sleep', label: 'Screen-Free Bedtime', tag: 'Restful Sleep' },
  { pairId: 'sleep', label: '9–12 Hours Recharge', tag: 'Match' },
  { pairId: 'water', label: 'Tip Out Still Puddles', tag: 'Prevention' },
  { pairId: 'water', label: 'Keeps Mosquitoes Away', tag: 'Match' },
];

export const MemoryMatchModal: React.FC<MemoryMatchModalProps> = ({
  onComplete,
  onFail,
  onClose,
}) => {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const deck = useMemo(() => {
    void shuffleSeed;
    return shuffleArray(MEMORY_CARDS).map((card, slotIdx) => ({
      slotIdx,
      ...card,
    }));
  }, [shuffleSeed]);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('Flip two cards to match each Healthy Habit with its Wellness Power.');

  const handleRetry = () => {
    setShuffleSeed((s) => s + 1);
    setFlipped([]);
    setMatchedPairs([]);
    setMistakes(0);
    setFailed(false);
    setMessage('Flip two cards to match each Healthy Habit with its Wellness Power.');
  };

  const handleFlip = (slotIdx: number) => {
    if (failed) return;
    const card = deck[slotIdx];
    if (matchedPairs.includes(card.pairId) || flipped.includes(slotIdx) || flipped.length >= 2) return;

    audioEngine.playChime('tap');
    const nextFlipped = [...flipped, slotIdx];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const a = deck[nextFlipped[0]];
      const b = deck[nextFlipped[1]];
      if (a.pairId === b.pairId) {
        audioEngine.playChime('success');
        const nextMatched = [...matchedPairs, a.pairId];
        setMatchedPairs(nextMatched);
        setFlipped([]);
        setMessage(
          nextMatched.length === 4
            ? 'All 4 Healthy Habit pairs matched!'
            : `Matched! ${a.label} pairs with ${b.label}.`
        );
      } else {
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        if (nextMistakes >= MAX_MISMATCHES) {
          audioEngine.playChime('fail');
          setTimeout(() => {
            setFlipped([]);
            setFailed(true);
            onFail('Ran out of tries in Healthy Habits Memory Match.');
          }, 550);
        } else {
          audioEngine.playChime('hint');
          setMessage(`Not a match. (${MAX_MISMATCHES - nextMistakes} tries left)`);
          setTimeout(() => setFlipped([]), 800);
        }
      }
    }
  };

  const done = matchedPairs.length === 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Healthy Habits Memory Match</h2>
            <span className="text-[11px] text-slate-500">Match all 4 pairs within 6 mismatches</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close memory match"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5">
          {failed ? (
            <ChallengeFailedView
              title="Out of Tries"
              reason="You reached 6 mismatches before finding all 4 pairs. Keep track of card positions and try again."
              onRetry={handleRetry}
              onExit={onClose}
            />
          ) : (
            <>
              <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISMATCHES} label="Mismatches Left" />

              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium">
                {message}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {deck.map((card) => {
                  const isOpen = flipped.includes(card.slotIdx) || matchedPairs.includes(card.pairId);
                  const isMatched = matchedPairs.includes(card.pairId);
                  return (
                    <button
                      key={card.slotIdx}
                      type="button"
                      onClick={() => handleFlip(card.slotIdx)}
                      className={`h-16 sm:h-20 p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                        isMatched
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : isOpen
                          ? 'bg-slate-50 border-slate-400 text-slate-900'
                          : 'bg-white border-slate-200 hover:border-slate-400 text-slate-400'
                      }`}
                    >
                      {isOpen ? (
                        <>
                          <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 leading-none">
                            {card.tag}
                          </span>
                          <span className="text-[11px] sm:text-xs font-semibold mt-1 leading-tight">{card.label}</span>
                        </>
                      ) : (
                        <span className="font-display font-bold text-base text-slate-300">?</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {done && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                    <Award className="w-4 h-4" />
                    <span>+30 Bonus Coins · +60 XP</span>
                  </div>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Claim Bonus
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
