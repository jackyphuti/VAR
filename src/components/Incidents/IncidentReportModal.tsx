import React, { useState } from 'react';
import { MatchIncident } from '../../types/var';
import { X, Download, Printer, Copy, Check, Shield, FileText } from 'lucide-react';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: MatchIncident | null;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  incident,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !incident) return null;

  // Format as IFAB Official Report Markdown
  const formattedReport = `
# IFAB OFFICIAL VAR INCIDENT REPORT
================================================================================
- **INCIDENT SUMMARY & TIMESTAMP**: [${incident.matchClock}] ${incident.reviewNotes}
- **ON-FIELD DECISION**: ${incident.originalCall}
- **VAR CHECK CATEGORY**: ${incident.category.replace(/_/g, '/')}
- **FRAME-BY-FRAME & LAW ANALYSIS**:
  - Point of Contact / Key Frame: Evaluated at Frame ${incident.frameIndex} (60fps synchronized camera array). ${
    incident.saotDeltaCm !== undefined
      ? `SAOT 3D measurement reveals separation margin of ${
          incident.saotDeltaCm > 0 ? `+${incident.saotDeltaCm} cm (Offside)` : `${incident.saotDeltaCm} cm (Onside)`
        }.`
      : 'Contact point identified on multi-angle feeds.'
  }
  - Applicable IFAB Law: ${
    incident.category === 'GOAL_NO_GOAL'
      ? 'IFAB Law 11 (Offside) & Law 10 (Determining Outcome of Match)'
      : incident.category === 'PENALTY_NO_PENALTY'
      ? 'IFAB Law 12 (Fouls and Misconduct - Penalty Kick)'
      : 'IFAB Law 12 (Fouls and Misconduct - Serious Foul Play / DOGSO)'
  }
  - Mitigating / Aggravating Factors: High-speed lunge, exposed studs above lateral malleolus, no genuine play on ball.
- **THRESHOLD ASSESSMENT**: ${
    incident.originalCall === incident.finalDecision
      ? 'Check Complete - Call Stands'
      : 'Clear and Obvious Error'
  }
- **RECOMMENDED ACTION**: ${
    incident.category === 'GOAL_NO_GOAL' && incident.saotDeltaCm && incident.saotDeltaCm > 0
      ? 'Factual Overturn (VAR Only)'
      : 'On-Field Review (OFR)'
  }
- **COMMUNICATION TRANSCRIPT TO REFEREE**:
  "${incident.radioScript}"
- **FINAL RESTART & DISCIPLINARY SANCTION**: Restart: ${incident.restart.replace(
    /_/g,
    ' '
  )} | Disciplinary Card: ${incident.sanction}
================================================================================
Audit Duration: ${incident.durationSeconds}s | Review Status: ${incident.status}
`.trim();

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(incident, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `VAR_Incident_Report_${incident.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(formattedReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0B0F19] border-2 border-[#1F2937] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1F2937]">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm text-gray-200">
              Official IFAB VAR Match Incident Audit Report
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="px-2.5 py-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded bg-[#1F2937] hover:bg-[#374151] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-6 overflow-y-auto space-y-4 font-mono-telemetry text-xs text-gray-300 leading-relaxed bg-[#070B12]">
          <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] flex items-center justify-between">
            <div>
              <span className="text-gray-400">INCIDENT ID:</span>{' '}
              <strong className="text-white">{incident.id}</strong>
            </div>
            <div>
              <span className="text-gray-400">MATCH TIME:</span>{' '}
              <strong className="text-amber-400">{incident.matchClock}</strong>
            </div>
            <div>
              <span className="text-gray-400">REVIEW DURATION:</span>{' '}
              <strong className="text-white">{incident.durationSeconds}s</strong>
            </div>
          </div>

          <div className="space-y-3 bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                1. Incident Summary &amp; Timestamp:
              </span>
              <p className="text-gray-200 pl-3 border-l-2 border-blue-500">{incident.reviewNotes}</p>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                2. On-Field Decision:
              </span>
              <p className="text-gray-200 pl-3 border-l-2 border-amber-500">{incident.originalCall}</p>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                3. VAR Check Category:
              </span>
              <p className="text-gray-200 pl-3 border-l-2 border-blue-500">
                {incident.category.replace(/_/g, ' ')}
              </p>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                4. Frame-by-Frame &amp; Law Analysis:
              </span>
              <div className="pl-3 border-l-2 border-blue-500 space-y-1">
                <div>
                  • <strong>Key Contact Frame:</strong> Frame #{incident.frameIndex} (Synchronized Broadcast Feeds)
                </div>
                <div>
                  • <strong>SAOT Metric Telemetry:</strong>{' '}
                  {incident.saotDeltaCm !== undefined
                    ? `${incident.saotDeltaCm > 0 ? `+${incident.saotDeltaCm} cm (Offside)` : `${incident.saotDeltaCm} cm (Onside)`}`
                    : 'Contact established in 16.5m penalty box.'}
                </div>
                <div>
                  • <strong>Applicable IFAB Law:</strong> Law 11 / Law 12
                </div>
              </div>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                5. Threshold Assessment:
              </span>
              <p className="text-gray-200 pl-3 border-l-2 border-emerald-500">
                {incident.originalCall === incident.finalDecision
                  ? 'Check Complete - Call Stands'
                  : 'Clear and Obvious Error Confirmed'}
              </p>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                6. Communication Transcript to Referee:
              </span>
              <p className="text-emerald-300 pl-3 border-l-2 border-emerald-500 italic bg-[#050D1A] p-2 rounded">
                "{incident.radioScript}"
              </p>
            </div>

            <div>
              <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider">
                7. Final Restart &amp; Disciplinary Sanction:
              </span>
              <p className="text-white font-bold pl-3 border-l-2 border-red-500">
                Restart: {incident.restart.replace(/_/g, ' ')} | Sanction Card: {incident.sanction}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#111827] border-t border-[#1F2937] flex items-center justify-between text-xs text-gray-400">
          <span>IFAB VAR Protocol • Certified Video Operations Room (VOR) Record</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
