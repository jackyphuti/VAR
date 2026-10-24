import React from 'react';
import { HandballState } from '../../types/var';
import { Hand, CheckCircle, XCircle } from 'lucide-react';

interface HandballEvaluatorProps {
  state: HandballState;
  onChange: (updated: Partial<HandballState>) => void;
}

export const HandballEvaluator: React.FC<HandballEvaluatorProps> = ({ state, onChange }) => {
  // IFAB Law 12 Handball:
  // Offense if:
  // 1. Deliberately touches ball with hand/arm
  // 2. Touches ball when hand/arm has made their body unnaturally bigger (not justified by movement)
  // 3. Scores in opponent's goal directly from their hand/arm or immediately after it touched their hand/arm
  // Exception: ball played directly from player's own head/body from close proximity with natural arm position

  let isOffense = false;
  let reason = 'NO HANDBALL (LEGAL MOVEMENT / CLOSE PROXIMITY)';
  let outcomeStyle = 'bg-emerald-950/70 border-emerald-600 text-emerald-300';

  if (state.immediateGoalByScorer) {
    isOffense = true;
    reason = 'HANDBALL OFFENSE: ATTACKER SCORED DIRECTLY/IMMEDIATELY AFTER HAND TOUCH';
    outcomeStyle = 'bg-red-950/80 border-red-600 text-red-300';
  } else if (state.deliberateMovement) {
    isOffense = true;
    reason = 'HANDBALL OFFENSE: DELIBERATE ARM MOVEMENT TOWARDS BALL';
    outcomeStyle = 'bg-red-950/80 border-red-600 text-red-300';
  } else if (state.unnaturalSilhouette && !state.closeProximityDeflection) {
    isOffense = true;
    reason = 'HANDBALL OFFENSE: UNNATURALLY BIGGER SILHOUETTE (EXTENDED ARM)';
    outcomeStyle = 'bg-red-950/80 border-red-600 text-red-300';
  } else if (state.closeProximityDeflection && !state.deliberateMovement) {
    isOffense = false;
    reason = 'NO OFFENSE: DEFLECTION FROM CLOSE PROXIMITY (NO TIME TO REACT)';
    outcomeStyle = 'bg-emerald-950/70 border-emerald-600 text-emerald-300';
  }

  return (
    <div className="space-y-3 bg-[#0B0F19] p-3 rounded-lg border border-[#1F2937]">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-1.5">
        <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
          <Hand className="w-4 h-4" /> IFAB Law 12: Handball Offense Evaluator
        </span>
        <span className="text-[10px] text-gray-400">Silhouette &amp; Intent Assessment</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.unnaturalSilhouette}
            onChange={(e) => onChange({ unnaturalSilhouette: e.target.checked })}
            className="rounded text-sky-600 focus:ring-0"
          />
          <div>
            <span className="text-gray-200 font-semibold block">Unnatural Silhouette</span>
            <span className="text-[10px] text-gray-400 block">Arm away from body boundary</span>
          </div>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.deliberateMovement}
            onChange={(e) => onChange({ deliberateMovement: e.target.checked })}
            className="rounded text-sky-600 focus:ring-0"
          />
          <div>
            <span className="text-gray-200 font-semibold block">Deliberate Movement</span>
            <span className="text-[10px] text-gray-400 block">Hand moved toward ball</span>
          </div>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.immediateGoalByScorer}
            onChange={(e) => onChange({ immediateGoalByScorer: e.target.checked })}
            className="rounded text-sky-600 focus:ring-0"
          />
          <div>
            <span className="text-gray-200 font-semibold block">Immediate Goal Scorer</span>
            <span className="text-[10px] text-gray-400 block">Accidental touch by scorer</span>
          </div>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.closeProximityDeflection}
            onChange={(e) => onChange({ closeProximityDeflection: e.target.checked })}
            className="rounded text-sky-600 focus:ring-0"
          />
          <div>
            <span className="text-gray-200 font-semibold block">Close Deflection</span>
            <span className="text-[10px] text-gray-400 block">Rebound off own body/head</span>
          </div>
        </label>
      </div>

      {/* Evaluated Outcome */}
      <div className={`p-2.5 rounded-lg border font-mono-telemetry font-bold text-xs ${outcomeStyle}`}>
        <div className="text-[10px] uppercase tracking-wider opacity-80 mb-0.5">Handball Ruling</div>
        <div>{reason}</div>
      </div>
    </div>
  );
};
