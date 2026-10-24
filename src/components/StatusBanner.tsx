import React from 'react';
import { VarStatus } from '../types/var';
import { playAlertTone } from '../utils/audio';
import { ShieldCheck, Clock, CheckCircle, RefreshCcw, Eye, Tv, Pause, RotateCcw } from 'lucide-react';

interface StatusBannerProps {
  status: VarStatus;
  onChangeStatus: (newStatus: VarStatus) => void;
  reviewDurationSecs: number;
  isStopwatchRunning: boolean;
  onToggleStopwatch: () => void;
  onResetStopwatch: () => void;
  isRraModeActive: boolean;
  onToggleRraMode: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  status,
  onChangeStatus,
  reviewDurationSecs,
  isStopwatchRunning,
  onToggleStopwatch,
  onResetStopwatch,
  isRraModeActive,
  onToggleRraMode,
}) => {
  const transitions: { id: VarStatus; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'MONITORING',
      label: 'MONITORING',
      icon: <Eye className="w-3.5 h-3.5" />,
      color: 'bg-emerald-950/70 border-emerald-600 text-emerald-300',
    },
    {
      id: 'VAR_CHECK_IN_PROGRESS',
      label: 'CHECK IN PROGRESS (DELAY)',
      icon: <RefreshCcw className="w-3.5 h-3.5 animate-spin" />,
      color: 'bg-amber-950/80 border-amber-500 text-amber-200',
    },
    {
      id: 'ON_FIELD_REVIEW',
      label: 'ON-FIELD REVIEW (OFR)',
      icon: <Tv className="w-3.5 h-3.5" />,
      color: 'bg-purple-950/80 border-purple-500 text-purple-200',
    },
    {
      id: 'CHECK_COMPLETE_CONFIRMED',
      label: 'CALL CONFIRMED',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      color: 'bg-emerald-900 border-emerald-500 text-emerald-100',
    },
    {
      id: 'CHECK_COMPLETE_OVERTURNED',
      label: 'DECISION OVERTURNED',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      color: 'bg-red-950/90 border-red-500 text-red-200',
    },
  ];

  const handleSelectStatus = (newStatus: VarStatus) => {
    onChangeStatus(newStatus);
    if (newStatus === 'ON_FIELD_REVIEW') {
      playAlertTone('OFR');
    } else if (newStatus.startsWith('CHECK_COMPLETE')) {
      playAlertTone('DECISION');
    }
  };

  const formatStopwatch = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}s`;
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
      {/* Current Operational State Badge & Live Stopwatch */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1F2937]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono-telemetry text-xs font-bold uppercase tracking-wider text-white">
            OPERATIONAL PROTOCOL
          </span>
        </div>

        {/* Live Ticking Stopwatch (Part A.4) */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0B0F19] border border-amber-500/40 font-mono-telemetry text-xs text-amber-400">
          <Clock className={`w-3.5 h-3.5 ${isStopwatchRunning ? 'animate-spin' : ''}`} />
          <span className="font-bold">{formatStopwatch(reviewDurationSecs)}</span>

          <button
            onClick={onToggleStopwatch}
            title={isStopwatchRunning ? 'Pause Stopwatch' : 'Resume Stopwatch'}
            className="p-0.5 rounded text-gray-400 hover:text-white"
          >
            <Pause className="w-3 h-3" />
          </button>
          <button
            onClick={onResetStopwatch}
            title="Reset Stopwatch to 00:00"
            className="p-0.5 rounded text-gray-400 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Part B.5: Referee Review Area (RRA) Pitch-Side Monitor Toggle */}
        {status === 'ON_FIELD_REVIEW' && (
          <button
            onClick={onToggleRraMode}
            className={`px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1.5 border transition animate-pulse-subtle ${
              isRraModeActive
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                : 'bg-purple-950/70 text-purple-300 border-purple-600 hover:bg-purple-900'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{isRraModeActive ? 'EXIT RRA MONITOR' : 'LAUNCH RRA PITCH-SIDE'}</span>
          </button>
        )}
      </div>

      {/* One-Click State Transition Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {transitions.map((t) => {
          const isActive = status === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelectStatus(t.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-bold transition border ${
                isActive
                  ? `${t.color} shadow-lg ring-1 ring-white/20 scale-[1.02]`
                  : 'bg-[#0B0F19] text-gray-400 border-[#1F2937] hover:border-gray-500 hover:text-white'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
