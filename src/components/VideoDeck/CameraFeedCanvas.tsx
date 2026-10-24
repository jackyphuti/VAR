import React, { useEffect, useRef, useState } from 'react';
import { CameraId, SaotState, ScenarioId } from '../../types/var';
import { getScenarioFrameState } from '../../scenarios/matchScenarios';
import { CAMERA_PERSPECTIVES } from '../../utils/projection';

interface CameraFeedCanvasProps {
  cameraId: CameraId;
  scenarioId: ScenarioId;
  frameIndex: number;
  saotState: SaotState;
  onUpdateSaotCrosshair?: (type: 'defender' | 'attacker', pitchX: number, pitchY: number) => void;
  isMaximized?: boolean;
  videoElement?: HTMLVideoElement | null;
  isCustomVideo?: boolean;
}

export const CameraFeedCanvas: React.FC<CameraFeedCanvasProps> = ({
  cameraId,
  scenarioId,
  frameIndex,
  saotState,
  onUpdateSaotCrosshair,
  isMaximized = false,
  videoElement = null,
  isCustomVideo = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<'defender' | 'attacker' | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI display
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

    if (isCustomVideo && videoElement && videoElement.readyState >= 2) {
      // Draw uploaded video frame
      ctx.drawImage(videoElement, 0, 0, width, height);
    } else {
      // Draw simulated 3D football feed
      renderSimulatedPitchScene(ctx, cameraId, scenarioId, frameIndex, width, height, saotState);
    }

    ctx.restore();
  }, [cameraId, scenarioId, frameIndex, saotState, isCustomVideo, videoElement]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!saotState.passFrameLocked || !canvasRef.current || !onUpdateSaotCrosshair) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Determine if closer to defender or attacker crosshair
    const persp = CAMERA_PERSPECTIVES[cameraId];
    const defProj = persp.project(saotState.defender.pitchX, saotState.defender.pitchY, 1.2, rect.width, rect.height);
    const attProj = persp.project(saotState.attacker.pitchX, saotState.attacker.pitchY, 1.2, rect.width, rect.height);

    const distDef = Math.hypot(x - defProj.x, y - defProj.y);
    const distAtt = Math.hypot(x - attProj.x, y - attProj.y);

    if (distDef < 35) {
      setActiveDrag('defender');
    } else if (distAtt < 35) {
      setActiveDrag('attacker');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeDrag || !canvasRef.current || !onUpdateSaotCrosshair) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Map screen X back approximately to pitch meters (defense half 70m to 105m)
    const normX = Math.min(1.0, Math.max(0.0, x / rect.width));
    const newPitchX = 70.0 + normX * 35.0;
    const newPitchY = 34.0;

    onUpdateSaotCrosshair(activeDrag, newPitchX, newPitchY);
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block bg-[#070B12] ${
        saotState.passFrameLocked ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
};

/**
 * Renders the simulated football pitch scene with turf stripes, lines, players, ball, and SAOT 3D lines.
 */
