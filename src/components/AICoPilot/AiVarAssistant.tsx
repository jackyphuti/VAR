import React, { useState } from 'react';
import {
  ScenarioId,
  AiVarAnalysis,
  RecommendedAction,
  MatchRestart,
  DisciplinaryCard,
} from '../../types/var';
import { Bot, Sparkles, Check, ChevronDown, ChevronUp, ShieldAlert, ArrowRight } from 'lucide-react';

interface AiVarAssistantProps {
  scenarioId: ScenarioId;
  currentFrame: number;
  saotDeltaCm: number;
  onApplyRecommendation: (
    action: RecommendedAction,
    restart: MatchRestart,
    sanction: DisciplinaryCard,
    notes: string
  ) => void;
}

export const AiVarAssistant: React.FC<AiVarAssistantProps> = ({
  scenarioId,
  currentFrame,
  saotDeltaCm,
  onApplyRecommendation,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [applied, setApplied] = useState<boolean>(false);

  // Synthesize AI frame analysis based on active scenario and current frame
  const getAiAnalysis = (): AiVarAnalysis => {
    if (scenarioId === 'tight_offside') {
      const isOffside = saotDeltaCm > 0;
      return {
        confidenceScore: 98.7,
        thresholdMet: isOffside,
        ifabClause: 'IFAB Law 11.1 & 11.2 (Offside in Attacking Possession Phase)',
        primaryFinding: isOffside
          ? `Attacker is in an active offside position by +${Math.abs(saotDeltaCm).toFixed(1)} cm at the first point of contact of the pass. Factual offside verified by SAOT.`
          : `Attacker is onside by ${Math.abs(saotDeltaCm).toFixed(1)} cm. Legal attacking position.`,
        recommendedAction: isOffside ? 'FACTUAL_OVERTURN' : 'NO_INTERVENTION',
        recommendedRestart: isOffside ? 'INDIRECT_FREE_KICK' : 'KICK_OFF',
        recommendedSanction: 'NONE',
        telemetryBreakdown: {
          offsideDeltaCm: saotDeltaCm,
          ballVelocityMs: 24.5,
        },
      };
    }

    if (scenarioId === 'penalty_tackle') {
      return {
        confidenceScore: 96.4,
        thresholdMet: true,
        ifabClause: 'IFAB Law 12.1 (Excessive Force) & Law 12.3 (Serious Foul Play)',
        primaryFinding:
          'Defender lunged at high velocity with exposed studs making primary contact above the lateral malleolus. No ball contact. Endangers player safety.',
        recommendedAction: 'ON_FIELD_REVIEW',
        recommendedRestart: 'PENALTY_KICK',
        recommendedSanction: 'RED',
        telemetryBreakdown: {
          collisionIoU: 0.41,
          studElevationCm: 18.5,
          ballVelocityMs: 14.2,
        },
      };
    }

    if (scenarioId === 'goal_line_handball') {
      return {
        confidenceScore: 97.2,
        thresholdMet: true,
        ifabClause: 'IFAB Law 12.1 (Handball) & Law 12.3 (DOGSO Denial by Handball)',
        primaryFinding:
          'Defender jumped with right arm extended horizontally (88° silhouette angle away from torso), unnaturally blocking header trajectory on the goal-line.',
        recommendedAction: 'ON_FIELD_REVIEW',
        recommendedRestart: 'PENALTY_KICK',
        recommendedSanction: 'RED',
        telemetryBreakdown: {
          silhouetteAngleDeg: 88,
          collisionIoU: 0.38,
        },
      };
    }

    // glt_millimeter_check
    return {
      confidenceScore: 99.9,
      thresholdMet: false,
      ifabClause: 'IFAB Law 10 (Determining Outcome) & Law 9 (Ball In and Out of Play)',
      primaryFinding:
        'Ball has not wholly crossed the outer boundary of the 12.0 cm goal line (3.4 mm overhang remains on line). Factual No Goal.',
      recommendedAction: 'NO_INTERVENTION',
      recommendedRestart: 'DROP_BALL',
      recommendedSanction: 'NONE',
      telemetryBreakdown: {
        lineOverhangMm: -3.4,
      },
    };
  };

  const analysis = getAiAnalysis();

  const handleApply = () => {
    onApplyRecommendation(
      analysis.recommendedAction,
      analysis.recommendedRestart,
      analysis.recommendedSanction,
      analysis.primaryFinding
    );
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-2.5 shadow-xl">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-purple-900/60 border border-purple-600 text-purple-300">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <span>AI VAR Co-Pilot Analyzer</span>
              <Sparkles className="w-3 h-3 text-purple-400" />
            </h3>
            <span className="text-[10px] text-gray-400 font-mono-telemetry">
              Neural Frame Telemetry &bull; IFAB Grounded
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/60 font-mono-telemetry font-bold text-xs text-purple-200">
            {analysis.confidenceScore}% CONFIDENCE
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2.5 pt-1 text-xs">
          {/* Finding Banner */}
          <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-purple-900/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-400 font-bold uppercase font-mono-telemetry">
                {analysis.ifabClause}
              </span>
              <span
                className={`text-[9px] font-mono-telemetry font-bold px-1.5 py-0.2 rounded ${
                  analysis.thresholdMet
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {analysis.thresholdMet ? 'THRESHOLD MET (INTERVENE)' : 'CALL CONFIRMED'}
              </span>
            </div>
            <p className="text-gray-200 font-mono-telemetry text-[11px] leading-relaxed">
              {analysis.primaryFinding}
            </p>
          </div>

          {/* Telemetry Pills */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono-telemetry text-[10px]">
            {analysis.telemetryBreakdown.offsideDeltaCm !== undefined && (
              <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2937] text-gray-300">
                SAOT Delta: <strong className={analysis.telemetryBreakdown.offsideDeltaCm > 0 ? 'text-red-400' : 'text-emerald-400'}>{analysis.telemetryBreakdown.offsideDeltaCm}cm</strong>
              </span>
            )}
            {analysis.telemetryBreakdown.collisionIoU !== undefined && (
              <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2937] text-gray-300">
                Impact IoU: <strong className="text-amber-400">{analysis.telemetryBreakdown.collisionIoU}</strong>
              </span>
            )}
            {analysis.telemetryBreakdown.studElevationCm !== undefined && (
              <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2937] text-gray-300">
                Stud Height: <strong className="text-red-400">{analysis.telemetryBreakdown.studElevationCm}cm</strong>
              </span>
            )}
            {analysis.telemetryBreakdown.silhouetteAngleDeg !== undefined && (
              <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2937] text-gray-300">
                Arm Angle: <strong className="text-red-400">{analysis.telemetryBreakdown.silhouetteAngleDeg}°</strong>
              </span>
            )}
            {analysis.telemetryBreakdown.lineOverhangMm !== undefined && (
              <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2937] text-gray-300">
                Overhang: <strong className="text-amber-400">{analysis.telemetryBreakdown.lineOverhangMm}mm</strong>
              </span>
            )}
          </div>

          {/* 1-Click Apply AI Recommendation Button */}
          <button
            onClick={handleApply}
            className={`w-full py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg ${
              applied
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {applied ? (
              <>
                <Check className="w-4 h-4" />
                <span>APPLIED TO CHECKLIST &amp; RADIO SCRIPT</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Apply AI Recommendation ({analysis.recommendedAction.replace(/_/g, ' ')})</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
