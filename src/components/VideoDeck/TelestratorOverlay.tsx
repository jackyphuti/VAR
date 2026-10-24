import React, { useRef, useState, useEffect } from 'react';
import { TelestratorTool, TelestratorDrawing } from '../../types/var';
import {
  PenTool,
  MoveRight,
  Circle,
  Maximize2,
  RotateCcw,
  Trash2,
  Compass,
  Palette,
} from 'lucide-react';

interface TelestratorOverlayProps {
  isActive: boolean;
  onToggleActive: () => void;
  primaryCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

const COLORS = ['#38BDF8', '#EF4444', '#10B981', '#F59E0B', '#FFFFFF'];

export const TelestratorOverlay: React.FC<TelestratorOverlayProps> = ({
  isActive,
  onToggleActive,
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTool, setActiveTool] = useState<TelestratorTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#38BDF8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [drawings, setDrawings] = useState<TelestratorDrawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<TelestratorDrawing | null>(null);

  // Magnifier Loupe state
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null);
  const [zoomFactor, setZoomFactor] = useState<number>(3);

  // Redraw all telestrator drawings on canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw all confirmed drawings
    drawings.forEach((d) => renderDrawing(ctx, d));

    // Draw active drawing in progress
    if (currentDrawing) {
      renderDrawing(ctx, currentDrawing);
    }

    // Render Loupe Magnifier if active
    if (activeTool === 'loupe' && loupePos) {
      renderLoupe(ctx, loupePos.x, loupePos.y, zoomFactor, rect.width, rect.height);
    }

