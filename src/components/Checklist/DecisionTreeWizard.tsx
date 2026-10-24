import React from 'react';
import {
  VarCategory,
  RecommendedAction,
  DisciplinaryCard,
  MatchRestart,
  DogsoState,
  SfpState,
  HandballState,
} from '../../types/var';
import { DogsoCalculator } from './DogsoCalculator';
import { SeriousFoulMatrix } from './SeriousFoulMatrix';
import { HandballEvaluator } from './HandballEvaluator';
import {
  ClipboardCheck,
  Goal,
  AlertCircle,
  ShieldX,
  Users,
  CheckCircle2,
  Tv,
  ArrowRight,
} from 'lucide-react';

interface DecisionTreeWizardProps {
  category: VarCategory;
  onSelectCategory: (cat: VarCategory) => void;
  recommendedAction: RecommendedAction;
  onSelectAction: (act: RecommendedAction) => void;
  restart: MatchRestart;
  onSelectRestart: (res: MatchRestart) => void;
  sanction: DisciplinaryCard;
  onSelectSanction: (card: DisciplinaryCard) => void;
  dogsoState: DogsoState;
  onChangeDogso: (updates: Partial<DogsoState>) => void;
  sfpState: SfpState;
  onChangeSfp: (updates: Partial<SfpState>) => void;
  handballState: HandballState;
  onChangeHandball: (updates: Partial<HandballState>) => void;
  isClearAndObvious: boolean;
  onToggleClearAndObvious: () => void;
}

