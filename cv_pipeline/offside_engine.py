"""
offside_engine.py - Automated Pass Detection & Semi-Automated Offside Technology (SAOT).

Detects kick point (t_pass) via ball acceleration & player proximity, identifies the
second-last defender in metric pitch coordinates, checks attacking players' position,
and locks the evaluated offside line for 3 seconds (180 frames) per IFAB Law 11.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
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
    is_locked: bool = True


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
        kick_cooldown_frames: int = 90,
        lock_hold_frames: int = 180,  # 3.0 seconds at 60fps
    ):
        self.homography = homography
        self.attacking_direction = attacking_direction
        self.attacking_team = attacking_team
        self.defending_team = defending_team
        self.kick_cooldown_frames = kick_cooldown_frames
        self.lock_hold_frames = lock_hold_frames

        # Historical tracking for pass kick-point detection
        self.ball_positions: List[Tuple[int, float, float]] = []  # (frame_idx, x_m, y_m)
        self.ball_speeds: List[Tuple[int, float]] = []
        self.kick_frame_detected: Optional[int] = None
        self.cooldown_counter: int = 0

        # Locked evaluation state
        self.locked_offside_result: Optional[OffsideResult] = None
        self.locked_until_frame: int = 0

    def update_ball_trajectory(
        self,
        frame_idx: int,
        ball_obj: Optional[TrackedObject],
        players: Optional[List[TrackedObject]] = None,
    ) -> Optional[int]:
        """
        Tracks ball position in pitch coordinates and detects sharp acceleration changes
        coinciding with player proximity (< 1.2m) to register a valid forward pass contact.
        """
        if self.cooldown_counter > 0:
            self.cooldown_counter -= 1
            if self.cooldown_counter == 0:
                self.kick_frame_detected = None

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

        dt = 1.0 / 60.0
        p1 = self.ball_positions[-2]
        p2 = self.ball_positions[-1]
        dist = float(np.hypot(p2[1] - p1[1], p2[2] - p1[2]))
        speed = dist / dt  # m/s
        self.ball_speeds.append((frame_idx, speed))

        if len(self.ball_speeds) >= 3 and self.kick_frame_detected is None:
            s_prev = self.ball_speeds[-2][1]
            s_curr = self.ball_speeds[-1][1]
            accel = (s_curr - s_prev) / dt

            # Acceleration spike indicating kicking impulse
            if accel > 12.0 and s_curr > 4.5:
                # Proximity check: verify at least one player is within 1.2m
                has_player_proximity = True
                if players:
                    min_player_dist = 999.0
                    for p in players:
                        if p.class_name == "person":
                            try:
                                px, py = self.homography.pixel_to_pitch(p.feet_pos[0], p.feet_pos[1])
                                d = np.hypot(px - x_m, py - y_m)
                                if d < min_player_dist:
                                    min_player_dist = d
                            except Exception:
                                continue
                    has_player_proximity = (min_player_dist <= 1.5)

                if has_player_proximity:
                    self.kick_frame_detected = frame_idx - 1
                    self.cooldown_counter = self.kick_cooldown_frames
                    logger.info("Pass contact confirmed at frame %d (accel=%.1f m/s^2)", self.kick_frame_detected, accel)
                    return self.kick_frame_detected

        return None

    def evaluate_offside(
        self,
        frame_idx: int,
        tracked_objects: List[TrackedObject],
    ) -> Optional[OffsideResult]:
        """
        Performs SAOT evaluation according to IFAB Law 11:
        1. If a pass frame was just detected, compute and lock the result for lock_hold_frames.
        2. If within locked window, return the locked result with is_locked=True.
        3. Otherwise return live positional evaluation.
        """
        # If currently locked, continue returning the locked pass frame result
        if self.locked_offside_result is not None and frame_idx <= self.locked_until_frame:
            return self.locked_offside_result

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

            if obj.team in (self.defending_team, "Goalkeeper"):
                defenders.append((obj.track_id, x_m, y_m))
            elif obj.team == self.attacking_team:
                attackers.append((obj.track_id, x_m, y_m))

        if len(defenders) < 2 or len(attackers) == 0:
            return None

        # Sort defenders by position along pitch length
        if self.attacking_direction > 0:
            defenders.sort(key=lambda d: d[1], reverse=True)
            attackers.sort(key=lambda a: a[1], reverse=True)
            second_last_def = defenders[1]
            leading_att = attackers[0]

            # Player cannot be offside in their own half (< 52.5m)
            ref_line_x = max(second_last_def[1], 52.5)
            # Player cannot be offside if behind the ball
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

        is_kick_point = (self.kick_frame_detected == frame_idx)

        res = OffsideResult(
            frame_idx=frame_idx,
            is_offside=is_offside,
            offside_delta_cm=round(delta_cm, 1),
            second_last_defender_id=second_last_def[0],
            second_last_defender_pitch_pos=(second_last_def[1], second_last_def[2]),
            leading_attacker_id=leading_att[0],
            leading_attacker_pitch_pos=(leading_att[1], leading_att[2]),
            kick_point_detected=is_kick_point,
            attacking_team=self.attacking_team,
            defending_team=self.defending_team,
            is_locked=is_kick_point,
        )

        if is_kick_point:
            self.locked_offside_result = res
            self.locked_until_frame = frame_idx + self.lock_hold_frames
            logger.info("Locked SAOT line at pass frame %d (holding for %d frames)", frame_idx, self.lock_hold_frames)

        return res

    def draw_offside_overlay(
        self,
        frame: np.ndarray,
        result: OffsideResult,
    ) -> np.ndarray:
        """
        Renders broadcast-quality 3D perspective offside lines and radar minimap.
        """
        out = frame.copy()
        h, w = out.shape[:2]

        def_x = result.second_last_defender_pitch_pos[0]
        att_x = result.leading_attacker_pitch_pos[0]

        # 1. Project Defender Line across width (y=0 to y=68)
        p_def_top, p_def_bot = self.homography.project_pitch_line(def_x, 0.0, def_x, 68.0)
        cv2.line(out, p_def_top, p_def_bot, (255, 120, 0), 3, cv2.LINE_AA)

        # 2. Project Attacker Line across width
        att_color = (0, 0, 230) if result.is_offside else (0, 200, 50)
        p_att_top, p_att_bot = self.homography.project_pitch_line(att_x, 0.0, att_x, 68.0)
        self._draw_dashed_line(out, p_att_top, p_att_bot, att_color, thickness=2, dash_length=15)

        # 3. Offside HUD Pill Badge with Locked Status indicator
        status_text = f"OFFSIDE: +{result.offside_delta_cm:.1f} cm" if result.is_offside else f"ONSIDE: {result.offside_delta_cm:.1f} cm"
        badge_bg = (20, 20, 180) if result.is_offside else (20, 140, 40)

        badge_x, badge_y = 60, 60
        (tw, th), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_DUPLEX, 0.8, 2)
        cv2.rectangle(out, (badge_x - 10, badge_y - 30), (badge_x + tw + 20, badge_y + 15), (15, 15, 20), -1)
        cv2.rectangle(out, (badge_x - 10, badge_y - 30), (badge_x + tw + 20, badge_y + 15), badge_bg, 2)
        cv2.putText(out, status_text, (badge_x, badge_y), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

        if result.is_locked:
            lock_label = f"PASS FRAME LOCKED [F:{result.frame_idx}]"
            cv2.rectangle(out, (badge_x - 10, badge_y + 20), (badge_x + tw + 20, badge_y + 42), (0, 80, 180), -1)
            cv2.putText(out, lock_label, (badge_x, badge_y + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # 4. Render 2D Top-Down Radar Minimap in bottom-left
        self._render_minimap(out, result)

        return out

    def _render_minimap(self, frame: np.ndarray, result: OffsideResult) -> None:
        """Renders an anti-aliased 2D pitch radar overlay in bottom corner."""
        h, w = frame.shape[:2]
        map_w, map_h = 240, 155
        mx, my = 30, h - map_h - 30

        sub = frame[my:my+map_h, mx:mx+map_w]
        overlay = np.full_like(sub, 25)
        cv2.addWeighted(overlay, 0.85, sub, 0.15, 0, sub)
        cv2.rectangle(frame, (mx, my), (mx + map_w, my + map_h), (80, 80, 80), 1)

        half_x = int(mx + map_w * 0.5)
        cv2.line(frame, (half_x, my), (half_x, my + map_h), (100, 100, 100), 1)

        def_map_x = int(mx + (result.second_last_defender_pitch_pos[0] / 105.0) * map_w)
        cv2.line(frame, (def_map_x, my), (def_map_x, my + map_h), (255, 140, 0), 2)

        att_map_x = int(mx + (result.leading_attacker_pitch_pos[0] / 105.0) * map_w)
        line_color = (0, 0, 240) if result.is_offside else (0, 220, 80)
        cv2.line(frame, (att_map_x, my), (att_map_x, my + map_h), line_color, 2)

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
