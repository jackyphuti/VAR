import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  MistakenIdentityState,
  MatchIncident,
  GltState,
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
import { GoalLineTechPanel } from './components/GLT/GoalLineTechPanel';
import { AiVarAssistant } from './components/AICoPilot/AiVarAssistant';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CameraFeedCanvas } from './components/VideoDeck/CameraFeedCanvas';
import { playAlertTone } from './utils/audio';
import { Tv, Play, Pause, ChevronRight, X, ArrowLeft } from 'lucide-react';

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
  const [totalFrames, setTotalFrames] = useState<number>(activeScenario.totalFrames);
  const [activeCam, setActiveCam] = useState<CameraId>('cam_16m');

  // Custom uploaded video handling (Part A.3)
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // SAOT State (Part A.1)
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

  // Goal-Line Technology State (Part B.1)
  const [gltState, setGltState] = useState<GltState>({
    active: false,
    ballPitchX: 105.1066, // 105.12m is outer edge; 105.1066 is 13.4mm on line
    ballPitchY: 34.0,
    ballElevationM: 0.12,
    ballDiameterCm: 22.0,
    goalLineWidthCm: 12.0,
    overhangMm: -3.4,
    isGoal: false,
    watchSignal: 'NO_GOAL',
    cameraView: 'top_down',
  });

  // Decision Tree / Checklist State (Part A.4)
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

  const [mistakenIdentityState, setMistakenIdentityState] = useState<MistakenIdentityState>({
    incorrectPlayerNumber: 4,
    correctPlayerNumber: 6,
    verifiedByMultiAngle: true,
    sanctionToTransfer: 'YELLOW',
  });

  // Operational VAR Status & Live Stopwatch (Part A.4)
  const [varStatus, setVarStatus] = useState<VarStatus>('VAR_CHECK_IN_PROGRESS');
  const [reviewDurationSecs, setReviewDurationSecs] = useState<number>(34);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(true);

  // Referee Review Area (RRA) Pitch-Side Mode (Part B.5)
  const [isRraModeActive, setIsRraModeActive] = useState<boolean>(false);
  const [rraPlaybackPhase, setRraPlaybackPhase] = useState<'slow_mo_contact' | 'normal_speed_intensity'>('slow_mo_contact');
  const [rraLoopCounter, setRraLoopCounter] = useState<number>(0);

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
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Synchronize scenario switches
  const handleSelectScenario = (id: ScenarioId) => {
    setSelectedScenarioId(id);
    const scen = MATCH_SCENARIOS.find((s) => s.id === id);
    if (!scen) return;

    setCurrentFrame(scen.kickFrame);
    setIsPlaying(false);
    setCategory(scen.category);
    setRecommendedAction(scen.recommendedAction);
    setTotalFrames(scen.totalFrames);
    setIsRraModeActive(false);

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
    } else if (scen.id === 'glt_millimeter_check') {
      setRestart('DROP_BALL');
      setSanction('NONE');
      setVarStatus('VAR_CHECK_IN_PROGRESS');
      setReviewDurationSecs(18);
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

  // Live Stopwatch Ticker (Part A.4)
  useEffect(() => {
    if (!isStopwatchRunning) return;
    if (varStatus !== 'VAR_CHECK_IN_PROGRESS' && varStatus !== 'ON_FIELD_REVIEW') return;

    const timer = setInterval(() => {
      setReviewDurationSecs((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isStopwatchRunning, varStatus]);

  // Playback Animation Loop (60 FPS clock simulation)
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 1000 / 60 / playbackRate;
    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        let next = prev + 1;
        if (isLooping && loopB !== null && next > loopB) {
          return loopA !== null ? loopA : 0;
        }
        if (next >= totalFrames) {
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackRate, isLooping, loopA, loopB, totalFrames]);

  // Part A.3: Synchronize custom video time with frame counter
  useEffect(() => {
    if (customVideoUrl && videoRef.current) {
      const targetTime = currentFrame / 60;
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.04) {
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [currentFrame, customVideoUrl]);

  // Part B.5: RRA (Referee Review Area) automated speed protocol loop
  useEffect(() => {
    if (!isRraModeActive) return;

    // IFAB Protocol: slow-mo for contact (frames incidentFrame - 15 to incidentFrame + 15), then normal speed for intensity
    const startF = Math.max(0, activeScenario.incidentFrame - 15);
    const endF = Math.min(totalFrames - 1, activeScenario.incidentFrame + 15);

    setLoopA(startF);
    setLoopB(endF);
    setIsLooping(true);
    setIsPlaying(true);

    if (rraPlaybackPhase === 'slow_mo_contact') {
      setPlaybackRate(0.25); // 25% speed
    } else {
      setPlaybackRate(1.0); // 100% normal speed
    }
  }, [isRraModeActive, rraPlaybackPhase, activeScenario.incidentFrame, totalFrames]);

  // Recalculate SAOT Delta whenever defender or attacker crosshairs change (Part A.1)
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

  // Custom Video Upload (Part A.3)
  const handleUploadCustomVideo = (file: File) => {
    const url = URL.createObjectURL(file);
    setCustomVideoUrl(url);

    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.playsInline = true;

    vid.onloadedmetadata = () => {
      const frames = Math.max(60, Math.floor(vid.duration * 60));
      setTotalFrames(frames);
    };

    videoRef.current = vid;
  };

  // Part A.4: Commit and Log Decision into IncidentTimeline
  const handleCommitDecision = () => {
    const updatedDecisionText =
      recommendedAction === 'FACTUAL_OVERTURN'
        ? `${category === 'GOAL_NO_GOAL' ? 'NO GOAL - OFFSIDE' : 'DECISION OVERTURNED'}`
        : recommendedAction === 'ON_FIELD_REVIEW'
        ? `OFR CONFIRMED: ${restart.replace(/_/g, ' ')} + ${sanction} CARD`
        : 'CALL CONFIRMED (CALL STANDS)';

    const newInc: MatchIncident = {
      id: `INC-${String(incidents.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toLocaleTimeString(),
      matchClock: activeScenario.matchClock,
      frameIndex: currentFrame,
      category,
      originalCall: activeScenario.originalCall,
      finalDecision: updatedDecisionText,
      restart,
      sanction,
      status:
        recommendedAction === 'FACTUAL_OVERTURN'
          ? 'CHECK_COMPLETE_OVERTURNED'
          : recommendedAction === 'ON_FIELD_REVIEW'
          ? 'ON_FIELD_REVIEW'
          : 'CHECK_COMPLETE_CONFIRMED',
      durationSeconds: reviewDurationSecs,
      saotDeltaCm: saotState.deltaCm,
      reviewNotes: `Official review of ${category.replace(/_/g, ' ')}. Action: ${recommendedAction}.`,
      radioScript: `Review concluded: ${updatedDecisionText}. Restart: ${restart.replace(/_/g, ' ')}.`,
    };

    setIncidents((prev) => [newInc, ...prev]);
    setSelectedIncidentId(newInc.id);
    playAlertTone('SUCCESS');
  };

  // Part B.6: Global Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently interacting with an input, select, or textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentFrame((prev) => Math.max(0, prev - (e.shiftKey ? 10 : 1)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentFrame((prev) => Math.min(totalFrames - 1, prev + (e.shiftKey ? 10 : 1)));
          break;
        case 'KeyK':
          e.preventDefault();
          setCurrentFrame(activeScenario.kickFrame);
          setIsPlaying(false);
          break;
        case 'KeyI':
          e.preventDefault();
          setCurrentFrame(activeScenario.incidentFrame);
          setIsPlaying(false);
          break;
        case 'Digit1':
          setActiveCam('main_wide');
          break;
        case 'Digit2':
          setActiveCam('cam_16m');
          break;
        case 'Digit3':
          setActiveCam('behind_goal');
          break;
        case 'Digit4':
          setActiveCam('spidercam');
          break;
        case 'BracketLeft':
          setLoopA(currentFrame);
          break;
        case 'BracketRight':
          setLoopB(currentFrame);
          break;
        case 'KeyL':
          setIsLooping((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalFrames, activeScenario.kickFrame, activeScenario.incidentFrame, currentFrame]);

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
        onOpenShortcutsModal={() => setShowShortcutsModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 p-3 space-y-3 max-w-[1920px] mx-auto w-full flex flex-col">
        {/* 2. Status Banner */}
        <StatusBanner
          status={varStatus}
          onChangeStatus={setVarStatus}
          reviewDurationSecs={reviewDurationSecs}
          isStopwatchRunning={isStopwatchRunning}
          onToggleStopwatch={() => setIsStopwatchRunning(!isStopwatchRunning)}
          onResetStopwatch={() => setReviewDurationSecs(0)}
          isRraModeActive={isRraModeActive}
          onToggleRraMode={() => setIsRraModeActive(!isRraModeActive)}
        />

        {/* Part B.5: Fullscreen RRA Pitch-Side Monitor View (when active) */}
        {isRraModeActive ? (
          <div className="flex-1 bg-black rounded-xl border-4 border-purple-600 p-4 flex flex-col shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-ping" />
                <h2 className="text-lg font-black text-white uppercase tracking-widest">
                  REFEREE REVIEW AREA (RRA) &bull; PITCH-SIDE MONITOR
                </h2>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 text-xs font-mono-telemetry font-bold">
                  {rraPlaybackPhase === 'slow_mo_contact' ? 'PHASE 1: 25% SLOW-MOTION (CONTACT)' : 'PHASE 2: 100% FULL SPEED (INTENSITY)'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    setRraPlaybackPhase(
                      rraPlaybackPhase === 'slow_mo_contact' ? 'normal_speed_intensity' : 'slow_mo_contact'
                    )
                  }
                  className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <span>Toggle Speed (Slow-Mo / Real-Time)</span>
                </button>

                <button
                  onClick={() => setIsRraModeActive(false)}
                  className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs flex items-center gap-1.5 border border-gray-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to VOR Multi-Angle Deck</span>
                </button>
              </div>
            </div>

            <div className="flex-1 relative my-3 rounded-lg overflow-hidden border border-purple-900/50">
              <CameraFeedCanvas
                cameraId={activeCam}
                scenarioId={selectedScenarioId}
                frameIndex={currentFrame}
                saotState={saotState}
                onUpdateSaotCrosshair={handleUpdateSaotCrosshair}
                isMaximized={true}
                isCustomVideo={!!customVideoUrl}
                videoElement={videoRef.current}
              />
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] flex items-center justify-between">
              <div className="text-xs text-gray-300 font-mono-telemetry">
                Showing frame <strong>{currentFrame}</strong> &bull; Point of Contact: #{activeScenario.incidentFrame}
              </div>
              <div className="flex items-center space-x-2 font-mono-telemetry text-xs">
                <span className="text-amber-400 font-bold">IFAB RULE:</span>
                <span className="text-gray-300">Slow motion for point of contact; normal speed for tackle intensity.</span>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Control Room Grid: Feeds (Left) + Analysis Instruments (Right) */
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
                  activeCameraId={activeCam}
                  onSelectActiveCamera={setActiveCam}
                />
              </div>

              {/* Broadcast Playback Controls with APP Scrubber */}
              <PlaybackControls
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                isPlaying={isPlaying}
                playbackRate={playbackRate}
                loopA={loopA}
                loopB={loopB}
                isLooping={isLooping}
                kickFrame={activeScenario.kickFrame}
                incidentFrame={activeScenario.incidentFrame}
                appPhases={activeScenario.appPhases}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onStepFrame={(d) => setCurrentFrame((f) => Math.max(0, Math.min(totalFrames - 1, f + d)))}
                onSeekFrame={setCurrentFrame}
                onChangeRate={setPlaybackRate}
                onSetLoopA={() => setLoopA(currentFrame)}
                onSetLoopB={() => setLoopB(currentFrame)}
                onToggleLoop={() => setIsLooping(!isLooping)}
                onClearLoop={() => {
                  setLoopA(null);
                  setLoopB(null);
                  setIsLooping(false);
                }}
                onFreezeKickPoint={() => {
                  setCurrentFrame(activeScenario.kickFrame);
                  setIsPlaying(false);
                }}
                onJumpIncident={() => {
                  setCurrentFrame(activeScenario.incidentFrame);
                  setIsPlaying(false);
                }}
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

            {/* Right Column (5/12 cols): Specialized Tooling + AI Co-Pilot + Decision Tree */}
            <div className="lg:col-span-5 flex flex-col space-y-3 overflow-y-auto pr-1">
              {/* Part B.7: AI Co-Pilot Frame Analyzer */}
              <AiVarAssistant
                scenarioId={selectedScenarioId}
                currentFrame={currentFrame}
                saotDeltaCm={saotState.deltaCm}
                onApplyRecommendation={(act, res, sanc) => {
                  setRecommendedAction(act);
                  setRestart(res);
                  setSanction(sanc);
                }}
              />

              {/* Goal-Line Technology Panel (when GLT scenario active) */}
              {selectedScenarioId === 'glt_millimeter_check' && (
                <GoalLineTechPanel
                  gltState={gltState}
                  onUpdateBallX={(newX) => setGltState((prev) => ({ ...prev, ballPitchX: newX }))}
                />
              )}

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
                mistakenIdentityState={mistakenIdentityState}
                onChangeMistakenIdentity={(up) =>
                  setMistakenIdentityState((prev) => ({ ...prev, ...up }))
                }
                isClearAndObvious={isClearAndObvious}
                onToggleClearAndObvious={() => setIsClearAndObvious(!isClearAndObvious)}
                onCommitDecision={handleCommitDecision}
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
                mistakenIdentityState={mistakenIdentityState}
              />
            </div>
          </div>
        )}
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

      {/* Hardware Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};

export default App;