function renderSimulatedPitchScene(
  ctx: CanvasRenderingContext2D,
  camId: CameraId,
  scenarioId: ScenarioId,
  frame: number,
  w: number,
  h: number,
  saot: SaotState
) {
  const persp = CAMERA_PERSPECTIVES[camId];
  const state = getScenarioFrameState(scenarioId, frame);

  // 1. Draw Pitch Turf Grass
  ctx.fillStyle = '#1A3F22';
  ctx.fillRect(0, 0, w, h);

  // Grass stripes pattern (5m mowing stripes along length)
  for (let sx = 65; sx <= 105; sx += 5.5) {
    const isDark = Math.floor(sx / 5.5) % 2 === 0;
    ctx.fillStyle = isDark ? '#1E4A28' : '#183C20';

    const p1 = persp.project(sx, 0, 0, w, h);
    const p2 = persp.project(sx + 5.5, 0, 0, w, h);
    const p3 = persp.project(sx + 5.5, 68, 0, w, h);
    const p4 = persp.project(sx, 68, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  // 2. Draw Pitch Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.5;

  // Touchlines & Goal Line
  drawPitchSegment(ctx, persp, 65, 0, 105, 0, w, h);
  drawPitchSegment(ctx, persp, 105, 0, 105, 68, w, h); // Goal Line
  drawPitchSegment(ctx, persp, 65, 68, 105, 68, w, h);

  // 16.5m Penalty Area Box (X=88.5 to 105, Y=13.84 to 54.16)
  ctx.lineWidth = 2;
  drawPitchSegment(ctx, persp, 88.5, 13.84, 105, 13.84, w, h);
  drawPitchSegment(ctx, persp, 88.5, 13.84, 88.5, 54.16, w, h);
  drawPitchSegment(ctx, persp, 88.5, 54.16, 105, 54.16, w, h);

  // 5.5m Goal Area (X=99.5 to 105, Y=24.84 to 43.16)
  drawPitchSegment(ctx, persp, 99.5, 24.84, 105, 24.84, w, h);
  drawPitchSegment(ctx, persp, 99.5, 24.84, 99.5, 43.16, w, h);
  drawPitchSegment(ctx, persp, 99.5, 43.16, 105, 43.16, w, h);

  // Penalty Spot (X=94.0, Y=34.0)
  const penSpot = persp.project(94.0, 34.0, 0, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(penSpot.x, penSpot.y, 3 * penSpot.scale, 0, Math.PI * 2);
  ctx.fill();

  // Goal Frame (X=105, Y=30.34 to 37.66, height 2.44m)
  drawGoalFrame(ctx, persp, w, h);

  // 3. Render SAOT 3D Offside Lines on Turf (if active)
  if (saot.show3DLines) {
    renderSaot3DLines(ctx, persp, saot, w, h);
  }

  // 4. Draw Shadows and Players
  // Sort players by depth (pitchY)
  const sortedPlayers = [...state.players].sort((a, b) => a.pitchY - b.pitchY);

  sortedPlayers.forEach((player) => {
    renderPlayer(ctx, persp, player, w, h);
  });

  // 5. Draw Ball
  renderBall(ctx, persp, state.ball, w, h);

  // 6. Draw SAOT Crosshairs & Measurement Badges
  if (saot.show3DLines) {
    renderSaotCrosshairs(ctx, persp, saot, w, h);
  }

  // 7. Radar Minimap (if enabled)
  if (saot.showRadarMinimap) {
    renderRadarMinimap(ctx, state, saot, w, h);
  }
}

function drawPitchSegment(
  ctx: CanvasRenderingContext2D,
  persp: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  h: number
) {
  const p1 = persp.project(x1, y1, 0, w, h);
  const p2 = persp.project(x2, y2, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawGoalFrame(ctx: CanvasRenderingContext2D, persp: any, w: number, h: number) {
  // Goal posts at X=105, Y=30.34 and Y=37.66, height 2.44m
  const post1Base = persp.project(105, 30.34, 0, w, h);
  const post1Top = persp.project(105, 30.34, 2.44, w, h);
  const post2Base = persp.project(105, 37.66, 0, w, h);
  const post2Top = persp.project(105, 37.66, 2.44, w, h);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  // Left post
  ctx.moveTo(post1Base.x, post1Base.y);
  ctx.lineTo(post1Top.x, post1Top.y);
  // Crossbar
  ctx.lineTo(post2Top.x, post2Top.y);
  // Right post
  ctx.lineTo(post2Base.x, post2Base.y);
  ctx.stroke();

  // Net mesh outline
  const netBack1 = persp.project(107, 30.34, 0, w, h);
  const netBack2 = persp.project(107, 37.66, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(post1Top.x, post1Top.y);
  ctx.lineTo(netBack1.x, netBack1.y);
  ctx.lineTo(netBack2.x, netBack2.y);
  ctx.lineTo(post2Top.x, post2Top.y);
  ctx.stroke();
}

function renderPlayer(ctx: CanvasRenderingContext2D, persp: any, player: any, w: number, h: number) {
  const feet = persp.project(player.pitchX, player.pitchY, 0, w, h);
  const head = persp.project(player.pitchX, player.pitchY, 1.8 + player.z, w, h);
  const scale = feet.scale;
  const playerH = Math.max(16, Math.abs(feet.y - head.y));

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y, 8 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const isFallen = player.actionState === 'FALLEN';
  const isLunge = player.actionState === 'LUNGING_STUDS_UP';

  // Kit colors
  let primaryKit = '#3B82F6'; // Blue defenders
  let shortKit = '#1E3A8A';
  if (player.team === 'ATTACKER') {
    primaryKit = '#DC2626'; // Red attackers
    shortKit = '#FFFFFF';
  } else if (player.team === 'GOALKEEPER') {
    primaryKit = '#F59E0B'; // Amber keeper
    shortKit = '#1F2937';
  } else if (player.team === 'REFEREE') {
    primaryKit = '#10B981'; // Green high-vis ref
    shortKit = '#111827';
  }

  ctx.save();
  ctx.translate(feet.x, feet.y);

  if (isFallen) {
    // Player on ground
    ctx.rotate(0.5);
    ctx.fillStyle = primaryKit;
    ctx.fillRect(-playerH * 0.4, -playerH * 0.25, playerH * 0.8, playerH * 0.25);
    // Head
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(playerH * 0.45, -playerH * 0.15, playerH * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (isLunge) {
    // Sliding lunge with exposed studs
    ctx.fillStyle = primaryKit;
    ctx.beginPath();
    ctx.ellipse(0, -playerH * 0.35, playerH * 0.22, playerH * 0.38, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // Extended leg with studs
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -playerH * 0.25);
    ctx.lineTo(playerH * 0.6, -playerH * 0.12);
    ctx.stroke();
    // Red highlight on studs
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(playerH * 0.62, -playerH * 0.12, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal standing/running player
    // Torso
    ctx.fillStyle = primaryKit;
    ctx.fillRect(-playerH * 0.18, -playerH * 0.75, playerH * 0.36, playerH * 0.45);

    // Shorts
    ctx.fillStyle = shortKit;
    ctx.fillRect(-playerH * 0.16, -playerH * 0.35, playerH * 0.32, playerH * 0.2);

    // Legs
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-playerH * 0.14, -playerH * 0.18, playerH * 0.1, playerH * 0.18);
    ctx.fillRect(playerH * 0.04, -playerH * 0.18, playerH * 0.1, playerH * 0.18);

    // Head
    ctx.beginPath();
    ctx.arc(0, -playerH * 0.86, playerH * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Squad Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, Math.floor(playerH * 0.22))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.number}`, 0, -playerH * 0.55);
  }

  ctx.restore();
}

function renderBall(ctx: CanvasRenderingContext2D, persp: any, ball: any, w: number, h: number) {
  const groundPos = persp.project(ball.x, ball.y, 0, w, h);
  const airPos = persp.project(ball.x, ball.y, ball.z, w, h);
  const scale = airPos.scale;
  const radius = Math.max(3.5, 5.5 * scale);

  // Ground shadow
  const shadowDist = Math.hypot(groundPos.x - airPos.x, groundPos.y - airPos.y);
  const shadowAlpha = Math.max(0.1, 0.45 - shadowDist * 0.005);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(groundPos.x, groundPos.y, radius * 1.2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball sphere
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(airPos.x, airPos.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pentagons on ball
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(airPos.x, airPos.y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function renderSaot3DLines(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  const defX = saot.defender.pitchX;
  const attX = saot.attacker.pitchX;

  // 1. Defender 3D Offside Line across pitch grass (Blue / Cyan)
  const defP1 = persp.project(defX, 0, 0, w, h);
  const defP2 = persp.project(defX, 68, 0, w, h);

  ctx.strokeStyle = '#0284C7'; // Blue
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(defP1.x, defP1.y);
  ctx.lineTo(defP2.x, defP2.y);
  ctx.stroke();

  // 2. Attacker 3D Offside Line across pitch grass (Red or Emerald)
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

  // Shaded delta zone between lines
  ctx.fillStyle = isOffside ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)';
  ctx.beginPath();
  ctx.moveTo(defP1.x, defP1.y);
  ctx.lineTo(attP1.x, attP1.y);
  ctx.lineTo(attP2.x, attP2.y);
  ctx.lineTo(defP2.x, defP2.y);
  ctx.closePath();
  ctx.fill();
}

function renderSaotCrosshairs(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  // Defender Vertical Drop Line (3D Pole from grass to body extremity)
  const defGrass = persp.project(saot.defender.pitchX, saot.defender.pitchY, 0, w, h);
  const defBody = persp.project(saot.defender.pitchX, saot.defender.pitchY, saot.defender.heightAboveGrassM || 1.35, w, h);

  ctx.strokeStyle = '#38BDF8'; // Sky blue
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(defGrass.x, defGrass.y);
  ctx.lineTo(defBody.x, defBody.y);
  ctx.stroke();

  // Defender Crosshair Target
  drawCrosshair(ctx, defBody.x, defBody.y, '#38BDF8', 'DEFENDER (2ND LAST)');

  // Attacker Vertical Drop Line
  const attGrass = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, 0, w, h);
  const attBody = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, saot.attacker.heightAboveGrassM || 1.45, w, h);

  const attColor = saot.deltaCm > 0 ? '#EF4444' : '#10B981';
  ctx.strokeStyle = attColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(attGrass.x, attGrass.y);
  ctx.lineTo(attBody.x, attBody.y);
  ctx.stroke();

  // Attacker Crosshair Target
  drawCrosshair(ctx, attBody.x, attBody.y, attColor, `ATTACKER (${saot.deltaCm > 0 ? '+' : ''}${saot.deltaCm.toFixed(1)}cm)`);
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Cross lines
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

  // Label tag
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

function renderRadarMinimap(ctx: CanvasRenderingContext2D, state: any, saot: SaotState, w: number, h: number) {
  const mapW = 160;
  const mapH = 100;
  const mx = w - mapW - 16;
  const my = h - mapH - 16;

  // Background
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
  ctx.fillRect(mx, my, mapW, mapH);
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mapW, mapH);

  // Pitch outline (half pitch 52.5m to 105m)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  const pitchLeft = mx + 10;
  const pitchTop = my + 10;
  const pitchW = mapW - 20;
  const pitchH = mapH - 20;
  ctx.strokeRect(pitchLeft, pitchTop, pitchW, pitchH);

  // Scale: 52.5m -> pitchW, 68m -> pitchH
  const toMapX = (px: number) => pitchLeft + ((px - 52.5) / 52.5) * pitchW;
  const toMapY = (py: number) => pitchTop + (py / 68.0) * pitchH;

  // Draw 2nd-last defender line
  const defMapX = toMapX(saot.defender.pitchX);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(defMapX, pitchTop);
  ctx.lineTo(defMapX, pitchTop + pitchH);
  ctx.stroke();

  // Draw attacker line
  const attMapX = toMapX(saot.attacker.pitchX);
  ctx.strokeStyle = saot.deltaCm > 0 ? '#EF4444' : '#10B981';
  ctx.beginPath();
  ctx.moveTo(attMapX, pitchTop);
  ctx.lineTo(attMapX, pitchTop + pitchH);
  ctx.stroke();

  // Draw players on minimap
  state.players.forEach((p: any) => {
    ctx.fillStyle = p.team === 'ATTACKER' ? '#EF4444' : p.team === 'DEFENDER' ? '#38BDF8' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(toMapX(p.pitchX), toMapY(p.pitchY), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Radar title
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '8px monospace';
  ctx.fillText('2D SAOT RADAR', mx + 8, my + 8);
}
