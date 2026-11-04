// 3D Scene: Turret, ground plane, targets and projectile using FixedFunction (FF)
import './style.css';
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING, Color } from './vendor/ff/ff';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_COLOR,
  COLORS,
  NORMAL_OFFSET_BYTES,
  STRIDE_BYTES,
  FIELD_WIDTH,
  FIELD_DEPTH,
  TARGET_RADIUS,
  PROJECTILE_RADIUS,
  CANNON_RADIUS,
  CANNON_LENGTH,
} from './constants';
import {
  createPlane,
  createBox,
  createCylinder,
  createSphere,
  MeshData,
} from './primitives';

type FF = ReturnType<typeof createFixedFunction>;

// WebGL helper types
interface GPUMesh {
  vao: WebGLVertexArrayObject;
  indexCount: number;
}

interface DynamicLineMesh {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  update: (points: Float32Array, count: number) => void;
  vertexCount: number;
}

function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

function uploadMesh(gl: WebGL2RenderingContext, mesh: MeshData): GPUMesh {
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

  const ebo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bindVertexArray(null);

  return { vao, indexCount: mesh.indices.length };
}

function createDynamicLineMesh(gl: WebGL2RenderingContext, maxVertices: number = 300): DynamicLineMesh {
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // Allocate buffer for maxVertices positions (3 floats per vertex)
  gl.bufferData(gl.ARRAY_BUFFER, maxVertices * 3 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
  // Disabled normal array: FixedFunction unlit path will use ATTRIB.COLOR
  gl.disableVertexAttribArray(ATTRIB.NORMAL);
  gl.bindVertexArray(null);

  const lineMesh: DynamicLineMesh = {
    vao,
    vbo,
    vertexCount: 0,
    update(points: Float32Array, count: number) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, points.subarray(0, count * 3));
      lineMesh.vertexCount = count;
    },
  };

  return lineMesh;
}

function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
}

function setupScene(ff: FF): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.35, 0.35, 0.38, 1.0]);

  // Directional light from upper-left lighting the scene
  ff.setLight(0, {
    position: [0.6, 1.0, 0.5, 0.0],
    ambient: [0.2, 0.2, 0.2, 1.0],
    diffuse: [1.0, 0.98, 0.92, 1.0],
    specular: [0.6, 0.6, 0.6, 1.0],
  });
  ff.enableLight(0);

  // Third-person perspective camera viewing the turret, ground and floating targets
  const view = mat4.lookAt(mat4.create(), [0.0, 7.0, 24.0], [0.0, 4.0, -8.0], [0, 1, 0]);
  ff.setViewMatrix(view);

  const projection = mat4.perspective(
    mat4.create(),
    Math.PI / 3.8,
    CANVAS_WIDTH / CANVAS_HEIGHT,
    0.1,
    200.0
  );
  ff.setProjectionMatrix(projection);
}

// ---------------------------------------------------------------------------
// Scene Objects Configuration (Static)
// ---------------------------------------------------------------------------

// Fixed static positions for the 3 reddish-orange targets floating over the field:
// Target 1: distancia cercana (alcanzable con Nivel 1, ~28.2°)
// Target 2: distancia media (requiere al menos Nivel 2, ~23.4°)
// Target 3: distancia lejana (requiere Nivel 3 de máxima fuerza, ~21.6°)
const TARGETS = [
  { x: -8.0, y: 5.5, z: -8.0 },  // Nivel 1 (cercano-medio, a 16 unidades de la torreta)
  { x: 0.0, y: 7.0, z: -16.0 },  // Nivel 2 (medio)
  { x: 8.0, y: 8.0, z: -35.0 },  // Nivel 3 (lejano)
] as const;

// Turret state and configuration
const MIN_PITCH = 5 * (Math.PI / 180);
const MAX_PITCH = 90 * (Math.PI / 180);

let activeTargets = [true, true, true]; // Para saber cuáles siguen vivos

const PROJECTILE = {
  isFlying: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0
};

const TURRET = {
  x: 0.0,
  z: 8.0, // Movida hacia adelante hacia el campo
  pitchAngle: 28 * (Math.PI / 180), // Ángulo inicial entre 5 y 90 grados
  speed: 12.0, // Unidades por segundo (movimiento horizontal)
  pitchSpeed: 1.0, // Radianes por segundo (~57 deg/s)
};

