/* eslint-disable @typescript-eslint/no-explicit-any */
declare const THREE: any;

const POSITION_DECIMALS = 2;

const _average = { x: 0, y: 0, z: 0 };
const _center = { x: 0, y: 0, z: 0 };

function hashFromXYZ(x: number, y: number, z: number): string {
  const shift = Math.pow(10, POSITION_DECIMALS);
  return `${Math.round(x * shift)}_${Math.round(y * shift)}_${Math.round(z * shift)}`;
}

export interface SubdivisionParams {
  split?: boolean;
  uvSmooth?: boolean;
  preserveEdges?: boolean;
  flatOnly?: boolean;
  maxTriangles?: number;
  weight?: number;
}

/**
 * Loop Subdivision Surface modifier for Three.js BufferGeometry.
 * Subdivides each triangle into 4 sub-triangles and applies Loop's weighted
 * vertex smoothing formula across welded vertices so joints and corners
 * smooth into organic curved surfaces without tearing.
 */
export class LoopSubdivision {
  static modify(bufferGeometry: any, iterations = 1, params: SubdivisionParams = {}): any {
    if (!bufferGeometry || !bufferGeometry.attributes || !bufferGeometry.attributes.position) {
      return bufferGeometry;
    }

    const uvSmooth = params.uvSmooth !== undefined ? params.uvSmooth : true;
    const flatOnly = params.flatOnly !== undefined ? params.flatOnly : false;
    const maxTriangles = params.maxTriangles !== undefined ? params.maxTriangles : 250000;
    const weight = params.weight !== undefined ? Math.max(0, Math.min(1, params.weight)) : 1.0;

    let current = bufferGeometry.index !== null ? bufferGeometry.toNonIndexed() : bufferGeometry.clone();

    for (let iter = 0; iter < iterations; iter++) {
      const triCount = current.attributes.position.count / 3;
      if (triCount >= maxTriangles) break;

      const next = flatOnly
        ? LoopSubdivision.flat(current)
        : LoopSubdivision.smooth(current, uvSmooth, weight);

      current.dispose();
      current = next;
    }

    current.computeVertexNormals();
    return current;
  }

