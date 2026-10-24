import { CameraId } from '../types/var';

export interface CameraPerspective {
  project(
    pitchX: number,
    pitchY: number,
    pitchZ: number,
    width: number,
    height: number
  ): { x: number; y: number; scale: number; visible: boolean };

  unproject(
    screenX: number,
    screenY: number,
    pitchZ: number,
    width: number,
    height: number
  ): { pitchX: number; pitchY: number };
}

/**
 * Camera 1: Main Wide
 * Camera located at midfield main stand (X ~ 52.5, Y ~ -25, Z ~ 18), looking toward X=85..105
 */
export const mainWideCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    const relX = (x - 70) / 38;
    const relY = (y - 34) / 38;
    const depth = 1.0 + relY * 0.35 + (x - 70) * 0.008;
    const screenX = w * (0.5 + (relX * 0.42) / depth);
    const screenY = h * (0.62 + (relY * 0.28) / depth) - (z * 35) / depth;
    const scale = Math.max(0.4, 1.0 / depth);

    return { x: screenX, y: screenY, scale, visible: true };
  },

  unproject(screenX, screenY, pitchZ, width, height) {
    const sx = screenX / width - 0.5;
    const syEff = screenY / height - 0.62;

    const A = 1.0 + (0.35 * 35 * pitchZ) / (0.28 * height);
    const B = 1.25 * syEff + (0.304 / 0.42) * sx;
    const denom = Math.abs(1.0 - B) < 0.01 ? 0.01 : 1.0 - B;
    const depth = Math.max(0.4, Math.min(3.5, A / denom));

    const relX = (sx / 0.42) * depth;
    const relY = (syEff * depth + (pitchZ * 35) / height) / 0.28;

    const rawX = 70 + relX * 38;
    const rawY = 34 + relY * 38;

    return {
      pitchX: Math.max(52.5, Math.min(105.0, Number(rawX.toFixed(3)))),
      pitchY: Math.max(0.0, Math.min(68.0, Number(rawY.toFixed(3)))),
    };
  },
};

/**
 * Camera 2: 16-Yard Offside Cam
 * Camera perpendicular to the 16.5m line (X = 88.5, Y = -20, Z = 12), calibrated for SAOT
 */
export const offside16mCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    const relX = (x - 88.5) * 1.8;
    const relY = (y - 34) / 36;
    const depth = 1.0 + relY * 0.4;
    const screenX = w * (0.5 + (relX * 0.07) / depth);
    const screenY = h * (0.58 + (relY * 0.32) / depth) - (z * 40) / depth;
    const scale = Math.max(0.4, 1.1 / depth);

    return { x: screenX, y: screenY, scale, visible: true };
  },

  unproject(screenX, screenY, pitchZ, width, height) {
    const sx = screenX / width - 0.5;
    const syEff = screenY / height - 0.58;

    const denom = 0.32 - 0.4 * syEff;
    const denomSafe = Math.abs(denom) < 0.01 ? 0.01 : denom;
    const relY = (syEff + (pitchZ * 40) / height) / denomSafe;
    const depth = Math.max(0.4, Math.min(3.5, 1.0 + relY * 0.4));

    const relX = (sx / 0.07) * depth;
    const rawX = 88.5 + relX / 1.8;
    const rawY = 34 + relY * 36;

    return {
      pitchX: Math.max(52.5, Math.min(105.0, Number(rawX.toFixed(3)))),
      pitchY: Math.max(0.0, Math.min(68.0, Number(rawY.toFixed(3)))),
    };
  },
};

/**
 * Camera 3: Behind Goal Low
 * Looking from behind the net (X = 112, Y = 34, Z = 1.5) outwards into the field
 */
export const behindGoalCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    const distFromGoal = 108 - x;
    if (distFromGoal <= 1) return { x: w / 2, y: h / 2, scale: 0.1, visible: false };

    const relY = (34 - y) / (distFromGoal * 0.55);
    const relZ = (z - 1.2) / (distFromGoal * 0.35);

    const screenX = w * (0.5 + relY * 0.4);
    const screenY = h * (0.58 - relZ * 0.35);
    const scale = Math.min(2.5, Math.max(0.3, 12 / distFromGoal));

    return { x: screenX, y: screenY, scale, visible: true };
  },

  unproject(screenX, screenY, pitchZ, width, height) {
    const denom = screenY / height - 0.58;
    const denomSafe = Math.abs(denom) < 0.005 ? (denom < 0 ? -0.005 : 0.005) : denom;
    const distFromGoal = (1.2 - pitchZ) / denomSafe;
    const distClamped = Math.max(3.0, Math.min(36.0, distFromGoal));

    const rawX = 108 - distClamped;
    const relY = (screenX / width - 0.5) / 0.4;
    const rawY = 34 - relY * (distClamped * 0.55);

    return {
      pitchX: Math.max(52.5, Math.min(105.0, Number(rawX.toFixed(3)))),
      pitchY: Math.max(0.0, Math.min(68.0, Number(rawY.toFixed(3)))),
    };
  },
};

/**
 * Camera 4: High Tactical Spidercam
 * High aerial view looking down onto the 18-yard box and goalmouth
 */
export const spidercamCamera: CameraPerspective = {
  project(x, y, z, w, h) {
    const normX = (x - 68) / 38;
    const normY = (y - 34) / 36;

    const screenX = w * (0.5 + normX * 0.42);
    const screenY = h * (0.5 + normY * 0.38) - z * 8;
    const scale = 0.9;

    return { x: screenX, y: screenY, scale, visible: true };
  },

  unproject(screenX, screenY, pitchZ, width, height) {
    const normX = (screenX / width - 0.5) / 0.42;
    const rawX = 68 + normX * 38;

    const normY = ((screenY + pitchZ * 8) / height - 0.5) / 0.38;
    const rawY = 34 + normY * 36;

    return {
      pitchX: Math.max(52.5, Math.min(105.0, Number(rawX.toFixed(3)))),
      pitchY: Math.max(0.0, Math.min(68.0, Number(rawY.toFixed(3)))),
    };
  },
};

export const CAMERA_PERSPECTIVES: Record<CameraId, CameraPerspective> = {
  main_wide: mainWideCamera,
  cam_16m: offside16mCamera,
  behind_goal: behindGoalCamera,
  spidercam: spidercamCamera,
};