    ctx.restore();
  }, [drawings, currentDrawing, activeTool, loupePos, zoomFactor, isActive]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'loupe') {
      setLoupePos({ x, y });
      return;
    }

    const newDrawing: TelestratorDrawing = {
      id: `draw_${Date.now()}`,
      type: activeTool as any,
      points: [{ x, y }],
      color: selectedColor,
      width: strokeWidth,
    };
    setCurrentDrawing(newDrawing);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'loupe') {
      setLoupePos({ x, y });
      return;
    }

    if (!currentDrawing) return;

    if (currentDrawing.type === 'pen') {
      setCurrentDrawing((prev) => (prev ? { ...prev, points: [...prev.points, { x, y }] } : null));
    } else if (currentDrawing.type === 'arrow' || currentDrawing.type === 'halo' || currentDrawing.type === 'protractor') {
      setCurrentDrawing((prev) => {
        if (!prev) return null;
        const p0 = prev.points[0];
        let angleDeg: number | undefined;
        let distanceM: number | undefined;

        if (prev.type === 'protractor') {
          const dx = x - p0.x;
          const dy = y - p0.y;
          angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
          if (angleDeg < 0) angleDeg += 360;
          distanceM = Number((Math.hypot(dx, dy) * 0.05).toFixed(2));
        }

        return {
          ...prev,
          points: [p0, { x, y }],
          angleDeg,
          distanceM,
        };
      });
    }
  };

  const handlePointerUp = () => {
    if (currentDrawing) {
      setDrawings((prev) => [...prev, currentDrawing]);
      setCurrentDrawing(null);
    }
  };

  const handleUndo = () => {
    setDrawings((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setDrawings([]);
    setCurrentDrawing(null);
  };

  return (
    <>
      {/* Telestrator Top Floating Toolbar */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1.5 bg-[#0B0F19]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1F2937] shadow-2xl text-xs">
        <button
          onClick={onToggleActive}
          className={`px-2 py-1 rounded font-bold transition flex items-center gap-1 ${
            isActive ? 'bg-sky-600 text-white shadow' : 'bg-[#1F2937] text-gray-300 hover:text-white'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>{isActive ? 'TELESTRATOR ON' : 'TELESTRATOR'}</span>
        </button>

        {isActive && (
          <>
            <div className="h-4 w-px bg-[#1F2937] mx-1" />

            {/* Tool Selection */}
            <button
              onClick={() => setActiveTool('pen')}
              title="Freehand Tactical Pen"
              className={`p-1.5 rounded ${
                activeTool === 'pen' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveTool('arrow')}
              title="Pass / Movement Direction Arrow"
              className={`p-1.5 rounded ${
                activeTool === 'arrow' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <MoveRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveTool('halo')}
              title="Player Spotlight Halo Ring"
              className={`p-1.5 rounded ${
                activeTool === 'halo' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveTool('protractor')}
              title="Angle & Distance Protractor"
              className={`p-1.5 rounded ${
                activeTool === 'protractor' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveTool('loupe')}
              title="2x-4x Contact Zoom Loupe (Magnifier)"
              className={`p-1.5 rounded flex items-center gap-1 font-mono-telemetry ${
                activeTool === 'loupe' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{zoomFactor}x</span>
            </button>

            {activeTool === 'loupe' && (
              <select
                value={zoomFactor}
                onChange={(e) => setZoomFactor(Number(e.target.value))}
                className="bg-[#1F2937] border border-[#374151] rounded text-[10px] text-white px-1 py-0.5"
              >
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            )}

            <div className="h-4 w-px bg-[#1F2937] mx-1" />

            {/* Colors */}
            <div className="flex items-center space-x-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-3.5 h-3.5 rounded-full transition transform hover:scale-125 ${
                    selectedColor === c ? 'ring-2 ring-white scale-110' : ''
                  }`}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-[#1F2937] mx-1" />

            {/* Undo & Clear */}
            <button
              onClick={handleUndo}
              title="Undo last stroke"
              disabled={drawings.length === 0}
              className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClear}
              title="Clear all drawings"
              disabled={drawings.length === 0}
              className="p-1 rounded text-gray-400 hover:text-red-400 disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Overlay Canvas for pointer capture and drawing */}
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`absolute inset-0 z-20 w-full h-full ${
          isActive
            ? activeTool === 'loupe'
              ? 'cursor-none pointer-events-auto'
              : 'cursor-crosshair pointer-events-auto'
            : 'pointer-events-none'
        }`}
      />
    </>
  );
};

function renderDrawing(ctx: CanvasRenderingContext2D, d: TelestratorDrawing) {
  if (d.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = d.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (d.type === 'pen') {
    ctx.beginPath();
    ctx.moveTo(d.points[0].x, d.points[0].y);
    for (let i = 1; i < d.points.length; i++) {
      ctx.lineTo(d.points[i].x, d.points[i].y);
    }
    ctx.stroke();
  } else if (d.type === 'arrow' && d.points.length >= 2) {
    const p1 = d.points[0];
    const p2 = d.points[1];
    drawArrow(ctx, p1.x, p1.y, p2.x, p2.y, d.width, d.color);
  } else if (d.type === 'halo' && d.points.length >= 2) {
    const p1 = d.points[0];
    const p2 = d.points[1];
    const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    // Glowing spotlight halo
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `${d.color}25`;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.type === 'protractor' && d.points.length >= 2) {
    const p1 = d.points[0];
    const p2 = d.points[1];

    // Measure line
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Measurement badge
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const label = `${d.angleDeg || 0}° | ${d.distanceM || 0}m`;

    ctx.font = 'bold 11px monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
    ctx.fillRect(midX - tw / 2 - 6, midY - 18, tw + 12, 18);
    ctx.strokeRect(midX - tw / 2 - 6, midY - 18, tw + 12, 18);

    ctx.fillStyle = d.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY - 9);
  }

  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  color: string
) {
  const headlen = 14;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function renderLoupe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  w: number,
  h: number
) {
  const radius = 64;

  ctx.save();
  // Outer metallic lens rim
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair in center of lens
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx, cy + 16);
  ctx.stroke();

  // Telemetry badge under loupe
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
  ctx.fillRect(cx - 30, cy + radius + 4, 60, 14);
  ctx.fillStyle = '#38BDF8';
  ctx.textAlign = 'center';
  ctx.fillText(`LOUPE ${zoom}x`, cx, cy + radius + 14);

  ctx.restore();
}