  static flat(geometry: any): any {
    const existing = geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
    const out = new THREE.BufferGeometry();
    const vertexCount = existing.attributes.position.count;

    const posAttr = existing.getAttribute('position');
    const uvAttr = existing.getAttribute('uv');

    const newPos = new Float32Array(vertexCount * 4 * 3);
    let pIdx = 0;

    for (let i = 0; i < vertexCount; i += 3) {
      const x0 = posAttr.getX(i), y0 = posAttr.getY(i), z0 = posAttr.getZ(i);
      const x1 = posAttr.getX(i + 1), y1 = posAttr.getY(i + 1), z1 = posAttr.getZ(i + 1);
      const x2 = posAttr.getX(i + 2), y2 = posAttr.getY(i + 2), z2 = posAttr.getZ(i + 2);

      const mx01 = (x0 + x1) * 0.5, my01 = (y0 + y1) * 0.5, mz01 = (z0 + z1) * 0.5;
      const mx12 = (x1 + x2) * 0.5, my12 = (y1 + y2) * 0.5, mz12 = (z1 + z2) * 0.5;
      const mx20 = (x2 + x0) * 0.5, my20 = (y2 + y0) * 0.5, mz20 = (z2 + z0) * 0.5;

      // Tri 0: v0, m01, m20
      newPos[pIdx++] = x0; newPos[pIdx++] = y0; newPos[pIdx++] = z0;
      newPos[pIdx++] = mx01; newPos[pIdx++] = my01; newPos[pIdx++] = mz01;
      newPos[pIdx++] = mx20; newPos[pIdx++] = my20; newPos[pIdx++] = mz20;

      // Tri 1: v1, m12, m01
      newPos[pIdx++] = x1; newPos[pIdx++] = y1; newPos[pIdx++] = z1;
      newPos[pIdx++] = mx12; newPos[pIdx++] = my12; newPos[pIdx++] = mz12;
      newPos[pIdx++] = mx01; newPos[pIdx++] = my01; newPos[pIdx++] = mz01;

      // Tri 2: v2, m20, m12
      newPos[pIdx++] = x2; newPos[pIdx++] = y2; newPos[pIdx++] = z2;
      newPos[pIdx++] = mx20; newPos[pIdx++] = my20; newPos[pIdx++] = mz20;
      newPos[pIdx++] = mx12; newPos[pIdx++] = my12; newPos[pIdx++] = mz12;

      // Tri 3 (center): m01, m12, m20
      newPos[pIdx++] = mx01; newPos[pIdx++] = my01; newPos[pIdx++] = mz01;
      newPos[pIdx++] = mx12; newPos[pIdx++] = my12; newPos[pIdx++] = mz12;
      newPos[pIdx++] = mx20; newPos[pIdx++] = my20; newPos[pIdx++] = mz20;
    }

    out.setAttribute('position', new THREE.BufferAttribute(newPos, 3));

    if (uvAttr) {
      const newUv = new Float32Array(vertexCount * 4 * 2);
      let uIdx = 0;
      for (let i = 0; i < vertexCount; i += 3) {
        const u0 = uvAttr.getX(i), v0 = uvAttr.getY(i);
        const u1 = uvAttr.getX(i + 1), v1 = uvAttr.getY(i + 1);
        const u2 = uvAttr.getX(i + 2), v2 = uvAttr.getY(i + 2);

        const mu01 = (u0 + u1) * 0.5, mv01 = (v0 + v1) * 0.5;
        const mu12 = (u1 + u2) * 0.5, mv12 = (v1 + v2) * 0.5;
        const mu20 = (u2 + u0) * 0.5, mv20 = (v2 + v0) * 0.5;

        newUv[uIdx++] = u0; newUv[uIdx++] = v0;
        newUv[uIdx++] = mu01; newUv[uIdx++] = mv01;
        newUv[uIdx++] = mu20; newUv[uIdx++] = mv20;

        newUv[uIdx++] = u1; newUv[uIdx++] = v1;
        newUv[uIdx++] = mu12; newUv[uIdx++] = mv12;
        newUv[uIdx++] = mu01; newUv[uIdx++] = mv01;

        newUv[uIdx++] = u2; newUv[uIdx++] = v2;
        newUv[uIdx++] = mu20; newUv[uIdx++] = mv20;
        newUv[uIdx++] = mu12; newUv[uIdx++] = mv12;

        newUv[uIdx++] = mu01; newUv[uIdx++] = mv01;
        newUv[uIdx++] = mu12; newUv[uIdx++] = mv12;
        newUv[uIdx++] = mu20; newUv[uIdx++] = mv20;
      }
      out.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
    }

    existing.dispose();
    return out;
  }

