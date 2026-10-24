import React, { useState, useEffect, useRef } from 'react';
import {
  CameraId,
  ScenarioId,
  VarStatus,
  VarCategory,
  RecommendedAction,
  MatchRestart,
  DisciplinaryCard,
  SaotState,
  DogsoState,
  SfpState,
  HandballState,
  MatchIncident,
} from './types/var';
import { MATCH_SCENARIOS } from './scenarios/matchScenarios';
import { Header } from './components/Header';
import { StatusBanner } from './components/StatusBanner';
import { MultiAngleDeck } from './components/VideoDeck/MultiAngleDeck';
import { PlaybackControls } from './components/VideoDeck/PlaybackControls';
import { SaotCalibrationPanel } from './components/SAOT/SaotCalibrationPanel';
import { DecisionTreeWizard } from './components/Checklist/DecisionTreeWizard';
import { RadioCommsPanel } from './components/Communication/RadioCommsPanel';
import { BroadcastModal } from './components/Communication/BroadcastModal';
import { IncidentTimeline } from './components/Incidents/IncidentTimeline';
import { IncidentReportModal } from './components/Incidents/IncidentReportModal';

export const App: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>('tight_offside');
  const activeScenario = MATCH_SCENARIOS.find((s) => s.id === selectedScenarioId) || MATCH_SCENARIOS[0];

  // Playback state
  const [currentFrame, setCurrentFrame] = useState<number>(activeScenario.kickFrame);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Custom uploaded video handling
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // SAOT State
  const [saotState, setSaotState] = useState<SaotState>({
    passFrameLocked: true,
    lockedKickFrame: activeScenario.kickFrame,
    defender: {
      active: true,
      screenX: 0,
      screenY: 0,
      pitchX: activeScenario.defaultSaot.defenderPitchX,
      pitchY: 32.0,
      bodyPart: 'Boot / Heel',
      heightAboveGrassM: 1.35,
    },
    attacker: {
      active: true,
      screenX: 0,
      screenY: 0,
      pitchX: activeScenario.defaultSaot.attackerPitchX,
      pitchY: 30.5,
      bodyPart: 'Head / Forehead',
      heightAboveGrassM: 1.45,
    },
    deltaCm: activeScenario.defaultSaot.deltaCm,
    isOffside: activeScenario.defaultSaot.isOffside,
    show3DLines: true,
    showPitchGrid: true,
    showRadarMinimap: true,
  });

  // Decision Tree / Checklist State
  const [category, setCategory] = useState<VarCategory>(activeScenario.category);
  const [recommendedAction, setRecommendedAction] = useState<RecommendedAction>(activeScenario.recommendedAction);
  const [restart, setRestart] = useState<MatchRestart>('INDIRECT_FREE_KICK');
  const [sanction, setSanction] = useState<DisciplinaryCard>('NONE');
  const [isClearAndObvious, setIsClearAndObvious] = useState<boolean>(true);

  // Sub-matrix states
  const [dogsoState, setDogsoState] = useState<DogsoState>({
    distanceToGoal: 'CLOSE',
    directionOfPlay: 'TOWARDS_GOAL',
    likelihoodOfControl: true,
    defendersCount: 'NONE_EXCEPT_GK',
    insidePenaltyArea: true,
    genuineAttemptToPlayBall: false,
  });

  const [sfpState, setSfpState] = useState<SfpState>({
    excessiveForce: true,
    studsExposed: true,
    pointOfContact: 'ABOVE_ANKLE_SHIN',
    speedIntensity: 'HIGH_LUNGE',
    endangeringSafety: true,
  });

  const [handballState, setHandballState] = useState<HandballState>({
    unnaturalSilhouette: true,
    deliberateMovement: false,
    immediateGoalByScorer: false,
    closeProximityDeflection: false,
  });

  // Operational VAR Status
  const [varStatus, setVarStatus] = useState<VarStatus>('VAR_CHECK_IN_PROGRESS');
  const [reviewDurationSecs, setReviewDurationSecs] = useState<number>(34);

  // Match Incidents Log
  const [incidents, setIncidents] = useState<MatchIncident[]>([
    {
      id: 'INC-001',
      timestamp: '14:22:05',
      matchClock: '58:42',
      frameIndex: 72,
      category: 'GOAL_NO_GOAL',
      originalCall: 'GOAL AWARDED',
      finalDecision: 'NO GOAL - OFFSIDE',
      restart: 'INDIRECT_FREE_KICK',
      sanction: 'NONE',
      status: 'CHECK_COMPLETE_OVERTURNED',
      durationSeconds: 38,
      saotDeltaCm: 14.2,
      reviewNotes: 'Tight offside in Attacking Possession Phase leading to goal. Striker +14.2cm offside.',
      radioScript: 'Delay, delay. SAOT 3D offside verified (+14.2 cm). Overturn goal: Disallow goal, restart Indirect Free Kick.',
    },
    {
      id: 'INC-002',
      timestamp: '14:41:30',
      matchClock: '74:18',
      frameIndex: 110,
      category: 'PENALTY_NO_PENALTY',
      originalCall: 'NO PENALTY (PLAY ON)',
      finalDecision: 'PENALTY KICK + RED CARD (SFP)',
      restart: 'PENALTY_KICK',
      sanction: 'RED',
      status: 'ON_FIELD_REVIEW',
      durationSeconds: 47,
      saotDeltaCm: -80.0,
      reviewNotes: 'Studs-up challenge above the ankle inside the 16.5m penalty area. Excessive force.',
      radioScript: 'Recommend an On-Field Review for penalty kick and direct red card. Point of contact is above ankle with exposed studs.',
    },
    {
      id: 'INC-003',
      timestamp: '14:58:12',
      matchClock: '89:05',
      frameIndex: 115,
      category: 'DIRECT_RED_CARD',
      originalCall: 'CORNER KICK',
      finalDecision: 'PENALTY KICK + RED CARD (DOGSO)',
      restart: 'PENALTY_KICK',
      sanction: 'RED',
      status: 'CHECK_COMPLETE_OVERTURNED',
      durationSeconds: 52,
      saotDeltaCm: -470.0,
      reviewNotes: 'Defender jumping with unnatural silhouette denying header crossing goal line.',
      radioScript: 'Recommend On-Field Review: Goal line handball denying an obvious goal. Restart: Penalty Kick + Red Card.',
    },
  ]);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>('INC-001');

  // Modals
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Synchronize scenario switches
  const handleSelectScenario = (id: ScenarioId) => {
    setSelectedScenarioId(id);
    const scen = MATCH_SCENARIOS.find((s) => s.id === id);
    if (!scen) return;

    setCurrentFrame(scen.kickFrame);
    setIsPlaying(false);
    setCategory(scen.category);
    setRecommendedAction(scen.recommendedAction);

    if (scen.id === 'tight_offside') {
      setRestart('INDIRECT_FREE_KICK');
      setSanction('NONE');
      setVarStatus('VAR_CHECK_IN_PROGRESS');
      setReviewDurationSecs(38);
      setSelectedIncidentId('INC-001');
    } else if (scen.id === 'penalty_tackle') {
      setRestart('PENALTY_KICK');
      setSanction('RED');
      setVarStatus('ON_FIELD_REVIEW');
      setReviewDurationSecs(47);
      setSelectedIncidentId('INC-002');
    } else if (scen.id === 'goal_line_handball') {
      setRestart('PENALTY_KICK');
      setSanction('RED');
      setVarStatus('ON_FIELD_REVIEW');
      setReviewDurationSecs(52);
      setSelectedIncidentId('INC-003');
    }

    setSaotState((prev) => ({
      ...prev,
      passFrameLocked: true,
      lockedKickFrame: scen.kickFrame,
      defender: {
        ...prev.defender,
        pitchX: scen.defaultSaot.defenderPitchX,
      },
      attacker: {
        ...prev.attacker,
        pitchX: scen.defaultSaot.attackerPitchX,
      },
      deltaCm: scen.defaultSaot.deltaCm,
      isOffside: scen.defaultSaot.isOffside,
    }));
  };

  // Playback Animation Loop (60 FPS clock simulation)
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = (1000 / 60) / playbackRate;
    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        let next = prev + 1;
        if (isLooping && loopB !== null && next > loopB) {
          return loopA !== null ? loopA : 0;
        }
        if (next >= activeScenario.totalFrames) {
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackRate, isLooping, loopA, loopB, activeScenario.totalFrames]);

  // Recalculate SAOT Delta whenever defender or attacker crosshairs change
  const handleUpdateSaotCrosshair = (type: 'defender' | 'attacker', pitchX: number, pitchY: number) => {
    setSaotState((prev) => {
      const nextDefX = type === 'defender' ? pitchX : prev.defender.pitchX;
      const nextAttX = type === 'attacker' ? pitchX : prev.attacker.pitchX;
      const deltaM = nextAttX - nextDefX;
      const deltaCm = Number((deltaM * 100).toFixed(1));

      return {
        ...prev,
        [type]: {
          ...prev[type],
          pitchX,
          pitchY,
        },
        deltaCm,
        isOffside: deltaCm > 0,
      };
    });
  };

  // Custom Video Upload
  const handleUploadCustomVideo = (file: File) => {
    const url = URL.createObjectURL(file);
    setCustomVideoUrl(url);
    if (!videoRef.current) {
      const vid = document.createElement('video');
      vid.src = url;
      vid.muted = true;
      vid.playsInline = true;
      videoRef.current = vid;
    } else {
      videoRef.current.src = url;
    }
  };

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Header */}
      <Header
        scenarios={MATCH_SCENARIOS}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={handleSelectScenario}
        matchClock={activeScenario.matchClock}
        onOpenBroadcastModal={() => setShowBroadcastModal(true)}
        onOpenReportModal={() => setShowReportModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 p-3 space-y-3 max-w-[1920px] mx-auto w-full flex flex-col">
        {/* 2. Status Banner */}
        <StatusBanner
          status={varStatus}
          onChangeStatus={setVarStatus}
          reviewDurationSecs={reviewDurationSecs}
        />

        {/* 3. Primary Control Room Grid: Feeds (Left) + Analysis Instruments (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left Column (7/12 cols): Multi-Angle Deck + Playback Controls + Timeline */}
          <div className="lg:col-span-7 flex flex-col space-y-3 min-h-0">
            {/* Multi-Angle Video Deck */}
            <div className="flex-1 min-h-[460px]">
              <MultiAngleDeck
                scenarioId={selectedScenarioId}
                frameIndex={currentFrame}
                saotState={saotState}
                onUpdateSaotCrosshair={handleUpdateSaotCrosshair}
                onUploadCustomVideo={handleUploadCustomVideo}
                isCustomVideo={!!customVideoUrl}
                videoElement={videoRef.current}
              />
            </div>

            {/* Broadcast Playback Controls */}
            <PlaybackControls
              currentFrame={currentFrame}
              totalFrames={activeScenario.totalFrames}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              loopA={loopA}
              loopB={loopB}
              isLooping={isLooping}
              kickFrame={activeScenario.kickFrame}
              incidentFrame={activeScenario.incidentFrame}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onStepFrame={(d) => setCurrentFrame((f) => Math.max(0, Math.min(activeScenario.totalFrames - 1, f + d)))}
              onSeekFrame={setCurrentFrame}
              onChangeRate={setPlaybackRate}
              onSetLoopA={() => setLoopA(currentFrame)}
              onSetLoopB={() => setLoopB(currentFrame)}
              onToggleLoop={() => setIsLooping(!isLooping)}
              onClearLoop={() => { setLoopA(null); setLoopB(null); setIsLooping(false); }}
              onFreezeKickPoint={() => { setCurrentFrame(activeScenario.kickFrame); setIsPlaying(false); }}
              onJumpIncident={() => { setCurrentFrame(activeScenario.incidentFrame); setIsPlaying(false); }}
            />

            {/* Match Incidents Timeline */}
            <IncidentTimeline
              incidents={incidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={(id) => {
                setSelectedIncidentId(id);
                const inc = incidents.find((i) => i.id === id);
                if (inc) {
                  setCurrentFrame(inc.frameIndex);
                  setCategory(inc.category);
                  setRestart(inc.restart);
                  setSanction(inc.sanction);
                }
              }}
              onOpenReportModal={() => setShowReportModal(true)}
            />
          </div>

          {/* Right Column (5/12 cols): SAOT Tooling + Guided Checklist + Referee Intercom */}
          <div className="lg:col-span-5 flex flex-col space-y-3 overflow-y-auto pr-1">
            {/* SAOT Offside Calibration Panel */}
            <SaotCalibrationPanel
              saotState={saotState}
              currentFrame={currentFrame}
              onTogglePassFrameLock={() =>
                setSaotState((prev) => ({
                  ...prev,
                  passFrameLocked: !prev.passFrameLocked,
                  lockedKickFrame: currentFrame,
                }))
              }
              onUpdateDefenderPoint={(up) =>
                setSaotState((prev) => {
                  const updatedDef = { ...prev.defender, ...up };
                  const deltaM = prev.attacker.pitchX - updatedDef.pitchX;
                  const deltaCm = Number((deltaM * 100).toFixed(1));
                  return { ...prev, defender: updatedDef, deltaCm, isOffside: deltaCm > 0 };
                })
              }
              onUpdateAttackerPoint={(up) =>
                setSaotState((prev) => {
                  const updatedAtt = { ...prev.attacker, ...up };
                  const deltaM = updatedAtt.pitchX - prev.defender.pitchX;
                  const deltaCm = Number((deltaM * 100).toFixed(1));
                  return { ...prev, attacker: updatedAtt, deltaCm, isOffside: deltaCm > 0 };
                })
              }
              onToggle3DLines={() =>
                setSaotState((prev) => ({ ...prev, show3DLines: !prev.show3DLines }))
              }
              onToggleRadar={() =>
                setSaotState((prev) => ({ ...prev, showRadarMinimap: !prev.showRadarMinimap }))
              }
              onResetCalibration={() =>
                setSaotState((prev) => ({
                  ...prev,
                  defender: { ...prev.defender, pitchX: activeScenario.defaultSaot.defenderPitchX },
                  attacker: { ...prev.attacker, pitchX: activeScenario.defaultSaot.attackerPitchX },
                  deltaCm: activeScenario.defaultSaot.deltaCm,
                  isOffside: activeScenario.defaultSaot.isOffside,
                }))
              }
            />

            {/* IFAB Guided Checklist Wizard */}
            <DecisionTreeWizard
              category={category}
              onSelectCategory={setCategory}
              recommendedAction={recommendedAction}
              onSelectAction={setRecommendedAction}
              restart={restart}
              onSelectRestart={setRestart}
              sanction={sanction}
              onSelectSanction={setSanction}
              dogsoState={dogsoState}
              onChangeDogso={(up) => setDogsoState((prev) => ({ ...prev, ...up }))}
              sfpState={sfpState}
              onChangeSfp={(up) => setSfpState((prev) => ({ ...prev, ...up }))}
              handballState={handballState}
              onChangeHandball={(up) => setHandballState((prev) => ({ ...prev, ...up }))}
              isClearAndObvious={isClearAndObvious}
              onToggleClearAndObvious={() => setIsClearAndObvious(!isClearAndObvious)}
            />

            {/* Referee Radio Comms & PTT */}
            <RadioCommsPanel
              status={varStatus}
              category={category}
              action={recommendedAction}
              restart={restart}
              sanction={sanction}
              saotDeltaCm={saotState.deltaCm}
              matchClock={activeScenario.matchClock}
            />
          </div>
        </div>
      </main>

      {/* Broadcast Graphics Modal Preview */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        status={varStatus}
        category={category}
        action={recommendedAction}
        sanction={sanction}
        restart={restart}
        saotDeltaCm={saotState.deltaCm}
        matchClock={activeScenario.matchClock}
      />

      {/* Official Incident Audit Report Modal */}
      <IncidentReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        incident={selectedIncident}
      />
    </div>
  );
};

export default App;
