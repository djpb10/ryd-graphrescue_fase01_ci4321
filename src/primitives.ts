export interface MeshData {
  vertices: Float32Array;
  indices: Uint16Array;
}
// Plano en XZ (Suelo)
export function createPlane(width: number, depth: number): MeshData {
  const hw = width / 2;
  const hd = depth / 2;
  const vertices = new Float32Array([
    -hw, 0.0,  hd,   0.0, 1.0, 0.0, 
     hw, 0.0,  hd,   0.0, 1.0, 0.0, 
     hw, 0.0, -hd,   0.0, 1.0, 0.0, 
    -hw, 0.0, -hd,   0.0, 1.0, 0.0, 
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return { vertices, indices };
}

// Caja 
export function createBox(width: number, height: number, depth: number): MeshData {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const vertices = new Float32Array([

    -hw, -hh,  hd,   0,  0,  1,
     hw, -hh,  hd,   0,  0,  1,
     hw,  hh,  hd,   0,  0,  1,
    -hw,  hh,  hd,   0,  0,  1,

     hw, -hh, -hd,   0,  0, -1,
    -hw, -hh, -hd,   0,  0, -1,
    -hw,  hh, -hd,   0,  0, -1,
     hw,  hh, -hd,   0,  0, -1,

     hw, -hh,  hd,   1,  0,  0,
     hw, -hh, -hd,   1,  0,  0,
     hw,  hh, -hd,   1,  0,  0,
     hw,  hh,  hd,   1,  0,  0,

    -hw, -hh, -hd,  -1,  0,  0,
    -hw, -hh,  hd,  -1,  0,  0,
    -hw,  hh,  hd,  -1,  0,  0,
    -hw,  hh, -hd,  -1,  0,  0,

    -hw,  hh,  hd,   0,  1,  0,
     hw,  hh,  hd,   0,  1,  0,
     hw,  hh, -hd,   0,  1,  0,
    -hw,  hh, -hd,   0,  1,  0,
  
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

// Esfera 
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

      indices.push(first, first + 1, second);
      indices.push(second, first + 1, second + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

// Cilindro alineado en Z
export function createCylinder(radius: number, length: number, radialSegments = 20): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Pared lateral
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const nx = cosA;
    const ny = sinA;
    const nz = 0;

    // Base
    vertices.push(radius * cosA, radius * sinA, 0, nx, ny, nz);
    // Punta
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
