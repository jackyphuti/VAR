import React, { useState } from 'react';
import { VideoSourceType } from '../../types/var';
import {
  parseYouTubeVideoId,
  isDirectVideoUrl,
  getYouTubeThumbnailUrl,
  MATCH_VIDEO_PRESETS,
  MatchVideoPreset,
} from '../../utils/youtube';
import { X, Play, Globe, CheckCircle2, RotateCcw, Copy, ExternalLink, Sparkles } from 'lucide-react';

interface VideoUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadUrl: (url: string) => void;
  onClearVideo: () => void;
  currentSourceType: VideoSourceType;
  currentVideoTitle?: string;
}

export const VideoUrlModal: React.FC<VideoUrlModalProps> = ({
  isOpen,
  onClose,
  onLoadUrl,
  onClearVideo,
  currentSourceType,
  currentVideoTitle,
}) => {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'custom' | 'presets'>('custom');

  if (!isOpen) return null;

  const detectedYouTubeId = parseYouTubeVideoId(inputUrl);
  const isDirectVideo = isDirectVideoUrl(inputUrl);
  const isValidUrl = Boolean(detectedYouTubeId || isDirectVideo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    onLoadUrl(inputUrl.trim());
    onClose();
  };

  const handleSelectPreset = (preset: MatchVideoPreset) => {
    onLoadUrl(preset.url);
    onClose();
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInputUrl(text);
    } catch {
      // Clipboard permissions not granted
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0B0F19] border border-[#1F2937] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F2937] bg-[#111827]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400">
              {/* YouTube SVG Icon */}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
                Load Match Video Feed
                <span className="text-[10px] font-mono-telemetry font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  YOUTUBE &amp; WEB STREAMS
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Paste any YouTube URL or direct MP4 stream for frame-accurate VAR review and telestration.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1F2937] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-5 pt-3 border-b border-[#1F2937] bg-[#0E1524] gap-2">
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'custom'
                ? 'text-white border-blue-500 bg-[#111827]'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Enter Video Link / URL</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'presets'
                ? 'text-white border-blue-500 bg-[#111827]'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Official Incident Presets</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'custom' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  YouTube or Video Stream URL:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      className="w-full bg-[#111827] border border-[#1F2937] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none font-mono-telemetry"
                    />
                    {inputUrl && (
                      <button
                        type="button"
                        onClick={() => setInputUrl('')}
                        className="absolute right-2 top-2 text-gray-400 hover:text-white text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-2.5 py-2 bg-[#1F2937] hover:bg-[#374151] text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition border border-[#374151]"
                    title="Paste from clipboard"
                  >
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>Paste</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Supports YouTube standard watch URLs, short links (youtu.be), YouTube Shorts, and direct MP4/WebM video links.
                </p>
              </div>

              {/* URL Verification / Preview Card */}
              {detectedYouTubeId ? (
                <div className="p-3 bg-[#111827] rounded-lg border border-red-500/40 flex items-center gap-3 animate-fade-in shadow-inner">
                  <div className="relative w-28 h-16 rounded overflow-hidden bg-black shrink-0 border border-gray-700">
                    <img
                      src={getYouTubeThumbnailUrl(detectedYouTubeId)}
                      alt="YouTube Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-1">
                      <span className="text-[9px] font-mono-telemetry font-bold text-red-400 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> YouTube Feed
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Valid YouTube Video Link Detected
                    </div>
                    <div className="text-[11px] font-mono-telemetry text-gray-400 truncate">
                      Video ID: <span className="text-amber-400">{detectedYouTubeId}</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ready for Frame Scrubber &amp; SAOT 3D Adjudication
                    </div>
                  </div>
                </div>
              ) : isDirectVideo ? (
                <div className="p-3 bg-[#111827] rounded-lg border border-blue-500/40 flex items-center gap-3 animate-fade-in shadow-inner">
                  <div className="p-2 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Direct Video Stream URL Detected</div>
                    <div className="text-[10px] font-mono-telemetry text-gray-400 truncate max-w-sm">
                      {inputUrl}
                    </div>
                    <div className="text-[10px] text-blue-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Full 4-Camera Perspective Multi-Angle Mapping Enabled
                    </div>
                  </div>
                </div>
              ) : inputUrl.trim() ? (
                <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
                  Please enter a valid YouTube link (e.g. <code>https://youtube.com/watch?v=...</code>) or a direct MP4/WebM URL.
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {(currentSourceType === 'youtube' || currentSourceType === 'video_url') && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearVideo();
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700 text-xs text-red-200 font-semibold flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Video &amp; Return to Simulation</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isValidUrl}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition ${
                      isValidUrl
                        ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Load Video Feed</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Presets List */
            <div className="space-y-2.5">
              <p className="text-xs text-gray-300 font-medium">
                Select an official match incident video stream to immediately test VAR review tools:
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {MATCH_VIDEO_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-3 bg-[#111827] hover:bg-[#1a2333] border border-[#1F2937] hover:border-blue-500/80 rounded-lg cursor-pointer transition flex items-center justify-between group shadow"
                  >
                    <div className="flex items-center space-x-3">
                      {preset.youtubeId ? (
                        <div className="w-20 h-12 rounded bg-black overflow-hidden relative shrink-0 border border-gray-700">
                          <img
                            src={getYouTubeThumbnailUrl(preset.youtubeId)}
                            alt="Preset Thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-12 rounded bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
                          <Globe className="w-5 h-5 text-blue-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono-telemetry font-bold px-1.5 py-0.2 rounded" style={{ backgroundColor: `${preset.badgeColor}22`, color: preset.badgeColor, border: `1px solid ${preset.badgeColor}55` }}>
                            {preset.competition}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono-telemetry">
                            {preset.type === 'youtube' ? 'YOUTUBE' : 'DIRECT MP4'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition mt-0.5">
                          {preset.title}
                        </h4>
                        <p className="text-[10px] text-gray-400 line-clamp-1">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 bg-blue-600/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white rounded text-xs font-bold flex items-center gap-1 transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Load</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
