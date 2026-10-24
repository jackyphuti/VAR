import React, { useState } from 'react';
import { SaotState } from '../../types/var';
import { Target, Lock, Unlock, Eye, Compass, RotateCcw, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';

interface SaotCalibrationPanelProps {
  saotState: SaotState;
  currentFrame: number;
  onTogglePassFrameLock: () => void;
  onUpdateDefenderPoint: (updates: Partial<SaotState['defender']>) => void;
  onUpdateAttackerPoint: (updates: Partial<SaotState['attacker']>) => void;
  onToggle3DLines: () => void;
  onToggleRadar: () => void;
  onResetCalibration: () => void;
}

const BODY_PARTS_DEFENDER = [
  'Boot / Heel',
  'Knee',
  'Upper Torso',
  'Shoulder',
  'Hip / Pelvis',
];

const BODY_PARTS_ATTACKER = [
  'Head / Forehead',
  'Shoulder',
  'Knee / Thigh',
  'Boot / Toe',
  'Torso',
];

export const SaotCalibrationPanel: React.FC<SaotCalibrationPanelProps> = ({
  saotState,
  currentFrame,
  onTogglePassFrameLock,
  onUpdateDefenderPoint,
  onUpdateAttackerPoint,
  onToggle3DLines,
  onToggleRadar,
  onResetCalibration,
}) => {
  const [axisMode, setAxisMode] = useState<'X' | 'Y' | 'Z'>('X');
  const isOffside = saotState.deltaCm > 0;

  const nudgeDefender = (deltaM: number) => {
    if (axisMode === 'X') {
      onUpdateDefenderPoint({ pitchX: Math.max(52.5, Math.min(105.0, saotState.defender.pitchX + deltaM)) });
    } else if (axisMode === 'Y') {
      onUpdateDefenderPoint({ pitchY: Math.max(0.0, Math.min(68.0, saotState.defender.pitchY + deltaM)) });
    } else {
      onUpdateDefenderPoint({
        heightAboveGrassM: Math.max(0.1, Math.min(2.2, (saotState.defender.heightAboveGrassM || 1.35) + deltaM)),
      });
    }
  };

  const nudgeAttacker = (deltaM: number) => {
    if (axisMode === 'X') {
      onUpdateAttackerPoint({ pitchX: Math.max(52.5, Math.min(105.0, saotState.attacker.pitchX + deltaM)) });
    } else if (axisMode === 'Y') {
      onUpdateAttackerPoint({ pitchY: Math.max(0.0, Math.min(68.0, saotState.attacker.pitchY + deltaM)) });
    } else {
      onUpdateAttackerPoint({
        heightAboveGrassM: Math.max(0.1, Math.min(2.2, (saotState.attacker.heightAboveGrassM || 1.45) + deltaM)),
      });
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-3 shadow-xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-2">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-sky-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">
            SAOT 3D Offside Calibration Engine
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onToggle3DLines}
            title="Toggle 3D grass projection lines"
            className={`p-1 rounded text-xs flex items-center gap-1 transition ${
              saotState.show3DLines ? 'bg-sky-600 text-white' : 'bg-[#1F2937] text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> 3D Lines
          </button>
          <button
            onClick={onToggleRadar}
            title="Toggle 2D pitch radar minimap"
            className={`p-1 rounded text-xs flex items-center gap-1 transition ${
              saotState.showRadarMinimap ? 'bg-sky-600 text-white' : 'bg-[#1F2937] text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Radar
          </button>
          <button
            onClick={onResetCalibration}
            title="Reset to default AI calibration"
            className="p-1 rounded bg-[#1F2937] text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. Pass Frame Lock Button (Kick Point IFAB Law 11) */}
      <div className="flex items-center justify-between bg-[#0B0F19] p-2.5 rounded-lg border border-[#1F2937]">
        <div>
          <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
            <span>Pass Release Frame (IFAB Law 11):</span>
            <span className="font-mono-telemetry font-bold text-amber-400">
              {saotState.passFrameLocked ? `LOCKED (Frame ${saotState.lockedKickFrame})` : `UNLOCKED (F: ${currentFrame})`}
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            Offside must be judged at the first point of contact of the pass. Drag crosshairs directly on pitch canvas.
          </p>
        </div>

        <button
          onClick={onTogglePassFrameLock}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow ${
            saotState.passFrameLocked
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {saotState.passFrameLocked ? (
            <>
              <Lock className="w-3.5 h-3.5" /> KICK POINT LOCKED
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5" /> LOCK CURRENT FRAME
            </>
          )}
        </button>
      </div>

      {/* 2. Real-Time Offside Delta Result HUD Badge */}
      <div
        className={`p-3 rounded-lg border flex items-center justify-between shadow-inner ${
          isOffside
            ? 'bg-red-950/60 border-red-600/60 text-red-100'
            : 'bg-emerald-950/60 border-emerald-600/60 text-emerald-100'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          {isOffside ? (
            <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-300">
              Semi-Automated Line Verdict
            </div>
            <div className="text-lg font-mono-telemetry font-black tracking-tight">
              {isOffside ? 'OFFSIDE OFFENSE' : 'ONSIDE (LEGAL POSITION)'}
            </div>
          </div>
        </div>

        <div className="text-right font-mono-telemetry">
          <div className="text-[10px] text-gray-400 uppercase">Margin of Separation</div>
          <div
            className={`text-2xl font-black ${
              isOffside ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isOffside ? `+${saotState.deltaCm.toFixed(1)} cm` : `${saotState.deltaCm.toFixed(1)} cm`}
          </div>
          <div className="text-[10px] text-gray-500">
            {Math.abs(saotState.deltaCm * 10).toFixed(0)} mm difference
          </div>
        </div>
      </div>

      {/* Axis Nudge Selector (X, Y, Z) */}
      <div className="flex items-center justify-between bg-[#0B0F19] px-2.5 py-1.5 rounded border border-[#1F2937] text-xs">
        <span className="text-[10px] text-gray-400 flex items-center gap-1 font-semibold uppercase">
          <Sliders className="w-3 h-3 text-sky-400" /> Micro-Nudge Axis:
        </span>
        <div className="flex items-center bg-[#111827] rounded p-0.5 border border-[#1F2937]">
          <button
            onClick={() => setAxisMode('X')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono-telemetry font-bold transition ${
              axisMode === 'X' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            X (Length)
          </button>
          <button
            onClick={() => setAxisMode('Y')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono-telemetry font-bold transition ${
              axisMode === 'Y' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Y (Lateral)
          </button>
          <button
            onClick={() => setAxisMode('Z')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono-telemetry font-bold transition ${
              axisMode === 'Z' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Z (Elevation)
          </button>
        </div>
      </div>

      {/* 3. Crosshair Calibration Boxes (Defender vs Attacker) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Defender (2nd Last Opponent) Crosshair Box */}
        <div className="bg-[#0B0F19] p-2.5 rounded border border-blue-900/60 space-y-2">
          <div className="flex items-center justify-between border-b border-blue-900/40 pb-1">
            <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> 2nd-Last Def
            </span>
            <span className="text-xs font-mono-telemetry text-gray-300">
              {axisMode === 'X'
                ? `X: ${saotState.defender.pitchX.toFixed(3)}m`
                : axisMode === 'Y'
                ? `Y: ${saotState.defender.pitchY.toFixed(3)}m`
                : `Z: ${(saotState.defender.heightAboveGrassM || 1.35).toFixed(2)}m`}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 block">Furthest Playable Part:</label>
            <select
              value={saotState.defender.bodyPart}
              onChange={(e) => onUpdateDefenderPoint({ bodyPart: e.target.value })}
              className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-xs text-white"
            >
              {BODY_PARTS_DEFENDER.map((bp) => (
                <option key={bp} value={bp}>{bp}</option>
              ))}
            </select>
          </div>

          {/* Micro-Adjustment buttons for selected axis */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              onClick={() => nudgeDefender(-0.05)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              -5cm
            </button>
            <button
              onClick={() => nudgeDefender(-0.01)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              -1cm
            </button>
            <span className="text-[10px] text-gray-400">{axisMode}</span>
            <button
              onClick={() => nudgeDefender(0.01)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              +1cm
            </button>
            <button
              onClick={() => nudgeDefender(0.05)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              +5cm
            </button>
          </div>
        </div>

        {/* Attacker Crosshair Box */}
        <div className="bg-[#0B0F19] p-2.5 rounded border border-red-900/60 space-y-2">
          <div className="flex items-center justify-between border-b border-red-900/40 pb-1">
            <span className="text-xs font-bold text-red-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400" /> Leading Att
            </span>
            <span className="text-xs font-mono-telemetry text-gray-300">
              {axisMode === 'X'
                ? `X: ${saotState.attacker.pitchX.toFixed(3)}m`
                : axisMode === 'Y'
                ? `Y: ${saotState.attacker.pitchY.toFixed(3)}m`
                : `Z: ${(saotState.attacker.heightAboveGrassM || 1.45).toFixed(2)}m`}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 block">Furthest Playable Part:</label>
            <select
              value={saotState.attacker.bodyPart}
              onChange={(e) => onUpdateAttackerPoint({ bodyPart: e.target.value })}
              className="w-full bg-[#1F2937] border border-[#374151] rounded px-2 py-1 text-xs text-white"
            >
              {BODY_PARTS_ATTACKER.map((bp) => (
                <option key={bp} value={bp}>{bp}</option>
              ))}
            </select>
          </div>

          {/* Micro-Adjustment buttons for selected axis */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              onClick={() => nudgeAttacker(-0.05)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              -5cm
            </button>
            <button
              onClick={() => nudgeAttacker(-0.01)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              -1cm
            </button>
            <span className="text-[10px] text-gray-400">{axisMode}</span>
            <button
              onClick={() => nudgeAttacker(0.01)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              +1cm
            </button>
            <button
              onClick={() => nudgeAttacker(0.05)}
              className="px-1.5 py-0.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
            >
              +5cm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
