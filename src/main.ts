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

// Fixed static positions for the 3 reddish-orange targets floating over the field
const TARGETS = [
  { x: -9.0, y: 6.5, z: -12.0 },
  { x: 0.0, y: 8.5, z: -20.0 },
  { x: 9.0, y: 7.0, z: -15.0 },
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

// En el EventListener de 'keydown', agrega estas condicionales DESPUÉS de la línea `keysPressed[e.key] = true;`:
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (TRACKED_KEYS.has(e.key)) {
    keysPressed[e.key] = true;
    e.preventDefault();

    // AQUÍ VAN PEGADOS LOS IF:
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

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (TRACKED_KEYS.has(e.key)) {
    keysPressed[e.key] = true;
    e.preventDefault();

    // AQUÍ VAN LAS CONDICIONES (Adentro del evento)
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

  // --- INDICADOR DE FUERZA (3 Barras laterales) ---
  const COLOR_BAR_OFF: Color = [0.0, 0.4, 0.0, 1.0]; // Verde oscuro
  const COLOR_BAR_ON: Color = [0.2, 0.9, 0.2, 1.0];  // Verde claro

  for (let b = 1; b <= 3; b++) {
    // Si el nivel actual es mayor o igual a la barra, se enciende
    const barColor = b <= powerLevel ? COLOR_BAR_ON : COLOR_BAR_OFF;
    mat4.identity(model);
    // Las ubicamos a un lado del cañón, apiladas hacia arriba
    mat4.translate(model, model, [tx - 1.3, (bodyHeight / 2) + (b * 0.4) - 0.5, tz]);
    mat4.scale(model, model, [0.2, 0.3, 0.8]); // Paralelogramos pequeños
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
  };

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
    render(gl, ff, meshes);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);
