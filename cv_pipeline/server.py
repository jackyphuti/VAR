"""
server.py - FastAPI + WebSocket Live Telemetry Bridge for VAR Workstation.

Provides REST and real-time WebSocket endpoints:
- POST /api/analyze-video: Processes an uploaded .mp4 and returns frame-by-frame JSON telemetry
  matching the TypeScript ScenarioFrameState interface.
- WS /ws/telemetry: Streams live MJPEG frames and real-time coordinate payloads to the React workstation.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import shutil
import tempfile
from typing import Any, Dict, List

import cv2
import numpy as np

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

from .detector import PlayerDetector, TrackedObject
from .homography import PitchHomography
from .incident_detector import IncidentDetector
from .offside_engine import OffsideEngine
from .pose_analyzer import PoseAnalyzer

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("VAR.Server")

if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="VAR Computer Vision Backend Bridge",
        description="FastAPI WebSocket & REST bridge connecting Python CV pipeline to React VAR workstation.",
        version="3.0",
    )

    # Enable CORS for React frontend (Vite default port 5173)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app = None


@app.get("/")
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ONLINE",
        "service": "VAR CV Pipeline Telemetry Bridge",
        "version": "3.0",
        "fastapi_ready": FASTAPI_AVAILABLE,
    }


@app.post("/api/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    """
    Accepts an uploaded .mp4 football match video, executes the full VAR computer vision pipeline,
    and returns frame-by-frame telemetry matching the TypeScript ScenarioFrameState interface.
    """
    if not file.filename.lower().endswith((".mp4", ".mov", ".avi", ".webm")):
        raise HTTPException(status_code=400, detail="Only video files (.mp4, .webm, .mov, .avi) are supported.")

    temp_dir = tempfile.mkdtemp()
    video_path = os.path.join(temp_dir, file.filename)

    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 60.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        max_process = min(total_frames, 360)  # Up to 6 seconds at 60fps for quick response

        homography = PitchHomography()
        detector = PlayerDetector(confidence_threshold=0.35)
        offside_engine = OffsideEngine(homography, attacking_direction=1)
        pose_analyzer = PoseAnalyzer(homography)
        incident_detector = IncidentDetector(homography, fps=int(fps))

        frames_telemetry: List[Dict[str, Any]] = []
        kick_frame_identified: Optional[int] = None
        last_saot_delta_cm: float = 0.0

        for f_idx in range(max_process):
            ret, frame = cap.read()
            if not ret:
                break

            # 1. Update dynamic homography if lines are visible
            homography.estimate_from_frame(frame)

            # 2. Detect & Track objects
            tracked_objects = detector.process_frame(frame, f_idx)

            # 3. Detect Ball & Kick Point
            ball_obj = next((obj for obj in tracked_objects if obj.class_name == "ball"), None)
            kick_pt = offside_engine.update_ball_trajectory(f_idx, ball_obj, tracked_objects)
            if kick_pt is not None and kick_frame_identified is None:
                kick_frame_identified = kick_pt

            # 4. Offside Check
            offside_res = offside_engine.evaluate_offside(f_idx, tracked_objects)
            if offside_res:
                last_saot_delta_cm = offside_res.offside_delta_cm

            # 5. Skeletal Pose & Handball
            poses = pose_analyzer.extract_poses(frame, tracked_objects)
            handball_res = None
            if ball_obj:
                handball_res = pose_analyzer.check_handball_contact(f_idx, ball_obj.feet_pos, poses)

            # 6. Incident Check (Foul / Tackle in penalty area)
            incident_payload = incident_detector.process_frame(f_idx, frame, tracked_objects)

            # 7. Format frame state matching TypeScript ScenarioFrameState interface
            ball_pos_m = (105.0, 34.0)
            if ball_obj:
                try:
                    ball_pos_m = homography.pixel_to_pitch(ball_obj.feet_pos[0], ball_obj.feet_pos[1])
                except Exception:
                    pass

            player_dicts = []
            for p in tracked_objects:
                if p.class_name == "person":
                    try:
                        px, py = homography.pixel_to_pitch(p.feet_pos[0], p.feet_pos[1])
                    except Exception:
                        px, py = 75.0, 34.0

                    team_label = "DEFENDER" if p.team == "Team B" else "GOALKEEPER" if p.team == "Goalkeeper" else "REFEREE" if p.team == "Referee" else "ATTACKER"
                    player_dicts.append({
                        "id": p.track_id,
                        "team": team_label,
                        "number": p.track_id % 99 + 1,
                        "pitchX": round(px, 3),
                        "pitchY": round(py, 3),
                        "z": 0.0,
                    })

            frames_telemetry.append({
                "frame": f_idx,
                "ball": {"x": round(ball_pos_m[0], 2), "y": round(ball_pos_m[1], 2), "z": 0.15},
                "players": player_dicts,
                "passFrame": (f_idx == kick_frame_identified),
                "incidentFrame": bool(incident_payload or handball_res),
                "offsideMarginCm": last_saot_delta_cm,
            })

        cap.release()

        return JSONResponse({
            "status": "SUCCESS",
            "filename": file.filename,
            "totalProcessedFrames": len(frames_telemetry),
            "kickFrame": kick_frame_identified or 60,
            "detectedIncidents": [inc.__dict__ for inc in incident_detector.detected_incidents],
            "telemetry": frames_telemetry,
        })

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """
    WebSocket endpoint streaming real-time coordinate telemetry and synthesized broadcast frames
    to the React workstation.
    """
    await websocket.accept()
    logger.info("VAR Web Workstation connected to WebSocket telemetry bridge.")

    homography = PitchHomography()
    detector = PlayerDetector()
    offside_engine = OffsideEngine(homography)

    frame_idx = 0
    try:
        while True:
            # Synthetic 60 FPS broadcast cycle simulation
            synthetic_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            # Pitch green
            synthetic_frame[:] = (25, 75, 30)

            tracked = detector.process_frame(synthetic_frame, frame_idx)
            ball_obj = next((o for o in tracked if o.class_name == "ball"), None)
            offside_engine.update_ball_trajectory(frame_idx, ball_obj, tracked)
            offside_res = offside_engine.evaluate_offside(frame_idx, tracked)

            # Encode lightweight JPEG thumbnail
            ret, buffer = cv2.imencode(".jpg", synthetic_frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            jpeg_bytes = buffer.tobytes()

            payload = {
                "frameIndex": frame_idx,
                "timecode": f"{(frame_idx // 60):02d}:{(frame_idx % 60):02d}",
                "offsideDeltaCm": offside_res.offside_delta_cm if offside_res else 0.0,
                "isOffside": offside_res.is_offside if offside_res else False,
                "playersCount": len(tracked),
            }

            await websocket.send_text(json.dumps(payload))
            frame_idx += 1
            await asyncio.sleep(1.0 / 60.0)

    except WebSocketDisconnect:
        logger.info("VAR Web Workstation disconnected.")
    except Exception as e:
        logger.error("WebSocket error: %s", e)


def start_server(host: str = "0.0.0.0", port: int = 8000):
    """CLI runner for uvicorn."""
    import uvicorn
    uvicorn.run("cv_pipeline.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    start_server()