export const DecisionTreeWizard: React.FC<DecisionTreeWizardProps> = ({
  category,
  onSelectCategory,
  recommendedAction,
  onSelectAction,
  restart,
  onSelectRestart,
  sanction,
  onSelectSanction,
  dogsoState,
  onChangeDogso,
  sfpState,
  onChangeSfp,
  handballState,
  onChangeHandball,
  isClearAndObvious,
  onToggleClearAndObvious,
}) => {
  const categories: { id: VarCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'GOAL_NO_GOAL', label: '1. Goal / No Goal', icon: <Goal className="w-4 h-4" /> },
    { id: 'PENALTY_NO_PENALTY', label: '2. Penalty / No Pen', icon: <AlertCircle className="w-4 h-4" /> },
    { id: 'DIRECT_RED_CARD', label: '3. Direct Red Card', icon: <ShieldX className="w-4 h-4" /> },
    { id: 'MISTAKEN_IDENTITY', label: '4. Mistaken Identity', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-2">
        <div className="flex items-center space-x-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">
            IFAB Decision Tree &amp; Guided Review Wizard
          </h3>
        </div>
        <span className="text-[10px] text-gray-400 font-mono-telemetry">IFAB Protocol v2024/25</span>
      </div>

      {/* 1. Category Switcher */}
      <div className="grid grid-cols-2 gap-1.5">
        {categories.map((c) => {
          const isSelected = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCategory(c.id)}
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-semibold transition border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                  : 'bg-[#0B0F19] text-gray-300 border-[#1F2937] hover:border-gray-600'
              }`}
            >
              <span className={isSelected ? 'text-white' : 'text-blue-400'}>{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Clear and Obvious Error Threshold Check */}
      <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#1F2937] flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Threshold: "Clear &amp; Obvious Error"?</span>
            <span
              className={`text-[10px] font-mono-telemetry font-bold px-1.5 py-0.2 rounded ${
                isClearAndObvious
                  ? 'bg-red-950 text-red-300 border border-red-700'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {isClearAndObvious ? 'THRESHOLD MET' : 'MARGINAL / 50-50'}
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            Do NOT intervene for marginal subjective calls. Only act on high-certainty evidence.
          </p>
        </div>

        <button
          onClick={onToggleClearAndObvious}
          className={`px-3 py-1 rounded text-xs font-bold transition shadow ${
            isClearAndObvious
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-[#1F2937] hover:bg-gray-700 text-gray-300'
          }`}
        >
          {isClearAndObvious ? 'ERROR CONFIRMED' : 'CHECK COMPLETE'}
        </button>
      </div>

      {/* 3. Dynamic Specialized Tooling Matrix based on Category */}
      {category === 'GOAL_NO_GOAL' && (
        <div className="space-y-2">
          <HandballEvaluator state={handballState} onChange={onChangeHandball} />
        </div>
      )}

      {category === 'PENALTY_NO_PENALTY' && (
        <div className="space-y-2">
          <SeriousFoulMatrix state={sfpState} onChange={onChangeSfp} />
          <DogsoCalculator state={dogsoState} onChange={onChangeDogso} />
        </div>
      )}

      {category === 'DIRECT_RED_CARD' && (
        <div className="space-y-2">
          <SeriousFoulMatrix state={sfpState} onChange={onChangeSfp} />
          <DogsoCalculator state={dogsoState} onChange={onChangeDogso} />
        </div>
      )}

      {category === 'MISTAKEN_IDENTITY' && (
        <div className="bg-[#0B0F19] p-3 rounded-lg border border-[#1F2937] space-y-2 text-xs">
          <div className="text-xs font-bold text-amber-400">Law 12: Mistaken Identity Rectification</div>
          <p className="text-gray-300 text-[11px]">
            Center referee sanctioned player #4 instead of player #6 who actually committed the contact offense.
          </p>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-red-400 font-semibold">Rescind Card: Player #4</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-emerald-400 font-semibold">Issue Card: Player #6</span>
          </div>
        </div>
      )}

      {/* 4. Action Recommendation (No Intervention / Factual Overturn / OFR) */}
      <div className="space-y-1.5 pt-1">
        <label className="text-[10px] text-gray-400 uppercase font-bold block">
          Recommended VAR Intervention Protocol:
        </label>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <button
            onClick={() => onSelectAction('NO_INTERVENTION')}
            className={`py-2 px-1.5 rounded border text-center font-bold transition flex flex-col items-center justify-center gap-1 ${
              recommendedAction === 'NO_INTERVENTION'
                ? 'bg-emerald-700 text-white border-emerald-500 shadow-md'
                : 'bg-[#0B0F19] text-gray-300 border-[#1F2937] hover:border-gray-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">Check Complete (Call Stands)</span>
          </button>

          <button
            onClick={() => onSelectAction('FACTUAL_OVERTURN')}
            className={`py-2 px-1.5 rounded border text-center font-bold transition flex flex-col items-center justify-center gap-1 ${
              recommendedAction === 'FACTUAL_OVERTURN'
                ? 'bg-blue-700 text-white border-blue-500 shadow-md'
                : 'bg-[#0B0F19] text-gray-300 border-[#1F2937] hover:border-gray-500'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="text-[11px]">Factual Overturn (VAR Only)</span>
          </button>

          <button
            onClick={() => onSelectAction('ON_FIELD_REVIEW')}
            className={`py-2 px-1.5 rounded border text-center font-bold transition flex flex-col items-center justify-center gap-1 ${
              recommendedAction === 'ON_FIELD_REVIEW'
                ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                : 'bg-[#0B0F19] text-gray-300 border-[#1F2937] hover:border-gray-500'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="text-[11px]">On-Field Review (OFR)</span>
          </button>
        </div>
      </div>

      {/* 5. Restart & Sanction Selectors */}
      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Match Restart:</label>
          <select
            value={restart}
            onChange={(e) => onSelectRestart(e.target.value as MatchRestart)}
            className="w-full bg-[#0B0F19] border border-[#1F2937] rounded px-2 py-1.5 text-white text-xs font-semibold"
          >
            <option value="PENALTY_KICK">Penalty Kick</option>
            <option value="DIRECT_FREE_KICK">Direct Free Kick</option>
            <option value="INDIRECT_FREE_KICK">Indirect Free Kick (Offside)</option>
            <option value="DROP_BALL">Drop Ball</option>
            <option value="KICK_OFF">Kick-Off (Goal Confirmed)</option>
            <option value="CORNER_KICK">Corner Kick</option>
            <option value="GOAL_KICK">Goal Kick</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Disciplinary Sanction:</label>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onSelectSanction('NONE')}
              className={`flex-1 py-1.5 rounded border text-xs font-bold transition ${
                sanction === 'NONE'
                  ? 'bg-gray-700 text-white border-gray-500'
                  : 'bg-[#0B0F19] text-gray-400 border-[#1F2937]'
              }`}
            >
              None
            </button>
            <button
              onClick={() => onSelectSanction('YELLOW')}
              className={`flex-1 py-1.5 rounded border text-xs font-bold transition flex items-center justify-center gap-1 ${
                sanction === 'YELLOW'
                  ? 'bg-amber-500 text-black border-amber-300'
                  : 'bg-[#0B0F19] text-amber-400 border-[#1F2937]'
              }`}
            >
              <span className="w-2.5 h-3.5 bg-amber-400 inline-block rounded-xs shadow" /> Yellow
            </button>
            <button
              onClick={() => onSelectSanction('RED')}
              className={`flex-1 py-1.5 rounded border text-xs font-bold transition flex items-center justify-center gap-1 ${
                sanction === 'RED'
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-[#0B0F19] text-red-400 border-[#1F2937]'
              }`}
            >
              <span className="w-2.5 h-3.5 bg-red-600 inline-block rounded-xs shadow" /> Red
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
