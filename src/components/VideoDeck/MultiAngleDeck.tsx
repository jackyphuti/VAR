import React, { useState } from 'react';
import { CameraId, SaotState, ScenarioId } from '../../types/var';
import { CameraFeedCanvas } from './CameraFeedCanvas';
import { TelestratorOverlay } from './TelestratorOverlay';
import { Maximize2, Grid, Film, Upload, Columns, PenTool } from 'lucide-react';

interface MultiAngleDeckProps {
  scenarioId: ScenarioId;
  frameIndex: number;
  saotState: SaotState;
  onUpdateSaotCrosshair: (type: 'defender' | 'attacker', pitchX: number, pitchY: number) => void;
  onUploadCustomVideo: (file: File) => void;
  isCustomVideo: boolean;
  videoElement: HTMLVideoElement | null;
  activeCameraId?: CameraId;
  onSelectActiveCamera?: (id: CameraId) => void;
}

interface CameraMeta {
  id: CameraId;
  name: string;
  badge: string;
  spec: string;
}

const CAMERAS: CameraMeta[] = [
  { id: 'main_wide', name: 'Main Tactical Wide', badge: 'CAM-01', spec: '1080p @ 59.94fps | 35mm F2.8' },
  { id: 'cam_16m', name: '16-Yard Offside Line', badge: 'CAM-02', spec: '1080p @ 59.94fps | Calibrated SAOT' },
  { id: 'behind_goal', name: 'Behind Goal Low', badge: 'CAM-03', spec: '1080p @ 59.94fps | 18mm Goalmouth' },
  { id: 'spidercam', name: 'Tactical High Spidercam', badge: 'CAM-04', spec: '1080p @ 59.94fps | Aerial 4-Wire' },
];

