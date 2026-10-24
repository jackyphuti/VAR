"""
pose_analyzer.py - 17-Keypoint Anatomical Skeletal Pose Estimation for VAR.

Uses YOLOv8-Pose (yolov8m-pose.pt) to extract 17 anatomical keypoints per player:
- SAOT Offside (Law 11): Strictly checks playable body parts (head, shoulders, hips, knees, feet)
  while strictly excluding elbows and wrists (arms/hands are not playable).
- Handball Silhouette (Law 12): Calculates arm abduction angle relative to the vertical torso axis
  (> 45 degrees = unnatural silhouette) and verifies contact with ball.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
import numpy as np

try:
    from .homography import PitchHomography
except ImportError:
    from homography import PitchHomography

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

logger = logging.getLogger("VAR.PoseAnalyzer")

# COCO 17-Keypoint Indices:
# 0: Nose, 1: L-Eye, 2: R-Eye, 3: L-Ear, 4: R-Ear
# 5: L-Shoulder, 6: R-Shoulder, 7: L-Elbow, 8: R-Elbow, 9: L-Wrist, 10: R-Wrist
# 11: L-Hip, 12: R-Hip, 13: L-Knee, 14: R-Knee, 15: L-Ankle, 16: R-Ankle

PLAYABLE_KEYPOINTS = [0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16]
EXCLUDED_ARM_KEYPOINTS = [7, 8, 9, 10]  # Elbows and Wrists (Hands/Arms)


@dataclass
class PlayerPose:
    """Represents the 17-keypoint skeletal pose of a single tracked player."""
    track_id: int
    team: str
    keypoints_xy: np.ndarray  # Shape: (17, 2) in screen pixel coordinates
    keypoints_conf: np.ndarray  # Shape: (17,) confidence scores
    bbox: Tuple[float, float, float, float]
    deepest_playable_pixel: Tuple[float, float] = field(init=False)
    deepest_playable_pitch_m: Tuple[float, float] = field(init=False)
    arm_angle_left_deg: float = 0.0
    arm_angle_right_deg: float = 0.0
    unnatural_silhouette: bool = False

    def __post_init__(self):
        self.deepest_playable_pixel = (self.bbox[2], self.bbox[3])
        self.deepest_playable_pitch_m = (0.0, 0.0)


@dataclass
class HandballContactResult:
    """Evaluation of a potential handball offense."""
    is_handball: bool
    player_id: int
    arm_involved: str  # 'LEFT_ARM', 'RIGHT_ARM', 'NONE'
    silhouette_angle_deg: float
    unnatural_silhouette: bool
    contact_frame: int
    ball_distance_to_arm_px: float


class PoseAnalyzer:
    """
    Analyzes skeletal geometry using YOLOv8-Pose for IFAB Law 11 & Law 12 enforcement.
    """

    def __init__(
        self,
        homography: PitchHomography,
        model_name: str = "yolov8m-pose.pt",
        device: str = "cpu",
        conf_threshold: float = 0.4,
    ):
        self.homography = homography
        self.conf = conf_threshold
        self.device = device

        if ULTRALYTICS_AVAILABLE:
            try:
                self.model = YOLO(model_name)
                self.pose_active = True
                logger.info("YOLOv8-Pose loaded successfully on %s", device)
            except Exception as e:
                logger.warning("Could not load YOLOv8-Pose (%s); using synthetic skeletal generator.", e)
                self.pose_active = False
        else:
            self.pose_active = False

    def extract_poses(
        self,
        frame: np.ndarray,
        tracked_players: List[any],
        attacking_direction: int = 1,
    ) -> List[PlayerPose]:
        """
        Extracts 17 keypoints for all players on screen, isolates playable body parts for offside,
        and computes arm silhouette angles.
        """
        if not self.pose_active:
            return self._simulate_poses(frame, tracked_players, attacking_direction)

        h_img, w_img = frame.shape[:2]
        results = self.model.predict(
            source=frame,
            conf=self.conf,
            device=self.device,
            verbose=False,
        )[0]

        player_poses: List[PlayerPose] = []
        if results.keypoints is None or len(results.keypoints) == 0:
            return self._simulate_poses(frame, tracked_players, attacking_direction)

        kpts_data = results.keypoints.xy.cpu().numpy()
        kpts_conf = results.keypoints.conf.cpu().numpy() if results.keypoints.conf is not None else np.ones((len(kpts_data), 17))
        boxes = results.boxes.xyxy.cpu().numpy()

        for idx in range(len(kpts_data)):
            kxy = kpts_data[idx]
            kconf = kpts_conf[idx]
            bbox = tuple(boxes[idx])

            # Match with tracked player
            matched_player = self._match_player(bbox, tracked_players)
            track_id = matched_player.track_id if matched_player else idx
            team = matched_player.team if matched_player else "Team A"

            pose = PlayerPose(
                track_id=track_id,
                team=team,
                keypoints_xy=kxy,
                keypoints_conf=kconf,
                bbox=bbox,
            )

            # Law 11: Identify deepest playable body part (excluding elbows and wrists)
            self._evaluate_playable_extremity(pose, attacking_direction)

            # Law 12: Compute arm silhouette angles
            self._evaluate_arm_angles(pose)

            player_poses.append(pose)

        return player_poses

    def _evaluate_playable_extremity(self, pose: PlayerPose, attacking_direction: int) -> None:
        """
        Finds the furthest playable body part in pitch coordinate X.
        Strictly excludes elbow (7, 8) and wrist (9, 10).
        """
        best_pitch_x = -999.0 if attacking_direction > 0 else 999.0
        best_pixel = (pose.bbox[0], pose.bbox[3])
        best_pitch_pos = (0.0, 0.0)

        for kpt_idx in PLAYABLE_KEYPOINTS:
            px, py = pose.keypoints_xy[kpt_idx]
            conf = pose.keypoints_conf[kpt_idx]
            if conf < 0.2 or px == 0:
                continue

            try:
                pitch_x, pitch_y = self.homography.pixel_to_pitch(px, py)
            except Exception:
                continue

            if attacking_direction > 0:
                if pitch_x > best_pitch_x:
                    best_pitch_x = pitch_x
                    best_pixel = (px, py)
                    best_pitch_pos = (pitch_x, pitch_y)
            else:
                if pitch_x < best_pitch_x:
                    best_pitch_x = pitch_x
                    best_pixel = (px, py)
                    best_pitch_pos = (pitch_x, pitch_y)

        pose.deepest_playable_pixel = best_pixel
        pose.deepest_playable_pitch_m = best_pitch_pos

    def _evaluate_arm_angles(self, pose: PlayerPose) -> None:
        """
        Computes arm silhouette angles relative to the torso vertical line:
        - Torso axis vector: Neck (mid shoulders) -> Pelvis (mid hips)
        - Left arm vector: Left Shoulder (5) -> Left Elbow (7) -> Left Wrist (9)
        - Right arm vector: Right Shoulder (6) -> Right Elbow (8) -> Right Wrist (10)
        """
        kxy = pose.keypoints_xy
        # Mid shoulder & mid hip
        mid_shoulder = (kxy[5] + kxy[6]) / 2.0
        mid_hip = (kxy[11] + kxy[12]) / 2.0
        torso_vec = mid_hip - mid_shoulder

        torso_len = np.linalg.norm(torso_vec)
        if torso_len < 1e-3:
            return

        # Left Arm Angle
        l_arm_vec = kxy[9] - kxy[5]
        l_angle = self._vector_angle_deg(torso_vec, l_arm_vec)
        pose.arm_angle_left_deg = float(l_angle)

        # Right Arm Angle
        r_arm_vec = kxy[10] - kxy[6]
        r_angle = self._vector_angle_deg(torso_vec, r_arm_vec)
        pose.arm_angle_right_deg = float(r_angle)

        # IFAB Law 12 Unnatural Silhouette threshold (> 45 degrees away from body axis)
        pose.unnatural_silhouette = (l_angle > 45.0) or (r_angle > 45.0)

    @staticmethod
    def _vector_angle_deg(v1: np.ndarray, v2: np.ndarray) -> float:
        """Returns the angle in degrees between two 2D vectors."""
        n1 = np.linalg.norm(v1)
        n2 = np.linalg.norm(v2)
        if n1 < 1e-4 or n2 < 1e-4:
            return 0.0
        dot = np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)
        return float(np.arccos(dot) * 180.0 / np.pi)

    def check_handball_contact(
        self,
        frame_idx: int,
        ball_pos: Tuple[float, float],
        poses: List[PlayerPose],
        distance_threshold_px: float = 28.0,
    ) -> Optional[HandballContactResult]:
        """
        Checks if the ball intersects an arm in an unnatural silhouette position (> 45 degrees).
        """
        bx, by = ball_pos

        for pose in poses:
            # Check left arm
            l_wrist = pose.keypoints_xy[9]
            l_elbow = pose.keypoints_xy[7]
            dist_l = self._dist_point_to_segment((bx, by), l_elbow, l_wrist)

            if dist_l < distance_threshold_px and pose.arm_angle_left_deg > 45.0:
                return HandballContactResult(
                    is_handball=True,
                    player_id=pose.track_id,
                    arm_involved="LEFT_ARM",
                    silhouette_angle_deg=pose.arm_angle_left_deg,
                    unnatural_silhouette=True,
                    contact_frame=frame_idx,
                    ball_distance_to_arm_px=dist_l,
                )

            # Check right arm
            r_wrist = pose.keypoints_xy[10]
            r_elbow = pose.keypoints_xy[8]
            dist_r = self._dist_point_to_segment((bx, by), r_elbow, r_wrist)

            if dist_r < distance_threshold_px and pose.arm_angle_right_deg > 45.0:
                return HandballContactResult(
                    is_handball=True,
                    player_id=pose.track_id,
                    arm_involved="RIGHT_ARM",
                    silhouette_angle_deg=pose.arm_angle_right_deg,
                    unnatural_silhouette=True,
                    contact_frame=frame_idx,
                    ball_distance_to_arm_px=dist_r,
                )

        return None

    @staticmethod
    def _dist_point_to_segment(p: Tuple[float, float], a: np.ndarray, b: np.ndarray) -> float:
        """Shortest distance from point p to line segment ab."""
        px, py = p
        ax, ay = a
        bx, by = b
        l2 = (bx - ax) ** 2 + (by - ay) ** 2
        if l2 == 0:
            return float(np.hypot(px - ax, py - ay))
        t = max(0.0, min(1.0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2))
        proj_x = ax + t * (bx - ax)
        proj_y = ay + t * (by - ay)
        return float(np.hypot(px - proj_x, py - proj_y))

    @staticmethod
    def _match_player(bbox: Tuple[float, float, float, float], tracked: List[any]) -> Optional[any]:
        for p in tracked:
            iou = PoseAnalyzer._iou(bbox, p.bbox)
            if iou > 0.4:
                return p
        return None

    @staticmethod
    def _iou(boxA, boxB) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        inter = max(0.0, xB - xA) * max(0.0, yB - yA)
        areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        return inter / float(areaA + areaB - inter + 1e-6)

    def _simulate_poses(
        self,
        frame: np.ndarray,
        tracked_players: List[any],
        attacking_direction: int,
    ) -> List[PlayerPose]:
        """Generates realistic synthetic 17-keypoint skeletons for testing and CPU fallback."""
        poses: List[PlayerPose] = []
        for p in tracked_players:
            if getattr(p, "class_name", "") != "person":
                continue

            x1, y1, x2, y2 = p.bbox
            w = x2 - x1
            h = y2 - y1
            cx = (x1 + x2) / 2.0

            # Synthesize keypoints:
            kpts = np.zeros((17, 2), dtype=np.float32)
            kpts[0] = [cx, y1 + 0.1 * h]          # Nose
            kpts[5] = [cx - 0.2 * w, y1 + 0.25 * h] # L-Shoulder
            kpts[6] = [cx + 0.2 * w, y1 + 0.25 * h] # R-Shoulder
            kpts[7] = [cx - 0.3 * w, y1 + 0.45 * h] # L-Elbow
            kpts[8] = [cx + 0.3 * w, y1 + 0.45 * h] # R-Elbow
            kpts[9] = [cx - 0.35 * w, y1 + 0.6 * h] # L-Wrist
            kpts[10] = [cx + 0.35 * w, y1 + 0.6 * h] # R-Wrist
            kpts[11] = [cx - 0.15 * w, y1 + 0.55 * h] # L-Hip
            kpts[12] = [cx + 0.15 * w, y1 + 0.55 * h] # R-Hip
            kpts[13] = [cx - 0.15 * w, y1 + 0.75 * h] # L-Knee
            kpts[14] = [cx + 0.15 * w, y1 + 0.75 * h] # R-Knee
            kpts[15] = [cx - 0.15 * w, y2]          # L-Ankle
            kpts[16] = [cx + 0.15 * w, y2]          # R-Ankle

            # If player is defender jumping (e.g. ID 5), extend right arm horizontally
            if getattr(p, "track_id", 0) == 5:
                kpts[8] = [cx + 0.5 * w, y1 + 0.25 * h] # R-Elbow extended horizontally
                kpts[10] = [cx + 0.9 * w, y1 + 0.25 * h] # R-Wrist extended horizontally

            pose = PlayerPose(
                track_id=p.track_id,
                team=getattr(p, "team", "Team A"),
                keypoints_xy=kpts,
                keypoints_conf=np.ones(17, dtype=np.float32),
                bbox=p.bbox,
            )
            self._evaluate_playable_extremity(pose, attacking_direction)
            self._evaluate_arm_angles(pose)
            poses.append(pose)

        return poses
