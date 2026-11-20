import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
  Volume2,
} from 'lucide-react';
import { CrystalCategory, GameSaveState, QuestDefinition } from '../types/game';
import { ZONE_MAP } from '../data/zones';
import { audioEngine } from '../engine/audio';

interface EvidenceLogPanelProps {
  state: GameSaveState;
  quests: QuestDefinition[];
}

type FilterCategory = 'all' | CrystalCategory | 'final';

const CATEGORY_OPTIONS: Array<{ id: FilterCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hygiene', label: 'Hygiene' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'rest', label: 'Rest' },
  { id: 'prevention', label: 'Prevention' },
];

export const EvidenceLogPanel: React.FC<EvidenceLogPanelProps> = ({ state, quests }) => {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUndiscovered, setShowUndiscovered] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const completedSet = useMemo(() => new Set(state.completedQuestIds), [state.completedQuestIds]);
  const learnedMap = useMemo(() => {
    const map = new Map<string, GameSaveState['learnedFacts'][number]>();
    for (const f of state.learnedFacts) {
      map.set(f.questId, f);
    }
    return map;
  }, [state.learnedFacts]);

  const entries = useMemo(() => {
    const questIdsSeen = new Set<string>();
    const list: Array<{
      questId: string;
      number: number;
      title: string;
      category: CrystalCategory | 'final';
      fact: string;
      trustedAdultNote?: string;
      goal?: string;
      zoneName?: string;
      collected: boolean;
    }> = [];

    for (const q of quests) {
      questIdsSeen.add(q.id);
      const learned = learnedMap.get(q.id);
      const collected = Boolean(learned) || completedSet.has(q.id);
      const fact =
        state.appearance.ageBracket === '11-14'
          ? q.didYouKnowOlder || learned?.fact || q.didYouKnow
          : q.didYouKnow || learned?.fact || q.didYouKnowOlder;

      list.push({
        questId: q.id,
        number: q.number,
        title: q.title,
        category: q.category,
        fact,
        trustedAdultNote: q.trustedAdultNote,
        goal: q.goal,
        zoneName: ZONE_MAP[q.zoneId]?.name ?? q.zoneId.replace('_', ' '),
        collected,
      });
    }

    for (const f of state.learnedFacts) {
      if (questIdsSeen.has(f.questId)) continue;
      list.push({
        questId: f.questId,
        number: list.length + 1,
        title: f.title,
        category: (f.category as CrystalCategory | 'final') || 'hygiene',
        fact: f.fact,
        collected: true,
      });
    }

    return list;
  }, [quests, learnedMap, completedSet, state.appearance.ageBracket, state.learnedFacts]);

  const collectedCount = useMemo(
    () => entries.filter((e) => e.collected).length,
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!entry.collected && !showUndiscovered) return false;
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'prevention') {
          if (entry.category !== 'prevention' && entry.category !== 'final') return false;
        } else if (entry.category !== selectedCategory) {
          return false;
        }
      }
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.collected && entry.fact.toLowerCase().includes(q)) ||
        (entry.zoneName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, selectedCategory, searchQuery, showUndiscovered]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const cb = state.settings.colorblindPalette;
  const progressPct = entries.length > 0 ? Math.round((collectedCount / entries.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Unboxed Header & Slim Progress */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Evidence Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {collectedCount} of {entries.length} health facts collected
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUndiscovered((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              showUndiscovered
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showUndiscovered ? 'Hide Locked' : 'Show Locked'}
          </button>
        </div>

        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${cb ? 'bg-[#009E73]' : 'bg-emerald-700'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-1 bg-slate-100 p-0.5 rounded-lg">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facts..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* Evidence List */}
      {filteredEntries.length === 0 ? (
        <div className="py-6 text-center space-y-1">
          <p className="text-xs font-medium text-slate-700">
            {collectedCount === 0
              ? 'No health facts recorded yet.'
              : 'No collected facts match your filter.'}
          </p>
          <p className="text-xs text-slate-400">
            {collectedCount === 0
              ? 'Complete a quest with any villager to add your first entry.'
              : 'Try selecting All or clearing your search.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {filteredEntries.map((entry) => {
            if (!entry.collected) {
              return (
                <div
                  key={entry.questId}
                  className="p-3.5 bg-slate-50/40 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-slate-400 capitalize">
                      Quest {entry.number} · {entry.category} · {entry.zoneName}
                    </div>
                    <div className="text-xs font-medium text-slate-600">{entry.title}</div>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>
              );
            }

            const isExpanded = Boolean(expandedIds[entry.questId]);

            return (
              <div key={entry.questId} className="p-4 bg-white space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-slate-500 capitalize">
                      {entry.category === 'final' ? 'Finale' : entry.category}
                      {entry.number > 0 && ` · Quest ${entry.number}`}
                      {entry.zoneName && ` · ${entry.zoneName}`}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{entry.title}</h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => audioEngine.speak(`${entry.title}. ${entry.fact}`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Read fact aloud"
                      aria-label={`Read ${entry.title} fact aloud`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    {(entry.trustedAdultNote || entry.goal) && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.questId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Hide notes' : 'Show notes'}
                        aria-label={isExpanded ? 'Collapse notes' : 'Expand notes'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{entry.fact}</p>

                {isExpanded && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    {entry.goal && (
                      <p>
                        <span className="font-medium text-slate-800">Recap: </span>
                        {entry.goal}
                      </p>
                    )}
                    {entry.trustedAdultNote && (
                      <p className="text-slate-500">
                        <span className="font-medium text-slate-700">Note: </span>
                        {entry.trustedAdultNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
