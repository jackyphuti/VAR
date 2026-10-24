"""
Football Virtual Assistant Referee (VAR) Computer Vision Pipeline.
Modules for automated tracking, homography mapping, offside determination, and incident detection.
"""

from .detector import PlayerDetector, TrackedObject
from .homography import PitchHomography
from .offside_engine import OffsideEngine, OffsideResult
from .incident_detector import IncidentDetector, IncidentPayload

__all__ = [
    "PlayerDetector",
    "TrackedObject",
    "PitchHomography",
    "OffsideEngine",
    "OffsideResult",
    "IncidentDetector",
    "IncidentPayload",
]
