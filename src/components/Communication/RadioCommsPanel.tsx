import React, { useState } from 'react';
import {
  VarStatus,
  VarCategory,
  RecommendedAction,
  MatchRestart,
  DisciplinaryCard,
} from '../../types/var';
import { playRadioChirp, playRadioSquelch } from '../../utils/audio';
import { Radio, Mic, Copy, Check, Volume2 } from 'lucide-react';

interface RadioCommsPanelProps {
  status: VarStatus;
  category: VarCategory;
  action: RecommendedAction;
  restart: MatchRestart;
  sanction: DisciplinaryCard;
  saotDeltaCm?: number;
  matchClock: string;
}

export const RadioCommsPanel: React.FC<RadioCommsPanelProps> = ({
  status,
  category,
  action,
  restart,
  sanction,
  saotDeltaCm = 0,
  matchClock,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Generate official IFAB VAR radio speech
  const generateRadioScript = (): string => {
    if (status === 'MONITORING') {
      return `[${matchClock}] VAR to Referee: "All clear, check complete on that phase. Play continues."`;
    }

    if (category === 'GOAL_NO_GOAL') {
      if (action === 'FACTUAL_OVERTURN') {
        return `[${matchClock}] VAR to Referee: "Delay, delay, checking possible offside in the Attacking Possession Phase (APP)... We have established the pass contact frame. Attacking striker is in an offside position by +${Math.abs(saotDeltaCm).toFixed(1)} cm ahead of the second-last defender. Factual offside verified. Overturn goal: Disallow goal, restart with Indirect Free Kick."`;
      }
      return `[${matchClock}] VAR to Referee: "Delay, delay, checking goal in the APP... Checking attacking foul, handball, and ball in play. Check complete, goal confirmed, legal restart with Kick-Off."`;
    }

    if (category === 'PENALTY_NO_PENALTY') {
      if (action === 'ON_FIELD_REVIEW') {
        return `[${matchClock}] VAR to Referee: "Delay, delay, checking possible penalty and Serious Foul Play inside the penalty area. Recommend an On-Field Review for possible penalty kick and direct red card. I will show you the exact point of contact at 25% speed, followed by full speed to assess speed and force."`;
      }
      return `[${matchClock}] VAR to Referee: "Checking potential penalty inside the area... Clear touch on the ball by the defender, mutual contact, no clear error. Check complete, play on."`;
    }

    if (category === 'DIRECT_RED_CARD') {
      return `[${matchClock}] VAR to Referee: "Delay, delay, checking potential Direct Red Card for Serious Foul Play / DOGSO. Recommend an On-Field Review at the Referee Review Area. Point of contact is above the ankle with studs exposed and excessive force."`;
    }

    return `[${matchClock}] VAR to Referee: "Checking potential mistaken identity. The center referee cautioned player #4, but the foul was committed by player #6. Recommend factual correction: Rescind yellow card for #4, issue yellow card to #6."`;
  };

  const script = generateRadioScript();

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePushToTalkDown = () => {
    setIsTransmitting(true);
    playRadioChirp();
    // Optional Speech Synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(script.replace(/\[\d+:\d+\] VAR to Referee: /g, ''));
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePushToTalkUp = () => {
    setIsTransmitting(false);
    playRadioSquelch();
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-3 space-y-2.5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-1.5">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">
            Referee Intercom &amp; Radio Comms
          </h3>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono-telemetry text-emerald-400 font-bold">CH-1: CENTER REF SECURE</span>
        </div>
      </div>

      {/* Script Box */}
      <div className="relative bg-[#0B0F19] p-2.5 rounded border border-[#1F2937] font-mono-telemetry text-xs text-emerald-300/90 leading-relaxed min-h-[72px]">
        {script}

        <button
          onClick={handleCopy}
          title="Copy radio transcript"
          className="absolute top-2 right-2 p-1 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-300 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Push-to-Talk and Intercom Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onMouseDown={handlePushToTalkDown}
          onMouseUp={handlePushToTalkUp}
          onTouchStart={handlePushToTalkDown}
          onTouchEnd={handlePushToTalkUp}
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition select-none shadow-md ${
            isTransmitting
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>{isTransmitting ? 'TRANSMITTING TO REFEREE...' : 'HOLD PUSH-TO-TALK (PTT)'}</span>
        </button>

        <button
          onClick={() => {
            playRadioChirp();
            setTimeout(playRadioSquelch, 300);
          }}
          title="Test radio squelch chirp"
          className="p-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-300 transition"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
