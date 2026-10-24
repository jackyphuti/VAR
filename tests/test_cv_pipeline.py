"""
test_cv_pipeline.py - Unit test suite for Automated Football VAR Computer Vision Pipeline.

Verifies:
1. Homography projection and inverse projection (< 1cm round-trip error).
2. Offside calculations under IFAB Law 11 (behind the ball, in own half, ahead of 2nd-last defender).
3. Penalty area boundary checks (Law 12).
4. Circular HSV color feature mapping (resolving red-jersey wrap-around).
5. Pose estimation playable body part isolation and arm silhouette angle calculation.
"""

import math
import numpy as np
import pytest

from cv_pipeline.homography import PitchHomography
from cv_pipeline.offside_engine import OffsideEngine, OffsideResult
from cv_pipeline.detector import TeamClassifier, TrackedObject
from cv_pipeline.pose_analyzer import PoseAnalyzer, PLAYABLE_KEYPOINTS, EXCLUDED_ARM_KEYPOINTS


class TestHomography:
    """Tests for homography projection accuracy and boundary detection."""

    def setup_method(self):
        self.homography = PitchHomography()

    def test_round_trip_accuracy(self):
        """Verify pixel_to_pitch and pitch_to_pixel round-trip error is < 1 cm (0.01m)."""
        test_points_pitch = [
            (55.0, 10.0),
            (75.0, 34.0),
            (88.5, 20.0),
            (94.0, 34.0),
            (102.0, 50.0),
        ]

        for x_m, y_m in test_points_pitch:
            u, v = self.homography.pitch_to_pixel(x_m, y_m)
            recovered_x, recovered_y = self.homography.pixel_to_pitch(u, v)

            error_x = abs(recovered_x - x_m)
            error_y = abs(recovered_y - y_m)

            assert error_x < 0.01, f"X round-trip error ({error_x:.4f}m) exceeded 1cm for ({x_m}, {y_m})"
            assert error_y < 0.01, f"Y round-trip error ({error_y:.4f}m) exceeded 1cm for ({x_m}, {y_m})"

    def test_penalty_area_boundaries(self):
        """Verify detection of points inside vs outside the 16.5m penalty box."""
        # Penalty spot (X=94, Y=34) is inside the right penalty box (88.5m to 105.0m, Y=13.84 to 54.16m)
        assert self.homography.is_inside_penalty_area(94.0, 34.0) is True
        assert self.homography.is_inside_penalty_area(100.0, 20.0) is True

        # Midfield (X=70, Y=34) is outside
        assert self.homography.is_inside_penalty_area(70.0, 34.0) is False

        # Sideline outside penalty box width (X=95, Y=60)
        assert self.homography.is_inside_penalty_area(95.0, 60.0) is False


