import { MatchScenario, ScenarioId } from '../types/var';

export const MATCH_SCENARIOS: MatchScenario[] = [
  {
    id: 'tight_offside',
    title: 'Tight Offside in Attacking Possession Phase (APP) Leading to Goal',
    matchClock: "58:42",
    minute: 59,
    category: 'GOAL_NO_GOAL',
    originalCall: 'GOAL AWARDED (ON-FIELD CALL)',
    recommendedAction: 'FACTUAL_OVERTURN',
    description: 'Deep through-ball struck toward the right half-space. Attacking striker #9 leans ahead of the 2nd-last defender #4 at the exact moment of kick contact, receiving the ball and scoring.',
    totalFrames: 240,
    kickFrame: 72,
    incidentFrame: 145,
    defaultSaot: {
      defenderPitchX: 84.60,
      attackerPitchX: 84.742,
      deltaCm: 14.2,
      isOffside: true,
    },
    suggestedChecklist: {
      category: 'GOAL_NO_GOAL',
    },
  },
  {
    id: 'penalty_tackle',
    title: 'Penalty Area Challenge: Studs-Up Lunge Above Ankle',
    matchClock: "74:18",
    minute: 75,
    category: 'PENALTY_NO_PENALTY',
    originalCall: 'NO PENALTY - PLAY ON (NO FOUL)',
    recommendedAction: 'ON_FIELD_REVIEW',
    description: 'Attacker cuts into the 16.5m penalty area. Defender lunges recklessly at high speed with exposed studs contacting the opponent directly above the lateral malleolus (ankle) with excessive force.',
    totalFrames: 240,
    kickFrame: 90,
    incidentFrame: 110,
    defaultSaot: {
      defenderPitchX: 91.20,
      attackerPitchX: 90.40,
      deltaCm: -80.0,
      isOffside: false,
    },
    suggestedChecklist: {
      category: 'PENALTY_NO_PENALTY',
      sfp: {
        excessiveForce: true,
        studsExposed: true,
        pointOfContact: 'ABOVE_ANKLE_SHIN',
        speedIntensity: 'HIGH_LUNGE',
        endangeringSafety: true,
      },
    },
  },
  {
    id: 'goal_line_handball',
    title: 'Goal-Line Handball Block: Unnatural Silhouette Denial',
    matchClock: "89:05",
    minute: 90,
    category: 'DIRECT_RED_CARD',
    originalCall: 'CORNER KICK (ON-FIELD CALL)',
    recommendedAction: 'ON_FIELD_REVIEW',
    description: 'Header from a corner kick directed toward the upper corner of the net. Defending player jumps with right arm extended horizontally away from the body, unnaturally blocking the ball from crossing the goal line.',
    totalFrames: 240,
    kickFrame: 45,
    incidentFrame: 115,
    defaultSaot: {
      defenderPitchX: 104.5,
      attackerPitchX: 99.8,
      deltaCm: -470.0,
      isOffside: false,
    },
    suggestedChecklist: {
      category: 'DIRECT_RED_CARD',
      handball: {
        unnaturalSilhouette: true,
        deliberateMovement: true,
        immediateGoalByScorer: false,
        closeProximityDeflection: false,
      },
      dogso: {
        distanceToGoal: 'CLOSE',
        directionOfPlay: 'TOWARDS_GOAL',
        likelihoodOfControl: true,
        defendersCount: 'NONE_EXCEPT_GK',
        insidePenaltyArea: true,
        genuineAttemptToPlayBall: false,
      },
    },
  },
];

export interface Player3D {
  id: number;
  team: 'ATTACKER' | 'DEFENDER' | 'GOALKEEPER' | 'REFEREE';
  number: number;
  pitchX: number; // 0..105 meters
  pitchY: number; // 0..68 meters
  z: number;      // elevation in meters
  actionState?: string;
}

export interface ScenarioFrameState {
  ball: { x: number; y: number; z: number };
  players: Player3D[];
  passFrame: boolean;
  incidentFrame: boolean;
  offsideMarginCm: number;
}

/**
 * Computes synchronized 3D metric coordinates for all participants
 * across the 4 cameras for any given frame index.
 */
