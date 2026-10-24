import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SaotState, ScenarioId } from '../../types/var';
import { CAMERA_PERSPECTIVES } from '../../utils/projection';
import { getConnectedBallImuData } from '../../scenarios/matchScenarios';

interface YouTubePlayerFeedProps {
  videoId: string;
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  playbackRate: number;
  isLooping: boolean;
  loopA: number | null;
  loopB: number | null;
  onFrameUpdate: (frame: number) => void;
  onDurationChange: (durationSec: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  saotState: SaotState;
  onUpdateSaotCrosshair?: (type: 'defender' | 'attacker', pitchX: number, pitchY: number) => void;
  scenarioId: ScenarioId;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YouTubePlayerFeed: React.FC<YouTubePlayerFeedProps> = ({
  videoId,
  currentFrame,
  totalFrames,
  isPlaying,
  playbackRate,
  isLooping,
  loopA,
  loopB,
  onFrameUpdate,
  onDurationChange,
  onPlayStateChange,
  saotState,
  onUpdateSaotCrosshair,
  scenarioId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const lastEmittedFrameRef = useRef<number>(-1);
  const isSeekingInternallyRef = useRef<boolean>(false);

  // Crosshair dragging state
  const [activeDrag, setActiveDrag] = useState<'defender' | 'attacker' | null>(null);
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // PostMessage helper for YouTube Player
  const sendYouTubeCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    }
  }, []);

  // 1. Initialize YouTube IFrame API
  useEffect(() => {
    let isCancelled = false;

    const setupPlayer = () => {
      if (isCancelled || !window.YT || !window.YT.Player) return;

      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }

        playerRef.current = new window.YT.Player('var-yt-iframe', {
          events: {
            onReady: (event: any) => {
              if (isCancelled) return;
              setPlayerReady(true);
              const dur = event.target.getDuration();
              if (dur && dur > 0) {
                onDurationChange(dur);
              }
              event.target.setPlaybackRate(playbackRate);
              const targetSec = currentFrame / 60;
              event.target.seekTo(targetSec, true);
            },
            onStateChange: (event: any) => {
              if (isCancelled) return;
              // 1: playing, 2: paused, 0: ended
              if (event.data === 1) {
                onPlayStateChange(true);
              } else if (event.data === 2) {
                onPlayStateChange(false);
              } else if (event.data === 0) {
                if (isLooping && loopA !== null) {
                  event.target.seekTo(loopA / 60, true);
                  event.target.playVideo();
                } else {
                  onPlayStateChange(false);
                }
              }
            },
          },
        });
      } catch (err) {
        console.warn('YouTube Player initialization fallback:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        setupPlayer();
      };

      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [videoId]);

  // 2. Play / Pause Control Synchronization
  useEffect(() => {
    if (playerRef.current && playerReady && typeof playerRef.current.getPlayerState === 'function') {
      try {
        const state = playerRef.current.getPlayerState();
        if (isPlaying && state !== 1) {
          playerRef.current.playVideo();
        } else if (!isPlaying && state === 1) {
          playerRef.current.pauseVideo();
        }
      } catch {
        // Fallback to postMessage
        sendYouTubeCommand(isPlaying ? 'playVideo' : 'pauseVideo');
      }
    } else {
      sendYouTubeCommand(isPlaying ? 'playVideo' : 'pauseVideo');
    }
  }, [isPlaying, playerReady, sendYouTubeCommand]);

  // 3. Playback Rate Synchronization
  useEffect(() => {
    if (playerRef.current && playerReady && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch {
        sendYouTubeCommand('setPlaybackRate', [playbackRate]);
      }
    } else {
      sendYouTubeCommand('setPlaybackRate', [playbackRate]);
    }
  }, [playbackRate, playerReady, sendYouTubeCommand]);

  // 4. Scrubbing & Seeking Synchronization (from external frame controls)
  useEffect(() => {
    // Only seek YouTube video if the frame change was NOT generated by internal playback
    if (Math.abs(currentFrame - lastEmittedFrameRef.current) > 1) {
      const targetSec = currentFrame / 60;
      if (playerRef.current && playerReady && typeof playerRef.current.seekTo === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          if (Math.abs(cur - targetSec) > 0.08) {
            playerRef.current.seekTo(targetSec, true);
          }
        } catch {
          sendYouTubeCommand('seekTo', [targetSec, true]);
        }
      } else {
        sendYouTubeCommand('seekTo', [targetSec, true]);
      }
      lastEmittedFrameRef.current = currentFrame;
    }
  }, [currentFrame, playerReady, sendYouTubeCommand]);

