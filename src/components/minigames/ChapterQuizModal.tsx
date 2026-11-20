import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, X } from 'lucide-react';
import { ChapterQuiz } from '../../types/game';
import { audioEngine } from '../../engine/audio';
import { shuffleArray } from '../../utils/shuffle';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface ChapterQuizModalProps {
  quiz: ChapterQuiz;
  onComplete: (score: number) => void;
  onFail: (reason: string) => void;
  onClose: () => void;
}

const MAX_MISTAKES = 3;

export const ChapterQuizModal: React.FC<ChapterQuizModalProps> = ({
  quiz,
  onComplete,
  onFail,
  onClose,
}) => {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);
  const [firstTryScore, setFirstTryScore] = useState(0);
  const [hadWrongAttempt, setHadWrongAttempt] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState(false);

  const shuffledQuestions = useMemo(() => {
    void shuffleSeed;
    return quiz.questions.map((q) => {
      const tagged = q.options.map((text, idx) => ({
        text,
        isCorrect: idx === q.correctIndex,
      }));
      const mixed = shuffleArray(tagged);
      return {
        ...q,
        options: mixed.map((m) => m.text),
        correctIndex: mixed.findIndex((m) => m.isCorrect),
      };
    });
  }, [quiz, shuffleSeed]);

  const finished = qIndex >= shuffledQuestions.length;
  const currentQ = shuffledQuestions[qIndex];

  const handleRetry = () => {
    setShuffleSeed((s) => s + 1);
    setQIndex(0);
    setSelected(null);
    setFeedback(null);
    setAnsweredCorrect(false);
    setFirstTryScore(0);
    setHadWrongAttempt(false);
    setMistakes(0);
    setFailed(false);
  };

  const handleSelect = (idx: number) => {
    if (answeredCorrect || failed) return;
    setSelected(idx);
    if (idx === currentQ.correctIndex) {
      audioEngine.playChime('success');
      setAnsweredCorrect(true);
      setFeedback(currentQ.explanation);
      if (!hadWrongAttempt) {
        setFirstTryScore((s) => s + 1);
      }
    } else {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setHadWrongAttempt(true);
      if (nextMistakes >= MAX_MISTAKES) {
        audioEngine.playChime('fail');
        setFailed(true);
        onFail(`Missed ${MAX_MISTAKES} questions in ${quiz.title}.`);
      } else {
        audioEngine.playChime('hint');
        setFeedback(`Hint: ${currentQ.hint} (${MAX_MISTAKES - nextMistakes} tries left)`);
      }
    }
  };

  const handleNext = () => {
    setQIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    setAnsweredCorrect(false);
    setHadWrongAttempt(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">{quiz.title}</h2>
            <span className="text-[11px] text-slate-500">{quiz.subtitle}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
            aria-label="Close quiz"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5">
          {failed ? (
            <ChallengeFailedView
              title="Quiz Failed"
              reason="You ran out of tries after 3 incorrect answers. Review what you learned in the Evidence Log and try again."
              onRetry={handleRetry}
              onExit={onClose}
            />
          ) : !finished ? (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="font-mono-num font-medium">
                  Question {qIndex + 1} / {shuffledQuestions.length}
                </span>
                <div className="w-36">
                  <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} label="Tries" />
                </div>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {currentQ.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentQ.options.map((opt, idx) => {
                  const isRight = answeredCorrect && idx === currentQ.correctIndex;
                  const isWrongPicked = !answeredCorrect && selected === idx;
                  return (
                    <button
                      key={`${qIndex}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(idx)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs sm:text-sm font-medium leading-snug transition-colors ${
                        isRight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                          : isWrongPicked
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-white border-slate-200 hover:border-slate-400 text-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {(feedback || answeredCorrect) && (
                <div
                  className={`px-3 py-2 rounded-lg border text-xs leading-snug flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                    answeredCorrect
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="flex-1">{feedback}</span>
                  {answeredCorrect && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0"
                    >
                      {qIndex + 1 === shuffledQuestions.length ? 'Finish Quiz' : 'Next Question'}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <Award className="w-10 h-10 text-emerald-700 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Chapter Quiz Complete</h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Answered <span className="font-mono-num font-bold text-emerald-700">{firstTryScore}/5</span> on the first try.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>+50 Coins · +100 XP</span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onComplete(firstTryScore)}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold"
                >
                  Collect Bonus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
