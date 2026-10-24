"""
offside_engine.py - Automated Pass Detection & Semi-Automated Offside Technology (SAOT).

Detects kick point (t_pass) via ball acceleration & player proximity, identifies the
second-last defender in metric pitch coordinates, checks attacking players' position,
and generates perspective-accurate 3D offside overlays and 2D radar minimaps.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from .detector import TrackedObject
from .homography import PitchHomography

logger = logging.getLogger("VAR.OffsideEngine")


@dataclass
class OffsideResult:
    """Detailed outcome of an SAOT evaluation at pass release frame."""
    frame_idx: int
    is_offside: bool
    offside_delta_cm: float  # Positive = Offside, Negative = Onside
    second_last_defender_id: int
    second_last_defender_pitch_pos: Tuple[float, float]
    leading_attacker_id: int
    leading_attacker_pitch_pos: Tuple[float, float]
    kick_point_detected: bool
    attacking_team: str
    defending_team: str


class OffsideEngine:
    """
    Automated Offside Engine complying with IFAB Law 11.
    Evaluates player positions relative to the second-last opponent at the exact frame of the pass.
    """

    def __init__(
        self,
        homography: PitchHomography,
        attacking_direction: int = 1,  # 1: attacking towards X=105m (right), -1: towards X=0m (left)
        attacking_team: str = "Team A",
        defending_team: str = "Team B",
    ):
        self.homography = homography
        self.attacking_direction = attacking_direction
        self.attacking_team = attacking_team
        self.defending_team = defending_team

        # Historical tracking for pass kick-point detection
        self.ball_positions: List[Tuple[int, float, float]] = []  # (frame_idx, x_m, y_m)
        self.ball_speeds: List[Tuple[int, float]] = []
        self.kick_frame_detected: Optional[int] = None

    def update_ball_trajectory(self, frame_idx: int, ball_obj: Optional[TrackedObject]) -> Optional[int]:
        """
        Tracks ball position in pitch coordinates and detects sharp acceleration changes
        corresponding to a forward pass contact event.
        """
        if ball_obj is None:
            return None

        bx, by = ball_obj.feet_pos
        try:
            x_m, y_m = self.homography.pixel_to_pitch(bx, by)
        except Exception:
            return None

        self.ball_positions.append((frame_idx, x_m, y_m))
        if len(self.ball_positions) < 3:
            return None

        # Calculate speed between last two frames (at 60fps, dt = 1/60s)
        dt = 1.0 / 60.0
        p1 = self.ball_positions[-2]
        p2 = self.ball_positions[-1]
        dist = np.hypot(p2[1] - p1[1], p2[2] - p1[2])
        speed = dist / dt  # m/s
        self.ball_speeds.append((frame_idx, speed))

        if len(self.ball_speeds) >= 3:
            s_prev = self.ball_speeds[-2][1]
            s_curr = self.ball_speeds[-1][1]
            # Acceleration spike > 12 m/s^2 indicating kicking impulse
            accel = (s_curr - s_prev) / dt
            if accel > 12.0 and s_curr > 5.0 and self.kick_frame_detected is None:
                self.kick_frame_detected = frame_idx - 1
                logger.info("Pass release frame (kick point) identified at frame %d", self.kick_frame_detected)
                return self.kick_frame_detected

        return None

    def evaluate_offside(
        self,
        frame_idx: int,
        tracked_objects: List[TrackedObject],
    ) -> Optional[OffsideResult]:
        """
        Performs SAOT evaluation according to IFAB Law 11:
        1. Find second-last defender's deepest playable body point (using feet/torso proxy).
        2. Find deepest attacking player ahead of the ball.
        3. Determine metric distance delta in centimeters.
        """
        defenders: List[Tuple[int, float, float]] = []  # (id, x_m, y_m)
        attackers: List[Tuple[int, float, float]] = []
        ball_pos_m: Optional[Tuple[float, float]] = None

        for obj in tracked_objects:
            if obj.class_name == "ball":
                try:
                    ball_pos_m = self.homography.pixel_to_pitch(obj.feet_pos[0], obj.feet_pos[1])
                except Exception:
                    pass
                continue

            try:
                x_m, y_m = self.homography.pixel_to_pitch(obj.feet_pos[0], obj.feet_pos[1])
            except Exception:
                continue

            if obj.team == self.defending_team or obj.team == "Goalkeeper":
                defenders.append((obj.track_id, x_m, y_m))
            elif obj.team == self.attacking_team:
                attackers.append((obj.track_id, x_m, y_m))

        if len(defenders) < 2 or len(attackers) == 0:
            return None

        # Sort defenders by position along pitch length
        # If attacking right (direction = 1), larger X is closer to goal
        if self.attacking_direction > 0:
            defenders.sort(key=lambda d: d[1], reverse=True)
            attackers.sort(key=lambda a: a[1], reverse=True)
            second_last_def = defenders[1]  # 0 is usually goalkeeper (or deepest defender)
            leading_att = attackers[0]

            # Offside line is maximum of second-last defender and halfway line (52.5m)
            # and ball position (cannot be offside if behind the ball)
            ref_line_x = max(second_last_def[1], 52.5)
            if ball_pos_m is not None:
                ref_line_x = max(ref_line_x, ball_pos_m[0])

            delta_meters = leading_att[1] - ref_line_x
        else:
            defenders.sort(key=lambda d: d[1], reverse=False)
            attackers.sort(key=lambda a: a[1], reverse=False)
            second_last_def = defenders[1]
            leading_att = attackers[0]

            ref_line_x = min(second_last_def[1], 52.5)
            if ball_pos_m is not None:
                ref_line_x = min(ref_line_x, ball_pos_m[0])

            delta_meters = ref_line_x - leading_att[1]

        delta_cm = float(delta_meters * 100.0)
        is_offside = delta_cm > 0.0

        return OffsideResult(
            frame_idx=frame_idx,
            is_offside=is_offside,
            offside_delta_cm=round(delta_cm, 1),
            second_last_defender_id=second_last_def[0],
            second_last_defender_pitch_pos=(second_last_def[1], second_last_def[2]),
            leading_attacker_id=leading_att[0],
            leading_attacker_pitch_pos=(leading_att[1], leading_att[2]),
            kick_point_detected=(self.kick_frame_detected == frame_idx),
            attacking_team=self.attacking_team,
            defending_team=self.defending_team,
        )

    def draw_offside_overlay(
        self,
        frame: np.ndarray,
        result: OffsideResult,
    ) -> np.ndarray:
        """
        Renders broadcast-quality 3D perspective offside lines and radar minimap.
        - Solid Blue line across grass for the 2nd-last defender.
        - Dashed Red/Green line across grass for the leading attacker.
        - Offside distance HUD pill badge.
        - Top-down 2D radar minimap in bottom-left corner.
        """
        out = frame.copy()
        h, w = out.shape[:2]

        def_x = result.second_last_defender_pitch_pos[0]
        att_x = result.leading_attacker_pitch_pos[0]

        # 1. Project Defender Line across width (y=0 to y=68)
        p_def_top, p_def_bot = self.homography.project_pitch_line(def_x, 0.0, def_x, 68.0)
        cv2.line(out, p_def_top, p_def_bot, (255, 120, 0), 3, cv2.LINE_AA)  # Blue/Cyan

        # 2. Project Attacker Line across width
        att_color = (0, 0, 230) if result.is_offside else (0, 200, 50)  # Red if offside, Emerald if onside
        p_att_top, p_att_bot = self.homography.project_pitch_line(att_x, 0.0, att_x, 68.0)
        self._draw_dashed_line(out, p_att_top, p_att_bot, att_color, thickness=2, dash_length=15)

        # 3. Offside HUD Pill Badge
        status_text = f"OFFSIDE: +{result.offside_delta_cm:.1f} cm" if result.is_offside else f"ONSIDE: {result.offside_delta_cm:.1f} cm"
        badge_bg = (20, 20, 180) if result.is_offside else (20, 140, 40)

        badge_x, badge_y = 60, 60
        (tw, th), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_DUPLEX, 0.8, 2)
        cv2.rectangle(out, (badge_x - 10, badge_y - 30), (badge_x + tw + 20, badge_y + 15), (15, 15, 20), -1)
        cv2.rectangle(out, (badge_x - 10, badge_y - 30), (badge_x + tw + 20, badge_y + 15), badge_bg, 2)
        cv2.putText(out, status_text, (badge_x, badge_y), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

        # 4. Render 2D Top-Down Radar Minimap in bottom-left
        self._render_minimap(out, result)

        return out

    def _render_minimap(self, frame: np.ndarray, result: OffsideResult) -> None:
        """Renders an anti-aliased 2D pitch radar overlay in bottom corner."""
        h, w = frame.shape[:2]
        map_w, map_h = 240, 155
        mx, my = 30, h - map_h - 30

        # Pitch background
        sub = frame[my:my+map_h, mx:mx+map_w]
        overlay = np.full_like(sub, 25)
        cv2.addWeighted(overlay, 0.85, sub, 0.15, 0, sub)
        cv2.rectangle(frame, (mx, my), (mx + map_w, my + map_h), (80, 80, 80), 1)

        # Halfway line & penalty box outlines in radar
        half_x = int(mx + map_w * 0.5)
        cv2.line(frame, (half_x, my), (half_x, my + map_h), (100, 100, 100), 1)

        # Draw Defender 2D line
        def_map_x = int(mx + (result.second_last_defender_pitch_pos[0] / 105.0) * map_w)
        cv2.line(frame, (def_map_x, my), (def_map_x, my + map_h), (255, 140, 0), 2)

        # Draw Attacker 2D line
        att_map_x = int(mx + (result.leading_attacker_pitch_pos[0] / 105.0) * map_w)
        line_color = (0, 0, 240) if result.is_offside else (0, 220, 80)
        cv2.line(frame, (att_map_x, my), (att_map_x, my + map_h), line_color, 2)

        # Label
        cv2.putText(frame, "SAOT 2D RADAR", (mx + 8, my + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

    @staticmethod
    def _draw_dashed_line(
        img: np.ndarray,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        color: Tuple[int, int, int],
        thickness: int = 2,
        dash_length: int = 10,
    ) -> None:
        """Draws an anti-aliased dashed line between two points."""
        dist = np.hypot(pt2[0] - pt1[0], pt2[1] - pt1[1])
        if dist < 1e-3:
            return
        dashes = int(dist / dash_length)
        for i in range(0, dashes, 2):
            t1 = i / dashes
            t2 = min((i + 1) / dashes, 1.0)
            p1 = (int(pt1[0] + (pt2[0] - pt1[0]) * t1), int(pt1[1] + (pt2[1] - pt1[1]) * t1))
            p2 = (int(pt1[0] + (pt2[0] - pt1[0]) * t2), int(pt1[1] + (pt2[1] - pt1[1]) * t2))
            cv2.line(img, p1, p2, color, thickness, cv2.LINE_AA)
