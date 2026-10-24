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

export type ScenarioId = 'tight_offside' | 'penalty_tackle' | 'goal_line_handball' | 'glt_millimeter_check' | 'custom_upload';

export interface AppPhase {
  id: string;
  name: string;
  frame: number;
  description: string;
  badgeColor: string;
}

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
    mistakenIdentity?: Partial<MistakenIdentityState>;
  };
  description: string;
  totalFrames: number;
  kickFrame: number;
  incidentFrame: number;
  appPhases?: AppPhase[];
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
  pitchX: number; // in meters (52.5 to 105.0)
  pitchY: number; // in meters (0.0 to 68.0)
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
  show3DCurtain: boolean;
  show29PointLimbMesh: boolean;
  show500HzImuGraph: boolean;
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
  sanctionToTransfer: DisciplinaryCard;
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

/* Telestrator & Tactical Drawing Types */
export type TelestratorTool = 'select' | 'pen' | 'arrow' | 'halo' | 'protractor' | 'loupe';

export interface TelestratorDrawing {
  id: string;
  type: 'pen' | 'arrow' | 'halo' | 'protractor';
  points: { x: number; y: number }[];
  color: string;
  width: number;
  angleDeg?: number;
  distanceM?: number;
}

/* Goal Line Technology (GLT) State */
export interface GltState {
  active: boolean;
  ballPitchX: number; // 105.0 is goal line outer edge
  ballPitchY: number; // 34.0 is goal mouth center
  ballElevationM: number;
  ballDiameterCm: number; // 22.0 cm standard FIFA size 5
  goalLineWidthCm: number; // 12.0 cm standard FIFA line
  overhangMm: number; // positive = wholly over line (GOAL), negative = still on line (NO GOAL)
  isGoal: boolean;
  watchSignal: 'GOAL' | 'NO_GOAL';
  cameraView: 'top_down' | 'cross_section' | '3d_mesh';
}

/* AI Co-Pilot Telemetry & Evaluation */
export interface AiVarAnalysis {
  confidenceScore: number; // 0..100
  thresholdMet: boolean;
  ifabClause: string;
  primaryFinding: string;
  recommendedRestart: MatchRestart;
  recommendedSanction: DisciplinaryCard;
  recommendedAction: RecommendedAction;
  telemetryBreakdown: {
    ballVelocityMs?: number;
    collisionIoU?: number;
    studElevationCm?: number;
    silhouetteAngleDeg?: number;
    offsideDeltaCm?: number;
    dogsoDefendersCount?: number;
    lineOverhangMm?: number;
  };
}

/* Referee Review Area (RRA) Pitch-Side Mode */
export interface RraModeConfig {
  isActive: boolean;
  playbackPhase: 'slow_mo_contact' | 'normal_speed_intensity';
  loopCount: number;
}
