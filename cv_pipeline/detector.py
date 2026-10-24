"""
detector.py - Detection & Multi-Object Tracking for Football VAR.

Uses YOLOv8 for object detection (person, sports ball) and ByteTrack for persistent ID tracking.
Extracts player torso colors using circular unit-circle HSV representations (handling cyclic hue wrap-around)
and outlier rejection to reliably isolate Team A, Team B, Goalkeeper, and Referee.
"""

from __future__ import annotations

import logging
import math
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
    using circular trigonometric projection of Hue in HSV space:
      theta = 2 * pi * (H / 180.0)
      feat = [cos(theta) * (S / 255.0), sin(theta) * (S / 255.0), V / 255.0]

    This completely resolves the red-jersey boundary bug (where H=0..10 and H=170..180
    wrap around the 0-180 boundary) and applies centroid outlier rejection for Referees/Goalkeepers.
    """

    def __init__(self, n_teams: int = 2, outlier_dist_threshold: float = 0.42):
        self.n_teams = n_teams
        self.outlier_dist_threshold = outlier_dist_threshold
        self.team_centroids_feature: Optional[np.ndarray] = None
        self.is_calibrated: bool = False

    @staticmethod
    def hsv_to_circular_feature(hsv: np.ndarray) -> np.ndarray:
        """
        Maps (H, S, V) into 3D unit-cylinder circular coordinates:
          H in [0, 180] -> theta in [0, 2*pi]
          feature = [cos(theta) * S_norm, sin(theta) * S_norm, V_norm]
        """
        h = float(hsv[0])
        s = float(hsv[1]) / 255.0
        v = float(hsv[2]) / 255.0

        theta = 2.0 * math.pi * (h / 180.0)
        cos_h = math.cos(theta) * s
        sin_h = math.sin(theta) * s

        return np.array([cos_h, sin_h, v], dtype=np.float32)

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

        tx1 = int(x1 + 0.2 * w)
        tx2 = int(x1 + 0.8 * w)
        ty1 = int(y1 + 0.25 * h)
        ty2 = int(y1 + 0.55 * h)

        torso_crop = image[ty1:ty2, tx1:tx2]
        if torso_crop.size == 0:
            return None

        hsv_crop = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)

        # Exclude green grass in HSV (Hue 35-85, Saturation > 40)
        lower_green = np.array([35, 40, 40], dtype=np.uint8)
        upper_green = np.array([85, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv_crop, lower_green, upper_green)
        non_pitch_mask = cv2.bitwise_not(mask)

        valid_pixels = hsv_crop[non_pitch_mask > 0]
        if len(valid_pixels) < 20:
            return np.mean(hsv_crop.reshape(-1, 3), axis=0)

        return np.median(valid_pixels, axis=0)

    def fit(self, hsv_samples: List[np.ndarray]) -> None:
        """
        Fits KMeans in circular trigonometric feature space to determine Team A and Team B centroids.
        """
        if not SKLEARN_AVAILABLE or len(hsv_samples) < 4:
            logger.warning("Not enough samples or scikit-learn missing; using heuristic team classifier.")
            return

        features = [self.hsv_to_circular_feature(s) for s in hsv_samples]
        data = np.array(features, dtype=np.float32)

        # Filter out extreme black outliers (referees) before team centroid fitting
        valid_for_teams = [f for f in data if f[2] > 0.25]
        if len(valid_for_teams) >= 4:
            data = np.array(valid_for_teams)

        kmeans = KMeans(n_clusters=self.n_teams, random_state=42, n_init=10)
        kmeans.fit(data)
        self.team_centroids_feature = kmeans.cluster_centers_
        self.is_calibrated = True
        logger.info("Team color classifier calibrated in circular HSV space.")

    def predict(self, hsv_color: np.ndarray, is_near_goal: bool = False) -> str:
        """
        Classifies an HSV color into Team A, Team B, Goalkeeper, or Referee
        using circular distance metrics and outlier rejection.
        """
        h, s, v = hsv_color[0], hsv_color[1], hsv_color[2]

        # 1. Distinct Referee kit signatures:
        # Deep black kit (V < 50)
        if v < 50:
            return "Referee"

        # High-vis neon yellow / lime referee kit (H ~ 25..40, S > 180, V > 200)
        if 25 <= h <= 40 and s > 180 and v > 200:
            return "Referee"

        feat = self.hsv_to_circular_feature(hsv_color)

        if not self.is_calibrated or self.team_centroids_feature is None:
            # Fallback heuristic using circular coordinate cos(theta)
            return "Team A" if feat[0] > 0 else "Team B"

        # 2. Compute circular Euclidean distances to team centroids
        dists = [float(np.linalg.norm(feat - center)) for center in self.team_centroids_feature]
        min_dist = min(dists)
        best_team_idx = int(np.argmin(dists))

        # 3. Outlier rejection: if point is far from both team centroids
        if min_dist > self.outlier_dist_threshold:
            # If player is stationed near goal mouth or wearing distinct neon jersey -> Goalkeeper
            if is_near_goal or (s > 150 and v > 150):
                return "Goalkeeper"
            return "Referee"

        return "Team A" if best_team_idx == 0 else "Team B"


class PlayerDetector:
    """
    Main detection and tracking pipeline.
    Combines YOLOv8 inference, ByteTrack multi-object tracker,
    and circular HSV color classification with outlier rejection.
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
        self.calibration_limit = 50

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
        """
        if not self.yolo_active:
            return self._simulate_detections(frame, frame_idx)

        results = self.model.predict(
            source=frame,
            conf=self.conf,
            device=self.device,
            classes=[0, 32],
            verbose=False,
        )[0]

        detections = sv.Detections.from_ultralytics(results)
        person_mask = (detections.class_id == 0)
        ball_mask = (detections.class_id == 32)

        person_detections = detections[person_mask]
        tracked_persons = self.tracker.update_with_detections(person_detections)

        tracked_objects: List[TrackedObject] = []
        h_img, w_img = frame.shape[:2]

        for i in range(len(tracked_persons)):
            bbox = tuple(tracked_persons.xyxy[i])
            track_id = int(tracked_persons.tracker_id[i]) if tracked_persons.tracker_id is not None else i
            conf = float(tracked_persons.confidence[i]) if tracked_persons.confidence is not None else 0.85

            hsv = self.team_classifier.extract_torso_hsv(frame, bbox)
            is_near_goal = bbox[2] > w_img * 0.85 or bbox[0] < w_img * 0.15

            if hsv is not None:
                if len(self.collected_samples) < self.calibration_limit:
                    self.collected_samples.append(hsv)
                    if len(self.collected_samples) == self.calibration_limit:
                        self.team_classifier.fit(self.collected_samples)

                team = self.team_classifier.predict(hsv, is_near_goal=is_near_goal)
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
        """Synthetic detection generator for testing environments without GPU or weights."""
        h, w = frame.shape[:2]
        objects: List[TrackedObject] = []

        base_x = w * 0.45 + (frame_idx % 200) * 0.4
        ball_x = base_x + 50 + (frame_idx * 1.5) % 150
        ball_y = h * 0.65

        objects.append(
            TrackedObject(
                track_id=-1,
                class_name="ball",
                bbox=(ball_x - 8, ball_y - 8, ball_x + 8, ball_y + 8),
                confidence=0.92,
                team=None,
            )
        )

        # Goalkeeper
        objects.append(
            TrackedObject(
                track_id=1,
                class_name="person",
                bbox=(w * 0.90, h * 0.50, w * 0.90 + 36, h * 0.50 + 90),
                confidence=0.94,
                team="Goalkeeper",
            )
        )

        # Referee
        objects.append(
            TrackedObject(
                track_id=99,
                class_name="person",
                bbox=(w * 0.40, h * 0.48, w * 0.40 + 34, h * 0.48 + 88),
                confidence=0.90,
                team="Referee",
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
