import React from 'react';
import { DogsoState } from '../../types/var';
import { ShieldAlert, Info } from 'lucide-react';

interface DogsoCalculatorProps {
  state: DogsoState;
  onChange: (updated: Partial<DogsoState>) => void;
}

export const DogsoCalculator: React.FC<DogsoCalculatorProps> = ({ state, onChange }) => {
  // IFAB Law 12 DOGSO 4 criteria check:
  // 1. Distance between offense and goal
  // 2. General direction of play
  // 3. Likelihood of keeping or gaining control of ball
  // 4. Location and number of defenders
  const isDogso =
    (state.distanceToGoal === 'CLOSE' || state.distanceToGoal === 'MEDIUM') &&
    state.directionOfPlay === 'TOWARDS_GOAL' &&
    state.likelihoodOfControl &&
    (state.defendersCount === 'NONE_EXCEPT_GK' || state.defendersCount === 'ONE_RECOVERING');

  // IFAB Double Jeopardy: If DOGSO foul committed INSIDE penalty area and defender made genuine attempt to play ball -> DOWNGRADE TO YELLOW CARD
  let sanction = 'NO DOGSO (YELLOW / FOUL)';
  let sanctionColor = 'text-gray-400 bg-gray-900 border-gray-700';

  if (isDogso) {
    if (state.insidePenaltyArea && state.genuineAttemptToPlayBall) {
      sanction = 'PENALTY KICK + CAUTION (YELLOW CARD) [DOWNGRADED: GENUINE ATTEMPT]';
      sanctionColor = 'text-amber-400 bg-amber-950/80 border-amber-600';
    } else {
      sanction = state.insidePenaltyArea
        ? 'PENALTY KICK + SENDING OFF (RED CARD) [DOGSO - NO PLAY ON BALL]'
        : 'DIRECT FREE KICK + SENDING OFF (RED CARD) [DOGSO OUTSIDE AREA]';
      sanctionColor = 'text-red-400 bg-red-950/80 border-red-600';
    }
  }

  return (
    <div className="space-y-3 bg-[#0B0F19] p-3 rounded-lg border border-[#1F2937]">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-1.5">
        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4" /> IFAB Law 12: DOGSO 4-Criteria Calculator
        </span>
        <span className="text-[10px] text-gray-400">Denial of Obvious Goal-Scoring Opportunity</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* 1. Distance to Goal */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">1. Distance to Goal:</label>
          <select
            value={state.distanceToGoal}
            onChange={(e) => onChange({ distanceToGoal: e.target.value as any })}
            className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white text-xs"
          >
            <option value="CLOSE">Close (&lt; 20m)</option>
            <option value="MEDIUM">Medium (20m - 35m)</option>
            <option value="FAR">Far (&gt; 35m / Own Half)</option>
          </select>
        </div>

        {/* 2. Direction of Play */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">2. Direction of Play:</label>
          <select
            value={state.directionOfPlay}
            onChange={(e) => onChange({ directionOfPlay: e.target.value as any })}
            className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white text-xs"
          >
            <option value="TOWARDS_GOAL">Directly Towards Goal</option>
            <option value="ANGLED">Angled Towards Flank</option>
            <option value="AWAY">Moving Away from Goal</option>
          </select>
        </div>

        {/* 3. Likelihood of Control */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">3. Likelihood of Ball Control:</label>
          <button
            onClick={() => onChange({ likelihoodOfControl: !state.likelihoodOfControl })}
            className={`w-full py-1 px-2 rounded border text-xs font-semibold transition ${
              state.likelihoodOfControl
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1F2937] text-gray-400 border-[#374151]'
            }`}
          >
            {state.likelihoodOfControl ? 'High (Clear Control)' : 'Low (Ball Unreachable)'}
          </button>
        </div>

        {/* 4. Location and Number of Defenders */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">4. Number of Covering Defenders:</label>
          <select
            value={state.defendersCount}
            onChange={(e) => onChange({ defendersCount: e.target.value as any })}
            className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white text-xs"
          >
            <option value="NONE_EXCEPT_GK">None Except Goalkeeper</option>
            <option value="ONE_RECOVERING">One Recovering Defender</option>
            <option value="MULTIPLE">Multiple Defenders Behind Ball</option>
          </select>
        </div>
      </div>

      {/* Double Jeopardy: Inside Box & Genuine Attempt */}
      <div className="pt-2 border-t border-[#1F2937] grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.insidePenaltyArea}
            onChange={(e) => onChange({ insidePenaltyArea: e.target.checked })}
            className="rounded text-blue-600 focus:ring-0"
          />
          <span className="text-gray-200">Inside Penalty Area</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.genuineAttemptToPlayBall}
            onChange={(e) => onChange({ genuineAttemptToPlayBall: e.target.checked })}
            className="rounded text-blue-600 focus:ring-0"
          />
          <span className="text-gray-200">Genuine Attempt on Ball</span>
        </label>
      </div>

      {/* Computed Sanction Display */}
      <div className={`p-2.5 rounded-lg border font-mono-telemetry font-bold text-xs ${sanctionColor}`}>
        <div className="text-[10px] uppercase tracking-wider opacity-80 mb-0.5">Automated Sanction Calculation</div>
        <div>{sanction}</div>
      </div>
    </div>
  );
};
