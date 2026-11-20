import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, ShieldCheck, Wind, Droplets } from 'lucide-react';
import { MiniGameType } from '../../types/game';
import { audioEngine } from '../../engine/audio';
import { shuffleArray } from '../../utils/shuffle';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface BreathingAndPreventionProps {
  mode: Extract<
    MiniGameType,
    'worry_breathing' | 'germ_detectives' | 'vaccine_visit' | 'mosquito_patrol' | 'boss_fog'
  >;
  hint: string;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

export const BreathingAndPreventionGames: React.FC<BreathingAndPreventionProps> = ({
  mode,
  hint,
  onComplete,
  onFail,
  onCancel,
}) => {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const failSentRef = useRef(false);

  const triggerFailure = (reason: string) => {
    if (failSentRef.current) return;
    failSentRef.current = true;
    audioEngine.playChime('fail');
    setFailed(reason);
    onFail(reason);
  };

  // 1. Worry Clouds Breathing Guide
  const [breathCycle, setBreathCycle] = useState(0);
  const [breathStage, setBreathStage] = useState<'ready' | 'inhale' | 'hold' | 'exhale' | 'done'>('ready');
  const [breathCount, setBreathCount] = useState(4);

  useEffect(() => {
    if (mode !== 'worry_breathing' || breathStage === 'ready' || breathStage === 'done') return;
    const t = window.setInterval(() => {
      setBreathCount((c) => {
        if (c > 1) return c - 1;
        if (breathStage === 'inhale') {
          setBreathStage('hold');
          return 3;
        }
        if (breathStage === 'hold') {
          setBreathStage('exhale');
          return 4;
        }
        audioEngine.playChime('success');
        const nextCycle = breathCycle + 1;
        setBreathCycle(nextCycle);
        if (nextCycle >= 3) {
          setBreathStage('done');
          return 0;
        }
        setBreathStage('inhale');
        return 4;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, breathStage, breathCycle]);

  // 2. Germ Detectives (with clean decoy objects so UV detection & precision matter)
  const [gogglesOn, setGogglesOn] = useState(false);
  const [cleanedSpots, setCleanedSpots] = useState<string[]>([]);
  const [germMsg, setGermMsg] = useState('Switch on Germ Goggles UV lens, then tap ONLY the glowing germ hotspots!');
  const hotspots = [
    { id: 'knob', label: 'Classroom Doorknob', x: '18%', y: '48%', isGerm: true },
    { id: 'eraser', label: 'Clean Chalk Eraser', x: '34%', y: '76%', isGerm: false },
    { id: 'desk', label: 'Shared Science Desk', x: '50%', y: '56%', isGerm: true },
    { id: 'plant', label: 'Window Fern', x: '66%', y: '78%', isGerm: false },
    { id: 'pencils', label: 'Community Pencil Cup', x: '75%', y: '50%', isGerm: true },
    { id: 'sink', label: 'Faucet Handle', x: '84%', y: '34%', isGerm: true },
  ];
  const germSpotCount = hotspots.filter((s) => s.isGerm).length;

  // 3. Vaccine Visit (Ordered 3-step training with shuffled cards & mistake tracking)
  const [shieldCount, setShieldCount] = useState(0);
  const [vaccineMsg, setVaccineMsg] = useState('Click the Vaccine Training Cards in order (Blueprint → Practice → Memory) to train your Immune Defenders.');
  const drills = useMemo(() => {
    void shuffleSeed;
    const ordered = [
      { id: 'd1', stepIndex: 0, title: 'Blueprint Lesson', desc: 'Shows Immune B-Cells what the germ’s coat looks like (harmlessly).' },
      { id: 'd2', stepIndex: 1, title: 'Antibody Practice', desc: 'T-Cells & B-Cells practice making custom protective shields.' },
      { id: 'd3', stepIndex: 2, title: 'Memory Guard Ready', desc: 'Immune Memory remembers the defense plan for the future.' },
    ];
    let mixed = shuffleArray(ordered);
    if (mixed.every((d, i) => d.stepIndex === i)) {
      mixed = [mixed[1], mixed[2], mixed[0]];
    }
    return mixed;
  }, [shuffleSeed]);

  // 4. Mosquito Patrol (Empty 5 standing-water containers before 20s dusk timer ends)
  const [tippedPots, setTippedPots] = useState<string[]>([]);
  const [patrolTime, setPatrolTime] = useState(20);
  const waterContainers = useMemo(() => {
    void shuffleSeed;
    return shuffleArray([
      { id: 'pot1', label: 'Porch Flowerpot Saucer' },
      { id: 'bucket', label: 'Rainwater Garden Bucket' },
      { id: 'tire', label: 'Old Playground Tire' },
      { id: 'bath', label: 'Still Birdbath Dish' },
      { id: 'can', label: 'Open Watering Can' },
    ]);
  }, [shuffleSeed]);

  useEffect(() => {
    if (mode !== 'mosquito_patrol' || failed || tippedPots.length >= waterContainers.length) return;
    if (patrolTime <= 0) {
      triggerFailure('Dusk arrived before all standing-water containers were tipped dry!');
      return;
    }
    const id = window.setTimeout(() => setPatrolTime((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, patrolTime, tippedPots.length, failed]);

  // 5. Boss Fog Battle (Shuffled options per wave!)
  const bossStages = useMemo(() => {
    void shuffleSeed;
    const rawStages = [
      {
        chapter: 'Wave 1: Sticky Grumble Dust (Hygiene)',
        prompt: 'The Grumble Fog swirls sticky dust everywhere! What clears germs from hands safely?',
        options: [
          'Quick 2-second rinse with cold water only',
          'Scrub palms, fingers, thumbs & nails with soap and water for 20 seconds',
          'Wipe hands on your sleeves',
        ],
        correct: 1,
        hint: 'Remember Elder Rowan’s 20-second bubble timer!',
      },
      {
        chapter: 'Wave 2: Energy Drain Mist (Nutrition)',
        prompt: 'The Fog tries to sap Sunnybrook’s strength with a sugar crash! What keeps energy steady?',
        options: [
          'A Rainbow Plate of colorful veggies, fruit, whole grains, protein & water',
          'Three cans of fizzy high-fructose soda',
          'Skipping meals all day',
        ],
        correct: 0,
        hint: 'Think of Baker Bea’s balanced Rainbow Plate!',
      },
      {
        chapter: 'Wave 3: Sluggish Gust (Fitness)',
        prompt: 'Heavy fog slows everyone down! How should Sunnybrook restore healthy energy safely?',
        options: [
          'Warm up gently, enjoy 60 minutes of fun daily movement, and sip water',
          'Never move off the couch',
          'Sprint hard without warming up or hydrating',
        ],
        correct: 0,
        hint: 'Coach Kiko taught warm-ups, joyful play, and water breaks!',
      },
      {
        chapter: 'Wave 4: Worry Cloud Swarm (Rest & Wellness)',
        prompt: 'Worry Clouds rumble overhead! What calms the nervous system and restores rest?',
        options: [
          'Staring at bright screens late at night',
          'Slow belly breathing, screen-free bedtime routines, and talking with a trusted adult',
          'Staying awake all night worrying alone',
        ],
        correct: 1,
        hint: 'Remember Granny Luna’s cozy hearth breathing exercise!',
      },
      {
        chapter: 'Wave 5: Outbreak Squall (Prevention)',
        prompt: 'Final Surge! How do we protect our whole village community together?',
        options: [
          'Cough into elbows, clean shared surfaces, stay up to date on vaccines, and tip standing water',
          'Leave stagnant rainwater buckets outside and sneeze into bare hands',
          'Ignore symptoms and never ask a doctor',
        ],
        correct: 0,
        hint: 'Unite Teacher Tam and Nurse Nora’s prevention habits!',
      },
    ];

    return rawStages.map((st) => {
      const tagged = st.options.map((text, idx) => ({
        text,
        isCorrect: idx === st.correct,
      }));
      const mixed = shuffleArray(tagged);
      return {
        ...st,
        options: mixed.map((m) => m.text),
        correct: mixed.findIndex((m) => m.isCorrect),
      };
    });
  }, [shuffleSeed]);
  const [bossIdx, setBossIdx] = useState(0);
  const [bossMsg, setBossMsg] = useState('Unite all 5 Wellness Crystals to dissolve the Grumble Fog!');

  const handleReset = () => {
    failSentRef.current = false;
    setShuffleSeed((s) => s + 1);
    setMistakes(0);
    setFailed(null);
    setGogglesOn(false);
    setCleanedSpots([]);
    setGermMsg('Switch on Germ Goggles UV lens, then tap ONLY the glowing germ hotspots!');
    setShieldCount(0);
    setVaccineMsg('Click the Vaccine Training Cards in order (Blueprint → Practice → Memory) to train your Immune Defenders.');
    setTippedPots([]);
    setPatrolTime(20);
    setBossIdx(0);
    setBossMsg('Unite all 5 Wellness Crystals to dissolve the Grumble Fog!');
  };

  if (failed) {
    return (
      <ChallengeFailedView
        title={mode === 'boss_fog' ? 'Crystal Shield Shattered' : 'Challenge Failed'}
        reason={failed}
        onRetry={handleReset}
        onExit={onCancel}
      />
    );
  }

  if (mode === 'worry_breathing') {
    return (
      <div className="space-y-2.5 text-center">
        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
          Complete 3 calm belly-breathing cycles ({breathCycle}/3) to clear the Worry Clouds.
        </div>

        <div className="py-2 sm:py-3 flex flex-col items-center justify-center">
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center border-4 border-violet-300 transition-transform duration-700"
            style={{
              backgroundColor: breathStage === 'inhale' ? '#EDE9FE' : breathStage === 'hold' ? '#DDD6FE' : '#F5F3FF',
              transform:
                breathStage === 'inhale' || breathStage === 'hold' ? 'scale(1.14)' : 'scale(0.92)',
            }}
          >
            <Wind className="w-6 h-6 text-violet-700 mb-0.5" />
            <span className="font-bold text-xs sm:text-sm text-violet-950 capitalize">
              {breathStage === 'ready' ? 'Ready' : breathStage === 'done' ? 'Calm!' : breathStage}
            </span>
            {breathStage !== 'ready' && breathStage !== 'done' && (
              <span className="font-mono-num text-lg font-bold text-violet-800 leading-none mt-0.5">{breathCount}</span>
            )}
          </div>
        </div>

        {breathStage === 'ready' && (
          <button
            type="button"
            onClick={() => {
              audioEngine.playChime('tap');
              setBreathStage('inhale');
              setBreathCount(4);
            }}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
          >
            Begin Calm Breathing
          </button>
        )}

        {breathStage === 'done' && (
          <div className="space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">The Worry Clouds drifted peacefully away.</p>
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Restore Rest Crystal & Unlock Healing Satchel
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500 text-left">
          <span className="truncate">Hint: {hint}</span>
          <button type="button" onClick={onCancel} className="font-medium hover:text-slate-900 shrink-0">Exit</button>
        </div>
      </div>
    );
  }

  if (mode === 'germ_detectives') {
    const allCleaned = cleanedSpots.length === germSpotCount;
    return (
      <div className="space-y-2.5">
        <TriesIndicator mistakes={mistakes} maxMistakes={3} label="Accuracy" />
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <div className="text-xs sm:text-sm text-slate-800 font-medium">{germMsg}</div>
          <button
            type="button"
            onClick={() => {
              audioEngine.playChime('tap');
              setGogglesOn((g) => !g);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors shrink-0 ${
              gogglesOn
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {gogglesOn ? 'Germ Goggles: ON' : 'Switch On Germ Goggles'}
          </button>
        </div>

        <div
          className={`relative h-44 sm:h-52 rounded-xl border overflow-hidden transition-colors ${
            gogglesOn ? 'bg-slate-900 border-emerald-500' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="absolute top-2 left-4 right-4 h-8 rounded-lg bg-emerald-800/85 border border-emerald-900 flex items-center justify-center text-[11px] text-emerald-100 font-medium">
            Sunnybrook Classroom · Sanitize Shared Hotspots ({cleanedSpots.length}/{germSpotCount})
          </div>

          {hotspots.map((spot) => {
            const isClean = cleanedSpots.includes(spot.id);
            const glows = gogglesOn && spot.isGerm && !isClean;
            return (
              <button
                key={spot.id}
                type="button"
                disabled={isClean}
                onClick={() => {
                  if (!gogglesOn) {
                    const nm = mistakes + 1;
                    setMistakes(nm);
                    if (nm >= 3) {
                      triggerFailure('Turn on Germ Goggles first before wiping blind spots!');
                    } else {
                      audioEngine.playChime('hint');
                      setGermMsg(`Switch on Germ Goggles first! (${3 - nm} tries left)`);
                    }
                    return;
                  }
                  if (!spot.isGerm) {
                    const nm = mistakes + 1;
                    setMistakes(nm);
                    if (nm >= 3) {
                      triggerFailure('Too many clean items wiped! Only target glowing germ hotspots.');
                    } else {
                      audioEngine.playChime('hint');
                      setGermMsg(`${spot.label} is already clean—look for glowing spots! (${3 - nm} tries left)`);
                    }
                    return;
                  }
                  audioEngine.playChime('bubble');
                  setCleanedSpots((prev) => [...prev, spot.id]);
                  setGermMsg(`Sanitized ${spot.label}!`);
                }}
                style={{ left: spot.x, top: spot.y }}
                className={`-translate-x-1/2 -translate-y-1/2 absolute px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium border transition-all whitespace-nowrap ${
                  isClean
                    ? 'bg-emerald-600/20 border-emerald-400 text-emerald-200'
                    : glows
                    ? 'bg-lime-400/25 border-lime-400 text-lime-200 shadow-lg hover:scale-105 cursor-pointer'
                    : gogglesOn
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 cursor-pointer'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 cursor-pointer'
                }`}
              >
                {isClean ? `Clean: ${spot.label}` : glows ? `Germ Hotspot: ${spot.label}` : spot.label}
              </button>
            );
          })}
        </div>

        {allCleaned && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                audioEngine.playChime('crystal');
                onComplete();
              }}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Unlock Germ Goggles Tool
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

  if (mode === 'vaccine_visit') {
    const done = shieldCount >= drills.length;
    return (
      <div className="space-y-2.5">
        <TriesIndicator mistakes={mistakes} maxMistakes={2} label="Order" />
        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
          {vaccineMsg}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {drills.map((d) => {
            const trained = d.stepIndex < shieldCount;
            return (
              <button
                key={d.id}
                type="button"
                disabled={trained}
                onClick={() => {
                  if (d.stepIndex === shieldCount) {
                    audioEngine.playChime('success');
                    setShieldCount(d.stepIndex + 1);
                    setVaccineMsg(`Step ${d.stepIndex + 1} complete! ${d.desc}`);
                  } else {
                    const nm = mistakes + 1;
                    setMistakes(nm);
                    if (nm >= 2) {
                      triggerFailure('Immune training steps happened out of sequence! Follow Blueprint → Practice → Memory.');
                    } else {
                      audioEngine.playChime('hint');
                      setVaccineMsg(`Pick Step ${shieldCount + 1} next before skipping ahead! (${2 - nm} try left)`);
                    }
                  }
                }}
                className={`text-left p-3 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${
                  trained
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs sm:text-sm leading-snug">
                    {trained ? `${d.stepIndex + 1}. ${d.title}` : d.title}
                  </div>
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${trained ? 'text-emerald-700' : 'text-slate-400'}`} />
                </div>
                <div className="text-[11px] sm:text-xs text-slate-600 leading-snug">{d.desc}</div>
              </button>
            );
          })}
        </div>
        {done && (
          <div className="text-center">
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Finish Vaccine Visit
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

  if (mode === 'mosquito_patrol') {
    const done = tippedPots.length === waterContainers.length;
    return (
      <div className="space-y-2.5">
        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-800 font-medium">
            Tip all standing-water containers ({tippedPots.length}/{waterContainers.length}) dry before dusk!
          </div>
          <span
            className={`font-mono-num text-sm sm:text-base font-bold shrink-0 ${
              patrolTime <= 6 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {patrolTime}s
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {waterContainers.map((c) => {
            const dry = tippedPots.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={dry}
                onClick={() => {
                  audioEngine.playChime('bubble');
                  setTippedPots((prev) => [...prev, c.id]);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                  dry
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-white border-slate-200 hover:border-slate-400'
                }`}
              >
                <span className="text-xs sm:text-sm font-medium leading-snug">{c.label}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold shrink-0">
                  <Droplets className={`w-3.5 h-3.5 ${dry ? 'text-emerald-700' : 'text-sky-600'}`} />
                  {dry ? 'Dry' : 'Tip'}
                </span>
              </button>
            );
          })}
        </div>
        {done && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                audioEngine.playChime('crystal');
                onComplete();
              }}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Restore Prevention Crystal
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

  // Boss Fog Battle!
  const bossDone = bossIdx >= bossStages.length;
  const stage = bossStages[bossIdx];
  return (
    <div className="space-y-2.5">
      <TriesIndicator mistakes={mistakes} maxMistakes={3} label="Crystal Shield" />

      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-500">Misty Forest Showdown</div>
          <div className="text-xs sm:text-sm text-slate-800 font-medium truncate">{bossMsg}</div>
        </div>
        <div className="font-mono-num text-xs font-bold text-slate-700 shrink-0">
          Fog: {Math.max(0, 100 - bossIdx * 20)}%
        </div>
      </div>

      {!bossDone ? (
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
          <div className="text-[11px] font-semibold text-emerald-700">{stage.chapter}</div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{stage.prompt}</h3>
          <div className="space-y-1.5">
            {stage.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (idx === stage.correct) {
                    audioEngine.playChime('crystal');
                    const next = bossIdx + 1;
                    setBossIdx(next);
                    setBossMsg(
                      next >= bossStages.length
                        ? 'All 5 Wellness Crystals shine in harmony—the Grumble Fog is gone!'
                        : 'Crystal beam hit! The Grumble Fog shrinks back.'
                    );
                  } else {
                    const nm = mistakes + 1;
                    setMistakes(nm);
                    if (nm >= 3) {
                      triggerFailure('The Grumble Fog broke through your Crystal Shield after 3 wrong counters!');
                    } else {
                      audioEngine.playChime('hint');
                      setBossMsg(`${stage.hint} (${3 - nm} shield left)`);
                    }
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-400 text-xs sm:text-sm font-medium text-slate-800 leading-snug transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-3 space-y-2">
          <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
          <p className="text-base font-bold text-slate-900">Sunnybrook Village is Restored!</p>
          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
          >
            Watch Sunnybrook Celebration
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
