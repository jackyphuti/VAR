"""
homography.py - Planar Homography & 2D Pitch Coordinate Mapping.

Maps image pixels (u, v) from camera broadcast perspective to metric FIFA standard pitch coordinates (X, Y)
where:
  - Pitch dimensions: 105.0 meters length x 68.0 meters width.
  - Coordinate system: Origin (0, 0) at top-left corner flag, (105, 0) at top-right corner,
    (105, 68) at bottom-right corner, (0, 68) at bottom-left corner.
Includes automatic pitch white-line detection via Top-Hat morphological filtering, Hough Line Transform,
and Exponential Moving Average (EMA) temporal smoothing for dynamic camera panning.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False

import numpy as np

logger = logging.getLogger("VAR.Homography")

# FIFA Pitch Dimensions in meters
PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0
PENALTY_AREA_LENGTH_M = 16.5
PENALTY_AREA_WIDTH_M = 40.32
GOAL_AREA_LENGTH_M = 5.5
GOAL_AREA_WIDTH_M = 18.32


class PitchHomography:
    """
    Computes and manages homography transformation between camera screen pixels
    and FIFA pitch coordinate space (meters).
    """

    def __init__(
        self,
        pitch_length: float = PITCH_LENGTH_M,
        pitch_width: float = PITCH_WIDTH_M,
        ema_alpha: float = 0.15,
    ):
        self.pitch_length = pitch_length
        self.pitch_width = pitch_width
        self.ema_alpha = ema_alpha
        self.H: Optional[np.ndarray] = None
        self.H_inv: Optional[np.ndarray] = None
        self._init_default_camera_matrix()

    def _init_default_camera_matrix(self) -> None:
        """
        Initializes a default perspective matrix matching a standard 1080p broadcast wide camera.
        Assumes the camera overlooks the right-hand attacking half from the main stand.
        """
        src_points = np.array([
            [260.0, 320.0],    # Near halfway line top touchline
            [1660.0, 330.0],   # Far goal line top corner
            [1880.0, 980.0],   # Far goal line bottom corner
            [80.0, 960.0],     # Near halfway line bottom touchline
        ], dtype=np.float32)

        dst_points = np.array([
            [52.5, 0.0],           # Halfway line top touchline
            [105.0, 0.0],          # Goal line top corner
            [105.0, 68.0],         # Goal line bottom corner
            [52.5, 68.0],          # Halfway line bottom touchline
        ], dtype=np.float32)

        self.compute_from_points(src_points, dst_points)

    def compute_from_points(
        self,
        pixel_points: np.ndarray,
        pitch_points_meters: np.ndarray,
    ) -> bool:
        """
        Computes the planar homography matrix using cv2.findHomography with RANSAC.
        """
        if len(pixel_points) < 4 or len(pitch_points_meters) < 4:
            logger.error("At least 4 correspondence points required for homography.")
            return False

        if CV2_AVAILABLE and cv2 is not None:
            H, status = cv2.findHomography(pixel_points, pitch_points_meters, cv2.RANSAC, 5.0)
        else:
            # Fallback Direct Linear Transform (DLT) via SVD using pure NumPy
            A = []
            for i in range(len(pixel_points)):
                u, v = pixel_points[i]
                X, Y = pitch_points_meters[i]
                A.append([-u, -v, -1.0, 0.0, 0.0, 0.0, u * X, v * X, X])
                A.append([0.0, 0.0, 0.0, -u, -v, -1.0, u * Y, v * Y, Y])
            A = np.array(A, dtype=np.float64)
            _, _, Vh = np.linalg.svd(A)
            H = Vh[-1].reshape(3, 3)
            if abs(H[2, 2]) > 1e-8:
                H = H / H[2, 2]

        if H is None:
            logger.error("Failed to solve planar transform.")
            return False

        if self.H is None:
            self.H = H
        else:
            # Exponential Moving Average (EMA) smoothing
            self.H = self.ema_alpha * H + (1.0 - self.ema_alpha) * self.H

        try:
            self.H_inv = np.linalg.inv(self.H)
        except np.linalg.LinAlgError:
            logger.error("Singular homography matrix encountered; cannot invert.")
            return False

        return True

    def estimate_from_frame(self, frame: np.ndarray) -> bool:
        """
        Automatically extracts white pitch markings using Top-Hat morphology + HSV white filter
        + probabilistic Hough Line Transform (cv2.HoughLinesP), finds intersections,
        and smoothly updates self.H via Exponential Moving Average (EMA).
        """
        h_img, w_img = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 1. Top-Hat morphological filtering to enhance white grass lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 13))
        tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)

        # 2. HSV white color filter (low saturation, high value)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        white_mask = cv2.inRange(hsv, np.array([0, 0, 160], dtype=np.uint8), np.array([180, 55, 255], dtype=np.uint8))
        combined = cv2.bitwise_and(tophat, tophat, mask=white_mask)
        _, thresh = cv2.threshold(combined, 30, 255, cv2.THRESH_BINARY)

        # 3. Probabilistic Hough Line Transform
        lines = cv2.HoughLinesP(thresh, rho=1, theta=np.pi / 180, threshold=70, minLineLength=80, maxLineGap=25)
        if lines is None or len(lines) < 4:
            return False

        # Classify lines into horizontal-like (touchlines) and vertical-like (goal/box lines)
        h_lines: List[Tuple[float, float, float, float]] = []
        v_lines: List[Tuple[float, float, float, float]] = []

        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi)
            if angle < 30.0 or angle > 150.0:
                h_lines.append((float(x1), float(y1), float(x2), float(y2)))
            elif 45.0 <= angle <= 135.0:
                v_lines.append((float(x1), float(y1), float(x2), float(y2)))

        if len(h_lines) < 2 or len(v_lines) < 2:
            return False

        # Find intersections between extreme horizontal and vertical lines
        h_lines.sort(key=lambda l: (l[1] + l[3]) / 2.0)
        v_lines.sort(key=lambda l: (l[0] + l[2]) / 2.0)

        top_touch = h_lines[0]
        bot_touch = h_lines[-1]
        left_bound = v_lines[0]
        right_bound = v_lines[-1]

        def line_intersection(l1: Tuple[float, float, float, float], l2: Tuple[float, float, float, float]) -> Optional[Tuple[float, float]]:
            x1, y1, x2, y2 = l1
            x3, y3, x4, y4 = l2
            denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
            if abs(denom) < 1e-4:
                return None
            px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom
            py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom
            return px, py

        p_tl = line_intersection(top_touch, left_bound)
        p_tr = line_intersection(top_touch, right_bound)
        p_br = line_intersection(bot_touch, right_bound)
        p_bl = line_intersection(bot_touch, left_bound)

        if not (p_tl and p_tr and p_br and p_bl):
            return False

        pts_src = np.array([p_tl, p_tr, p_br, p_bl], dtype=np.float32)
        # Validate that detected points fall inside reasonable screen bounds
        if np.any(pts_src < -100) or np.any(pts_src[:, 0] > w_img + 200) or np.any(pts_src[:, 1] > h_img + 200):
            return False

        pts_dst = np.array([
            [52.5, 0.0],
            [105.0, 0.0],
            [105.0, 68.0],
            [52.5, 68.0],
        ], dtype=np.float32)

        return self.compute_from_points(pts_src, pts_dst)

    def pixel_to_pitch(self, u: float, v: float) -> Tuple[float, float]:
        """
        Transforms screen pixel coordinate (u, v) to pitch metric coordinate (X, Y).
        """
        if self.H is None:
            raise RuntimeError("Homography matrix is not initialized.")

        if CV2_AVAILABLE and cv2 is not None:
            src = np.array([[[u, v]]], dtype=np.float32)
            dst = cv2.perspectiveTransform(src, self.H)
            x_m, y_m = dst[0][0]
            return float(x_m), float(y_m)
        else:
            vec = np.array([u, v, 1.0], dtype=np.float64)
            res = np.dot(self.H, vec)
            w = res[2] if abs(res[2]) > 1e-9 else 1e-9
            return float(res[0] / w), float(res[1] / w)

    def pitch_to_pixel(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """
        Transforms pitch metric coordinate (X, Y) back to screen pixel coordinate (u, v).
        """
        if self.H_inv is None:
            raise RuntimeError("Inverse homography matrix is not initialized.")

        if CV2_AVAILABLE and cv2 is not None:
            src = np.array([[[x_m, y_m]]], dtype=np.float32)
            dst = cv2.perspectiveTransform(src, self.H_inv)
            u, v = dst[0][0]
            return float(u), float(v)
        else:
            vec = np.array([x_m, y_m, 1.0], dtype=np.float64)
            res = np.dot(self.H_inv, vec)
            w = res[2] if abs(res[2]) > 1e-9 else 1e-9
            return float(res[0] / w), float(res[1] / w)

    def is_inside_penalty_area(self, x_m: float, y_m: float, target_goal_x: float = 105.0) -> bool:
        """
        Checks if pitch coordinate (x_m, y_m) falls within the 16.5m penalty box.
        """
        box_y_top = (self.pitch_width - PENALTY_AREA_WIDTH_M) / 2.0
        box_y_bot = box_y_top + PENALTY_AREA_WIDTH_M

        if target_goal_x > 52.5:
            box_x_min = self.pitch_length - PENALTY_AREA_LENGTH_M
            return (box_x_min <= x_m <= self.pitch_length) and (box_y_top <= y_m <= box_y_bot)
        else:
            box_x_max = PENALTY_AREA_LENGTH_M
            return (0.0 <= x_m <= box_x_max) and (box_y_top <= y_m <= box_y_bot)

    def project_pitch_line(
        self,
        x1_m: float,
        y1_m: float,
        x2_m: float,
        y2_m: float,
    ) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """
        Projects a straight line segment on the pitch (in meters) into camera pixel coordinates.
        """
        u1, v1 = self.pitch_to_pixel(x1_m, y1_m)
        u2, v2 = self.pitch_to_pixel(x2_m, y2_m)
        return (int(round(u1)), int(round(v1))), (int(round(u2)), int(round(v2)))
