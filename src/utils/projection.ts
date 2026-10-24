import { CameraId } from '../types/var';

export interface CameraPerspective {
  project(
    pitchX: number,
    pitchY: number,
    pitchZ: number,
    width: number,
    height: number
  ): { x: number; y: number; scale: number; visible: boolean };
}

/**
 * Camera 1: Main Wide
 * Camera located at midfield main stand (X ~ 52.5, Y ~ -25, Z ~ 18), looking toward X=85..105
 */
export const mainWideCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    // Relative coordinates centered on defending half (X=80, Y=34)
    const relX = (x - 70) / 38; // -0.5 to 1.0
    const relY = (y - 34) / 38; // -0.9 to 0.9

    // Perspective depth
    const depth = 1.0 + relY * 0.35 + (x - 70) * 0.008;
    const screenX = w * (0.5 + relX * 0.42 / depth);
    const screenY = h * (0.62 + relY * 0.28 / depth) - z * 35 / depth;
    const scale = Math.max(0.4, 1.0 / depth);

    return { x: screenX, y: screenY, scale, visible: true };
  },
};

/**
 * Camera 2: 16-Yard Offside Cam
 * Camera perpendicular to the 16.5m line (X = 88.5, Y = -20, Z = 12), perfectly aligned to detect offside
 */
export const offside16mCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    // X axis runs perpendicular to camera view line
    const relX = (x - 88.5) * 1.8; // Centered exactly at 16m line
    const relY = (y - 34) / 36;

    const depth = 1.0 + relY * 0.4;
    const screenX = w * (0.5 + relX * 0.07 / depth);
    const screenY = h * (0.58 + relY * 0.32 / depth) - z * 40 / depth;
    const scale = Math.max(0.4, 1.1 / depth);

    return { x: screenX, y: screenY, scale, visible: true };
  },
};

/**
 * Camera 3: Behind Goal Low
 * Looking from behind the net (X = 112, Y = 34, Z = 1.5) outwards into the field
 */
export const behindGoalCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    // Defending goal is at X = 105, looking back towards X = 75
    const distFromGoal = 108 - x; // 3m to 35m
    if (distFromGoal <= 1) return { x: w / 2, y: h / 2, scale: 0.1, visible: false };

    const relY = (34 - y) / (distFromGoal * 0.55);
    const relZ = (z - 1.2) / (distFromGoal * 0.35);

    const screenX = w * (0.5 + relY * 0.4);
    const screenY = h * (0.58 - relZ * 0.35);
    const scale = Math.min(2.5, Math.max(0.3, 12 / distFromGoal));

    return { x: screenX, y: screenY, scale, visible: true };
  },
};

/**
 * Camera 4: High Tactical Spidercam
 * High aerial view looking down onto the 18-yard box and goalmouth
 */
export const spidercamCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    // High top-down orthographic/mild isometric view
    const normX = (x - 68) / 38;
    const normY = (y - 34) / 36;

    const screenX = w * (0.5 + normX * 0.42);
    const screenY = h * (0.5 + normY * 0.38) - z * 8;
    const scale = 0.9;

    return { x: screenX, y: screenY, scale, visible: true };
  },
};

export const CAMERA_PERSPECTIVES: Record<CameraId, CameraPerspective> = {
  main_wide: mainWideCamera,
  cam_16m: offside16mCamera,
  behind_goal: behindGoalCamera,
  spidercam: spidercamCamera,
};