// Controls state
const keysPressed: Record<string, boolean> = {};

let powerLevel = 1; // 1, 2, o 3
const LAUNCH_SPEEDS = [0, 20.0, 30.0, 42.0]; // [dummy, nivel 1, nivel 2, nivel 3]
const GRAVITY = -24.0; // Aceleración en Y

// Actualiza tus TRACKED_KEYS para incluir los números, la F, espacio y R
const TRACKED_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '1', '2', '3', 'f', 'F', ' ', 'r', 'R']);

// Event listeners de teclado para interacción
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (TRACKED_KEYS.has(e.key)) {
    keysPressed[e.key] = true;
    e.preventDefault();

    if (e.key === '1') powerLevel = 1;
    if (e.key === '2') powerLevel = 2;
    if (e.key === '3') powerLevel = 3;
    if (e.key.toLowerCase() === 'f') powerLevel = powerLevel === 3 ? 1 : powerLevel + 1;

    if (e.key === ' ' && !PROJECTILE.isFlying) {
      fireProjectile();
    }
    if (e.key.toLowerCase() === 'r') {
      resetGame();
    }
  }
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (TRACKED_KEYS.has(e.key)) {
    keysPressed[e.key] = false;
    e.preventDefault();
  }
});

function fireProjectile() {
  PROJECTILE.isFlying = true;
  
  // Posición inicial: la punta del cañón
  const jointCenterY = 1.8 + 0.25; 
  // Trigonometría para calcular la punta exacta basado en el pitch (rotado en el eje X)
  PROJECTILE.x = TURRET.x;
  PROJECTILE.y = jointCenterY + Math.sin(TURRET.pitchAngle) * CANNON_LENGTH;
  PROJECTILE.z = TURRET.z - Math.cos(TURRET.pitchAngle) * CANNON_LENGTH;

  // Velocidad inicial
  const speed = LAUNCH_SPEEDS[powerLevel];
  PROJECTILE.vx = 0; // No se mueve en X (fijo)
  PROJECTILE.vy = speed * Math.sin(TURRET.pitchAngle);
  PROJECTILE.vz = -speed * Math.cos(TURRET.pitchAngle); 
}