class TestOffsideEngine:
    """Tests for IFAB Law 11 offside logic."""

    def setup_method(self):
        self.homography = PitchHomography()
        self.engine = OffsideEngine(self.homography, attacking_direction=1)

    def test_attacker_in_own_half_is_never_offside(self):
        """Law 11: An attacker cannot be in an offside position in their own half (< 52.5m)."""
        # Defenders at X=50m and X=45m (both in their own half)
        # Attacker at X=48m
        u_def1, v_def1 = self.homography.pitch_to_pixel(50.0, 30.0)
        u_def2, v_def2 = self.homography.pitch_to_pixel(45.0, 30.0)
        u_att, v_att = self.homography.pitch_to_pixel(48.0, 30.0)

        obj_def1 = TrackedObject(track_id=1, class_name="person", bbox=(u_def1-10, v_def1-20, u_def1+10, v_def1), confidence=0.9, team="Team B")
        obj_def2 = TrackedObject(track_id=2, class_name="person", bbox=(u_def2-10, v_def2-20, u_def2+10, v_def2), confidence=0.9, team="Team B")
        obj_att = TrackedObject(track_id=10, class_name="person", bbox=(u_att-10, v_att-20, u_att+10, v_att), confidence=0.9, team="Team A")

        result = self.engine.evaluate_offside(10, [obj_def1, obj_def2, obj_att])
        assert result is not None
        assert result.is_offside is False
        assert result.offside_delta_cm <= 0.0

    def test_attacker_behind_ball_is_never_offside(self):
        """Law 11: An attacker behind the line of the ball is never offside."""
        u_def1, v_def1 = self.homography.pitch_to_pixel(102.0, 34.0) # GK
        u_def2, v_def2 = self.homography.pitch_to_pixel(80.0, 34.0)  # 2nd last def
        u_ball, v_ball = self.homography.pitch_to_pixel(85.0, 34.0)  # Ball ahead at 85m
        u_att, v_att = self.homography.pitch_to_pixel(82.0, 34.0)   # Attacker at 82m (ahead of defender, but behind ball!)

        obj_def1 = TrackedObject(track_id=1, class_name="person", bbox=(u_def1-10, v_def1-20, u_def1+10, v_def1), confidence=0.9, team="Goalkeeper")
        obj_def2 = TrackedObject(track_id=2, class_name="person", bbox=(u_def2-10, v_def2-20, u_def2+10, v_def2), confidence=0.9, team="Team B")
        obj_ball = TrackedObject(track_id=-1, class_name="ball", bbox=(u_ball-5, v_ball-5, u_ball+5, v_ball+5), confidence=0.9)
        obj_att = TrackedObject(track_id=10, class_name="person", bbox=(u_att-10, v_att-20, u_att+10, v_att), confidence=0.9, team="Team A")

        result = self.engine.evaluate_offside(20, [obj_def1, obj_def2, obj_ball, obj_att])
        assert result is not None
        assert result.is_offside is False

    def test_attacker_ahead_of_second_last_defender_is_offside(self):
        """Law 11: Attacker ahead of 2nd last defender and ahead of ball in opponent half is offside."""
        u_def1, v_def1 = self.homography.pitch_to_pixel(102.0, 34.0) # GK at 102m
        u_def2, v_def2 = self.homography.pitch_to_pixel(84.0, 34.0)  # 2nd last def at 84m
        u_att, v_att = self.homography.pitch_to_pixel(84.5, 34.0)   # Attacker at 84.5m (+50cm offside!)
        u_ball, v_ball = self.homography.pitch_to_pixel(70.0, 34.0)  # Ball passed from 70m

        obj_def1 = TrackedObject(track_id=1, class_name="person", bbox=(u_def1-10, v_def1-20, u_def1+10, v_def1), confidence=0.9, team="Goalkeeper")
        obj_def2 = TrackedObject(track_id=2, class_name="person", bbox=(u_def2-10, v_def2-20, u_def2+10, v_def2), confidence=0.9, team="Team B")
        obj_ball = TrackedObject(track_id=-1, class_name="ball", bbox=(u_ball-5, v_ball-5, u_ball+5, v_ball+5), confidence=0.9)
        obj_att = TrackedObject(track_id=10, class_name="person", bbox=(u_att-10, v_att-20, u_att+10, v_att), confidence=0.9, team="Team A")

        result = self.engine.evaluate_offside(30, [obj_def1, obj_def2, obj_ball, obj_att])
        assert result is not None
        assert result.is_offside is True
        assert result.offside_delta_cm > 40.0


class TestTeamClassifierCircular:
    """Tests for circular trigonometric HSV classification."""

    def test_circular_red_hue_continuity(self):
        """Verify that H=5 and H=175 map close together in circular coordinate space."""
        hsv_low_red = np.array([5, 200, 200], dtype=np.uint8)
        hsv_high_red = np.array([175, 200, 200], dtype=np.uint8)

        feat_low = TeamClassifier.hsv_to_circular_feature(hsv_low_red)
        feat_high = TeamClassifier.hsv_to_circular_feature(hsv_high_red)

        # Distance should be very small (< 0.2), whereas in linear space |175 - 5| = 170
        dist = np.linalg.norm(feat_low - feat_high)
        assert dist < 0.25, f"Circular distance between red hues {dist:.3f} was too large"


class TestPoseAnalyzer:
    """Tests for Law 11 anatomical exclusions and Law 12 arm angle calculation."""

    def test_excluded_arm_keypoints(self):
        """Law 11: Hands and arms (wrists/elbows) must be excluded from playable body parts."""
        for arm_kpt in EXCLUDED_ARM_KEYPOINTS:
            assert arm_kpt not in PLAYABLE_KEYPOINTS, f"Arm keypoint {arm_kpt} was incorrectly included in playable parts"

    def test_arm_silhouette_angle(self):
        """Verify that horizontal arm extended at 90 degrees triggers unnatural silhouette (> 45 deg)."""
        v_torso = np.array([0.0, 1.0]) # Straight down along spine
        v_arm_horizontal = np.array([1.0, 0.0]) # Extended right

        angle = PoseAnalyzer._vector_angle_deg(v_torso, v_arm_horizontal)
        assert math.isclose(angle, 90.0, abs_tol=1.0)
        assert angle > 45.0, "90-degree arm extension should exceed 45-degree silhouette threshold"
