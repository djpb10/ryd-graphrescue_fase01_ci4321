// Procedural geometry generator for primitives with interleaved (position, normal) data.
// Layout: [x, y, z, nx, ny, nz] per vertex (stride 6 floats, normal offset 3 floats).

export interface MeshData {
  vertices: Float32Array;
  indices: Uint16Array;
}

/**
 * Creates a flat quad / parallelogram on the XZ plane centered around (0, 0, 0).
 * Dimensions: width along X, depth along Z. Facing +Y.
 */
export function createPlane(width: number, depth: number): MeshData {
  const hw = width / 2;
  const hd = depth / 2;
  const vertices = new Float32Array([
    //  x,    y,   z,     nx, ny, nz
    -hw, 0.0,  hd,   0.0, 1.0, 0.0, // bottom-left
     hw, 0.0,  hd,   0.0, 1.0, 0.0, // bottom-right
     hw, 0.0, -hd,   0.0, 1.0, 0.0, // top-right
    -hw, 0.0, -hd,   0.0, 1.0, 0.0, // top-left
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return { vertices, indices };
}

/**
 * Creates a box centered at the origin with given width, height, depth.
 * Flat shaded per face with separate vertices for accurate face normals.
 */
export function createBox(width: number, height: number, depth: number): MeshData {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const vertices = new Float32Array([
    // +Z face (front)
    -hw, -hh,  hd,   0,  0,  1,
     hw, -hh,  hd,   0,  0,  1,
     hw,  hh,  hd,   0,  0,  1,
    -hw,  hh,  hd,   0,  0,  1,
    // -Z face (back)
     hw, -hh, -hd,   0,  0, -1,
    -hw, -hh, -hd,   0,  0, -1,
    -hw,  hh, -hd,   0,  0, -1,
     hw,  hh, -hd,   0,  0, -1,
    // +X face (right)
     hw, -hh,  hd,   1,  0,  0,
     hw, -hh, -hd,   1,  0,  0,
     hw,  hh, -hd,   1,  0,  0,
     hw,  hh,  hd,   1,  0,  0,
    // -X face (left)
    -hw, -hh, -hd,  -1,  0,  0,
    -hw, -hh,  hd,  -1,  0,  0,
    -hw,  hh,  hd,  -1,  0,  0,
    -hw,  hh, -hd,  -1,  0,  0,
    // +Y face (top)
    -hw,  hh,  hd,   0,  1,  0,
     hw,  hh,  hd,   0,  1,  0,
     hw,  hh, -hd,   0,  1,  0,
    -hw,  hh, -hd,   0,  1,  0,
    // -Y face (bottom)
    -hw, -hh, -hd,   0, -1,  0,
     hw, -hh, -hd,   0, -1,  0,
     hw, -hh,  hd,   0, -1,  0,
    -hw, -hh,  hd,   0, -1,  0,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3, // +Z
     4,  5,  6,   4,  6,  7, // -Z
     8,  9, 10,   8, 10, 11, // +X
    12, 13, 14,  12, 14, 15, // -X
    16, 17, 18,  16, 18, 19, // +Y
    20, 21, 22,  20, 22, 23, // -Y
  ]);

  return { vertices, indices };
}

/**
 * Creates a UV sphere centered at (0, 0, 0) with smooth surface normals.
 */
export function createSphere(radius: number, latitudeBands = 24, longitudeBands = 24): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = (lat * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const nx = cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;

      const x = radius * nx;
      const y = radius * ny;
      const z = radius * nz;

      vertices.push(x, y, z, nx, ny, nz);
    }
  }

  for (let lat = 0; lat < latitudeBands; lat++) {
    for (let lon = 0; lon < longitudeBands; lon++) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;

      // Winding order CCW when viewed from outside:
      indices.push(first, first + 1, second);
      indices.push(second, first + 1, second + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

/**
 * Creates an open cylinder along the Z-axis (or Y-axis) centered at origin.
 * Here we orient it along the -Z axis from z = 0 to z = -height (pointing forward)
 * or along Z centered: from -height/2 to +height/2.
 * Let's create it aligned along Z axis from z = 0 to z = -length for convenient cannon aiming.
 */
export function createCylinder(radius: number, length: number, radialSegments = 20): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Lateral surface
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const nx = cosA;
    const ny = sinA;
    const nz = 0;

    // Vertex at base (z = 0)
    vertices.push(radius * cosA, radius * sinA, 0, nx, ny, nz);
    // Vertex at tip (z = -length)
    vertices.push(radius * cosA, radius * sinA, -length, nx, ny, nz);
  }

  for (let i = 0; i < radialSegments; i++) {
    const base1 = i * 2;
    const tip1 = base1 + 1;
    const base2 = (i + 1) * 2;
    const tip2 = base2 + 1;

    // CCW viewed from outside looking at the cylinder surface
    indices.push(base1, tip1, base2);
    indices.push(base2, tip1, tip2);
  }

  // Front cap at z = -length (facing -Z)
  const tipCenterIndex = vertices.length / 6;
  vertices.push(0, 0, -length, 0, 0, -1);
  const tipRimStartIndex = vertices.length / 6;
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    vertices.push(radius * Math.cos(angle), radius * Math.sin(angle), -length, 0, 0, -1);
  }
  for (let i = 0; i < radialSegments; i++) {
    indices.push(tipCenterIndex, tipRimStartIndex + i, tipRimStartIndex + i + 1);
  }

  // Back cap at z = 0 (facing +Z)
  const baseCenterIndex = vertices.length / 6;
  vertices.push(0, 0, 0, 0, 0, 1);
  const baseRimStartIndex = vertices.length / 6;
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    vertices.push(radius * Math.cos(angle), radius * Math.sin(angle), 0, 0, 0, 1);
  }
  for (let i = 0; i < radialSegments; i++) {
    indices.push(baseCenterIndex, baseRimStartIndex + i, baseRimStartIndex + i + 1);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}
