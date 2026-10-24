import React, { useEffect, useRef, useState } from 'react';
import { CameraId, SaotState, ScenarioId } from '../../types/var';
import { getScenarioFrameState, getConnectedBallImuData } from '../../scenarios/matchScenarios';
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
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

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

    if (isCustomVideo && videoElement && videoElement.readyState >= 2) {
      renderCustomVideoFeed(ctx, cameraId, videoElement, width, height);
      // Overlay SAOT lines and radar on top of custom video
      if (saotState.show3DLines) {
        const persp = CAMERA_PERSPECTIVES[cameraId];
        renderSaot3DLines(ctx, persp, saotState, width, height);
        if (saotState.show3DCurtain) {
          renderSaot3DCurtain(ctx, persp, saotState, width, height);
        }
        renderSaotCrosshairs(ctx, persp, saotState, width, height);
      }
      if (saotState.show500HzImuGraph) {
        renderConnectedBallImuGraph(ctx, scenarioId, frameIndex, saotState, width, height);
      }
    } else {
      renderSimulatedPitchScene(ctx, cameraId, scenarioId, frameIndex, width, height, saotState);
    }

    // Render Drag Tooltip if active
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
  }, [cameraId, scenarioId, frameIndex, saotState, isCustomVideo, videoElement, dragTooltip, isMaximized]);

  // Pointer interactions for True Inverse Projection unproject()
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!saotState.passFrameLocked || !canvasRef.current || !onUpdateSaotCrosshair) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const persp = CAMERA_PERSPECTIVES[cameraId];
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

    const persp = CAMERA_PERSPECTIVES[cameraId];
    const heightM =
      activeDrag === 'defender'
        ? saotState.defender.heightAboveGrassM || 1.35
        : saotState.attacker.heightAboveGrassM || 1.45;

    // Algebraic true inverse projection
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
    <canvas
      ref={canvasRef}
      className={`w-full h-full block bg-[#070B12] ${
        saotState.passFrameLocked ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
};

/**
 * Handles custom video rendering with simulated camera viewports for CAM-02, 03, 04
 */
function renderCustomVideoFeed(
  ctx: CanvasRenderingContext2D,
  camId: CameraId,
  video: HTMLVideoElement,
  w: number,
  h: number
) {
  const vw = video.videoWidth || 1920;
  const vh = video.videoHeight || 1080;

  if (camId === 'main_wide') {
    // CAM-01: Full uncropped frame
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, w, h);
  } else if (camId === 'cam_16m') {
    // CAM-02: Calibrated 16m zoom crop
    const sx = vw * 0.25;
    const sy = vh * 0.15;
    const sw = vw * 0.75;
    const sh = vh * 0.85;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } else if (camId === 'behind_goal') {
    // CAM-03: Goalmouth close-up crop
    const sx = vw * 0.45;
    const sy = vh * 0.25;
    const sw = vw * 0.55;
    const sh = vh * 0.75;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    // CAM-04: High tactical overhead view crop
    const sx = vw * 0.15;
    const sy = vh * 0.05;
    const sw = vw * 0.85;
    const sh = vh * 0.9;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  }
}

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

  // Grass stripes pattern (5.5m mowing stripes)
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

  // Goal Frame
  drawGoalFrame(ctx, persp, w, h);

  // 3. Render SAOT 3D Offside Lines & Virtual Curtain (if active)
  if (saot.show3DLines) {
    renderSaot3DLines(ctx, persp, saot, w, h);
    if (saot.show3DCurtain) {
      renderSaot3DCurtain(ctx, persp, saot, w, h);
    }
  }

  // 4. Draw Shadows, Players, and 29-Point Limb Mesh
  const sortedPlayers = [...state.players].sort((a, b) => a.pitchY - b.pitchY);
  sortedPlayers.forEach((player) => {
    renderPlayer(ctx, persp, player, w, h, saot);
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

  // 8. 500Hz Connected Ball Inertial Sensor (IMU) HUD Waveform
  if (saot.show500HzImuGraph) {
    renderConnectedBallImuGraph(ctx, scenarioId, frame, saot, w, h);
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
  const post1Base = persp.project(105, 30.34, 0, w, h);
  const post1Top = persp.project(105, 30.34, 2.44, w, h);
  const post2Base = persp.project(105, 37.66, 0, w, h);
  const post2Top = persp.project(105, 37.66, 2.44, w, h);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(post1Base.x, post1Base.y);
  ctx.lineTo(post1Top.x, post1Top.y);
  ctx.lineTo(post2Top.x, post2Top.y);
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

function renderPlayer(ctx: CanvasRenderingContext2D, persp: any, player: any, w: number, h: number, saot?: SaotState) {
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
  const isArmExtended = player.actionState === 'ARM_EXTENDED';
  const isHeading = player.actionState === 'HEADING';

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
  } else if (isArmExtended) {
    // Defender airborne with right arm horizontally extended (Handball Law 12)
    // Elevation lift
    const liftY = -playerH * 0.25;

    // Torso
    ctx.fillStyle = primaryKit;
    ctx.fillRect(-playerH * 0.18, -playerH * 0.75 + liftY, playerH * 0.36, playerH * 0.45);

    // Shorts
    ctx.fillStyle = shortKit;
    ctx.fillRect(-playerH * 0.16, -playerH * 0.35 + liftY, playerH * 0.32, playerH * 0.2);

    // Jumping legs
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-playerH * 0.14, -playerH * 0.18 + liftY, playerH * 0.1, playerH * 0.18);
    ctx.fillRect(playerH * 0.04, -playerH * 0.18 + liftY, playerH * 0.1, playerH * 0.18);

    // Head
    ctx.beginPath();
    ctx.arc(0, -playerH * 0.86 + liftY, playerH * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Right Arm horizontally extended 90 degrees outward (Unnatural Silhouette)
    ctx.strokeStyle = primaryKit;
    ctx.lineWidth = 4 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(playerH * 0.15, -playerH * 0.68 + liftY);
    ctx.lineTo(playerH * 0.75, -playerH * 0.68 + liftY); // Extended outward
    ctx.stroke();

    // Hand extremity with glowing impact ring
    const handX = playerH * 0.76;
    const handY = -playerH * 0.68 + liftY;
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(handX, handY, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Glowing impact ring
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(handX, handY, 7 * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(handX, handY, 11 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Squad number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, Math.floor(playerH * 0.22))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.number}`, 0, -playerH * 0.55 + liftY);
  } else if (isHeading) {
    // Attacker leaning forward mid-air heading ball
    const liftY = -playerH * 0.2;
    ctx.rotate(0.2); // Forward thrust

    // Torso
    ctx.fillStyle = primaryKit;
    ctx.fillRect(-playerH * 0.18, -playerH * 0.75 + liftY, playerH * 0.36, playerH * 0.45);

    // Shorts
    ctx.fillStyle = shortKit;
    ctx.fillRect(-playerH * 0.16, -playerH * 0.35 + liftY, playerH * 0.32, playerH * 0.2);

    // Legs
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-playerH * 0.14, -playerH * 0.18 + liftY, playerH * 0.1, playerH * 0.18);
    ctx.fillRect(playerH * 0.04, -playerH * 0.18 + liftY, playerH * 0.1, playerH * 0.18);

    // Head thrust forward towards ball
    ctx.beginPath();
    ctx.arc(playerH * 0.12, -playerH * 0.88 + liftY, playerH * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Squad number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, Math.floor(playerH * 0.22))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.number}`, 0, -playerH * 0.55 + liftY);
  } else {
    // Normal standing/running player
    ctx.fillStyle = primaryKit;
    ctx.fillRect(-playerH * 0.18, -playerH * 0.75, playerH * 0.36, playerH * 0.45);

    ctx.fillStyle = shortKit;
    ctx.fillRect(-playerH * 0.16, -playerH * 0.35, playerH * 0.32, playerH * 0.2);

    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-playerH * 0.14, -playerH * 0.18, playerH * 0.1, playerH * 0.18);
    ctx.fillRect(playerH * 0.04, -playerH * 0.18, playerH * 0.1, playerH * 0.18);

    ctx.beginPath();
    ctx.arc(0, -playerH * 0.86, playerH * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, Math.floor(playerH * 0.22))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.number}`, 0, -playerH * 0.55);
  }

  ctx.restore();

  // FIFA SAOT 29-Point Limb Tracking Skeletal Wireframes
  if (saot?.show29PointLimbMesh) {
    render29PointSkeletalMesh(ctx, persp, player, w, h, saot);
  }
}

