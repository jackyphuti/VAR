import React, { useState } from 'react';
import { VarStatus, VarCategory, RecommendedAction, DisciplinaryCard, MatchRestart } from '../../types/var';
import { X, Tv, Monitor, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: VarStatus;
  category: VarCategory;
  action: RecommendedAction;
  sanction: DisciplinaryCard;
  restart: MatchRestart;
  saotDeltaCm?: number;
  matchClock: string;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  status,
  category,
  action,
  sanction,
  restart,
  saotDeltaCm = 0,
  matchClock,
}) => {
  const [viewType, setViewType] = useState<'stadium' | 'tv_lower_third'>('stadium');

  if (!isOpen) return null;

  // Determine headlines based on state
  let headerText = 'VAR CHECK IN PROGRESS';
  let subHeaderText = 'CHECKING POSSIBLE FOUL';
  let resultText = 'DECISION PENDING';
  let isOverturn = action === 'FACTUAL_OVERTURN' || (action === 'ON_FIELD_REVIEW' && status.includes('OVERTURNED'));

  if (category === 'GOAL_NO_GOAL') {
    subHeaderText = 'POSSIBLE OFFSIDE';
    if (status === 'CHECK_COMPLETE_OVERTURNED' || action === 'FACTUAL_OVERTURN') {
      headerText = 'VAR DECISION';
      resultText = `NO GOAL - OFFSIDE (+${Math.abs(saotDeltaCm).toFixed(1)} cm)`;
    } else if (status === 'CHECK_COMPLETE_CONFIRMED') {
      headerText = 'VAR DECISION';
      resultText = 'GOAL CONFIRMED';
    }
  } else if (category === 'PENALTY_NO_PENALTY') {
    subHeaderText = 'POSSIBLE PENALTY';
    if (action === 'ON_FIELD_REVIEW') {
      headerText = 'ON-FIELD REVIEW (OFR)';
      resultText = 'REFEREE REVIEWING POTENTIAL PENALTY';
    } else if (status === 'CHECK_COMPLETE_OVERTURNED') {
      headerText = 'VAR DECISION';
      resultText = 'PENALTY KICK AWARDED';
    }
  } else if (category === 'DIRECT_RED_CARD') {
    subHeaderText = 'POSSIBLE DIRECT RED CARD';
    if (action === 'ON_FIELD_REVIEW') {
      headerText = 'ON-FIELD REVIEW (OFR)';
      resultText = 'REFEREE REVIEWING SERIOUS FOUL PLAY';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0B0F19] border-2 border-[#1F2937] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#111827] border-b border-[#1F2937]">
          <div className="flex items-center space-x-2">
            <Tv className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm text-gray-200">
              Stadium Giant Screen &amp; TV Broadcast Graphic Preview
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-[#0B0F19] rounded p-0.5 border border-[#1F2937]">
              <button
                onClick={() => setViewType('stadium')}
                className={`px-2.5 py-1 rounded text-xs transition ${
                  viewType === 'stadium' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                Stadium Jumbotron
              </button>
              <button
                onClick={() => setViewType('tv_lower_third')}
                className={`px-2.5 py-1 rounded text-xs transition ${
                  viewType === 'tv_lower_third' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                TV Lower Third
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stadium Giant Screen Display */}
        {viewType === 'stadium' ? (
          <div className="p-8 flex flex-col items-center justify-center min-h-[380px] bg-gradient-to-b from-[#0A1128] via-[#050814] to-black relative">
            {/* Corner LED Matrix dots simulation */}
            <div className="absolute inset-0 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            {/* Stadium Match Clock & Match Header */}
            <div className="flex items-center space-x-4 mb-6 z-10">
              <div className="px-3 py-1 bg-black/60 rounded border border-blue-500/40 font-mono-telemetry text-amber-400 font-bold text-sm">
                ⏱ {matchClock}
              </div>
              <div className="flex items-center space-x-2 font-bold text-white tracking-widest text-sm">
                <span className="text-blue-400">ARS</span>
                <span>1 - 0</span>
                <span className="text-red-400">MCI</span>
              </div>
            </div>

            {/* Official IFAB VAR Badge */}
            <div className="flex items-center space-x-3 mb-4 z-10">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg border border-blue-400">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-2xl font-black tracking-widest text-white">VAR</div>
                <div className="text-[10px] tracking-widest uppercase text-blue-300 font-bold">
                  Video Assistant Referee
                </div>
              </div>
            </div>

            {/* Pulsing Status Bar */}
            <div className="w-full max-w-lg bg-[#001433] border-2 border-blue-500 py-2.5 px-6 rounded-lg text-center shadow-xl mb-4 z-10 animate-pulse-subtle">
              <div className="text-blue-300 font-bold tracking-widest text-xs uppercase mb-1">
                {headerText}
              </div>
              <div className="text-xl md:text-2xl font-black tracking-wider text-white">
                {subHeaderText}
              </div>
            </div>

            {/* Big Final Decision Plate */}
            <div
              className={`w-full max-w-lg py-4 px-6 rounded-xl border-2 text-center shadow-2xl z-10 font-mono-telemetry transition-all ${
                isOverturn
                  ? 'bg-red-950/90 border-red-500 text-red-200'
                  : 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              }`}
            >
              <div className="text-xs uppercase font-extrabold tracking-widest opacity-80 mb-1">
                Official Stadium Ruling
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">
                {resultText}
              </div>
              <div className="text-xs mt-2 text-gray-300 font-semibold">
                Restart: <strong className="text-white">{restart.replace(/_/g, ' ')}</strong> | Sanction:{' '}
                <strong className="text-white">{sanction}</strong>
              </div>
            </div>
          </div>
        ) : (
          /* TV Broadcast Lower Third Graphic */
          <div className="p-8 flex flex-col justify-end min-h-[380px] bg-gradient-to-t from-black via-[#0B0F19] to-slate-900 relative">
            <div className="text-center text-xs text-gray-500 mb-auto pt-4">
              [Live 1080p Broadcast Simulation Feed Preview]
            </div>

            <div className="bg-[#050D1A]/95 border-l-8 border-l-blue-500 border border-[#1F2937] p-4 rounded-r-lg shadow-2xl flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center font-black text-white text-base">
                  VAR
                </div>
                <div>
                  <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                    {headerText} • {subHeaderText}
                  </div>
                  <div className="text-lg font-black text-white">{resultText}</div>
                </div>
              </div>

              <div className="text-right font-mono-telemetry">
                <div className="text-xs text-amber-400 font-bold">{matchClock}</div>
                <div className="text-[10px] text-gray-400 uppercase">IFAB Protocol</div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-[#111827] border-t border-[#1F2937] flex items-center justify-between text-xs text-gray-400">
          <span>Official Graphics Feed: Active Stadium Output (Giant Screens + In-Bowl Monitors)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
          >
            Dismiss Graphic
          </button>
        </div>
      </div>
    </div>
  );
};