  static smooth(geometry: any, _uvSmooth: boolean, weight: number): any {
    const existing = geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
    const flat = LoopSubdivision.flat(existing);
    const loop = new THREE.BufferGeometry();

    const vertexCount = existing.attributes.position.count;
    const posAttr = existing.getAttribute('position');
    const flatPos = flat.getAttribute('position');

    const existingNeighbors: Record<string, Record<string, number[]>> = {};
    const flatOpposites: Record<string, number[]> = {};
    const existingEdges: Record<string, Set<string>> = {};

    function addNeighbor(posHash: string, neighborHash: string, index: number) {
      if (!existingNeighbors[posHash]) existingNeighbors[posHash] = {};
      if (!existingNeighbors[posHash][neighborHash]) existingNeighbors[posHash][neighborHash] = [];
      existingNeighbors[posHash][neighborHash].push(index);
    }

    function addOpposite(posHash: string, index: number) {
      if (!flatOpposites[posHash]) flatOpposites[posHash] = [];
      flatOpposites[posHash].push(index);
    }

    function addEdgePoint(posHash: string, edgeHash: string) {
      if (!existingEdges[posHash]) existingEdges[posHash] = new Set();
      existingEdges[posHash].add(edgeHash);
    }

    for (let i = 0; i < vertexCount; i += 3) {
      const x0 = posAttr.getX(i), y0 = posAttr.getY(i), z0 = posAttr.getZ(i);
      const x1 = posAttr.getX(i + 1), y1 = posAttr.getY(i + 1), z1 = posAttr.getZ(i + 1);
      const x2 = posAttr.getX(i + 2), y2 = posAttr.getY(i + 2), z2 = posAttr.getZ(i + 2);

      const h0 = hashFromXYZ(x0, y0, z0);
      const h1 = hashFromXYZ(x1, y1, z1);
      const h2 = hashFromXYZ(x2, y2, z2);

      addNeighbor(h0, h1, i + 1);
      addNeighbor(h0, h2, i + 2);
      addNeighbor(h1, h0, i + 0);
      addNeighbor(h1, h2, i + 2);
      addNeighbor(h2, h0, i + 0);
      addNeighbor(h2, h1, i + 1);

      const h01 = hashFromXYZ((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
      const h12 = hashFromXYZ((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
      const h20 = hashFromXYZ((x2 + x0) * 0.5, (y2 + y0) * 0.5, (z2 + z0) * 0.5);

      addOpposite(h01, i + 2);
      addOpposite(h12, i + 0);
      addOpposite(h20, i + 1);

      addEdgePoint(h0, h01);
      addEdgePoint(h0, h20);
      addEdgePoint(h1, h01);
      addEdgePoint(h1, h12);
      addEdgePoint(h2, h12);
      addEdgePoint(h2, h20);
    }

    const flatVertexCount = flatPos.count;
    const outPositions = new Float32Array(flatVertexCount * 3);

    for (let i = 0; i < flatVertexCount; i++) {
      const fx = flatPos.getX(i), fy = flatPos.getY(i), fz = flatPos.getZ(i);
      const posHash = hashFromXYZ(fx, fy, fz);
      const isCorner = (i % 12 === 0) || (i % 12 === 3) || (i % 12 === 6);

      _average.x = fx; _average.y = fy; _average.z = fz;

      if (isCorner) {
        // Original vertex: apply Loop vertex rule
        const neighborMap = existingNeighbors[posHash];
        const edgeSet = existingEdges[posHash];
        if (neighborMap && edgeSet) {
          const neighborKeys = Object.keys(neighborMap);
          const k = neighborKeys.length;
          if (k >= 2) {
            let beta = 3 / 16;
            if (k > 3) {
              const cosVal = 0.375 + 0.25 * Math.cos((2 * Math.PI) / k);
              beta = (1 / k) * (0.625 - cosVal * cosVal);
            }
            const startWeight = 1.0 - k * beta;
            _center.x = fx * startWeight;
            _center.y = fy * startWeight;
            _center.z = fz * startWeight;

            for (let n = 0; n < k; n++) {
              const idxList = neighborMap[neighborKeys[n]];
              const nIdx = idxList[0];
              _center.x += posAttr.getX(nIdx) * beta;
              _center.y += posAttr.getY(nIdx) * beta;
              _center.z += posAttr.getZ(nIdx) * beta;
            }
            _average.x = fx * (1 - weight) + _center.x * weight;
            _average.y = fy * (1 - weight) + _center.y * weight;
            _average.z = fz * (1 - weight) + _center.z * weight;
          }
        }
      } else {
        // Edge midpoint vertex: 3/4 midpoint + 1/8 * (opposite0 + opposite1)
        const oppList = flatOpposites[posHash];
        if (oppList && oppList.length === 2) {
          const o0 = oppList[0];
          const o1 = oppList[1];
          const sx = fx * 0.75 + 0.125 * (posAttr.getX(o0) + posAttr.getX(o1));
          const sy = fy * 0.75 + 0.125 * (posAttr.getY(o0) + posAttr.getY(o1));
          const sz = fz * 0.75 + 0.125 * (posAttr.getZ(o0) + posAttr.getZ(o1));
          _average.x = fx * (1 - weight) + sx * weight;
          _average.y = fy * (1 - weight) + sy * weight;
          _average.z = fz * (1 - weight) + sz * weight;
        }
      }

      outPositions[i * 3] = _average.x;
      outPositions[i * 3 + 1] = _average.y;
      outPositions[i * 3 + 2] = _average.z;
    }

    loop.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
    if (flat.getAttribute('uv')) {
      loop.setAttribute('uv', flat.getAttribute('uv'));
    }

    existing.dispose();
    flat.dispose();
    return loop;
  }
}
