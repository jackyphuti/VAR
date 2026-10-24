import React from 'react';
import { ScenarioId, MatchScenario } from '../types/var';
import { Shield, Tv, FileSpreadsheet, Keyboard, Bot } from 'lucide-react';

interface HeaderProps {
  scenarios: MatchScenario[];
  selectedScenarioId: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  matchClock: string;
  onOpenBroadcastModal: () => void;
  onOpenReportModal: () => void;
  onOpenShortcutsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  matchClock,
  onOpenBroadcastModal,
  onOpenReportModal,
  onOpenShortcutsModal,
}) => {
  return (
    <header className="bg-[#111827] border-b border-[#1F2937] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl">
      {/* Brand / Station Identifier */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded bg-blue-600 flex items-center justify-center shadow-lg border border-blue-400">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-black tracking-widest text-white uppercase">
              VAR CONTROL ROOM
            </h1>
            <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-700 text-[10px] font-mono-telemetry font-bold">
              WORKSTATION v3.0
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">
            IFAB Certified Video Assistant Referee Operating Suite &bull; Hawkeye &amp; SAOT
          </p>
        </div>
      </div>

      {/* Center: Scenario Switcher & Match Clock */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-[#1F2937]">
          <span className="text-xs text-gray-400 font-semibold">Incident Preset:</span>
          <select
            value={selectedScenarioId}
            onChange={(e) => onSelectScenario(e.target.value as ScenarioId)}
            className="bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-blue-500 max-w-[280px] truncate"
          >
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.title}
              </option>
            ))}
          </select>
        </div>

        {/* Live Match Clock */}
        <div className="bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-[#1F2937] flex items-center space-x-2 font-mono-telemetry">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-400">MATCH CLOCK:</span>
          <span className="text-sm font-bold text-amber-400">{matchClock}</span>
        </div>
      </div>

      {/* Right Actions: Shortcuts / Giant Screen Broadcast / Audit Report */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenShortcutsModal}
          title="Hardware EVS Controller & Keyboard Shortcuts"
          className="px-2.5 py-1.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-300 text-xs font-bold flex items-center gap-1.5 border border-[#374151] transition"
        >
          <Keyboard className="w-3.5 h-3.5 text-sky-400" />
          <span>Hotkeys</span>
        </button>

        <button
          onClick={onOpenBroadcastModal}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition"
        >
          <Tv className="w-3.5 h-3.5" />
          <span>Giant Screen Graphic</span>
        </button>

        <button
          onClick={onOpenReportModal}
          className="px-3 py-1.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-200 text-xs font-bold flex items-center gap-1.5 border border-gray-600 transition"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>VAR Official Report</span>
        </button>
      </div>
    </header>
  );
};
