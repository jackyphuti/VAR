"""
main.py - Main CLI entry point for the Automated VAR Computer Vision Pipeline.

Usage:
    python -m cv_pipeline.main --source match_clip.mp4 --output var_output.mp4
    python -m cv_pipeline.main --synthetic --output synthetic_var_output.mp4
    python -m cv_pipeline.main --server --port 8000
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Optional

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
import numpy as np

from .detector import PlayerDetector, TrackedObject
from .homography import PitchHomography
from .incident_detector import IncidentDetector
from .offside_engine import OffsideEngine
from .pose_analyzer import PoseAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("VAR.Main")


def generate_synthetic_frame(frame_idx: int, width: int = 1920, height: int = 1080) -> np.ndarray:
    """Generates a realistic broadcast-style pitch perspective frame for demo/testing."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)

    # Pitch green gradient
    for y in range(height):
        ratio = y / height
        g = int(70 + 35 * ratio)
        b = int(25 + 15 * ratio)
        r = int(20 + 10 * ratio)
        frame[y, :] = (b, g, r)

    # White pitch boundary lines with perspective
    pts_pitch = np.array([
        [260, 320],
        [1660, 330],
        [1880, 980],
        [80, 960],
    ], np.int32)
    cv2.polylines(frame, [pts_pitch], isClosed=True, color=(240, 240, 240), thickness=3, lineType=cv2.LINE_AA)

    # Penalty box perspective
    pts_box = np.array([
        [1220, 325],
        [1660, 330],
        [1880, 980],
        [1120, 970],
    ], np.int32)
    cv2.polylines(frame, [pts_box], isClosed=True, color=(240, 240, 240), thickness=2, lineType=cv2.LINE_AA)

    # Penalty spot
    cv2.circle(frame, (1480, 650), 4, (245, 245, 245), -1, cv2.LINE_AA)

    # Goal line right
    cv2.line(frame, (1660, 330), (1880, 980), (255, 255, 255), 4, cv2.LINE_AA)

    # Timestamp & camera HUD
    cv2.putText(frame, f"CAM-01 [MAIN WIDE] | F: {frame_idx:05d} | 59.94 FPS", (40, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2, cv2.LINE_AA)

    return frame


def run_pipeline(
    source_path: Optional[str],
    output_path: str,
    device: str = "cpu",
    is_synthetic: bool = False,
    max_frames: int = 300,
) -> None:
    """Executes the VAR computer vision processing pipeline on video footage."""
    logger.info("Initializing Automated Football VAR Pipeline v3.0...")

    homography = PitchHomography()
    detector = PlayerDetector(confidence_threshold=0.35, device=device)
    offside_engine = OffsideEngine(homography, attacking_direction=1, attacking_team="Team A", defending_team="Team B")
    pose_analyzer = PoseAnalyzer(homography, device=device)
    incident_detector = IncidentDetector(homography, fps=60, output_dir="./var_incidents")

    if is_synthetic or source_path is None:
        logger.info("Running synthetic broadcast simulation (%d frames)...", max_frames)
        cap = None
        width, height, fps = 1920, 1080, 60.0
        total_frames = max_frames
    else:
        logger.info("Opening video source: %s", source_path)
        cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            logger.error("Failed to open source video %s. Falling back to synthetic simulation.", source_path)
            cap = None
            width, height, fps = 1920, 1080, 60.0
            total_frames = max_frames
        else:
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 60.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_idx = 0
    start_time = time.time()
    last_offside_result = None

    try:
        while frame_idx < total_frames:
            if cap is not None:
                ret, frame = cap.read()
                if not ret:
                    break
            else:
                frame = generate_synthetic_frame(frame_idx, width, height)

            # 1. Automatic White-Line & Keypoint Homography Updating
            homography.estimate_from_frame(frame)

            # 2. Detect & Track Objects (with circular HSV and outlier rejection)
            tracked_objects = detector.process_frame(frame, frame_idx)

            # 3. Track Ball & Kick Point Detection with player proximity check
            ball_obj = next((obj for obj in tracked_objects if obj.class_name == "ball"), None)
            kick_frame = offside_engine.update_ball_trajectory(frame_idx, ball_obj, tracked_objects)

            # 4. Offside Check (with 3-second locked pass frame hold)
            offside_res = offside_engine.evaluate_offside(frame_idx, tracked_objects)
            if offside_res is not None:
                last_offside_result = offside_res

            # 5. Skeletal Pose & Law 12 Handball Silhouette Analysis
            poses = pose_analyzer.extract_poses(frame, tracked_objects)
            handball_event = None
            if ball_obj:
                handball_event = pose_analyzer.check_handball_contact(frame_idx, ball_obj.feet_pos, poses)

            # 6. Penalty / Contact Incident Trigger
            incident_payload = incident_detector.process_frame(frame_idx, frame, tracked_objects)

            # 7. Visual Render
            display_frame = frame.copy()

            for obj in tracked_objects:
                x1, y1, x2, y2 = [int(v) for v in obj.bbox]
                if obj.class_name == "ball":
                    cv2.circle(display_frame, (int((x1 + x2) / 2), int((y1 + y2) / 2)), 7, (0, 255, 255), -1)
                else:
                    color = (255, 100, 50) if obj.team == "Team B" else (50, 100, 255)
                    cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                    label = f"#{obj.track_id} {obj.team or ''}"
                    cv2.putText(display_frame, label, (x1, max(15, y1 - 6)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

            # Render SAOT Overlay if available
            if last_offside_result is not None:
                display_frame = offside_engine.draw_offside_overlay(display_frame, last_offside_result)

            # Render Handball alert if detected
            if handball_event:
                cv2.putText(display_frame, f"HANDBALL ALERT: {handball_event.arm_involved} ({handball_event.silhouette_angle_deg:.1f} DEG)",
                            (width // 2 - 300, 85), cv2.FONT_HERSHEY_DUPLEX, 0.8, (0, 0, 255), 2)

            # Render top bar status
            status_text = "VAR STATUS: MONITORING (ALL FEEDS ACTIVE)"
            if last_offside_result and last_offside_result.is_offside:
                status_text = f"VAR REVIEW: POSSIBLE OFFSIDE (+{last_offside_result.offside_delta_cm}cm)"
            cv2.putText(display_frame, status_text, (width // 2 - 250, 45),
                        cv2.FONT_HERSHEY_DUPLEX, 0.7, (0, 255, 255), 2)

            out.write(display_frame)
            frame_idx += 1

            if frame_idx % 60 == 0:
                elapsed = time.time() - start_time
                fps_proc = frame_idx / max(1e-3, elapsed)
                logger.info("Processed frame %d/%d (%.1f FPS)", frame_idx, total_frames, fps_proc)

    finally:
        if cap is not None:
            cap.release()
        out.release()
        logger.info("VAR Video Output written to %s (%d frames total).", output_path, frame_idx)


def main() -> None:
    """CLI Argument Parser."""
    parser = argparse.ArgumentParser(description="Automated Football VAR Computer Vision Pipeline v3.0")
    parser.add_argument("--source", type=str, default=None, help="Path to input match video (.mp4)")
    parser.add_argument("--output", type=str, default="var_output.mp4", help="Path to output annotated video (.mp4)")
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu', 'cuda', 'mps')")
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic match footage for testing")
    parser.add_argument("--frames", type=int, default=180, help="Number of frames to process in synthetic mode")
    parser.add_argument("--server", action="store_true", help="Launch FastAPI + WebSocket telemetry server")
    parser.add_argument("--port", type=int, default=8000, help="Port for FastAPI server (default: 8000)")

    args = parser.parse_args()

    if args.server:
        from .server import start_server
        start_server(port=args.port)
    else:
        run_pipeline(
            source_path=args.source,
            output_path=args.output,
            device=args.device,
            is_synthetic=args.synthetic or (args.source is None),
            max_frames=args.frames,
        )


if __name__ == "__main__":
    main()
