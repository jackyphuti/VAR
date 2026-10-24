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
    description: 'Deep through-ball struck toward the right half-space. Attacking striker #9 runs ahead of the 2nd-last defender #4 at the exact moment of kick contact, receiving the ball and scoring.',
    totalFrames: 240,
    kickFrame: 72,
    incidentFrame: 145,
    appPhases: [
      { id: 'p1', name: 'APP Start (Possession Regained)', frame: 15, description: 'Tackle in midfield initiates attacking phase', badgeColor: '#3B82F6' },
      { id: 'p2', name: 'Buildup & Turn', frame: 45, description: 'Midfielder turns away from pressing midfielder', badgeColor: '#6366F1' },
      { id: 'p3', name: 'Pass Release (Kick Point)', frame: 72, description: 'Through-ball struck to striker', badgeColor: '#F59E0B' },
      { id: 'p4', name: 'Goal Incident', frame: 145, description: 'Striker slots ball past goalkeeper', badgeColor: '#10B981' },
    ],
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
    appPhases: [
      { id: 'p1', name: 'APP Start (Interception)', frame: 20, description: 'Ball intercepted in opponent half', badgeColor: '#3B82F6' },
      { id: 'p2', name: 'Dribble into 18-Yard Box', frame: 60, description: 'Attacker takes on defender 1v1', badgeColor: '#6366F1' },
      { id: 'p3', name: 'Penetrating Touch (Kick Point)', frame: 90, description: 'Attacker knocks ball towards goal', badgeColor: '#F59E0B' },
      { id: 'p4', name: 'Point of Contact (Foul)', frame: 110, description: 'Studs make contact above lateral malleolus', badgeColor: '#EF4444' },
    ],
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
    appPhases: [
      { id: 'p1', name: 'Corner Kick Taken', frame: 15, description: 'Delivery into the 6-yard area', badgeColor: '#3B82F6' },
      { id: 'p2', name: 'Header Contact (Kick Point)', frame: 45, description: 'Attacking header on target', badgeColor: '#F59E0B' },
      { id: 'p3', name: 'Ball Trajectory in Flight', frame: 85, description: 'Ball traveling towards top corner', badgeColor: '#6366F1' },
      { id: 'p4', name: 'Handball Contact (Incident)', frame: 115, description: 'Arm extended horizontally blocks ball', badgeColor: '#EF4444' },
    ],
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
  {
    id: 'glt_millimeter_check',
    title: 'Goal-Line Technology: 99% Ball Over Line Millimeter Check',
    matchClock: "90+3:14",
    minute: 94,
    category: 'GOAL_NO_GOAL',
    originalCall: 'NO GOAL - PLAY CONTINUES (ON-FIELD CALL)',
    recommendedAction: 'NO_INTERVENTION',
    description: 'Scramble inside the 6-yard box. Striker shots towards goal, goalkeeper claws ball off the goal line. GLT high-speed Hawkeye cameras evaluate ball curvature overhang relative to the outer edge of the 12cm line.',
    totalFrames: 240,
    kickFrame: 50,
    incidentFrame: 112,
    appPhases: [
      { id: 'p1', name: 'APP Start (Loose Ball)', frame: 15, description: 'Possession contested in penalty box', badgeColor: '#3B82F6' },
      { id: 'p2', name: 'Shot on Goal (Kick Point)', frame: 50, description: 'Low drive towards bottom corner', badgeColor: '#F59E0B' },
      { id: 'p3', name: 'Goalkeeper Desperation Dive', frame: 85, description: 'Goalkeeper reaches arm back towards line', badgeColor: '#6366F1' },
      { id: 'p4', name: 'Line Clearance (GLT Check)', frame: 112, description: 'Ball clawed off goal-line (3.4mm on line)', badgeColor: '#EF4444' },
    ],
    defaultSaot: {
      defenderPitchX: 104.9,
      attackerPitchX: 103.5,
      deltaCm: -140.0,
      isOffside: false,
    },
    suggestedChecklist: {
      category: 'GOAL_NO_GOAL',
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
  actionState?: 'STANDING' | 'RUNNING' | 'DRIBBLING' | 'FALLEN' | 'LUNGING_STUDS_UP' | 'ARM_EXTENDED' | 'HEADING' | 'JUMPING';
}

export interface ScenarioFrameState {
  ball: { x: number; y: number; z: number };
  players: Player3D[];
  passFrame: boolean;
  incidentFrame: boolean;
  offsideMarginCm: number;
  gltData?: {
    overhangMm: number;
    isWhollyOver: boolean;
  };
}

/**
 * Computes synchronized 3D metric coordinates for all participants
 * across the 4 cameras for any given frame index.
 */
export function getScenarioFrameState(scenarioId: ScenarioId, frame: number): ScenarioFrameState {
  if (scenarioId === 'tight_offside') {
    const isPostKick = frame >= 72;
    const kickProgress = isPostKick ? (frame - 72) / (240 - 72) : 0;

    let ballX = 62 + (isPostKick ? kickProgress * 36 : (frame / 72) * 2);
    let ballY = 34 + (isPostKick ? kickProgress * -4 : 0);
    let ballZ = isPostKick ? Math.sin(kickProgress * Math.PI) * 1.5 : 0.15;

    const defX = 84.60 - (frame / 240) * 2.5;
    const defY = 32.0 + Math.sin(frame * 0.05) * 0.4;

    const attX = isPostKick
      ? 84.742 + kickProgress * 15.0
      : 80.0 + (frame / 72) * 4.742;
    const attY = 30.5 + Math.sin(frame * 0.04) * 0.3;

    return {
      ball: { x: ballX, y: ballY, z: ballZ },
      players: [
        { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 102.5, pitchY: 34.0, z: 0 },
        { id: 4, team: 'DEFENDER', number: 4, pitchX: defX, pitchY: defY, z: 0, actionState: 'RUNNING' },
        { id: 5, team: 'DEFENDER', number: 5, pitchX: defX - 1.8, pitchY: 42.0, z: 0, actionState: 'RUNNING' },
        { id: 2, team: 'DEFENDER', number: 2, pitchX: defX + 1.2, pitchY: 20.0, z: 0, actionState: 'RUNNING' },
        { id: 9, team: 'ATTACKER', number: 9, pitchX: attX, pitchY: attY, z: 0, actionState: 'RUNNING' },
        { id: 10, team: 'ATTACKER', number: 10, pitchX: 63.5, pitchY: 34.5, z: 0, actionState: 'RUNNING' },
        { id: 7, team: 'ATTACKER', number: 7, pitchX: attX - 6.0, pitchY: 18.0, z: 0, actionState: 'RUNNING' },
        { id: 99, team: 'REFEREE', number: 0, pitchX: 70.0, pitchY: 48.0, z: 0, actionState: 'RUNNING' },
      ],
      passFrame: frame === 72,
      incidentFrame: frame >= 140 && frame <= 150,
      offsideMarginCm: 14.2,
    };
  }

  if (scenarioId === 'penalty_tackle') {
    const tackleTime = frame >= 110;
    const preTackle = frame < 110;

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
        { id: 4, team: 'DEFENDER', number: 4, pitchX: 95.0, pitchY: 42.0, z: 0, actionState: 'RUNNING' },
        { id: 99, team: 'REFEREE', number: 0, pitchX: 78.0, pitchY: 28.0, z: 0, actionState: 'RUNNING' },
      ],
      passFrame: frame === 90,
      incidentFrame: frame >= 108 && frame <= 118,
      offsideMarginCm: -80.0,
    };
  }

  if (scenarioId === 'goal_line_handball') {
    const cornerInFlight = frame < 115;
    const cProgress = frame / 115;
    const ballX = cornerInFlight ? 104.5 - (1 - cProgress) * 18 : 104.2;
    const ballY = cornerInFlight ? 0.0 + cProgress * 32.0 : 32.5;
    const ballZ = cornerInFlight ? Math.sin(cProgress * Math.PI) * 4.0 + 0.5 : 1.8;

    // Attacker jumps and leans forward to head the ball (Frame 30-70)
    const isAttackerHeading = frame >= 30 && frame <= 75;

    // Defender jumps and extends right arm horizontally into unnatural silhouette (Frame 95-135)
    const isDefenderArmExtended = frame >= 95 && frame <= 140;

    return {
      ball: { x: ballX, y: ballY, z: ballZ },
      players: [
        { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 104.2, pitchY: 36.0, z: 0, actionState: 'STANDING' },
        {
          id: 5,
          team: 'DEFENDER',
          number: 5,
          pitchX: 104.5,
          pitchY: 33.0,
          z: isDefenderArmExtended ? 0.45 : 0,
          actionState: isDefenderArmExtended ? 'ARM_EXTENDED' : 'JUMPING',
        },
        {
          id: 9,
          team: 'ATTACKER',
          number: 9,
          pitchX: 99.8,
          pitchY: 33.5,
          z: isAttackerHeading ? 0.55 : 0,
          actionState: isAttackerHeading ? 'HEADING' : 'RUNNING',
        },
        { id: 99, team: 'REFEREE', number: 0, pitchX: 92.0, pitchY: 48.0, z: 0, actionState: 'RUNNING' },
      ],
      passFrame: frame === 45,
      incidentFrame: frame >= 112 && frame <= 120,
      offsideMarginCm: -470.0,
    };
  }

  // glt_millimeter_check (Goal Line Technology Scenario)
  const isPreClear = frame < 112;
  const shotProgress = Math.min(1.0, frame / 112);

  // Ball moves from shot (x=96, y=34) right to the edge of the goal line (x=105.0)
  // At frame 112, ball center is at 104.9966m (ball radius is 0.11m -> 11cm).
  // Goal line outer edge is at 105.0m + 0.12m = 105.12m.
  // Ball leading edge: 104.9966 + 0.11 = 105.1066m.
  // Overhang = 105.1066m - 105.12m = -0.0134m (-13.4mm or -3.4mm touching outer edge!) -> NO GOAL
  let bX = 96.0 + shotProgress * 8.997;
  let bY = 34.0 + Math.sin(shotProgress * Math.PI) * 0.8;
  let bZ = 0.12;

  // Overhang calculation in mm (positive = wholly over line, negative = touching line)
  const lineOuterEdge = 105.0 + 0.12; // 105.12
  const ballTrailingEdge = bX - 0.11; // 100% must cross 105.12
  const overhangMm = (ballTrailingEdge - lineOuterEdge) * 1000;
  const isWhollyOver = overhangMm > 0;

  return {
    ball: { x: bX, y: bY, z: bZ },
    players: [
      { id: 1, team: 'GOALKEEPER', number: 1, pitchX: 104.8, pitchY: 33.5, z: 0, actionState: isPreClear ? 'RUNNING' : 'FALLEN' },
      { id: 9, team: 'ATTACKER', number: 9, pitchX: 97.0, pitchY: 34.0, z: 0, actionState: 'RUNNING' },
      { id: 4, team: 'DEFENDER', number: 4, pitchX: 103.5, pitchY: 36.0, z: 0, actionState: 'RUNNING' },
      { id: 99, team: 'REFEREE', number: 0, pitchX: 95.0, pitchY: 45.0, z: 0, actionState: 'RUNNING' },
    ],
    passFrame: frame === 50,
    incidentFrame: frame >= 110 && frame <= 116,
    offsideMarginCm: -140.0,
    gltData: {
      overhangMm: Number(overhangMm.toFixed(1)),
      isWhollyOver,
    },
  };
}