function resetGame() {
  PROJECTILE.isFlying = false;
  activeTargets = [true, true, true];
  TURRET.x = 0;
  TURRET.pitchAngle = 28 * (Math.PI / 180);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const model = mat4.create();
const normalMatrix = mat3.create();

function drawMesh(
  gl: WebGL2RenderingContext,
  ff: FF,
  mesh: GPUMesh,
  transform: mat4,
  materialColor: Color,
  shininess = 20
): void {
  ff.setMaterial({
    ambient: materialColor,
    diffuse: materialColor,
    specular: [0.3, 0.3, 0.3, 1.0],
    shininess,
  });

  ff.setModelMatrix(transform);
  mat3.normalFromMat4(normalMatrix, transform);
  ff.setNormalMatrix(normalMatrix);

  gl.bindVertexArray(mesh.vao);
  ff.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}

function render(
  gl: WebGL2RenderingContext,
  ff: FF,
  meshes: {
    ground: GPUMesh;
    box: GPUMesh;
    cylinder: GPUMesh;
    sphere: GPUMesh;
    trajectory: DynamicLineMesh;
  }
): void {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Ground: Large brown plane / parallelogram
  mat4.identity(model);
  drawMesh(gl, ff, meshes.ground, model, COLORS.GROUND, 5);

  // Targets: Three static reddish-orange spheres floating above the ground
  for (let i = 0; i < TARGETS.length; i++) {
    if (!activeTargets[i]) continue; // No dibujar si fue destruido
    const target = TARGETS[i];
    mat4.identity(model);
    mat4.translate(model, model, [target.x, target.y, target.z]);
    drawMesh(gl, ff, meshes.sphere, model, COLORS.TARGET, 35);
  }

  // Turret (Dark metallic gray: scaled down proportionately)
  const tx = TURRET.x;
  const tz = TURRET.z;

  // Turret Body (Rectangular prism: width 2.2, height 1.1, depth 2.2)
  const bodyHeight = 1.8;
  mat4.identity(model);
  mat4.translate(model, model, [tx, bodyHeight / 2, tz]);
  mat4.scale(model, model, [2.5, bodyHeight, 2.2]);
  drawMesh(gl, ff, meshes.box, model, COLORS.TURRET_BODY, 20);

  // --- INDICADOR DE FUERZA (3 Barras en la parte trasera del cuerpo) ---
  const COLOR_BAR_OFF: Color = [0.0, 0.4, 0.0, 1.0]; // Verde oscuro
  const COLOR_BAR_ON: Color = [0.2, 0.9, 0.2, 1.0];  // Verde claro

  // La cara trasera está en +Z (hacia la cámara, tz + profundidad/2 = tz + 1.1)
  const barOffsetsX = [-0.65, 0.0, 0.65];
  for (let b = 1; b <= 3; b++) {
    // Si el nivel actual es mayor o igual a la barra, se enciende
    const barColor = b <= powerLevel ? COLOR_BAR_ON : COLOR_BAR_OFF;
    mat4.identity(model);
    mat4.translate(model, model, [tx + barOffsetsX[b - 1], bodyHeight / 2, tz + 1.12]);
    mat4.scale(model, model, [0.45, 0.25, 0.08]);
    drawMesh(gl, ff, meshes.box, model, barColor, 10);
  }

  // Sphere joint on top of the rectangular body
  const jointRadius = 0.60;
  const jointCenterY = bodyHeight + 0.25;
  const jointScale = jointRadius / TARGET_RADIUS;
  mat4.identity(model);
  mat4.translate(model, model, [tx, jointCenterY, tz]);
  mat4.scale(model, model, [jointScale, jointScale, jointScale]);
  drawMesh(gl, ff, meshes.sphere, model, COLORS.TURRET_BODY, 25);

  // Cannon barrel (cylinder inclined by pitchAngle emerging from the sphere joint)
  const cannonPivotY = jointCenterY;
  mat4.identity(model);
  mat4.translate(model, model, [tx, cannonPivotY, tz]);
  mat4.rotateX(model, model, TURRET.pitchAngle);
  drawMesh(gl, ff, meshes.cylinder, model, COLORS.TURRET_CANNON, 30);

  // --- VISTA PREVIA DE LA TRAYECTORIA ---
  // Se muestra cuando el proyectil no está volando, actualizándose con posición, ángulo y fuerza
  if (!PROJECTILE.isFlying && meshes.trajectory.vertexCount > 1) {
    ff.disable(LIGHTING);
    ff.setColor(COLORS.TRAJECTORY_LINE);
    mat4.identity(model);
    ff.setModelMatrix(model);

    gl.bindVertexArray(meshes.trajectory.vao);
    ff.drawArrays(gl.LINE_STRIP, 0, meshes.trajectory.vertexCount);

    ff.enable(LIGHTING);
  }

  // Projectile: Controlar si está pegado al cañón o volando libre
  if (!PROJECTILE.isFlying) {
    // Pegado a la torreta (como lo hizo tu compañero)
    const projScale = PROJECTILE_RADIUS / TARGET_RADIUS;
    mat4.identity(model);
    mat4.translate(model, model, [tx, cannonPivotY, tz]);
    mat4.rotateX(model, model, TURRET.pitchAngle);
    mat4.translate(model, model, [0, 0, -CANNON_LENGTH]);
    mat4.scale(model, model, [projScale, projScale, projScale]);
    drawMesh(gl, ff, meshes.sphere, model, COLORS.PROJECTILE, 40);
  } else {
    // Volando independiente en el mundo
    const projScale = PROJECTILE_RADIUS / TARGET_RADIUS;
    mat4.identity(model);
    mat4.translate(model, model, [PROJECTILE.x, PROJECTILE.y, PROJECTILE.z]);
    mat4.scale(model, model, [projScale, projScale, projScale]);
    drawMesh(gl, ff, meshes.sphere, model, COLORS.PROJECTILE, 40);
  }
} 

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: false });

  // Generate primitives in code
  const groundMesh = createPlane(FIELD_WIDTH, FIELD_DEPTH);
  const boxMesh = createBox(1.0, 1.0, 1.0);
  const sphereMesh = createSphere(TARGET_RADIUS, 28, 28);
  const cylinderMesh = createCylinder(CANNON_RADIUS, CANNON_LENGTH, 28);

  const meshes = {
    ground: uploadMesh(gl, groundMesh),
    box: uploadMesh(gl, boxMesh),
    sphere: uploadMesh(gl, sphereMesh),
    cylinder: uploadMesh(gl, cylinderMesh),
    trajectory: createDynamicLineMesh(gl, 400),
  };

  const trajectoryBuffer = new Float32Array(400 * 3);

  function updateTrajectoryPreview(): void {
    if (PROJECTILE.isFlying) {
      meshes.trajectory.vertexCount = 0;
      return;
    }

    const jointCenterY = 1.8 + 0.25;
    const startX = TURRET.x;
    const startY = jointCenterY + Math.sin(TURRET.pitchAngle) * CANNON_LENGTH;
    const startZ = TURRET.z - Math.cos(TURRET.pitchAngle) * CANNON_LENGTH;

    const speed = LAUNCH_SPEEDS[powerLevel];
    let simX = startX;
    let simY = startY;
    let simZ = startZ;
    let simVy = speed * Math.sin(TURRET.pitchAngle);
    const simVz = -speed * Math.cos(TURRET.pitchAngle);

    const simDt = 0.016; // paso de tiempo para suavidad de la curva
    let count = 0;

    trajectoryBuffer[count * 3 + 0] = simX;
    trajectoryBuffer[count * 3 + 1] = simY;
    trajectoryBuffer[count * 3 + 2] = simZ;
    count++;

    while (simY >= PROJECTILE_RADIUS && count < 399) {
      simVy += GRAVITY * simDt;
      simY += simVy * simDt;
      simZ += simVz * simDt;

      trajectoryBuffer[count * 3 + 0] = simX;
      trajectoryBuffer[count * 3 + 1] = simY;
      trajectoryBuffer[count * 3 + 2] = simZ;
      count++;
    }

    meshes.trajectory.update(trajectoryBuffer, count);
  }

  setupState(gl, canvas);
  setupScene(ff);

  let lastTime = performance.now();

  function update(dt: number): void {
    const halfWidth = FIELD_WIDTH / 2 - 2.0; // Margen para no salirse del campo
    if (keysPressed['ArrowLeft']) {
      TURRET.x -= TURRET.speed * dt;
    }
    if (keysPressed['ArrowRight']) {
      TURRET.x += TURRET.speed * dt;
    }
    // Delimitar dentro del campo
    TURRET.x = Math.max(-halfWidth, Math.min(halfWidth, TURRET.x));

    // Control de elevación/rotación del cañón y proyectil
    if (keysPressed['ArrowUp']) {
      TURRET.pitchAngle += TURRET.pitchSpeed * dt;
    }
    if (keysPressed['ArrowDown']) {
      TURRET.pitchAngle -= TURRET.pitchSpeed * dt;
    }
    // Limitar entre 5° y 90°
    TURRET.pitchAngle = Math.max(MIN_PITCH, Math.min(MAX_PITCH, TURRET.pitchAngle));

    if (PROJECTILE.isFlying) {
      PROJECTILE.vy += GRAVITY * dt;
      PROJECTILE.y += PROJECTILE.vy * dt;
      PROJECTILE.z += PROJECTILE.vz * dt;

      // Si toca el suelo
      if (PROJECTILE.y <= PROJECTILE_RADIUS) {
        PROJECTILE.isFlying = false;
      }

      // Si choca con un objetivo
      for (let i = 0; i < TARGETS.length; i++) {
        if (!activeTargets[i]) continue;
        const target = TARGETS[i];
        
        // Distancia euclidiana entre centro de bala y centro de objetivo
        const dx = PROJECTILE.x - target.x;
        const dy = PROJECTILE.y - target.y;
        const dz = PROJECTILE.z - target.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist <= (TARGET_RADIUS + PROJECTILE_RADIUS)) {
          activeTargets[i] = false; // Objetivo destruido
          PROJECTILE.isFlying = false; // Bala desaparece
          break;
        }
      }
    }
  }

  function frame(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    updateTrajectoryPreview();
    render(gl, ff, meshes);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);
