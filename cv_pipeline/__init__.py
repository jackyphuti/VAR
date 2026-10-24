"""
Football Virtual Assistant Referee (VAR) Computer Vision Pipeline.
Modules for automated tracking, homography mapping, offside determination,
pose estimation, and incident detection.
"""

from .detector import PlayerDetector, TrackedObject, TeamClassifier
from .homography import PitchHomography
from .offside_engine import OffsideEngine, OffsideResult
from .incident_detector import IncidentDetector, IncidentPayload
from .pose_analyzer import PoseAnalyzer, PlayerPose, HandballContactResult

__all__ = [
    "PlayerDetector",
    "TrackedObject",
    "TeamClassifier",
    "PitchHomography",
    "OffsideEngine",
    "OffsideResult",
    "IncidentDetector",
    "IncidentPayload",
    "PoseAnalyzer",
    "PlayerPose",
    "HandballContactResult",
]