export function getScenarioFrameState(scenarioId: ScenarioId, frame: number): ScenarioFrameState {
  const norm = (frame % 240) / 240;

  if (scenarioId === 'tight_offside') {
    // Kick occurs at frame 72
    const isPostKick = frame >= 72;
    const kickProgress = isPostKick ? (frame - 72) / (240 - 72) : 0;

    // Ball moves from passer (x=62, y=34) towards striker (x=98, y=30)
    let ballX = 62 + (isPostKick ? kickProgress * 36 : (frame / 72) * 2);
    let ballY = 34 + (isPostKick ? kickProgress * -4 : 0);
    let ballZ = isPostKick ? Math.sin(kickProgress * Math.PI) * 1.5 : 0.15;

    // Defender #4 (Second-last defender) tracking back
    const defX = 84.60 - (frame / 240) * 2.5;
    const defY = 32.0 + Math.sin(frame * 0.05) * 0.4;

    // Attacker #9 (Striker) making darting run behind defense
    // At frame 72: Attacker is at 84.742m (+14.2cm offside!)
    const attX = isPostKick
      ? 84.742 + kickProgress * 15.0
      : 80.0 + (frame / 72) * 4.742;
    const attY = 30.5 + Math.sin(frame * 0.04) * 0.3;

    return {
      ball: { x: ballX, y: ballY, z: ballZ },
      players: [
        { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 102.5, pitchY: 34.0, z: 0 },
        { id: 4, team: 'DEFENDER', number: 4, pitchX: defX, pitchY: defY, z: 0 },
        { id: 5, team: 'DEFENDER', number: 5, pitchX: defX - 1.8, pitchY: 42.0, z: 0 },
        { id: 2, team: 'DEFENDER', number: 2, pitchX: defX + 1.2, pitchY: 20.0, z: 0 },
        { id: 9, team: 'ATTACKER', number: 9, pitchX: attX, pitchY: attY, z: 0 },
        { id: 10, team: 'ATTACKER', number: 10, pitchX: 63.5, pitchY: 34.5, z: 0 },
        { id: 7, team: 'ATTACKER', number: 7, pitchX: attX - 6.0, pitchY: 18.0, z: 0 },
        { id: 99, team: 'REFEREE', number: 0, pitchX: 70.0, pitchY: 48.0, z: 0 },
      ],
      passFrame: frame === 72,
      incidentFrame: frame >= 140 && frame <= 150,
      offsideMarginCm: 14.2,
    };
  }

  if (scenarioId === 'penalty_tackle') {
    // Attacker dribbling inside box (x ~ 92, y ~ 32), defender tackles at frame 110
    const tackleTime = frame >= 110;
    const preTackle = frame < 110;
    const tProgress = frame / 240;

    const attX = preTackle ? 88.0 + (frame / 110) * 3.5 : 91.5 + (frame - 110) * 0.05;
    const attY = preTackle ? 34.0 - (frame / 110) * 1.5 : 32.5;
    const attFallZ = tackleTime ? Math.max(0, 1.2 - (frame - 110) * 0.08) : 0;

    const defX = preTackle ? 94.0 - (frame / 110) * 2.5 : 91.5;
    const defY = preTackle ? 30.0 + (frame / 110) * 2.4 : 32.4;

    const ballX = preTackle ? attX + 0.8 : 93.0 + (frame - 110) * 0.15;
    const ballY = preTackle ? attY + 0.2 : 36.0;

    return {
      ball: { x: ballX, y: ballY, z: 0.15 },
      players: [
        { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 103.0, pitchY: 34.0, z: 0 },
        { id: 10, team: 'ATTACKER', number: 10, pitchX: attX, pitchY: attY, z: attFallZ, actionState: tackleTime ? 'FALLEN' : 'DRIBBLING' },
        { id: 3, team: 'DEFENDER', number: 3, pitchX: defX, pitchY: defY, z: 0, actionState: frame >= 100 ? 'LUNGING_STUDS_UP' : 'RUNNING' },
        { id: 4, team: 'DEFENDER', number: 4, pitchX: 95.0, pitchY: 42.0, z: 0 },
        { id: 99, team: 'REFEREE', number: 0, pitchX: 78.0, pitchY: 28.0, z: 0 },
      ],
      passFrame: frame === 90,
      incidentFrame: frame >= 108 && frame <= 118,
      offsideMarginCm: -80.0,
    };
  }

  // goal_line_handball
  const cornerInFlight = frame < 115;
  const cProgress = frame / 115;
  const ballX = cornerInFlight ? 104.5 - (1 - cProgress) * 18 : 104.2;
  const ballY = cornerInFlight ? 0.0 + cProgress * 32.0 : 32.5;
  const ballZ = cornerInFlight ? Math.sin(cProgress * Math.PI) * 4.0 + 0.5 : 1.8;

  return {
    ball: { x: ballX, y: ballY, z: ballZ },
    players: [
      { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 104.2, pitchY: 36.0, z: 0 },
      { id: 5, team: 'DEFENDER', number: 5, pitchX: 104.5, pitchY: 33.0, z: 0, actionState: frame >= 110 ? 'ARM_EXTENDED' : 'JUMPING' },
      { id: 9, team: 'ATTACKER', number: 9, pitchX: 99.8, pitchY: 33.5, z: 0, actionState: 'HEADING' },
      { id: 99, team: 'REFEREE', number: 0, pitchX: 92.0, pitchY: 48.0, z: 0 },
    ],
    passFrame: frame === 45,
    incidentFrame: frame >= 112 && frame <= 120,
    offsideMarginCm: -470.0,
  };
}