function renderBall(ctx: CanvasRenderingContext2D, persp: any, ball: any, w: number, h: number) {
  const groundPos = persp.project(ball.x, ball.y, 0, w, h);
  const airPos = persp.project(ball.x, ball.y, ball.z, w, h);
  const scale = airPos.scale;
  const radius = Math.max(3.5, 5.5 * scale);

  const shadowDist = Math.hypot(groundPos.x - airPos.x, groundPos.y - airPos.y);
  const shadowAlpha = Math.max(0.1, 0.45 - shadowDist * 0.005);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(groundPos.x, groundPos.y, radius * 1.2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(airPos.x, airPos.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(airPos.x, airPos.y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

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

function renderSaotCrosshairs(ctx: CanvasRenderingContext2D, persp: any, saot: SaotState, w: number, h: number) {
  const defGrass = persp.project(saot.defender.pitchX, saot.defender.pitchY, 0, w, h);
  const defBody = persp.project(saot.defender.pitchX, saot.defender.pitchY, saot.defender.heightAboveGrassM || 1.35, w, h);

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(defGrass.x, defGrass.y);
  ctx.lineTo(defBody.x, defBody.y);
  ctx.stroke();

  drawCrosshair(ctx, defBody.x, defBody.y, '#38BDF8', `DEF (${saot.defender.pitchX.toFixed(2)}m)`);

  const attGrass = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, 0, w, h);
  const attBody = persp.project(saot.attacker.pitchX, saot.attacker.pitchY, saot.attacker.heightAboveGrassM || 1.45, w, h);

  const attColor = saot.deltaCm > 0 ? '#EF4444' : '#10B981';
  ctx.strokeStyle = attColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(attGrass.x, attGrass.y);
  ctx.lineTo(attBody.x, attBody.y);
  ctx.stroke();

  drawCrosshair(ctx, attBody.x, attBody.y, attColor, `ATT (${saot.deltaCm > 0 ? '+' : ''}${saot.deltaCm.toFixed(1)}cm)`);
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
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

function renderRadarMinimap(ctx: CanvasRenderingContext2D, state: any, saot: SaotState, w: number, h: number) {
  const mapW = 160;
  const mapH = 100;
  const mx = w - mapW - 16;
  const my = h - mapH - 16;

  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
  ctx.fillRect(mx, my, mapW, mapH);
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mapW, mapH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  const pitchLeft = mx + 10;
  const pitchTop = my + 10;
  const pitchW = mapW - 20;
  const pitchH = mapH - 20;
  ctx.strokeRect(pitchLeft, pitchTop, pitchW, pitchH);

  const toMapX = (px: number) => pitchLeft + ((px - 52.5) / 52.5) * pitchW;
  const toMapY = (py: number) => pitchTop + (py / 68.0) * pitchH;

  const defMapX = toMapX(saot.defender.pitchX);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(defMapX, pitchTop);
  ctx.lineTo(defMapX, pitchTop + pitchH);
  ctx.stroke();

  const attMapX = toMapX(saot.attacker.pitchX);
  ctx.strokeStyle = saot.deltaCm > 0 ? '#EF4444' : '#10B981';
  ctx.beginPath();
  ctx.moveTo(attMapX, pitchTop);
  ctx.lineTo(attMapX, pitchTop + pitchH);
  ctx.stroke();

  state.players.forEach((p: any) => {
    ctx.fillStyle = p.team === 'ATTACKER' ? '#EF4444' : p.team === 'DEFENDER' ? '#38BDF8' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(toMapX(p.pitchX), toMapY(p.pitchY), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '8px monospace';
  ctx.fillText('2D SAOT RADAR', mx + 8, my + 8);
}

/**
 * FIFA SAOT 3D Virtual Offside Curtain (Vertical Holographic Wall)
 * Renders a translucent vertical plane rising 2.8m above the turf along the 2nd-last defender's line.
 * If attacker is in an offside position (deltaCm > 0), the volume between defender and attacker
 * is rendered as an extruded offside warning corridor with delta depth callouts.
 */
function renderSaot3DCurtain(
  ctx: CanvasRenderingContext2D,
  persp: any,
  saot: SaotState,
  w: number,
  h: number
) {
  const defX = saot.defender.pitchX;
  const attX = saot.attacker.pitchX;
  const isOffside = saot.deltaCm > 0;

  // Defender 3D Virtual Curtain
  const pB0 = persp.project(defX, 0, 0, w, h);
  const pB68 = persp.project(defX, 68, 0, w, h);
  const pT68 = persp.project(defX, 68, 2.8, w, h);
  const pT0 = persp.project(defX, 0, 2.8, w, h);

  // Holographic Translucent Fill
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

  // Top edge cyan laser beam
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pT0.x, pT0.y);
  ctx.lineTo(pT68.x, pT68.y);
  ctx.stroke();

  // Vertical holographic grid lines every 4m across the pitch width
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1;
  for (let gy = 0; gy <= 68; gy += 4) {
    const b = persp.project(defX, gy, 0, w, h);
    const t = persp.project(defX, gy, 2.8, w, h);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }

  // Horizontal altitude elevation lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  for (const gz of [0.5, 1.0, 1.5, 2.0, 2.5]) {
    const p1 = persp.project(defX, 0, gz, w, h);
    const p2 = persp.project(defX, 68, gz, w, h);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Offside Extrusion Zone (if attacker penetrates through the curtain)
  if (isOffside) {
    const aB0 = persp.project(attX, 0, 0, w, h);
    const aB68 = persp.project(attX, 68, 0, w, h);
    const aT68 = persp.project(attX, 68, 2.8, w, h);
    const aT0 = persp.project(attX, 0, 2.8, w, h);

    // Turf penetration shadow
    ctx.fillStyle = 'rgba(239, 68, 68, 0.20)';
    ctx.beginPath();
    ctx.moveTo(pB0.x, pB0.y);
    ctx.lineTo(aB0.x, aB0.y);
    ctx.lineTo(aB68.x, aB68.y);
    ctx.lineTo(pB68.x, pB68.y);
    ctx.closePath();
    ctx.fill();

    // Attacker penetrating red curtain
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

    // Red top laser beam
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(aT0.x, aT0.y);
    ctx.lineTo(aT68.x, aT68.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Holographic Banner in 3D Space
  const midY = (saot.defender.pitchY + saot.attacker.pitchY) / 2 || 34;
  const tagPos = persp.project(defX, midY, 2.9, w, h);
  ctx.save();
  ctx.font = 'bold 9px monospace';
  const tagText = `FIFA SAOT VIRTUAL OFFSIDE CURTAIN • ${
    isOffside ? `OFFSIDE (+${saot.deltaCm.toFixed(1)}cm)` : `ONSIDE (${saot.deltaCm.toFixed(1)}cm)`
  }`;
  const tw = ctx.measureText(tagText).width;
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
  ctx.strokeStyle = isOffside ? '#EF4444' : '#38BDF8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tagPos.x - tw / 2 - 8, tagPos.y - 10, tw + 16, 18, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isOffside ? '#FCA5A5' : '#38BDF8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, tagPos.x, tagPos.y);
  ctx.restore();
}

/**
 * FIFA SAOT 29-Point Anatomical Limb Tracking Wireframe
 * Renders the 29 optical skeleton keypoints and bones with IFAB Law 11 body part indicators.
 */
function render29PointSkeletalMesh(
  ctx: CanvasRenderingContext2D,
  persp: any,
  player: any,
  w: number,
  h: number,
  saot: SaotState
) {
  const x = player.pitchX;
  const y = player.pitchY;
  const z = player.z || 0;
  const isAttacker = player.team === 'ATTACKER';
  const isDefender = player.team === 'DEFENDER';

  // Only render full 29-pt mesh for key involved players
  if (!isAttacker && !isDefender && player.team !== 'GOALKEEPER') return;

  const isLunge = player.actionState === 'LUNGING_STUDS_UP';
  const isArmExt = player.actionState === 'ARM_EXTENDED';
  const isHeading = player.actionState === 'HEADING';
  const isFallen = player.actionState === 'FALLEN';

  // Compute 29 metric keypoints
  const kHeadTop = { x, y, z: 1.86 + z };
  const kNose = { x: x + (isHeading ? 0.22 : 0.08), y, z: 1.74 + z };
  const kEyeL = { x: x + 0.07, y: y - 0.04, z: 1.76 + z };
  const kEyeR = { x: x + 0.07, y: y + 0.04, z: 1.76 + z };
  const kEarL = { x: x - 0.02, y: y - 0.07, z: 1.74 + z };
  const kEarR = { x: x - 0.02, y: y + 0.07, z: 1.74 + z };

  const kNeck = { x: x + (isHeading ? 0.15 : 0), y, z: 1.58 + z };
  const kChest = { x: x + (isHeading ? 0.12 : 0.03), y, z: 1.40 + z };
  const kCog = { x, y, z: 1.15 + z };
  const kPelvis = { x, y, z: 0.96 + z };
  const kTorsoLat = { x: x - 0.04, y: y - 0.18, z: 1.25 + z };

  const kShL = { x: x - 0.03, y: y - 0.22, z: 1.46 + z };
  const kShR = { x: x + 0.03, y: y + 0.22, z: 1.46 + z };

  let kElL, kWrL, kHandL;
  let kElR, kWrR, kHandR;

  if (isArmExt) {
    kElR = { x: x + 0.35, y: y + 0.45, z: 1.46 + z };
    kWrR = { x: x + 0.65, y: y + 0.68, z: 1.46 + z };
    kHandR = { x: x + 0.78, y: y + 0.75, z: 1.46 + z };
    kElL = { x: x - 0.15, y: y - 0.32, z: 1.25 + z };
    kWrL = { x: x - 0.22, y: y - 0.38, z: 1.05 + z };
    kHandL = { x: x - 0.26, y: y - 0.42, z: 0.95 + z };
  } else {
    kElL = { x: x - 0.18, y: y - 0.28, z: 1.22 + z };
    kWrL = { x: x + 0.12, y: y - 0.30, z: 1.08 + z };
    kHandL = { x: x + 0.22, y: y - 0.30, z: 1.04 + z };
    kElR = { x: x + 0.18, y: y + 0.28, z: 1.22 + z };
    kWrR = { x: x - 0.12, y: y + 0.30, z: 1.08 + z };
    kHandR = { x: x - 0.22, y: y + 0.30, z: 1.04 + z };
  }

  const kHipL = { x: x - 0.02, y: y - 0.16, z: 0.94 + z };
  const kHipR = { x: x + 0.02, y: y + 0.16, z: 0.94 + z };

  let kKneeL, kAnkL, kHeelL, kToeL;
  let kKneeR, kAnkR, kHeelR, kToeR;

  if (isLunge) {
    kKneeR = { x: x + 0.55, y: y + 0.08, z: 0.52 + z };
    kAnkR = { x: x + 1.05, y: y + 0.05, z: 0.25 + z };
    kHeelR = { x: x + 1.00, y: y + 0.05, z: 0.26 + z };
    kToeR = { x: x + 1.18, y: y + 0.05, z: 0.22 + z };
    kKneeL = { x: x - 0.35, y: y - 0.18, z: 0.30 + z };
    kAnkL = { x: x - 0.75, y: y - 0.20, z: 0.12 + z };
    kHeelL = { x: x - 0.72, y: y - 0.20, z: 0.14 + z };
    kToeL = { x: x - 0.85, y: y - 0.20, z: 0.08 + z };
  } else if (isFallen) {
    kKneeR = { x: x + 0.25, y: y + 0.10, z: 0.15 };
    kAnkR = { x: x + 0.45, y: y + 0.10, z: 0.08 };
    kHeelR = { x: x + 0.42, y: y + 0.10, z: 0.08 };
    kToeR = { x: x + 0.52, y: y + 0.10, z: 0.08 };
    kKneeL = { x: x + 0.15, y: y - 0.10, z: 0.15 };
    kAnkL = { x: x + 0.35, y: y - 0.10, z: 0.08 };
    kHeelL = { x: x + 0.32, y: y - 0.10, z: 0.08 };
    kToeL = { x: x + 0.42, y: y - 0.10, z: 0.08 };
  } else {
    kKneeR = { x: x + 0.28, y: y + 0.12, z: 0.56 + z };
    kAnkR = { x: x + 0.36, y: y + 0.10, z: 0.18 + z };
    kHeelR = { x: x + 0.30, y: y + 0.10, z: 0.20 + z };
    kToeR = { x: x + 0.46, y: y + 0.10, z: 0.12 + z };
    kKneeL = { x: x - 0.24, y: y - 0.12, z: 0.52 + z };
    kAnkL = { x: x - 0.32, y: y - 0.10, z: 0.20 + z };
    kHeelL = { x: x - 0.28, y: y - 0.10, z: 0.22 + z };
    kToeL = { x: x - 0.40, y: y - 0.10, z: 0.14 + z };
  }

  // Project 29 landmarks to screen coordinates
  const pts: Record<string, { x: number; y: number; isPlayable: boolean }> = {
    headTop: { ...persp.project(kHeadTop.x, kHeadTop.y, kHeadTop.z, w, h), isPlayable: true },
    nose: { ...persp.project(kNose.x, kNose.y, kNose.z, w, h), isPlayable: true },
    eyeL: { ...persp.project(kEyeL.x, kEyeL.y, kEyeL.z, w, h), isPlayable: true },
    eyeR: { ...persp.project(kEyeR.x, kEyeR.y, kEyeR.z, w, h), isPlayable: true },
    earL: { ...persp.project(kEarL.x, kEarL.y, kEarL.z, w, h), isPlayable: true },
    earR: { ...persp.project(kEarR.x, kEarR.y, kEarR.z, w, h), isPlayable: true },
    neck: { ...persp.project(kNeck.x, kNeck.y, kNeck.z, w, h), isPlayable: true },
    chest: { ...persp.project(kChest.x, kChest.y, kChest.z, w, h), isPlayable: true },
    cog: { ...persp.project(kCog.x, kCog.y, kCog.z, w, h), isPlayable: true },
    pelvis: { ...persp.project(kPelvis.x, kPelvis.y, kPelvis.z, w, h), isPlayable: true },
    torsoLat: { ...persp.project(kTorsoLat.x, kTorsoLat.y, kTorsoLat.z, w, h), isPlayable: true },
    shL: { ...persp.project(kShL.x, kShL.y, kShL.z, w, h), isPlayable: true },
    shR: { ...persp.project(kShR.x, kShR.y, kShR.z, w, h), isPlayable: true },
    elL: { ...persp.project(kElL.x, kElL.y, kElL.z, w, h), isPlayable: false },
    wrL: { ...persp.project(kWrL.x, kWrL.y, kWrL.z, w, h), isPlayable: false },
    handL: { ...persp.project(kHandL.x, kHandL.y, kHandL.z, w, h), isPlayable: false },
    elR: { ...persp.project(kElR.x, kElR.y, kElR.z, w, h), isPlayable: false },
    wrR: { ...persp.project(kWrR.x, kWrR.y, kWrR.z, w, h), isPlayable: false },
    handR: { ...persp.project(kHandR.x, kHandR.y, kHandR.z, w, h), isPlayable: false },
    hipL: { ...persp.project(kHipL.x, kHipL.y, kHipL.z, w, h), isPlayable: true },
    hipR: { ...persp.project(kHipR.x, kHipR.y, kHipR.z, w, h), isPlayable: true },
    kneeL: { ...persp.project(kKneeL.x, kKneeL.y, kKneeL.z, w, h), isPlayable: true },
    kneeR: { ...persp.project(kKneeR.x, kKneeR.y, kKneeR.z, w, h), isPlayable: true },
    ankL: { ...persp.project(kAnkL.x, kAnkL.y, kAnkL.z, w, h), isPlayable: true },
    ankR: { ...persp.project(kAnkR.x, kAnkR.y, kAnkR.z, w, h), isPlayable: true },
    heelL: { ...persp.project(kHeelL.x, kHeelL.y, kHeelL.z, w, h), isPlayable: true },
    heelR: { ...persp.project(kHeelR.x, kHeelR.y, kHeelR.z, w, h), isPlayable: true },
    toeL: { ...persp.project(kToeL.x, kToeL.y, kToeL.z, w, h), isPlayable: true },
    toeR: { ...persp.project(kToeR.x, kToeR.y, kToeR.z, w, h), isPlayable: true },
  };

  const boneColor = isAttacker ? '#F97316' : '#38BDF8';
  const armColor = 'rgba(156, 163, 175, 0.4)';

  const playableBones = [
    ['headTop', 'nose'],
    ['nose', 'eyeL'],
    ['nose', 'eyeR'],
    ['eyeL', 'earL'],
    ['eyeR', 'earR'],
    ['nose', 'neck'],
    ['neck', 'chest'],
    ['chest', 'cog'],
    ['cog', 'pelvis'],
    ['chest', 'shL'],
    ['chest', 'shR'],
    ['shL', 'torsoLat'],
    ['torsoLat', 'hipL'],
    ['shR', 'hipR'],
    ['pelvis', 'hipL'],
    ['pelvis', 'hipR'],
    ['hipL', 'kneeL'],
    ['kneeL', 'ankL'],
    ['ankL', 'heelL'],
    ['heelL', 'toeL'],
    ['ankL', 'toeL'],
    ['hipR', 'kneeR'],
    ['kneeR', 'ankR'],
    ['ankR', 'heelR'],
    ['heelR', 'toeR'],
    ['ankR', 'toeR'],
  ];

  const armBones = [
    ['shL', 'elL'],
    ['elL', 'wrL'],
    ['wrL', 'handL'],
    ['shR', 'elR'],
    ['elR', 'wrR'],
    ['wrR', 'handR'],
  ];

  ctx.save();

  // Draw playable bones
  ctx.strokeStyle = boneColor;
  ctx.lineWidth = 1.8;
  playableBones.forEach(([p1, p2]) => {
    const pt1 = pts[p1];
    const pt2 = pts[p2];
    if (pt1 && pt2) {
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }
  });

  // Draw arm bones (dashed indicating excluded for Law 11 offside)
  ctx.strokeStyle = armColor;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  armBones.forEach(([p1, p2]) => {
    const pt1 = pts[p1];
    const pt2 = pts[p2];
    if (pt1 && pt2) {
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]);

  // Draw 29 joint nodes
  Object.entries(pts).forEach(([name, pt]) => {
    ctx.beginPath();
    if (pt.isPlayable) {
      ctx.fillStyle = boneColor;
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      if (['headTop', 'toeR', 'toeL', 'kneeR', 'shR'].includes(name)) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#9CA3AF';
      ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
}

/**
 * 500Hz Connected Ball Inertial Sensor (IMU) HUD Waveform
 * Renders the real-time Adidas CTR-CORE accelerometer curve with contact spike detection.
 */
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

  // Panel background
  ctx.fillStyle = 'rgba(11, 15, 25, 0.94)';
  ctx.strokeStyle = imu.isContactActive ? '#F59E0B' : '#1F2937';
  ctx.lineWidth = imu.isContactActive ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  // Header Title
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

  // Waveform graph area
  const gx = boxX + 10;
  const gy = boxY + 24;
  const gw = boxW - 20;
  const gh = boxH - 52;

  ctx.fillStyle = '#070B12';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = 'rgba(31, 41, 55, 0.7)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(gx, gy, gw, gh);

  // Horizontal G-force threshold lines (10G, 25G, 40G)
  const maxG = 50.0;
  [10, 25, 40].forEach((gVal) => {
    const ly = gy + gh - (gVal / maxG) * gh;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(gx, ly);
    ctx.lineTo(gx + gw, ly);
    ctx.stroke();

    ctx.fillStyle = '#6B7280';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${gVal}G`, gx + 2, ly - 2);
  });

  // Plot Samples
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

    // Draw Peak contact spike ring
    const peakSample = imu.samples.find((s) => s.accelG >= imu.peakAccelG * 0.95);
    if (peakSample) {
      const px = gx + ((peakSample.frame - firstF) / fRange) * gw;
      const py = gy + gh - Math.min(gh, (peakSample.accelG / maxG) * gh);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${imu.peakAccelG.toFixed(1)}G`, px, py - 6);
    }

    // Scrubber Needle for current frame
    const curX = gx + ((frame - firstF) / fRange) * gw;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(curX, gy);
    ctx.lineTo(curX, gy + gh);
    ctx.stroke();
  }

  // Footer status row
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