  // 5. Live playback time polling (syncs video to frame counter)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (playerRef.current && playerReady && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const sec = playerRef.current.getCurrentTime();
          if (typeof sec === 'number' && !isNaN(sec)) {
            const f = Math.round(sec * 60);

            // A/B loop handling
            if (isLooping && loopB !== null && f >= loopB) {
              const startSec = (loopA !== null ? loopA : 0) / 60;
              playerRef.current.seekTo(startSec, true);
              lastEmittedFrameRef.current = loopA !== null ? loopA : 0;
              onFrameUpdate(lastEmittedFrameRef.current);
            } else {
              lastEmittedFrameRef.current = f;
              onFrameUpdate(f);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying, playerReady, isLooping, loopA, loopB, onFrameUpdate]);

  // 6. Render Overlaid SAOT 3D Curtain, Lines, and 500Hz Ball IMU Graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const persp = CAMERA_PERSPECTIVES['main_wide'];

    // 1. SAOT 3D Lines & Virtual Offside Curtain
    if (saotState.show3DLines) {
      renderSaot3DLines(ctx, persp, saotState, width, height);
      if (saotState.show3DCurtain) {
        renderSaot3DCurtain(ctx, persp, saotState, width, height);
      }
      renderSaotCrosshairs(ctx, persp, saotState, width, height);
    }

    // 2. 500Hz Connected Ball IMU Waveform
    if (saotState.show500HzImuGraph) {
      renderConnectedBallImuGraph(ctx, scenarioId, currentFrame, saotState, width, height);
    }

    // 3. Drag Tooltip
    if (dragTooltip) {
      ctx.save();
      ctx.font = '11px monospace';
      const tw = ctx.measureText(dragTooltip.text).width;
      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(dragTooltip.x - tw / 2 - 8, dragTooltip.y - 32, tw + 16, 22, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dragTooltip.text, dragTooltip.x, dragTooltip.y - 21);
      ctx.restore();
    }

