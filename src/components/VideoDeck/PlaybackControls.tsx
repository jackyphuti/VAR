import React from 'react';
import { AppPhase } from '../../types/var';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
  Crosshair,
  Flame,
  RotateCcw,
  Flag,
} from 'lucide-react';

interface PlaybackControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  playbackRate: number;
  loopA: number | null;
  loopB: number | null;
  isLooping: boolean;
  kickFrame: number;
  incidentFrame: number;
  appPhases?: AppPhase[];
  onTogglePlay: () => void;
  onStepFrame: (delta: number) => void;
  onSeekFrame: (frame: number) => void;
  onChangeRate: (rate: number) => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onToggleLoop: () => void;
  onClearLoop: () => void;
  onFreezeKickPoint: () => void;
  onJumpIncident: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentFrame,
  totalFrames,
  isPlaying,
  playbackRate,
  loopA,
  loopB,
  isLooping,
  kickFrame,
  incidentFrame,
  appPhases = [],
  onTogglePlay,
  onStepFrame,
  onSeekFrame,
  onChangeRate,
  onSetLoopA,
  onSetLoopB,
  onToggleLoop,
  onClearLoop,
  onFreezeKickPoint,
  onJumpIncident,
}) => {
  const formatTimecode = (frame: number) => {
    const fps = 60;
    const totalSecs = Math.floor(frame / fps);
    const ff = frame % fps;
    const mm = Math.floor(totalSecs / 60);
    const ss = totalSecs % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  };

  const speedOptions = [0.1, 0.25, 0.5, 1.0, 2.0];

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-2.5 select-none shadow-xl">
      {/* 1. Scrub Timeline Bar with Keypoint Markers & APP Phase Indicators */}
      <div className="relative pt-1 pb-1">
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={currentFrame}
          onChange={(e) => onSeekFrame(Number(e.target.value))}
          className="w-full h-2.5 bg-[#1F2937] rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition"
        />

        {/* Kick Point Marker */}
        <div
          title={`Kick Point: Frame ${kickFrame}`}
          onClick={onFreezeKickPoint}
          style={{ left: `${(kickFrame / totalFrames) * 100}%` }}
          className="absolute -top-1 w-2.5 h-4.5 bg-amber-400 rounded-sm cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform shadow"
        />

        {/* Incident Point Marker */}
        <div
          title={`Incident Contact: Frame ${incidentFrame}`}
          onClick={onJumpIncident}
          style={{ left: `${(incidentFrame / totalFrames) * 100}%` }}
          className="absolute -top-1 w-2.5 h-4.5 bg-red-500 rounded-sm cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform shadow"
        />

        {/* Loop A & B visual indicators */}
        {loopA !== null && (
          <div
            title={`Loop Point A: Frame ${loopA}`}
            style={{ left: `${(loopA / totalFrames) * 100}%` }}
            className="absolute top-2.5 w-1.5 h-3 bg-sky-400 transform -translate-x-1/2"
          />
        )}
        {loopB !== null && (
          <div
            title={`Loop Point B: Frame ${loopB}`}
            style={{ left: `${(loopB / totalFrames) * 100}%` }}
            className="absolute top-2.5 w-1.5 h-3 bg-sky-400 transform -translate-x-1/2"
          />
        )}
      </div>

      {/* Part B.4: Attacking Possession Phase (APP) Markers Row */}
      {appPhases.length > 0 && (
        <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 border-t border-b border-[#1F2937]/60 text-[10px] font-mono-telemetry">
          <div className="flex items-center space-x-1 text-gray-400 uppercase font-bold shrink-0">
            <Flag className="w-3 h-3 text-blue-400" />
            <span>APP Phases:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {appPhases.map((phase) => {
              const isPassed = currentFrame >= phase.frame;
              return (
                <button
                  key={phase.id}
                  onClick={() => onSeekFrame(phase.frame)}
                  title={`${phase.description} (Frame ${phase.frame})`}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                    isPassed
                      ? 'bg-blue-950 text-blue-200 border border-blue-700'
                      : 'bg-[#0B0F19] text-gray-400 border border-[#1F2937] hover:border-gray-500'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: phase.badgeColor }}
                  />
                  <span className="truncate max-w-[120px]">{phase.name}</span>
                  <span className="text-[9px] text-gray-500">({phase.frame}f)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Main Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Timecode and Frame Counters */}
        <div className="flex items-center space-x-2 bg-[#0B0F19] px-3 py-1.5 rounded border border-[#1F2937] font-mono-telemetry">
          <span className="text-emerald-400 font-bold text-sm tracking-wider">
            {formatTimecode(currentFrame)}
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">
            F: <strong className="text-white">{currentFrame}</strong> / {totalFrames}
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-blue-400 font-semibold">60 FPS</span>
        </div>

        {/* Center: Playback Stepping & Shuttle Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onStepFrame(-10)}
            title="Step -10 frames"
            className="p-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-300 transition"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => onStepFrame(-1)}
            title="Step -1 frame (previous frame)"
            className="px-2 py-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry font-bold transition flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> -1f
          </button>

          <button
            onClick={onTogglePlay}
            className={`px-4 py-1.5 rounded font-bold transition flex items-center gap-1.5 shadow ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> PAUSE
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> PLAY
              </>
            )}
          </button>

          <button
            onClick={() => onStepFrame(1)}
            title="Step +1 frame (next frame)"
            className="px-2 py-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-mono-telemetry font-bold transition flex items-center gap-1"
          >
            +1f <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onStepFrame(10)}
            title="Step +10 frames"
            className="p-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-300 transition"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Speed / Shuttle Selector */}
        <div className="flex items-center space-x-1 bg-[#0B0F19] p-1 rounded border border-[#1F2937]">
          <span className="text-[10px] text-gray-400 uppercase px-1 font-semibold">Speed</span>
          {speedOptions.map((rate) => (
            <button
              key={rate}
              onClick={() => onChangeRate(rate)}
              className={`px-2 py-1 rounded text-xs font-mono-telemetry transition ${
                playbackRate === rate
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#1F2937]'
              }`}
            >
              {rate * 100}%
            </button>
          ))}
        </div>

        {/* Right: Quick Jump Actions */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onFreezeKickPoint}
            title="Jump and lock to Pass Contact Frame"
            className="px-2.5 py-1.5 rounded bg-amber-950/70 border border-amber-600/60 text-amber-300 hover:bg-amber-900 font-semibold flex items-center gap-1 transition"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>KICK POINT</span>
          </button>

          <button
            onClick={onJumpIncident}
            title="Jump to Incident Contact Point"
            className="px-2.5 py-1.5 rounded bg-red-950/70 border border-red-600/60 text-red-300 hover:bg-red-900 font-semibold flex items-center gap-1 transition"
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span>INCIDENT</span>
          </button>

          {/* Loop A-B Group */}
          <div className="flex items-center bg-[#0B0F19] rounded border border-[#1F2937] p-0.5">
            <button
              onClick={onSetLoopA}
              title="Set Loop Start [Point A]"
              className={`px-1.5 py-1 rounded text-[11px] font-mono-telemetry ${
                loopA !== null ? 'bg-sky-900 text-sky-200' : 'text-gray-400 hover:text-white'
              }`}
            >
              A: {loopA !== null ? loopA : '--'}
            </button>
            <button
              onClick={onSetLoopB}
              title="Set Loop End [Point B]"
              className={`px-1.5 py-1 rounded text-[11px] font-mono-telemetry ${
                loopB !== null ? 'bg-sky-900 text-sky-200' : 'text-gray-400 hover:text-white'
              }`}
            >
              B: {loopB !== null ? loopB : '--'}
            </button>
            <button
              onClick={onToggleLoop}
              title="Toggle Loop Playback"
              className={`p-1 rounded transition ${
                isLooping ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
            {(loopA !== null || loopB !== null) && (
              <button
                onClick={onClearLoop}
                title="Clear Loop Points"
                className="p-1 text-gray-500 hover:text-red-400"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
