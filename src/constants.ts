// Constants for scene appearance

/** Sky blue background color #73b3f2 -> RGBA in [0, 1] */
export const CLEAR_COLOR: readonly [number, number, number, number] = [0.45, 0.70, 0.95, 1.0];

/** Drawing buffer size in pixels, 4:3. */
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

/** Vertex layout constants */
export const STRIDE_BYTES = 6 * 4; // 6 floats (x, y, z, nx, ny, nz)
export const NORMAL_OFFSET_BYTES = 3 * 4; // offset to normal vector

/** Colors for scene objects (RGBA) */
export const COLORS = {
  // Ground: large brown plane
  GROUND: [0.45, 0.28, 0.15, 1.0] as const,
  // Turret: dark gray body and cannon
  TURRET_BODY: [0.22, 0.24, 0.26, 1.0] as const,
  TURRET_CANNON: [0.15, 0.16, 0.18, 1.0] as const,
  TURRET_DETAILS: [0.30, 0.32, 0.35, 1.0] as const,
  // Projectile: black sphere
  PROJECTILE: [0.05, 0.05, 0.05, 1.0] as const,
  // Targets: 3 reddish-orange spheres large enough to hit
  TARGET: [1.0, 0.30, 0.05, 1.0] as const,
} as const;

/** Field dimensions */
export const FIELD_WIDTH = 50.0;
export const FIELD_DEPTH = 120.0;

/** Cannon dimensions */
export const CANNON_RADIUS = 0.20;
export const CANNON_LENGTH = 2.6;

/** Sphere target radius */
export const TARGET_RADIUS = 1.6;

/** Projectile sphere radius */
export const PROJECTILE_RADIUS = 0.32;
