import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MiniGameType } from '../../types/game';
import { audioEngine } from '../../engine/audio';
import { shuffleArray } from '../../utils/shuffle';
import { ChallengeFailedView, TriesIndicator } from './ChallengeFailedView';

interface NutritionAndWaterGamesProps {
  mode: Extract<MiniGameType, 'clean_water' | 'rainbow_plate' | 'sugar_sneak' | 'harvest_helper'>;
  hint: string;
  onComplete: () => void;
  onFail: (reason: string) => void;
  onCancel: () => void;
}

const MAX_MISTAKES = 3;

export const NutritionAndWaterGames: React.FC<NutritionAndWaterGamesProps> = ({
  mode,
  hint,
  onComplete,
  onFail,
  onCancel,
}) => {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  // 1. Clean Water Quest
  const waterSources = useMemo(() => {
    void shuffleSeed;
    return shuffleArray([
      { id: 'tap', name: 'Tested Village Spring Tap', desc: 'Covered stone pipe with clean filter test', safe: true },
      { id: 'pond', name: 'Stagnant Meadow Puddle', desc: 'Still rainwater sitting near leaves', safe: false },
      { id: 'boiled', name: 'Rolling-Boiled Kettle Water', desc: 'Boiled 1+ minute & cooled in covered pitcher', safe: true },
      { id: 'barrel', name: 'Uncovered Rain Barrel', desc: 'Open barrel collecting dust & bugs', safe: false },
      { id: 'filter', name: 'Certified Ceramic Filter Jug', desc: 'Treated and sealed clean drinking flask', safe: true },
      { id: 'creek', name: 'Muddy Trail Runoff', desc: 'Cloudy stream water beside muddy boots', safe: false },
    ]);
  }, [shuffleSeed]);
  const [waterIdx, setWaterIdx] = useState(0);
  const [waterMsg, setWaterMsg] = useState('Inspect each water source and decide whether it is Safe to Drink or Needs Treatment.');

  // 2. Rainbow Plate (shuffled options per section with distractors)
  const plateOptions = useMemo(() => {
    void shuffleSeed;
    return {
      veggies: shuffleArray([
        { label: 'Roasted Broccoli & Carrots', healthy: true },
        { label: 'Deep-Fried Onion Rings', healthy: false },
        { label: 'Spinach & Bell Peppers', healthy: true },
      ]),
      fruit: shuffleArray([
        { label: 'Fresh Berries & Sliced Apple', healthy: true },
        { label: 'Sugary Fruit Gummies', healthy: false },
        { label: 'Orange Slices & Melon', healthy: true },
      ]),
      grains: shuffleArray([
        { label: 'Brown Rice & Whole-Wheat Roll', healthy: true },
        { label: 'Glazed Frosted Donut', healthy: false },
        { label: 'Warm Oats & Quinoa', healthy: true },
      ]),
      protein: shuffleArray([
        { label: 'Grilled Beans & Egg', healthy: true },
        { label: 'Processed Cheese Puffs', healthy: false },
        { label: 'Baked Salmon & Tofu', healthy: true },
      ]),
      drink: shuffleArray([
        { label: 'Clean Spring Water', healthy: true },
        { label: 'Fizzy High-Sugar Soda', healthy: false },
      ]),
    } as Record<string, Array<{ label: string; healthy: boolean }>>;
  }, [shuffleSeed]);
  const [plate, setPlate] = useState<Record<string, string>>({});
  const [plateMsg, setPlateMsg] = useState('Choose one wholesome, balanced option for each section of Baker Bea’s Rainbow Plate.');

  // 3. Sugar Sneak
  const labelItems = useMemo(() => {
    void shuffleSeed;
    return shuffleArray([
      { name: 'Sparkle Berry Fizz', label: 'Ingredients: Carbonated water, High-fructose corn syrup (34g sugar)', isLowSugar: false },
      { name: 'Orchard Apple & Water', label: 'Ingredients: Whole crisp apple, plain water (0g added sugar)', isLowSugar: true },
      { name: 'Frosted Candy Crunch Bar', label: 'Ingredients: Cane sugar, corn syrup, palm oil (26g added sugar)', isLowSugar: false },
      { name: 'Plain Yogurt + Blueberries', label: 'Ingredients: Cultured milk, fresh blueberries (0g added sugar)', isLowSugar: true },
      { name: 'Sweetened Fruit Punch Box', label: 'Ingredients: Water, dextrose, fruit concentrate (24g added sugar)', isLowSugar: false },
    ]);
  }, [shuffleSeed]);
  const [sugarIdx, setSugarIdx] = useState(0);
  const [sugarMsg, setSugarMsg] = useState('Read each ingredient label and identify Everyday Low-Sugar Picks vs Hidden Added Sugar.');

  // 4. Harvest Helper
  const harvestCards = useMemo(() => {
    void shuffleSeed;
    return shuffleArray([
      { name: 'Whole-Wheat Bread', group: 'grains' },
      { name: 'Spinach Leaves', group: 'produce' },
      { name: 'Black Beans', group: 'protein' },
      { name: 'Milk & Yogurt', group: 'calcium' },
      { name: 'Oatmeal', group: 'grains' },
      { name: 'Sweet Strawberries', group: 'produce' },
      { name: 'Scrambled Eggs', group: 'protein' },
      { name: 'Cheddar Cheese', group: 'calcium' },
    ]);
  }, [shuffleSeed]);
  const baskets = useMemo(() => {
    void shuffleSeed;
    return shuffleArray([
      { id: 'grains', label: 'Grains (Energy)' },
      { id: 'produce', label: 'Fruits & Veggies' },
      { id: 'protein', label: 'Protein (Muscles)' },
      { id: 'calcium', label: 'Dairy / Calcium' },
    ]);
  }, [shuffleSeed]);
  const [harvestIdx, setHarvestIdx] = useState(0);
  const [harvestMsg, setHarvestMsg] = useState('Sort Farmer Fig’s 8 harvest foods into the matching food group basket.');

  const registerMistake = (warningMsg: string, failReason: string, onWarn: (msg: string) => void) => {
    const next = mistakes + 1;
    setMistakes(next);
    if (next >= MAX_MISTAKES) {
      audioEngine.playChime('fail');
      setFailed(failReason);
      onFail(failReason);
    } else {
      audioEngine.playChime('hint');
      onWarn(`${warningMsg} (${MAX_MISTAKES - next} tries left)`);
    }
  };

  const resetAll = () => {
    setShuffleSeed((s) => s + 1);
    setMistakes(0);
    setFailed(null);
    setWaterIdx(0);
    setWaterMsg('Inspect each water source and decide whether it is Safe to Drink or Needs Treatment.');
    setPlate({});
    setPlateMsg('Choose one wholesome, balanced option for each section of Baker Bea’s Rainbow Plate.');
    setSugarIdx(0);
    setSugarMsg('Read each ingredient label and identify Everyday Low-Sugar Picks vs Hidden Added Sugar.');
    setHarvestIdx(0);
    setHarvestMsg('Sort Farmer Fig’s 8 harvest foods into the matching food group basket.');
  };

  if (failed) {
    return (
      <ChallengeFailedView
        title="Challenge Failed"
        reason={failed}
        onRetry={resetAll}
        onExit={onCancel}
      />
    );
  }

  if (mode === 'clean_water') {
    const done = waterIdx >= waterSources.length;
    const item = waterSources[waterIdx];
    return (
      <div className="space-y-2.5">
        <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} />
        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
          {waterMsg}
        </div>
        {!done ? (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white text-center space-y-2.5">
            <div className="text-[11px] font-mono-num text-slate-400">
              Station {waterIdx + 1} of {waterSources.length}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">{item.name}</h3>
            <p className="text-xs sm:text-sm text-slate-600">{item.desc}</p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (item.safe) {
                    audioEngine.playChime('success');
                    setWaterIdx((i) => i + 1);
                    setWaterMsg('Correct! Covered taps, boiled water, and certified filters are safe.');
                  } else {
                    registerMistake(
                      'Unsafe! Uncovered or stagnant water can carry germs and must be treated first.',
                      'Too many unsafe water misidentifications!',
                      setWaterMsg
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
              >
                Safe to Drink
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!item.safe) {
                    audioEngine.playChime('success');
                    setWaterIdx((i) => i + 1);
                    setWaterMsg('Good catch! That source needs boiling or filtering first.');
                  } else {
                    registerMistake(
                      'Check closely—this water was already boiled, filtered, or safely piped.',
                      'Too many water inspection mistakes!',
                      setWaterMsg
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm"
              >
                Needs Boiling / Filtering
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-3 space-y-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">All water stations inspected safely!</p>
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Restore Hygiene Crystal
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

  if (mode === 'rainbow_plate') {
    const keys = Object.keys(plateOptions);
    const complete = keys.every((k) => Boolean(plate[k]));

    const handleServe = () => {
      const badSections = keys.filter((sec) => {
        const picked = plate[sec];
        const match = plateOptions[sec].find((o) => o.label === picked);
        return !match?.healthy;
      });
      if (badSections.length === 0) {
        audioEngine.playChime('success');
        onComplete();
      } else {
        registerMistake(
          `Watch out—your ${badSections.join(', ')} choice has excess sugar or fried fat. Swap for a whole food!`,
          'You served too many unbalanced plates instead of whole-food nutrition!',
          setPlateMsg
        );
      }
    };

    return (
      <div className="space-y-2">
        <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} />
        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
          {plateMsg}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {keys.map((section) => (
            <div key={section} className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <div className="text-[11px] font-semibold capitalize text-slate-500">{section}</div>
              <div className="flex flex-col gap-1">
                {plateOptions[section].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      audioEngine.playChime('tap');
                      setPlate((p) => ({ ...p, [section]: opt.label }));
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium leading-tight transition-colors ${
                      plate[section] === opt.label
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="p-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center text-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">
              {complete ? 'Plate ready!' : `${Object.keys(plate).length}/${keys.length} chosen`}
            </span>
            <button
              type="button"
              disabled={!complete}
              onClick={handleServe}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                complete
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Serve Rainbow Plate
            </button>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">Hint: {hint}</span>
          <button type="button" onClick={onCancel} className="font-medium hover:text-slate-900 shrink-0">Exit</button>
        </div>
      </div>
    );
  }

  if (mode === 'sugar_sneak') {
    const done = sugarIdx >= labelItems.length;
    const cur = labelItems[sugarIdx];
    return (
      <div className="space-y-2.5">
        <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} />
        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
          {sugarMsg}
        </div>
        {!done ? (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-center">
            <div className="text-[11px] font-mono-num text-slate-400">
              Label {sugarIdx + 1} of {labelItems.length}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">{cur.name}</h3>
            <p className="text-xs font-mono bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-700">
              {cur.label}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (cur.isLowSugar) {
                    audioEngine.playChime('success');
                    setSugarIdx((i) => i + 1);
                    setSugarMsg('Spot on! Whole foods with zero added syrup keep energy steady.');
                  } else {
                    registerMistake(
                      'Check the ingredients—corn syrup or dextrose means sneaky added sugar!',
                      'Missed too many hidden sugar labels!',
                      setSugarMsg
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
              >
                Everyday Low-Sugar Pick
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cur.isLowSugar) {
                    audioEngine.playChime('success');
                    setSugarIdx((i) => i + 1);
                    setSugarMsg('Sharp detective work! You spotted the hidden added sugars.');
                  } else {
                    registerMistake(
                      'Look closely—this pick has whole ingredients and 0g added sugar.',
                      'Too many label inspection errors!',
                      setSugarMsg
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm"
              >
                Hidden Added Sugar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-3 space-y-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
            >
              Finish Sugar Sneak
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

  // Harvest Helper
  const hDone = harvestIdx >= harvestCards.length;
  const hItem = harvestCards[harvestIdx];

  return (
    <div className="space-y-2.5">
      <TriesIndicator mistakes={mistakes} maxMistakes={MAX_MISTAKES} />
      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium">
        {harvestMsg}
      </div>
      {!hDone ? (
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white text-center space-y-2.5">
          <div className="text-[11px] font-mono-num text-slate-400">
            Food {harvestIdx + 1} of {harvestCards.length}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">{hItem.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {baskets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (b.id === hItem.group) {
                    audioEngine.playChime('success');
                    setHarvestIdx((i) => i + 1);
                    setHarvestMsg(`Nice! ${hItem.name} belongs in ${b.label}.`);
                  } else {
                    registerMistake(
                      `Not quite! Think about what ${hItem.name} gives your body.`,
                      'Too many harvest sorting mistakes!',
                      setHarvestMsg
                    );
                  }
                }}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 text-xs sm:text-sm font-medium text-slate-800"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-3 space-y-2">
          <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm"
          >
            Restore Nutrition Crystal
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
