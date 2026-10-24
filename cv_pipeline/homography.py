"""
homography.py - Planar Homography & 2D Pitch Coordinate Mapping.

Maps image pixels (u, v) from camera broadcast perspective to metric FIFA standard pitch coordinates (X, Y)
where:
  - Pitch dimensions: 105.0 meters length x 68.0 meters width.
  - Coordinate system: Origin (0, 0) at top-left corner flag, (105, 0) at top-right corner,
    (105, 68) at bottom-right corner, (0, 68) at bottom-left corner.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import cv2
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

    def __init__(self, pitch_length: float = PITCH_LENGTH_M, pitch_width: float = PITCH_WIDTH_M):
        self.pitch_length = pitch_length
        self.pitch_width = pitch_width
        self.H: Optional[np.ndarray] = None
        self.H_inv: Optional[np.ndarray] = None
        self._init_default_camera_matrix()

    def _init_default_camera_matrix(self) -> None:
        """
        Initializes a default perspective matrix matching a standard 1080p broadcast wide camera.
        Assumes the camera overlooks the right-hand attacking half from the main stand.
        """
        # Standard camera points (pixels in 1920x1080)
        src_points = np.array([
            [260.0, 320.0],    # Near halfway line touchline
            [1660.0, 330.0],   # Far goal line top touchline
            [1880.0, 980.0],   # Far goal line bottom touchline
            [80.0, 960.0],     # Near halfway line bottom touchline
        ], dtype=np.float32)

        # Corresponding pitch metric coordinates (meters)
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

        Args:
            pixel_points: Nx2 array of (u, v) image coordinates.
            pitch_points_meters: Nx2 array of corresponding (X, Y) pitch coordinates in meters.

        Returns:
            True if homography was successfully calculated.
        """
        if len(pixel_points) < 4 or len(pitch_points_meters) < 4:
            logger.error("At least 4 correspondence points required for homography.")
            return False

        H, status = cv2.findHomography(pixel_points, pitch_points_meters, cv2.RANSAC, 5.0)
        if H is None:
            logger.error("cv2.findHomography failed to solve planar transform.")
            return False

        self.H = H
        try:
            self.H_inv = np.linalg.inv(H)
        except np.linalg.LinAlgError:
            logger.error("Singular homography matrix encountered; cannot invert.")
            return False

        logger.debug("Homography matrix updated successfully.")
        return True

    def pixel_to_pitch(self, u: float, v: float) -> Tuple[float, float]:
        """
        Transforms screen pixel coordinate (u, v) to pitch metric coordinate (X, Y).
        """
        if self.H is None:
            raise RuntimeError("Homography matrix is not initialized.")

        src = np.array([[[u, v]]], dtype=np.float32)
        dst = cv2.perspectiveTransform(src, self.H)
        x_m, y_m = dst[0][0]
        return float(x_m), float(y_m)

    def pitch_to_pixel(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """
        Transforms pitch metric coordinate (X, Y) back to screen pixel coordinate (u, v).
        """
        if self.H_inv is None:
            raise RuntimeError("Inverse homography matrix is not initialized.")

        src = np.array([[[x_m, y_m]]], dtype=np.float32)
        dst = cv2.perspectiveTransform(src, self.H_inv)
        u, v = dst[0][0]
        return float(u), float(v)

    def is_inside_penalty_area(self, x_m: float, y_m: float, target_goal_x: float = 105.0) -> bool:
        """
        Checks if pitch coordinate (x_m, y_m) falls within the 16.5m penalty box.
        """
        box_y_top = (self.pitch_width - PENALTY_AREA_WIDTH_M) / 2.0
        box_y_bot = box_y_top + PENALTY_AREA_WIDTH_M

        if target_goal_x > 52.5:
            # Defending goal at X = 105.0
            box_x_min = self.pitch_length - PENALTY_AREA_LENGTH_M
            return (box_x_min <= x_m <= self.pitch_length) and (box_y_top <= y_m <= box_y_bot)
        else:
            # Defending goal at X = 0.0
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
