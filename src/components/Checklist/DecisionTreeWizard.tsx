import React, { useEffect } from 'react';
import {
  VarCategory,
  RecommendedAction,
  DisciplinaryCard,
  MatchRestart,
  DogsoState,
  SfpState,
  HandballState,
  MistakenIdentityState,
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
  Save,
  Check,
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
  mistakenIdentityState: MistakenIdentityState;
  onChangeMistakenIdentity: (updates: Partial<MistakenIdentityState>) => void;
  isClearAndObvious: boolean;
  onToggleClearAndObvious: () => void;
  onCommitDecision: () => void;
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
  mistakenIdentityState,
  onChangeMistakenIdentity,
  isClearAndObvious,
  onToggleClearAndObvious,
  onCommitDecision,
}) => {
  const categories: { id: VarCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'GOAL_NO_GOAL', label: '1. Goal / No Goal', icon: <Goal className="w-4 h-4" /> },
    { id: 'PENALTY_NO_PENALTY', label: '2. Penalty / No Pen', icon: <AlertCircle className="w-4 h-4" /> },
    { id: 'DIRECT_RED_CARD', label: '3. Direct Red Card', icon: <ShieldX className="w-4 h-4" /> },
    { id: 'MISTAKEN_IDENTITY', label: '4. Mistaken Identity', icon: <Users className="w-4 h-4" /> },
  ];

  // Auto-sync decision outcomes based on active category matrices (Part A.4)
  useEffect(() => {
    if (category === 'PENALTY_NO_PENALTY' || category === 'DIRECT_RED_CARD') {
      const isSFP =
        sfpState.endangeringSafety ||
        (sfpState.excessiveForce && (sfpState.pointOfContact === 'ABOVE_ANKLE_SHIN' || sfpState.pointOfContact === 'KNEE')) ||
        (sfpState.studsExposed && sfpState.speedIntensity === 'HIGH_LUNGE');

      const isDogso =
        (dogsoState.distanceToGoal === 'CLOSE' || dogsoState.distanceToGoal === 'MEDIUM') &&
        dogsoState.directionOfPlay === 'TOWARDS_GOAL' &&
        dogsoState.likelihoodOfControl &&
        (dogsoState.defendersCount === 'NONE_EXCEPT_GK' || dogsoState.defendersCount === 'ONE_RECOVERING');

      if (isSFP) {
        onSelectSanction('RED');
        onSelectAction('ON_FIELD_REVIEW');
        onSelectRestart(dogsoState.insidePenaltyArea ? 'PENALTY_KICK' : 'DIRECT_FREE_KICK');
      } else if (isDogso) {
        if (dogsoState.insidePenaltyArea && dogsoState.genuineAttemptToPlayBall) {
          onSelectSanction('YELLOW'); // Double Jeopardy downgrade
          onSelectRestart('PENALTY_KICK');
        } else {
          onSelectSanction('RED');
          onSelectRestart(dogsoState.insidePenaltyArea ? 'PENALTY_KICK' : 'DIRECT_FREE_KICK');
        }
        onSelectAction('ON_FIELD_REVIEW');
      }
    }
  }, [sfpState, dogsoState, category]);

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
        /* Part A.4: Editable Mistaken Identity Inputs */
        <div className="bg-[#0B0F19] p-3 rounded-lg border border-[#1F2937] space-y-2.5 text-xs">
          <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
            <span>Law 12: Mistaken Identity Rectification</span>
            <span className="text-[10px] text-gray-400">Interactive Inputs</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-red-400 block mb-0.5 font-semibold">
                Sanctioned Wrong Player #:
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={mistakenIdentityState.incorrectPlayerNumber}
                onChange={(e) =>
                  onChangeMistakenIdentity({ incorrectPlayerNumber: Number(e.target.value) })
                }
                className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white font-mono-telemetry font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-emerald-400 block mb-0.5 font-semibold">
                Actual Offending Player #:
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={mistakenIdentityState.correctPlayerNumber}
                onChange={(e) =>
                  onChangeMistakenIdentity({ correctPlayerNumber: Number(e.target.value) })
                }
                className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white font-mono-telemetry font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-gray-400">Card to Transfer:</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onChangeMistakenIdentity({ sanctionToTransfer: 'YELLOW' })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  mistakenIdentityState.sanctionToTransfer === 'YELLOW'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1F2937] text-gray-400'
                }`}
              >
                Yellow
              </button>
              <button
                onClick={() => onChangeMistakenIdentity({ sanctionToTransfer: 'RED' })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  mistakenIdentityState.sanctionToTransfer === 'RED'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#1F2937] text-gray-400'
                }`}
              >
                Red
              </button>
            </div>
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
            <span className="text-[11px]">Check Complete</span>
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
            <span className="text-[11px]">Factual Overturn</span>
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
            <span className="text-[11px]">On-Field Review</span>
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
            <option value="INDIRECT_FREE_KICK">Indirect Free Kick</option>
            <option value="DROP_BALL">Drop Ball</option>
            <option value="KICK_OFF">Kick-Off</option>
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

      {/* Part A.4: Commit & Log Official Decision Button */}
      <button
        onClick={onCommitDecision}
        className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
      >
        <Save className="w-4 h-4" />
        <span>Commit &amp; Log Official Decision to Match Audit Log</span>
      </button>
    </div>
  );
};
