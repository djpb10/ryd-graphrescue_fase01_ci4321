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

// Static turret configuration
const TURRET = {
  x: 0.0,
  z: 8.0, // Movida hacia adelante hacia el campo
  pitchAngle: 28 * (Math.PI / 180), // 28 deg inclination
} as const;

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
  for (const target of TARGETS) {
    mat4.identity(model);
    mat4.translate(model, model, [target.x, target.y, target.z]);
    drawMesh(gl, ff, meshes.sphere, model, COLORS.TARGET, 35);
  }

  // Turret (Dark metallic gray: scaled down proportionately)
  const tx = TURRET.x;
  const tz = TURRET.z;

  // Turret Body (Rectangular prism: width 2.2, height 1.1, depth 2.2)
  const bodyHeight = 1.1;
  mat4.identity(model);
  mat4.translate(model, model, [tx, bodyHeight / 2, tz]);
  mat4.scale(model, model, [2.2, bodyHeight, 2.2]);
  drawMesh(gl, ff, meshes.box, model, COLORS.TURRET_BODY, 20);

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

  // Projectile: Black sphere positioned at the cannon's muzzle ready to launch
  const barrelLength = CANNON_LENGTH;
  const projY = cannonPivotY + Math.sin(TURRET.pitchAngle) * (barrelLength + 0.38);
  const projZ = tz - Math.cos(TURRET.pitchAngle) * (barrelLength + 0.38);
  const projScale = PROJECTILE_RADIUS / TARGET_RADIUS;

  mat4.identity(model);
  mat4.translate(model, model, [tx, projY, projZ]);
  mat4.scale(model, model, [projScale, projScale, projScale]);
  drawMesh(gl, ff, meshes.sphere, model, COLORS.PROJECTILE, 40);
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

  function frame(): void {
    render(gl, ff, meshes);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);
