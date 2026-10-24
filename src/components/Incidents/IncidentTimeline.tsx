import React from 'react';
import { MatchIncident } from '../../types/var';
import { History, Clock, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface IncidentTimelineProps {
  incidents: MatchIncident[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  onOpenReportModal: () => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onOpenReportModal,
}) => {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-1.5">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">
            Match VAR Incident Log &amp; Audit Trail
          </h3>
        </div>
        <span className="text-[10px] text-gray-400 font-mono-telemetry">
          {incidents.length} Incident(s) Logged
        </span>
      </div>

      {/* Incidents Horizontal / Vertical Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {incidents.map((inc) => {
          const isSelected = inc.id === selectedIncidentId;
          const isOverturn = inc.status.includes('OVERTURNED') || inc.originalCall !== inc.finalDecision;

          return (
            <div
              key={inc.id}
              onClick={() => onSelectIncident(inc.id)}
              className={`p-2.5 rounded-lg border cursor-pointer transition select-none flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                  : 'bg-[#0B0F19] border-[#1F2937] hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1 font-mono-telemetry">
                <span className="font-bold text-amber-400">⏱ {inc.matchClock}</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {inc.durationSeconds}s check
                </span>
              </div>

              <div className="text-xs font-bold text-white truncate mb-1">
                {inc.category.replace(/_/g, ' ')}
              </div>

              <div className="text-[11px] space-y-0.5">
                <div className="text-gray-400 truncate">
                  Call: <strong className="text-gray-300">{inc.originalCall}</strong>
                </div>
                <div
                  className={`font-semibold truncate ${
                    isOverturn ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  Final: {inc.finalDecision}
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-[#1F2937] flex items-center justify-between text-[10px] font-mono-telemetry text-gray-400">
                <span>Restart: {inc.restart}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    inc.sanction === 'RED'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : inc.sanction === 'YELLOW'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'text-gray-500'
                  }`}
                >
                  {inc.sanction !== 'NONE' ? `${inc.sanction} CARD` : 'NO CARD'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
