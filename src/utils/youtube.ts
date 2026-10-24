/**
 * youtube.ts - Utilities for parsing and managing YouTube & Web Video Streams
 * Supports standard YouTube URLs, short URLs, embeds, YouTube Shorts, and direct video links.
 */

export interface MatchVideoPreset {
  id: string;
  title: string;
  competition: string;
  category: 'GOAL_NO_GOAL' | 'PENALTY_NO_PENALTY' | 'DIRECT_RED_CARD' | 'GLT';
  type: 'youtube' | 'direct_url';
  url: string;
  youtubeId?: string;
  description: string;
  badgeColor: string;
}

export const MATCH_VIDEO_PRESETS: MatchVideoPreset[] = [
  {
    id: 'preset_wc2022_glt',
    title: 'FIFA World Cup 2022: Japan vs Spain Goal-Line Check',
    competition: 'FIFA World Cup Qatar 2022',
    category: 'GLT',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=kffacxfA7G4',
    youtubeId: 'kffacxfA7G4',
    description: 'Crucial goal-line curvature check. Optical tracking determines if the ball wholly crossed the endline.',
    badgeColor: '#10B981',
  },
  {
    id: 'preset_saot_tight_offside',
    title: 'UEFA Champions League: SAOT 3D Virtual Offside Review',
    competition: 'UEFA Champions League',
    category: 'GOAL_NO_GOAL',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=5z6BsgM8L-0',
    youtubeId: '5z6BsgM8L-0',
    description: 'Semi-Automated Offside Technology 3D curtain projection analyzing millimeter margin of separation.',
    badgeColor: '#38BDF8',
  },
  {
    id: 'preset_epl_sfp_tackle',
    title: 'Premier League VAR Review: High-Studs Serious Foul Play',
    competition: 'Premier League',
    category: 'DIRECT_RED_CARD',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=b4S_f3p8kZc',
    youtubeId: 'b4S_f3p8kZc',
    description: 'Point of contact above the ankle. Evaluating excessive force and endangerment of safety.',
    badgeColor: '#EF4444',
  },
  {
    id: 'preset_direct_mp4_sample',
    title: 'High-Definition Match Broadcast (Direct MP4 CDN Stream)',
    competition: 'Broadcast Feed Demo',
    category: 'GOAL_NO_GOAL',
    type: 'direct_url',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Direct high-bitrate video stream with full 4-camera synthetic perspective mapping and inverse projection.',
    badgeColor: '#F59E0B',
  },
];

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats.
 */
export function parseYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Direct 11-character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. youtu.be/<id>
  const shortMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // 3. youtube.com/watch?v=<id>
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // 4. youtube.com/embed/<id>
  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // 5. youtube.com/shorts/<id>
  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // 6. Generic regex for any v=<id> or youtu.be/<id>
  const genericMatch = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  if (genericMatch) return genericMatch[1];

  return null;
}

/**
 * Checks if a URL points to a direct video file (.mp4, .webm, .ogg, .m3u8).
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.m3u8') ||
    clean.includes('.mp4?') ||
    clean.includes('.webm?') ||
    clean.startsWith('blob:') ||
    clean.startsWith('data:video/')
  );
}

/**
 * Returns the standard YouTube video thumbnail image URL.
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