export const MultiAngleDeck: React.FC<MultiAngleDeckProps> = ({
  scenarioId,
  frameIndex,
  saotState,
  onUpdateSaotCrosshair,
  onUploadCustomVideo,
  isCustomVideo,
  videoElement,
  activeCameraId = 'cam_16m',
  onSelectActiveCamera,
}) => {
  const [maximizedCam, setMaximizedCam] = useState<CameraId>(activeCameraId);
  const [viewMode, setViewMode] = useState<'focused' | 'quad' | 'split'>('focused');
  const [splitCamLeft, setSplitCamLeft] = useState<CameraId>('cam_16m');
  const [splitCamRight, setSplitCamRight] = useState<CameraId>('behind_goal');
  const [telestratorActive, setTelestratorActive] = useState<boolean>(false);

  const handleSelectCam = (id: CameraId) => {
    setMaximizedCam(id);
    if (onSelectActiveCamera) onSelectActiveCamera(id);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadCustomVideo(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Top Deck Sub-Header */}
      <div className="flex flex-wrap items-center justify-between px-2.5 py-1.5 bg-[#111827] rounded border border-[#1F2937] text-xs gap-2">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-gray-200">SYNCHRONIZED CAMERA ARRAY</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono-telemetry font-bold animate-pulse-subtle">
            ● 4/4 FEEDS SYNCED
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Custom video upload */}
          <label className="flex items-center gap-1 px-2 py-1 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded cursor-pointer transition text-xs">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload MP4</span>
            <input type="file" accept="video/mp4,video/webm" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Telestrator Quick Toggle Button */}
          <button
            onClick={() => setTelestratorActive(!telestratorActive)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition ${
              telestratorActive ? 'bg-sky-600 text-white shadow' : 'bg-[#1F2937] text-gray-300 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Telestrator</span>
          </button>

          {/* Toggle View Mode: Primary+PIP / Quad Grid / Split-Screen Dual Compare */}
          <div className="flex items-center bg-[#0B0F19] rounded border border-[#1F2937] p-0.5">
            <button
              onClick={() => setViewMode('focused')}
              className={`px-2 py-0.5 rounded text-xs transition ${
                viewMode === 'focused' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Primary + PIP
            </button>
            <button
              onClick={() => setViewMode('quad')}
              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 transition ${
                viewMode === 'quad' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-3 h-3" /> Quad
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 transition ${
                viewMode === 'split' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" /> Split Compare
            </button>
          </div>
        </div>
      </div>

      {/* Main Video View Area */}
      {viewMode === 'focused' ? (
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          {/* Primary Maximized Monitor Canvas */}
          <div className="relative flex-1 bg-black rounded-lg border-2 border-blue-600/70 overflow-hidden shadow-2xl min-h-[380px] broadcast-feed">
            <CameraFeedCanvas
              cameraId={maximizedCam}
              scenarioId={scenarioId}
              frameIndex={frameIndex}
              saotState={saotState}
              onUpdateSaotCrosshair={onUpdateSaotCrosshair}
              isMaximized={true}
              isCustomVideo={isCustomVideo}
              videoElement={videoElement}
            />

            {/* Telestrator Drawing Overlay */}
            <TelestratorOverlay
              isActive={telestratorActive}
              onToggleActive={() => setTelestratorActive(!telestratorActive)}
            />

            {/* Live Camera HUD Overlay */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-[#0B0F19]/90 backdrop-blur px-2.5 py-1 rounded border border-[#1F2937]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono-telemetry font-bold text-xs text-white">
                {CAMERAS.find((c) => c.id === maximizedCam)?.badge} : {CAMERAS.find((c) => c.id === maximizedCam)?.name}
              </span>
              <span className="text-[10px] text-gray-400 font-mono-telemetry">
                [{CAMERAS.find((c) => c.id === maximizedCam)?.spec}]
              </span>
            </div>

            {/* SAOT Offside Delta Badge */}
            {saotState.show3DLines && (
              <div className="absolute top-2 right-2 z-20">
                <div
                  className={`px-3 py-1.5 rounded-lg border font-mono-telemetry font-extrabold text-sm shadow-lg ${
                    saotState.deltaCm > 0
                      ? 'bg-red-950/90 text-red-200 border-red-500'
                      : 'bg-emerald-950/90 text-emerald-200 border-emerald-500'
                  }`}
                >
                  {saotState.deltaCm > 0
                    ? `OFFSIDE: +${saotState.deltaCm.toFixed(1)} cm`
                    : `ONSIDE: ${saotState.deltaCm.toFixed(1)} cm`}
                </div>
              </div>
            )}
          </div>

          {/* Secondary 3 Synchronized Feeds Row */}
          <div className="grid grid-cols-4 gap-2 h-28">
            {CAMERAS.map((cam) => {
              const isSelected = cam.id === maximizedCam;
              return (
                <div
                  key={cam.id}
                  onClick={() => handleSelectCam(cam.id)}
                  className={`relative rounded-md overflow-hidden cursor-pointer transition border-2 ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/40'
                      : 'border-[#1F2937] hover:border-gray-500 opacity-80 hover:opacity-100'
                  }`}
                >
                  <CameraFeedCanvas
                    cameraId={cam.id}
                    scenarioId={scenarioId}
                    frameIndex={frameIndex}
                    saotState={saotState}
                    isCustomVideo={isCustomVideo}
                    videoElement={videoElement}
                  />

                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-mono-telemetry text-gray-300">
                    <span className="font-bold text-white">{cam.badge}</span>
                    <span className="truncate max-w-[80px]">{cam.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'split' ? (
        /* Part B.3: Split-Screen Dual Compare Mode */
        <div className="flex-1 flex flex-col space-y-2 min-h-[460px]">
          <div className="flex-1 grid grid-cols-2 gap-2">
            {/* Left Synchronized Camera */}
            <div className="relative bg-black rounded-lg border-2 border-blue-600/70 overflow-hidden shadow-xl broadcast-feed">
              <CameraFeedCanvas
                cameraId={splitCamLeft}
                scenarioId={scenarioId}
                frameIndex={frameIndex}
                saotState={saotState}
                onUpdateSaotCrosshair={onUpdateSaotCrosshair}
                isCustomVideo={isCustomVideo}
                videoElement={videoElement}
              />

              <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-[#0B0F19]/90 backdrop-blur px-2.5 py-1 rounded border border-[#1F2937]">
                <span className="font-bold text-xs text-sky-400">FEED A (LEFT):</span>
                <select
                  value={splitCamLeft}
                  onChange={(e) => setSplitCamLeft(e.target.value as CameraId)}
                  className="bg-[#1F2937] border border-[#374151] rounded px-1.5 py-0.5 text-xs text-white"
                >
                  {CAMERAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.badge} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Synchronized Camera */}
            <div className="relative bg-black rounded-lg border-2 border-amber-600/70 overflow-hidden shadow-xl broadcast-feed">
              <CameraFeedCanvas
                cameraId={splitCamRight}
                scenarioId={scenarioId}
                frameIndex={frameIndex}
                saotState={saotState}
                onUpdateSaotCrosshair={onUpdateSaotCrosshair}
                isCustomVideo={isCustomVideo}
                videoElement={videoElement}
              />

              <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-[#0B0F19]/90 backdrop-blur px-2.5 py-1 rounded border border-[#1F2937]">
                <span className="font-bold text-xs text-amber-400">FEED B (RIGHT):</span>
                <select
                  value={splitCamRight}
                  onChange={(e) => setSplitCamRight(e.target.value as CameraId)}
                  className="bg-[#1F2937] border border-[#374151] rounded px-1.5 py-0.5 text-xs text-white"
                >
                  {CAMERAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.badge} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-2 bg-[#111827] rounded border border-[#1F2937] text-center text-xs text-gray-400 font-mono-telemetry">
            DUAL SPLIT SYNC: Both angles locked frame-by-frame (Frame #{frameIndex}). Use playback controls below.
          </div>
        </div>
      ) : (
        /* 2x2 Quad Grid Mode */
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 min-h-[460px]">
          {CAMERAS.map((cam) => (
            <div
              key={cam.id}
              className="relative bg-black rounded-lg border border-[#1F2937] hover:border-blue-500/80 overflow-hidden transition group"
            >
              <CameraFeedCanvas
                cameraId={cam.id}
                scenarioId={scenarioId}
                frameIndex={frameIndex}
                saotState={saotState}
                onUpdateSaotCrosshair={onUpdateSaotCrosshair}
                isCustomVideo={isCustomVideo}
                videoElement={videoElement}
              />

              <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between bg-[#0B0F19]/80 backdrop-blur px-2 py-1 rounded text-xs font-mono-telemetry text-gray-200">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-bold text-white">{cam.badge}</span>
                  <span>{cam.name}</span>
                </div>
                <button
                  onClick={() => {
                    handleSelectCam(cam.id);
                    setViewMode('focused');
                  }}
                  title="Maximize this camera angle"
                  className="p-1 rounded hover:bg-[#1F2937] text-gray-400 hover:text-white"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