    ctx.restore();
  }, [currentFrame, saotState, scenarioId, dragTooltip]);

  // Pointer interactions for dragging crosshairs on top of YouTube video
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!saotState.passFrameLocked || !canvasRef.current || !onUpdateSaotCrosshair) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const persp = CAMERA_PERSPECTIVES['main_wide'];
    const defProj = persp.project(
      saotState.defender.pitchX,
      saotState.defender.pitchY,
      saotState.defender.heightAboveGrassM || 1.35,
      rect.width,
      rect.height
    );
    const attProj = persp.project(
      saotState.attacker.pitchX,
      saotState.attacker.pitchY,
      saotState.attacker.heightAboveGrassM || 1.45,
      rect.width,
      rect.height
    );

    const distDef = Math.hypot(x - defProj.x, y - defProj.y);
    const distAtt = Math.hypot(x - attProj.x, y - attProj.y);

    if (distDef < 40) {
      setActiveDrag('defender');
      setDragTooltip({
        x,
        y,
        text: `DEF: X=${saotState.defender.pitchX.toFixed(2)}m, Y=${saotState.defender.pitchY.toFixed(2)}m`,
      });
    } else if (distAtt < 40) {
      setActiveDrag('attacker');
      setDragTooltip({
        x,
        y,
        text: `ATT: X=${saotState.attacker.pitchX.toFixed(2)}m, Y=${saotState.attacker.pitchY.toFixed(2)}m`,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeDrag || !canvasRef.current || !onUpdateSaotCrosshair) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const persp = CAMERA_PERSPECTIVES['main_wide'];
    const heightM =
      activeDrag === 'defender'
        ? saotState.defender.heightAboveGrassM || 1.35
        : saotState.attacker.heightAboveGrassM || 1.45;

    const unproj = persp.unproject(x, y, heightM, rect.width, rect.height);
    onUpdateSaotCrosshair(activeDrag, unproj.pitchX, unproj.pitchY);

    setDragTooltip({
      x,
      y,
      text: `${activeDrag === 'defender' ? 'DEF' : 'ATT'}: X=${unproj.pitchX.toFixed(3)}m, Y=${unproj.pitchY.toFixed(3)}m`,
    });
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
    setDragTooltip(null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {/* YouTube Embedded IFrame Player */}
      <iframe
        id="var-yt-iframe"
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&disablekb=1&modestbranding=1&rel=0&playsinline=1&origin=${encodeURIComponent(
          typeof window !== 'undefined' ? window.location.origin : ''
        )}`}
        title="YouTube Match Incident Feed"
        className="absolute inset-0 w-full h-full pointer-events-auto border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />

      {/* Transparent SAOT & Calibration Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full z-10 ${
          saotState.passFrameLocked ? 'cursor-crosshair' : 'pointer-events-none'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Floating Camera Telemetry HUD Badge */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-[#0B0F19]/90 backdrop-blur px-2.5 py-1 rounded border border-[#1F2937]">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        <span className="font-mono-telemetry font-bold text-xs text-white">
          CAM-01 : YouTube Broadcast Feed
        </span>
        <span className="text-[10px] text-amber-400 font-mono-telemetry">
          [ID: {videoId}]
        </span>
      </div>

      {/* SAOT Offside Delta Verdict Badge */}
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
  );
};

/* Internal helper rendering functions for YouTube overlay */

function renderSaot3DLines(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  const defX = saot.defender.pitchX;
  const attX = saot.attacker.pitchX;

  const defP1 = persp.project(defX, 0, 0, w, h);
  const defP2 = persp.project(defX, 68, 0, w, h);

  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(defP1.x, defP1.y);
  ctx.lineTo(defP2.x, defP2.y);
  ctx.stroke();

  const attP1 = persp.project(attX, 0, 0, w, h);
  const attP2 = persp.project(attX, 68, 0, w, h);

  const isOffside = saot.deltaCm > 0;
  ctx.strokeStyle = isOffside ? '#EF4444' : '#10B981';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(attP1.x, attP1.y);
  ctx.lineTo(attP2.x, attP2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = isOffside ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)';
  ctx.beginPath();
  ctx.moveTo(defP1.x, defP1.y);
  ctx.lineTo(attP1.x, attP1.y);
  ctx.lineTo(attP2.x, attP2.y);
  ctx.lineTo(defP2.x, defP2.y);
  ctx.closePath();
  ctx.fill();
}

function renderSaot3DCurtain(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  const defX = saot.defender.pitchX;
  const attX = saot.attacker.pitchX;
  const isOffside = saot.deltaCm > 0;

  const pB0 = persp.project(defX, 0, 0, w, h);
  const pB68 = persp.project(defX, 68, 0, w, h);
  const pT68 = persp.project(defX, 68, 2.8, w, h);
  const pT0 = persp.project(defX, 0, 2.8, w, h);

  const defGrad = ctx.createLinearGradient(pB0.x, pB0.y, pT0.x, pT0.y);
  defGrad.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
  defGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
  defGrad.addColorStop(1, 'rgba(56, 189, 248, 0.03)');

  ctx.fillStyle = defGrad;
  ctx.beginPath();
  ctx.moveTo(pB0.x, pB0.y);
  ctx.lineTo(pB68.x, pB68.y);
  ctx.lineTo(pT68.x, pT68.y);
  ctx.lineTo(pT0.x, pT0.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pT0.x, pT0.y);
  ctx.lineTo(pT68.x, pT68.y);
  ctx.stroke();

  if (isOffside) {
    const aB0 = persp.project(attX, 0, 0, w, h);
    const aB68 = persp.project(attX, 68, 0, w, h);
    const aT68 = persp.project(attX, 68, 2.8, w, h);
    const aT0 = persp.project(attX, 0, 2.8, w, h);

    const attGrad = ctx.createLinearGradient(aB0.x, aB0.y, aT0.x, aT0.y);
    attGrad.addColorStop(0, 'rgba(239, 68, 68, 0.38)');
    attGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.16)');
    attGrad.addColorStop(1, 'rgba(239, 68, 68, 0.03)');

    ctx.fillStyle = attGrad;
    ctx.beginPath();
    ctx.moveTo(aB0.x, aB0.y);
    ctx.lineTo(aB68.x, aB68.y);
    ctx.lineTo(aT68.x, aT68.y);
    ctx.lineTo(aT0.x, aT0.y);
    ctx.closePath();
    ctx.fill();
  }
}

function renderSaotCrosshairs(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  const defGrass = persp.project(saot.defender.pitchX, saot.defender.pitchY, 0, w, h);
  const defBody = persp.project(saot.defender.pitchX, saot.defender.pitchY, saot.defender.heightAboveGrassM || 1.35, w, h);

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(defGrass.x, defGrass.y);
  ctx.lineTo(defBody.x, defBody.y);
  ctx.stroke();

  drawCrosshairNode(ctx, defBody.x, defBody.y, '#38BDF8', `DEF (${saot.defender.pitchX.toFixed(2)}m)`);

  const attGrass = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, 0, w, h);
  const attBody = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, saot.attacker.heightAboveGrassM || 1.45, w, h);

  const attColor = saot.deltaCm > 0 ? '#EF4444' : '#10B981';
  ctx.strokeStyle = attColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(attGrass.x, attGrass.y);
  ctx.lineTo(attBody.x, attBody.y);
  ctx.stroke();

  drawCrosshairNode(ctx, attBody.x, attBody.y, attColor, `ATT (${saot.deltaCm > 0 ? '+' : ''}${saot.deltaCm.toFixed(1)}cm)`);
}

function drawCrosshairNode(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 9, y);
  ctx.moveTo(x + 9, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y - 9);
  ctx.moveTo(x, y + 9);
  ctx.lineTo(x, y + 14);
  ctx.stroke();

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
  const tw = ctx.measureText(label).width;
  ctx.fillRect(x - tw / 2 - 4, y - 24, tw + 8, 14);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y - 17);

  ctx.restore();
}

function renderConnectedBallImuGraph(
  ctx: CanvasRenderingContext2D,
  scenarioId: ScenarioId,
  frame: number,
  saot: SaotState,
  w: number,
  h: number
) {
  const imu = getConnectedBallImuData(scenarioId, frame, 48);

  const boxW = Math.min(270, w * 0.42);
  const boxH = 114;
  const boxX = 14;
  const boxY = h - boxH - 14;

  ctx.save();
  ctx.fillStyle = 'rgba(11, 15, 25, 0.94)';
  ctx.strokeStyle = imu.isContactActive ? '#F59E0B' : '#1F2937';
  ctx.lineWidth = imu.isContactActive ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = imu.isContactActive ? '#EF4444' : '#10B981';
  ctx.beginPath();
  ctx.arc(boxX + 12, boxY + 12, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#E5E7EB';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADIDAS CONNECTED BALL', boxX + 20, boxY + 13);

  ctx.fillStyle = '#60A5FA';
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('500Hz IMU', boxX + boxW - 10, boxY + 13);

  const gx = boxX + 10;
  const gy = boxY + 24;
  const gw = boxW - 20;
  const gh = boxH - 52;

  ctx.fillStyle = '#070B12';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = 'rgba(31, 41, 55, 0.7)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(gx, gy, gw, gh);

  const maxG = 50.0;
  if (imu.samples.length > 1) {
    const firstF = imu.samples[0].frame;
    const lastF = imu.samples[imu.samples.length - 1].frame;
    const fRange = Math.max(1, lastF - firstF);

    ctx.strokeStyle = imu.isContactActive ? '#F59E0B' : '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    imu.samples.forEach((sample, idx) => {
      const sx = gx + ((sample.frame - firstF) / fRange) * gw;
      const sy = gy + gh - Math.min(gh, (sample.accelG / maxG) * gh);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    const curX = gx + ((frame - firstF) / fRange) * gw;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(curX, gy);
    ctx.lineTo(curX, gy + gh);
    ctx.stroke();
  }

  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(`CUR: ${imu.currentAccelG.toFixed(1)}G`, boxX + 10, boxY + boxH - 12);
  ctx.fillText(`KICK: F#${imu.contactFrame}`, boxX + 75, boxY + boxH - 12);

  ctx.textAlign = 'right';
  if (imu.isContactActive) {
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('● CONTACT POINT', boxX + boxW - 10, boxY + boxH - 12);
  } else {
    ctx.fillStyle = '#10B981';
    ctx.fillText('● SYNCED', boxX + boxW - 10, boxY + boxH - 12);
  }

  ctx.restore();
}
