// Constantes para la apariencia de la escena

// Color de fondo #73b3f2 -> RGBA in [0, 1] 
export const CLEAR_COLOR: readonly [number, number, number, number] = [0.45, 0.70, 0.95, 1.0];

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

export const STRIDE_BYTES = 6 * 4; // 6 floats x, y, z, nx, ny, nz
export const NORMAL_OFFSET_BYTES = 3 * 4; 

// Colores para los objetos de la escena
export const COLORS = {
  // Superficie marron
  GROUND: [0.45, 0.28, 0.15, 1.0] as const,
  // Torreta gris oscuro
  TURRET_BODY: [0.22, 0.24, 0.26, 1.0] as const,
  TURRET_CANNON: [0.15, 0.16, 0.18, 1.0] as const,
  TURRET_DETAILS: [0.30, 0.32, 0.35, 1.0] as const,
  // Proyectil negro
  PROJECTILE: [0.05, 0.05, 0.05, 1.0] as const,
  // Esferas/objetivo naranja
  TARGET: [1.0, 0.30, 0.05, 1.0] as const,
  // Trayectoria amarrillo
  TRAJECTORY_LINE: [1.0, 0.85, 0.1, 0.85] as const,
} as const;

// Dimensiones
export const FIELD_WIDTH = 50.0;
export const FIELD_DEPTH = 120.0;

// Dimensiones canon 
export const CANNON_RADIUS = 0.20;
export const CANNON_LENGTH = 2.6;

// Radio de esferas
export const TARGET_RADIUS = 1.6;

// Radio del pryectil
export const PROJECTILE_RADIUS = 0.32;
