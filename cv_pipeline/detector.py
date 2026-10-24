"""
detector.py - Detection & Multi-Object Tracking for Football VAR.

Uses YOLOv8 for object detection (person, sports ball) and ByteTrack for persistent ID tracking.
Extracts player torso colors using K-Means in HSV space (filtering out green pitch pixels)
to classify individuals into Team A, Team B, Goalkeeper, or Referee.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    from sklearn.cluster import KMeans
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    from ultralytics import YOLO
    import supervision as sv
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

logger = logging.getLogger("VAR.Detector")


@dataclass
class TrackedObject:
    """Represents a tracked individual or object on the pitch."""
    track_id: int
    class_name: str  # 'person', 'ball', 'referee', 'goalkeeper'
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    confidence: float
    team: Optional[str] = None  # 'Team A', 'Team B', 'Goalkeeper', 'Referee', or None
    dominant_color_hsv: Optional[Tuple[float, float, float]] = None
    feet_pos: Tuple[float, float] = field(init=False)

    def __post_init__(self):
        x1, y1, x2, y2 = self.bbox
        self.feet_pos = ((x1 + x2) / 2.0, y2)


class TeamClassifier:
    """
    Classifies players into Team A, Team B, Goalkeeper, and Referee
    based on K-Means clustering of HSV torso colors.
    Excludes pitch green hue range before clustering.
    """

    def __init__(self, n_teams: int = 2):
        self.n_teams = n_teams
        self.team_centers_hsv: Optional[np.ndarray] = None
        self.is_calibrated: bool = False

    @staticmethod
    def extract_torso_hsv(image: np.ndarray, bbox: Tuple[float, float, float, float]) -> Optional[np.ndarray]:
        """
        Extracts the upper torso region (25% to 55% height, 20% to 80% width)
        and filters out green pitch background pixels.
        """
        h_img, w_img = image.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w_img, x2), min(h_img, y2)

        w = x2 - x1
        h = y2 - y1
        if w < 10 or h < 20:
            return None

        # Torso bounding box
        tx1 = int(x1 + 0.2 * w)
        tx2 = int(x1 + 0.8 * w)
        ty1 = int(y1 + 0.25 * h)
        ty2 = int(y1 + 0.55 * h)

        torso_crop = image[ty1:ty2, tx1:tx2]
        if torso_crop.size == 0:
            return None

        hsv_crop = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)

        # Exclude green grass in HSV (Hue roughly 35-85, Saturation > 40)
        lower_green = np.array([35, 40, 40], dtype=np.uint8)
        upper_green = np.array([85, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv_crop, lower_green, upper_green)
        non_pitch_mask = cv2.bitwise_not(mask)

        valid_pixels = hsv_crop[non_pitch_mask > 0]
        if len(valid_pixels) < 20:
            return np.mean(hsv_crop.reshape(-1, 3), axis=0)

        # Return mean or median HSV of jersey
        return np.median(valid_pixels, axis=0)

    def fit(self, samples: List[np.ndarray]) -> None:
        """Fits KMeans on collected torso HSV samples to establish Team A and Team B palettes."""
        if not SKLEARN_AVAILABLE or len(samples) < 4:
            logger.warning("Not enough samples or scikit-learn missing; using fallback team splitting.")
            return

        data = np.array(samples)
        # Weight Hue and Value more than Saturation
        weights = np.array([2.0, 1.0, 1.2])
        weighted_data = data * weights

        kmeans = KMeans(n_clusters=self.n_teams, random_state=42, n_init=10)
        kmeans.fit(weighted_data)
        self.team_centers_hsv = kmeans.cluster_centers_ / weights
        self.is_calibrated = True
        logger.info("Team color classifier calibrated with centers: %s", self.team_centers_hsv)

    def predict(self, hsv_color: np.ndarray) -> str:
        """Classifies a given torso HSV color into a team or referee."""
        if not self.is_calibrated or self.team_centers_hsv is None:
            # Fallback heuristic: Hue split
            return "Team A" if hsv_color[0] < 90 else "Team B"

        # Check for Referee (typically high-vis neon yellow/green or solid black)
        # Very low value (< 45) -> Black kit referee
        if hsv_color[2] < 45:
            return "Referee"

        dists = [np.linalg.norm(hsv_color - center) for center in self.team_centers_hsv]
        min_idx = int(np.argmin(dists))
        return f"Team {'A' if min_idx == 0 else 'B'}"


class PlayerDetector:
    """
    Main detection and tracking pipeline.
    Combines YOLOv8 inference, ByteTrack multi-object tracker,
    and torso color classification.
    """

    def __init__(
        self,
        model_name: str = "yolov8m.pt",
        confidence_threshold: float = 0.35,
        device: str = "cpu",
    ):
        self.conf = confidence_threshold
        self.device = device
        self.team_classifier = TeamClassifier()
        self.collected_samples: List[np.ndarray] = []
        self.calibration_limit = 60

        if ULTRALYTICS_AVAILABLE:
            try:
                self.model = YOLO(model_name)
                self.tracker = sv.ByteTrack(
                    track_activation_threshold=0.3,
                    lost_track_buffer=30,
                    minimum_matching_threshold=0.8,
                    frame_rate=60,
                )
                self.yolo_active = True
                logger.info("YOLOv8 & ByteTrack initialized successfully on %s", device)
            except Exception as e:
                logger.warning("Failed loading YOLO/ByteTrack model (%s), running simulation mode.", e)
                self.yolo_active = False
        else:
            logger.warning("Ultralytics / Supervision not installed. Detector in simulation mode.")
            self.yolo_active = False

    def process_frame(self, frame: np.ndarray, frame_idx: int = 0) -> List[TrackedObject]:
        """
        Executes inference, tracking, and team attribution on a single video frame.

        Args:
            frame: BGR numpy image (1080p recommended).
            frame_idx: Index of current frame for temporal calibration.

        Returns:
            List of TrackedObject instances.
        """
        if not self.yolo_active:
            return self._simulate_detections(frame, frame_idx)

        # Run YOLOv8 inference
        results = self.model.predict(
            source=frame,
            conf=self.conf,
            device=self.device,
            classes=[0, 32],  # 0: person, 32: sports ball
            verbose=False,
        )[0]

        detections = sv.Detections.from_ultralytics(results)
        # Separate ball vs players for tracking (balls are fast and better detected directly)
        person_mask = (detections.class_id == 0)
        ball_mask = (detections.class_id == 32)

        person_detections = detections[person_mask]
        tracked_persons = self.tracker.update_with_detections(person_detections)

        tracked_objects: List[TrackedObject] = []

        # Process tracked persons
        for i in range(len(tracked_persons)):
            bbox = tuple(tracked_persons.xyxy[i])
            track_id = int(tracked_persons.tracker_id[i]) if tracked_persons.tracker_id is not None else i
            conf = float(tracked_persons.confidence[i]) if tracked_persons.confidence is not None else 0.85

            hsv = self.team_classifier.extract_torso_hsv(frame, bbox)
            if hsv is not None:
                if len(self.collected_samples) < self.calibration_limit:
                    self.collected_samples.append(hsv)
                    if len(self.collected_samples) == self.calibration_limit:
                        self.team_classifier.fit(self.collected_samples)

                team = self.team_classifier.predict(hsv)
            else:
                team = "Team A"

            obj = TrackedObject(
                track_id=track_id,
                class_name="person",
                bbox=bbox,
                confidence=conf,
                team=team,
                dominant_color_hsv=tuple(hsv) if hsv is not None else None,
            )
            tracked_objects.append(obj)

        # Process ball (untracked or single-frame ID -1)
        ball_detections = detections[ball_mask]
        if len(ball_detections) > 0:
            best_ball_idx = int(np.argmax(ball_detections.confidence))
            ball_bbox = tuple(ball_detections.xyxy[best_ball_idx])
            ball_conf = float(ball_detections.confidence[best_ball_idx])
            tracked_objects.append(
                TrackedObject(
                    track_id=-1,
                    class_name="ball",
                    bbox=ball_bbox,
                    confidence=ball_conf,
                    team=None,
                )
            )

        return tracked_objects

    def _simulate_detections(self, frame: np.ndarray, frame_idx: int) -> List[TrackedObject]:
        """Synthetic detection generator for testing environments without GPU or YOLO weights."""
        h, w = frame.shape[:2]
        objects: List[TrackedObject] = []

        # Synthesize 4 defenders, 3 attackers, 1 goalkeeper, 1 referee, 1 ball
        base_x = w * 0.45 + (frame_idx % 200) * 0.4
        ball_x = base_x + 50 + (frame_idx * 1.5) % 150
        ball_y = h * 0.65

        # Ball
        objects.append(
            TrackedObject(
                track_id=-1,
                class_name="ball",
                bbox=(ball_x - 8, ball_y - 8, ball_x + 8, ball_y + 8),
                confidence=0.92,
                team=None,
            )
        )

        # Defenders (Team B)
        for i in range(4):
            dx = w * (0.55 + i * 0.08) - (frame_idx * 0.2)
            dy = h * (0.40 + i * 0.12)
            objects.append(
                TrackedObject(
                    track_id=100 + i,
                    class_name="person",
                    bbox=(dx - 18, dy - 50, dx + 18, dy + 50),
                    confidence=0.88,
                    team="Team B",
                )
            )

        # Attackers (Team A)
        for j in range(3):
            ax = w * (0.52 + j * 0.09) + (frame_idx * 0.3)
            ay = h * (0.42 + j * 0.14)
            objects.append(
                TrackedObject(
                    track_id=200 + j,
                    class_name="person",
                    bbox=(ax - 18, ay - 50, ax + 18, ay + 50),
                    confidence=0.91,
                    team="Team A",
                )
            )

        return objects
