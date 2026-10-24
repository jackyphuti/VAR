import React from 'react';
import { SfpState } from '../../types/var';
import { Flame, AlertOctagon } from 'lucide-react';

interface SeriousFoulMatrixProps {
  state: SfpState;
  onChange: (updated: Partial<SfpState>) => void;
}

export const SeriousFoulMatrix: React.FC<SeriousFoulMatrixProps> = ({ state, onChange }) => {
  // IFAB Law 12 Serious Foul Play test:
  // - High point of contact (above ankle/shin or knee)
  // - Studs exposed
  // - Excessive force OR endangering safety
  const isSFP =
    state.endangeringSafety ||
    (state.excessiveForce && (state.pointOfContact === 'ABOVE_ANKLE_SHIN' || state.pointOfContact === 'KNEE')) ||
    (state.studsExposed && state.speedIntensity === 'HIGH_LUNGE');

  const isReckless =
    !isSFP &&
    (state.studsExposed || state.speedIntensity === 'MODERATE' || state.pointOfContact === 'FOOT_ON_GRASS');

  let cardOutcome = 'CARELESS CHALLENGE (NO CARD)';
  let outcomeStyle = 'bg-gray-900 border-gray-700 text-gray-300';

  if (isSFP) {
    cardOutcome = 'SERIOUS FOUL PLAY (DIRECT RED CARD - SFP)';
    outcomeStyle = 'bg-red-950/80 border-red-600 text-red-300';
  } else if (isReckless) {
    cardOutcome = 'RECKLESS CHALLENGE (CAUTION - YELLOW CARD)';
    outcomeStyle = 'bg-amber-950/80 border-amber-600 text-amber-300';
  }

  return (
    <div className="space-y-3 bg-[#0B0F19] p-3 rounded-lg border border-[#1F2937]">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-1.5">
        <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
          <Flame className="w-4 h-4" /> IFAB Law 12: Serious Foul Play (SFP) Matrix
        </span>
        <span className="text-[10px] text-gray-400">Tackle Intensity &amp; Safety Endangerment</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Point of Contact */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Point of Contact:</label>
          <select
            value={state.pointOfContact}
            onChange={(e) => onChange({ pointOfContact: e.target.value as any })}
            className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white text-xs"
          >
            <option value="ABOVE_ANKLE_SHIN">Above Ankle / Shin (High Risk)</option>
            <option value="KNEE">Directly on Knee (Excessive)</option>
            <option value="FOOT_ON_GRASS">Foot on Turf / Instep (Low)</option>
          </select>
        </div>

        {/* Speed / Intensity */}
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Speed &amp; Intensity:</label>
          <select
            value={state.speedIntensity}
            onChange={(e) => onChange({ speedIntensity: e.target.value as any })}
            className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-white text-xs"
          >
            <option value="HIGH_LUNGE">Airborne / High-Speed Lunge</option>
            <option value="MODERATE">Moderate Speed Slide</option>
            <option value="LOW">Low Velocity Standing Tackle</option>
          </select>
        </div>
      </div>

      {/* Boolean Toggles */}
      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
        <label className="flex items-center space-x-1.5 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.studsExposed}
            onChange={(e) => onChange({ studsExposed: e.target.checked })}
            className="rounded text-red-600 focus:ring-0"
          />
          <span className="text-gray-200">Studs Exposed</span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.excessiveForce}
            onChange={(e) => onChange({ excessiveForce: e.target.checked })}
            className="rounded text-red-600 focus:ring-0"
          />
          <span className="text-gray-200">Excessive Force</span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer bg-[#111827] p-2 rounded border border-[#1F2937]">
          <input
            type="checkbox"
            checked={state.endangeringSafety}
            onChange={(e) => onChange({ endangeringSafety: e.target.checked })}
            className="rounded text-red-600 focus:ring-0"
          />
          <span className="text-gray-200">Endangers Safety</span>
        </label>
      </div>

      {/* Output Sanction */}
      <div className={`p-2.5 rounded-lg border font-mono-telemetry font-bold text-xs ${outcomeStyle}`}>
        <div className="text-[10px] uppercase tracking-wider opacity-80 mb-0.5">SFP Decision Outcome</div>
        <div>{cardOutcome}</div>
      </div>
    </div>
  );
};
