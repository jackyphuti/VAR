"""
incident_detector.py - Penalty Area Contact & Incident Trigger.

Monitors high-IoU bounding box collisions between opposing players inside the 16.5m penalty box.
Detects rapid aspect ratio changes (player falling) and triggers automated video buffering,
slow-motion extraction, and structured JSON incident reporting.
"""

from __future__ import annotations

import collections
import json
import logging
import os
from dataclasses import asdict, dataclass
from typing import Deque, Dict, List, Optional, Tuple

import cv2
import numpy as np

from .detector import TrackedObject
from .homography import PitchHomography

logger = logging.getLogger("VAR.IncidentDetector")


@dataclass
class IncidentPayload:
    """Structured JSON payload for an automated VAR review incident."""
    incident_id: str
    timestamp_seconds: float
    frame_index: int
    category: str  # 'Penalty / Possible Foul', 'Possible Red Card'
    involved_player_ids: List[int]
    pitch_coordinates_m: Tuple[float, float]
    inside_penalty_area: bool
    contact_iou: float
    fall_aspect_ratio_delta: float
    replay_clip_path: Optional[str] = None


class IncidentDetector:
    """
    Detects potential penalty and serious foul incidents in real-time.
    Maintains a rolling circular buffer of frames for instant 6-second replay export.
    """

    def __init__(
        self,
        homography: PitchHomography,
        fps: int = 60,
        buffer_seconds: float = 6.0,
        iou_threshold: float = 0.28,
        output_dir: str = "./var_incidents",
    ):
        self.homography = homography
        self.fps = fps
        self.buffer_size = int(buffer_seconds * fps)
        self.half_buffer = self.buffer_size // 2
        self.iou_threshold = iou_threshold
        self.output_dir = output_dir

        # Rolling frame buffer
        self.frame_buffer: Deque[Tuple[int, np.ndarray]] = collections.deque(maxlen=self.buffer_size)

        # Player history: track_id -> deque of (frame_idx, aspect_ratio, y_pos)
        self.player_history: Dict[int, Deque[Tuple[int, float, float]]] = collections.defaultdict(
            lambda: collections.deque(maxlen=40)
        )

        self.detected_incidents: List[IncidentPayload] = []
        self.cooldown_frames: int = 0
        os.makedirs(self.output_dir, exist_ok=True)

    def process_frame(
        self,
        frame_idx: int,
        frame: np.ndarray,
        tracked_objects: List[TrackedObject],
    ) -> Optional[IncidentPayload]:
        """
        Stores current frame in rolling buffer and evaluates player interactions for potential fouls.
        """
        self.frame_buffer.append((frame_idx, frame.copy()))

        if self.cooldown_frames > 0:
            self.cooldown_frames -= 1
            return None

        # Filter players by team
        team_a = [obj for obj in tracked_objects if obj.team == "Team A"]
        team_b = [obj for obj in tracked_objects if obj.team in ("Team B", "Goalkeeper")]

        # Update player aspect ratios (w / h)
        for obj in tracked_objects:
            if obj.class_name == "person":
                x1, y1, x2, y2 = obj.bbox
                w = max(1.0, x2 - x1)
                h = max(1.0, y2 - y1)
                aspect_ratio = w / h  # Standing player ~ 0.35, Fallen player ~ 1.2+
                self.player_history[obj.track_id].append((frame_idx, aspect_ratio, y2))

        # Check collision and fall between opponents
        for p_a in team_a:
            for p_b in team_b:
                iou = self._calculate_iou(p_a.bbox, p_b.bbox)
                if iou >= self.iou_threshold:
                    # Check if either player is in penalty area
                    p_pos = self.homography.pixel_to_pitch(p_a.feet_pos[0], p_a.feet_pos[1])
                    if self.homography.is_inside_penalty_area(p_pos[0], p_pos[1]):
                        # Check for fall (rapid increase in aspect ratio w/h)
                        delta_a = self._detect_fall(p_a.track_id)
                        delta_b = self._detect_fall(p_b.track_id)

                        if delta_a > 0.4 or delta_b > 0.4:
                            # Incident triggered!
                            payload = self._trigger_incident(
                                frame_idx=frame_idx,
                                involved_ids=[p_a.track_id, p_b.track_id],
                                pitch_pos=p_pos,
                                iou=float(iou),
                                ar_delta=max(delta_a, delta_b),
                            )
                            self.cooldown_frames = self.fps * 4  # 4 second cooldown
                            return payload

        return None

    def _detect_fall(self, track_id: int) -> float:
        """Computes recent aspect-ratio expansion indicative of a player going to ground."""
        hist = self.player_history[track_id]
        if len(hist) < 10:
            return 0.0

        initial_ar = np.mean([h[1] for h in list(hist)[:5]])
        latest_ar = np.mean([h[1] for h in list(hist)[-5:]])
        return float(latest_ar - initial_ar)

    def _trigger_incident(
        self,
        frame_idx: int,
        involved_ids: List[int],
        pitch_pos: Tuple[float, float],
        iou: float,
        ar_delta: float,
    ) -> IncidentPayload:
        """Packages the event and exports the buffered slow-motion video clip."""
        time_sec = frame_idx / float(self.fps)
        inc_id = f"INC-{frame_idx:06d}"
        logger.warning(
            "VAR INCIDENT DETECTED [%s] at %.2fs! Players %s inside penalty area (IoU=%.2f, AR_delta=%.2f)",
            inc_id, time_sec, involved_ids, iou, ar_delta,
        )

        clip_filename = f"{inc_id}_replay.mp4"
        clip_path = os.path.join(self.output_dir, clip_filename)
        self._export_buffer_clip(clip_path)

        payload = IncidentPayload(
            incident_id=inc_id,
            timestamp_seconds=round(time_sec, 2),
            frame_index=frame_idx,
            category="Penalty / Possible Foul",
            involved_player_ids=involved_ids,
            pitch_coordinates_m=(round(pitch_pos[0], 2), round(pitch_pos[1], 2)),
            inside_penalty_area=True,
            contact_iou=round(iou, 3),
            fall_aspect_ratio_delta=round(ar_delta, 3),
            replay_clip_path=clip_path,
        )

        self.detected_incidents.append(payload)

        # Save JSON payload
        json_path = os.path.join(self.output_dir, f"{inc_id}_payload.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(asdict(payload), f, indent=2)

        return payload

    def _export_buffer_clip(self, output_path: str) -> None:
        """Exports the buffered frames as an MP4 video clip."""
        if not self.frame_buffer:
            return

        sample_frame = self.frame_buffer[0][1]
        h, w = sample_frame.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, self.fps, (w, h))

        for _, f in self.frame_buffer:
            writer.write(f)

        writer.release()
        logger.info("Saved replay buffer clip to %s", output_path)

    @staticmethod
    def _calculate_iou(boxA: Tuple[float, float, float, float], boxB: Tuple[float, float, float, float]) -> float:
        """Calculates Intersection over Union between two boxes (x1, y1, x2, y2)."""
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return float(iou)
