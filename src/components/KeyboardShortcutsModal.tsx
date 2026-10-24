import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'Space', description: 'Play / Pause Video Playback', category: 'Playback' },
  { key: '← / →', description: 'Step -1 Frame / +1 Frame (60 FPS)', category: 'Playback' },
  { key: 'Shift + ← / →', description: 'Step -10 Frames / +10 Frames', category: 'Playback' },
  { key: 'K', description: 'Freeze at Kick Point (Pass Frame Lock)', category: 'Keypoints' },
  { key: 'I', description: 'Jump to Incident Contact Point', category: 'Keypoints' },
  { key: '1, 2, 3, 4', description: 'Switch Active Camera (CAM-01 to CAM-04)', category: 'Feeds' },
  { key: '[', description: 'Set Loop In Point [A]', category: 'Looping' },
  { key: ']', description: 'Set Loop Out Point [B]', category: 'Looping' },
  { key: 'L', description: 'Toggle A-to-B Looping Playback', category: 'Looping' },
  { key: 'T', description: 'Toggle Broadcast Telestrator Drawing Suite', category: 'Tools' },
  { key: 'M', description: 'Toggle 3x Magnifier Loupe Tool', category: 'Tools' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0B0F19] border-2 border-[#1F2937] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1F2937]">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm text-gray-200">
              Hardware EVS Broadcast Keyboard Controller Mapping
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-gray-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto font-mono-telemetry text-xs">
          <p className="text-gray-400 text-[11px] mb-2">
            Professional VOR Operators use dedicated broadcast shuttle dials and keyboard macros for millisecond-level frame scrubbing:
          </p>

          <div className="grid grid-cols-1 gap-1.5">
            {SHORTCUTS.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-[#111827] border border-[#1F2937]"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">
                    {s.category}
                  </span>
                  <span className="text-gray-200 font-sans">{s.description}</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-[#0B0F19] border border-gray-600 font-bold text-amber-300 shadow">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#111827] border-t border-[#1F2937] flex items-center justify-between text-xs text-gray-400">
          <span>Keyboard shortcuts are active during all match reviews.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
