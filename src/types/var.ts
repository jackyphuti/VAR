export type CameraId = 'main_wide' | 'cam_16m' | 'behind_goal' | 'spidercam';

export interface CameraFeedConfig {
  id: CameraId;
  name: string;
  shortLabel: string;
  fps: number;
  focalType: string;
  angleDescription: string;
  status: 'ONLINE' | 'STANDBY' | 'CALIBRATING';
}

export type ScenarioId = 'tight_offside' | 'penalty_tackle' | 'goal_line_handball' | 'custom_upload';

export interface MatchScenario {
  id: ScenarioId;
  title: string;
  matchClock: string;
  minute: number;
  category: VarCategory;
  originalCall: string;
  recommendedAction: RecommendedAction;
  suggestedChecklist: {
    category: VarCategory;
    dogso?: Partial<DogsoState>;
    sfp?: Partial<SfpState>;
    handball?: Partial<HandballState>;
  };
  description: string;
  totalFrames: number;
  kickFrame: number;
  incidentFrame: number;
  defaultSaot: {
    defenderPitchX: number;
    attackerPitchX: number;
    deltaCm: number;
    isOffside: boolean;
  };
}

export type VarStatus =
  | 'MONITORING'
  | 'VAR_CHECK_IN_PROGRESS'
  | 'ON_FIELD_REVIEW'
  | 'CHECK_COMPLETE_CONFIRMED'
  | 'CHECK_COMPLETE_OVERTURNED';

export type VarCategory =
  | 'GOAL_NO_GOAL'
  | 'PENALTY_NO_PENALTY'
  | 'DIRECT_RED_CARD'
  | 'MISTAKEN_IDENTITY';

export type RecommendedAction =
  | 'NO_INTERVENTION'
  | 'FACTUAL_OVERTURN'
  | 'ON_FIELD_REVIEW';

export type DisciplinaryCard = 'NONE' | 'YELLOW' | 'RED';

export type MatchRestart =
  | 'KICK_OFF'
  | 'PENALTY_KICK'
  | 'DIRECT_FREE_KICK'
  | 'INDIRECT_FREE_KICK'
  | 'DROP_BALL'
  | 'CORNER_KICK'
  | 'GOAL_KICK';

export interface SaotCrosshair {
  active: boolean;
  screenX: number;
  screenY: number;
  pitchX: number; // in meters (0 to 105)
  pitchY: number; // in meters (0 to 68)
  bodyPart: string;
  heightAboveGrassM: number;
}

export interface SaotState {
  passFrameLocked: boolean;
  lockedKickFrame: number;
  defender: SaotCrosshair;
  attacker: SaotCrosshair;
  deltaCm: number;
  isOffside: boolean;
  show3DLines: boolean;
  showPitchGrid: boolean;
  showRadarMinimap: boolean;
}

export interface DogsoState {
  distanceToGoal: 'CLOSE' | 'MEDIUM' | 'FAR';
  directionOfPlay: 'TOWARDS_GOAL' | 'ANGLED' | 'AWAY';
  likelihoodOfControl: boolean;
  defendersCount: 'NONE_EXCEPT_GK' | 'ONE_RECOVERING' | 'MULTIPLE';
  insidePenaltyArea: boolean;
  genuineAttemptToPlayBall: boolean;
}

export interface SfpState {
  excessiveForce: boolean;
  studsExposed: boolean;
  pointOfContact: 'ABOVE_ANKLE_SHIN' | 'KNEE' | 'FOOT_ON_GRASS';
  speedIntensity: 'HIGH_LUNGE' | 'MODERATE' | 'LOW';
  endangeringSafety: boolean;
}

export interface HandballState {
  unnaturalSilhouette: boolean;
  deliberateMovement: boolean;
  immediateGoalByScorer: boolean;
  closeProximityDeflection: boolean;
}

export interface MistakenIdentityState {
  incorrectPlayerNumber: number;
  correctPlayerNumber: number;
  verifiedByMultiAngle: boolean;
}

export interface MatchIncident {
  id: string;
  timestamp: string;
  matchClock: string;
  frameIndex: number;
  category: VarCategory;
  originalCall: string;
  finalDecision: string;
  restart: MatchRestart;
  sanction: DisciplinaryCard;
  status: VarStatus;
  durationSeconds: number;
  saotDeltaCm?: number;
  reviewNotes: string;
  radioScript: string;
}

export interface BroadcastOverlayConfig {
  showModal: boolean;
  headerTitle: string;
  subTitle: string;
  statusType: 'CHECKING' | 'OFR' | 'DECISION';
  decisionText: string;
  reasonText: string;
  teamHome: string;
  teamAway: string;
  scoreHome: number;
  scoreAway: number;
}
