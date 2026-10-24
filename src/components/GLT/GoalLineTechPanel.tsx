import React, { useState } from 'react';
import { GltState } from '../../types/var';
import { Activity, CheckCircle, XCircle, Sliders, Eye, Watch } from 'lucide-react';

interface GoalLineTechPanelProps {
  gltState: GltState;
  onUpdateBallX: (newPitchX: number) => void;
}

export const GoalLineTechPanel: React.FC<GoalLineTechPanelProps> = ({
  gltState,
  onUpdateBallX,
}) => {
  const [viewMode, setViewMode] = useState<'top_down' | 'cross_section'>('top_down');

  // IFAB Law 10 & Law 9: A goal is scored when the ENTIRE ball passes over the goal line.
  // The goal line width is 12 cm. Inner edge at 105.0m, outer edge at 105.12m.
  // Standard ball diameter is 22.0 cm (radius 11.0 cm).
  // Trailing edge of ball = gltState.ballPitchX - 0.11
  // Overhang relative to outer edge = (trailing edge - 105.12) * 1000 in mm.
  const lineInnerEdge = 105.0;
  const lineWidthM = 0.12;
  const lineOuterEdge = lineInnerEdge + lineWidthM;
  const ballRadiusM = 0.11;

  const ballTrailingEdge = gltState.ballPitchX - ballRadiusM;
  const overhangMm = Number(((ballTrailingEdge - lineOuterEdge) * 1000).toFixed(1));
  const isGoal = overhangMm > 0;

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">
            Goal-Line Technology (GLT) Hawkeye Sensor Suite
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setViewMode('top_down')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              viewMode === 'top_down' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Top-Down 2D
          </button>
          <button
            onClick={() => setViewMode('cross_section')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              viewMode === 'cross_section' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Cross-Section
          </button>
        </div>
      </div>

      {/* Referee Watch Alert Badge */}
      <div
        className={`p-3 rounded-lg border flex items-center justify-between shadow-inner ${
          isGoal
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100'
            : 'bg-red-950/80 border-red-600 text-red-100'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-black/50 border border-white/20">
            <Watch className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-300">
              Referee Watch Vibrating Radio Alert
            </div>
            <div className="text-xl font-mono-telemetry font-black tracking-widest">
              {isGoal ? 'GLT SIGNAL: GOAL' : 'GLT SIGNAL: NO GOAL'}
            </div>
          </div>
        </div>

        <div className="text-right font-mono-telemetry">
          <div className="text-[10px] text-gray-400 uppercase">Line Overhang Margin</div>
          <div className={`text-2xl font-black ${isGoal ? 'text-emerald-400' : 'text-red-400'}`}>
            {isGoal ? `+${overhangMm} mm` : `${overhangMm} mm`}
          </div>
          <div className="text-[10px] text-gray-400">
            {isGoal ? 'Wholly Over Line' : `${Math.abs(overhangMm)} mm Still on Line`}
          </div>
        </div>
      </div>

      {/* Hawkeye Canvas Visualizer */}
      <div className="relative h-44 bg-[#050912] rounded-lg border border-[#1F2937] overflow-hidden flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 500 160">
          {viewMode === 'top_down' ? (
            /* Top-Down Bird's Eye View */
            <g>
              {/* Pitch turf green */}
              <rect x="0" y="0" width="280" height="160" fill="#14371D" />
              {/* Inside goal net white/slate */}
              <rect x="280" y="0" width="220" height="160" fill="#0D1F13" />

              {/* Goal Line (12cm wide, mapped to 60px) */}
              <rect x="250" y="0" width="60" height="160" fill="#FFFFFF" opacity="0.9" />
              <text x="255" y="20" fill="#1F2937" fontSize="10" fontFamily="monospace" fontWeight="bold">
                GOAL LINE (12.0 cm)
              </text>
              <line x1="310" y1="0" x2="310" y2="160" stroke="#EF4444" strokeWidth="2" strokeDasharray="4,4" />
              <text x="315" y="150" fill="#EF4444" fontSize="9" fontFamily="monospace">
                Outer Edge (100% threshold)
              </text>

              {/* Ball Position in top down */}
              {/* Calculate ball center X on SVG: 250px = 105.0m, 310px = 105.12m. scale = 500px / meter */}
              {(() => {
                const svgScale = 500;
                const ballCx = 250 + (gltState.ballPitchX - 105.0) * svgScale;
                const ballCy = 80;
                const ballRadiusPx = ballRadiusM * svgScale; // 55px

                return (
                  <g>
                    {/* Ball shadow */}
                    <ellipse cx={ballCx} cy={ballCy} rx={ballRadiusPx} ry={ballRadiusPx} fill="#FFFFFF" stroke="#0B0F19" strokeWidth="2" />
                    {/* Center point */}
                    <circle cx={ballCx} cy={ballCy} r="3" fill="#EF4444" />
                    {/* Tangent edge line */}
                    <line
                      x1={ballCx - ballRadiusPx}
                      y1="10"
                      x2={ballCx - ballRadiusPx}
                      y2="150"
                      stroke={isGoal ? '#10B981' : '#EF4444'}
                      strokeWidth="2"
                    />
                    <text
                      x={ballCx - ballRadiusPx + 4}
                      y="40"
                      fill={isGoal ? '#10B981' : '#EF4444'}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      Trailing Edge ({overhangMm}mm)
                    </text>
                  </g>
                );
              })()}
            </g>
          ) : (
            /* Cross-Section View (Level with Turf) */
            <g>
              {/* Turf line */}
              <rect x="0" y="110" width="500" height="50" fill="#14371D" />
              <line x1="0" y1="110" x2="500" y2="110" stroke="#FFFFFF" strokeWidth="1" />

              {/* Goal Line cross section */}
              <rect x="240" y="108" width="60" height="4" fill="#FFFFFF" />
              <line x1="300" y1="20" x2="300" y2="150" stroke="#EF4444" strokeWidth="2" strokeDasharray="3,3" />

              {/* Cross section ball */}
              {(() => {
                const svgScale = 500;
                const ballCx = 240 + (gltState.ballPitchX - 105.0) * svgScale;
                const ballCy = 110 - ballRadiusM * svgScale;
                const ballRadiusPx = ballRadiusM * svgScale;

                return (
                  <g>
                    <circle cx={ballCx} cy={ballCy} r={ballRadiusPx} fill="#F9FAFB" stroke="#1F2937" strokeWidth="2" />
                    <line
                      x1={ballCx - ballRadiusPx}
                      y1="20"
                      x2={ballCx - ballRadiusPx}
                      y2="130"
                      stroke={isGoal ? '#10B981' : '#EF4444'}
                      strokeWidth="2"
                    />
                  </g>
                );
              })()}
            </g>
          )}
        </svg>

        {/* Hawkeye Logo Watermark */}
        <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded border border-[#1F2937] text-[9px] font-mono-telemetry text-emerald-400">
          HAWKEYE 7-CAM TRIANGULATION
        </div>
      </div>

      {/* Ball Position Slider & Micro-Nudge */}
      <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#1F2937] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] text-gray-400 font-semibold uppercase flex items-center gap-1">
            <Sliders className="w-3 h-3 text-emerald-400" /> Ball Position relative to Goal Line:
          </span>
          <span className="font-mono-telemetry text-white font-bold">
            {gltState.ballPitchX.toFixed(4)}m
          </span>
        </div>

        <input
          type="range"
          min={104.90}
          max={105.35}
          step={0.0005}
          value={gltState.ballPitchX}
          onChange={(e) => onUpdateBallX(Number(e.target.value))}
          className="w-full h-2 bg-[#1F2937] rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        <div className="flex items-center justify-between text-[11px] pt-1">
          <button
            onClick={() => onUpdateBallX(gltState.ballPitchX - 0.005)}
            className="px-2 py-1 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
          >
            -5mm
          </button>
          <button
            onClick={() => onUpdateBallX(gltState.ballPitchX - 0.001)}
            className="px-2 py-1 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
          >
            -1mm
          </button>
          <span className="text-[10px] text-gray-500 font-mono-telemetry">IFAB LAW 10</span>
          <button
            onClick={() => onUpdateBallX(gltState.ballPitchX + 0.001)}
            className="px-2 py-1 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
          >
            +1mm
          </button>
          <button
            onClick={() => onUpdateBallX(gltState.ballPitchX + 0.005)}
            className="px-2 py-1 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry"
          >
            +5mm
          </button>
        </div>
      </div>
    </div>
  );
};
