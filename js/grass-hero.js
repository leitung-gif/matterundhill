/**
 * Matter & Hill — Grass Hero Animation
 * Three.js WebGPU grass field with auto-wind
 * Dark green background, vibrant green grass
 */
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, instancedArray, instanceIndex, uv,
  positionGeometry, positionWorld, sin, cos, pow, smoothstep, mix,
  sqrt, select, hash, time, deltaTime, PI, mx_noise_float, attribute,
} from 'three/tsl';

// ── Wiesenblumen ──────────────────────────────────────
// Gänseblümchen, Margeriten und Weissklee, in lockeren Nestern wie in
// einem echten Rasen. Stufe über data-blumen am Container oder ?blumen=
// in der Adresse: «aus», «wenig», «mehr».
const FLOWER_LEVELS = {
  aus: { nests: 0, perNest: 0, scattered: 0 },
  wenig: { nests: 7, perNest: 9, scattered: 40 },
  mehr: { nests: 15, perNest: 18, scattered: 130 },
};

function flowerLevel(container) {
  let level = container.dataset.blumen || 'wenig';
  try {
    const q = new URLSearchParams(window.location.search).get('blumen');
    if (q && FLOWER_LEVELS[q]) level = q;
  } catch (e) { /* ohne Adresse bleibt die Vorgabe */ }
  return FLOWER_LEVELS[level] ? level : 'wenig';
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eine Blume als Bausteine: Stiel (Teil 0), Blütenblätter (1), Körbchen (2),
// Kleeköpfchen (3). Kopf liegt flach in der XZ-Ebene, Radius 1.
function flowerParts(kind) {
  const pos = [], part = [], shade = [], idx = [];
  const add = (x, y, z, p, s) => { pos.push(x, y, z); part.push(p); shade.push(s); return part.length - 1; };

  // Stiel, 4 Segmente, y = 0..1
  const base = part.length;
  for (let i = 0; i <= 4; i++) { const t = i / 4; add(-0.5, t, 0, 0, t); add(0.5, t, 0, 0, t); }
  for (let i = 0; i < 4; i++) { const b = base + i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }

  if (kind === 2) {
    // Klee: kleiner Kern, darum drei Kränze aus feinen Blütchen,
    // oben aufrecht, unten hängend wie beim echten Kleeköpfchen
    const core = part.length, seg = 8;
    add(0, 1.9, 0, 3, 0.2);
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * Math.PI * 2;
      add(Math.cos(th) * 0.55, 1.0, Math.sin(th) * 0.55, 3, 0.1);
    }
    add(0, 0.2, 0, 3, 0.0);
    for (let s = 0; s < seg; s++) {
      const n = core + 1 + ((s + 1) % seg), c = core + 1 + s;
      idx.push(core, n, c, core + seg + 1, c, n);
    }
    const tiers = [[1.55, 0.55, 9, 0.35], [1.05, 0.0, 11, 0.0], [0.55, -0.6, 10, 0.25]];
    for (const [ty, pitch, count, twist] of tiers) {
      for (let i = 0; i < count; i++) {
        const th = (i / count) * Math.PI * 2 + twist;
        const dx = Math.cos(th), dz = Math.sin(th), px = -dz, pz = dx;
        const len = 0.95, w = 0.16;
        const tipX = dx * (0.25 + len * Math.cos(pitch)), tipZ = dz * (0.25 + len * Math.cos(pitch));
        const tipY = ty + len * Math.sin(pitch);
        const v0 = add(dx * 0.25 + px * w, ty, dz * 0.25 + pz * w, 3, 0.15);
        const v1 = add(dx * 0.25 - px * w, ty, dz * 0.25 - pz * w, 3, 0.15);
        const v2 = add(tipX, tipY, tipZ, 3, pitch < 0 ? 0.55 : 1);
        idx.push(v0, v1, v2);
      }
    }
    return { pos, part, shade, idx };
  }

  // Gänseblümchen (0) oder Margerite (1)
  const petals = kind === 1 ? 21 : 26;
  const inner = kind === 1 ? 0.30 : 0.26;
  const halfW = kind === 1 ? 0.085 : 0.06;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + (i % 2) * 0.05;
    const len = 1 - (i % 3) * 0.06;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
    const p = (r, w, s) => add(ca * r + px * w, 0.06 + r * 0.10, sa * r + pz * w, 1, s);
    const v0 = p(inner * 0.9, -halfW * 0.6, 0), v1 = p(inner * 0.9, halfW * 0.6, 0);
    const v2 = p(len * 0.62, -halfW, 0.6), v3 = p(len * 0.62, halfW, 0.6);
    const v4 = add(ca * len, 0.06 + len * 0.10, sa * len, 1, 1);
    idx.push(v0, v1, v2, v1, v3, v2, v2, v3, v4);
  }
  // Körbchen, leicht gewölbt
  const c = add(0, 0.16, 0, 2, 1);
  const ring = 12, first = part.length;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    add(Math.cos(a) * inner, 0.09, Math.sin(a) * inner, 2, 0);
  }
  for (let i = 0; i < ring; i++) idx.push(c, first + ((i + 1) % ring), first + i);
  return { pos, part, shade, idx };
}

function buildFlowerGeometry(THREE, level) {
  const cfg = FLOWER_LEVELS[level];
  const rnd = mulberry32(level === 'mehr' ? 2027 : 1848);
  const flowers = [];
  // Sichtbarer Teil der Wiese vor der Kamera, Rand und Nebel ausgespart
  const inZone = (x, z) => (x * x) / (15 * 15) + (z * z) / (9.2 * 9.2) < 1 && z > -6.5;
  const pickKind = (nestKind) => {
    const r = rnd();
    if (nestKind !== undefined && r < 0.75) return nestKind;
    return r < 0.62 ? 0 : (r < 0.84 ? 2 : 1);
  };
  const push = (x, z, kind) => { if (inZone(x, z)) flowers.push({ x, z, kind }); };

  for (let n = 0; n < cfg.nests; n++) {
    // Nester eher rechts und hinten, damit die Schrift links frei bleibt
    let cx = (rnd() - 0.5) * 26, cz = -4 + rnd() * 13;
    if (cx < -2 && cz > -1 && rnd() < 0.7) { cx = -cx * 0.8; cz = cz - 4; }
    const nestKind = rnd() < 0.55 ? 0 : (rnd() < 0.6 ? 2 : 1);
    const spread = 0.8 + rnd() * 1.6;
    const count = Math.round(cfg.perNest * (0.6 + rnd() * 0.8));
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, r = spread * Math.sqrt(-2 * Math.log(1 - rnd() * 0.98)) * 0.6;
      push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, pickKind(nestKind));
    }
  }
  for (let i = 0; i < cfg.scattered; i++) {
    const x = (rnd() - 0.5) * 30, z = -6.5 + rnd() * 16;
    if (x < -2 && z > 0 && rnd() < 0.55) continue;
    push(x, z, pickKind());
  }

  const kinds = [flowerParts(0), flowerParts(1), flowerParts(2)];
  const pos = [], part = [], shade = [], i0 = [], i1 = [], idx = [];
  let offset = 0;
  for (const f of flowers) {
    const g = kinds[f.kind];
    const size = f.kind === 1 ? 0.28 + rnd() * 0.10 : (f.kind === 2 ? 0.08 + rnd() * 0.025 : 0.15 + rnd() * 0.06);
    const height = f.kind === 1 ? 1.12 + rnd() * 0.25 : (f.kind === 2 ? 0.95 + rnd() * 0.2 : 1.02 + rnd() * 0.25);
    const rot = rnd() * Math.PI * 2;
    const tilt = 0.35 + rnd() * 0.45;
    const tint = rnd();
    const nv = g.part.length;
    for (let v = 0; v < nv; v++) {
      pos.push(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]);
      part.push(g.part[v]); shade.push(g.shade[v]);
      i0.push(f.x, f.z, rot, tilt);
      i1.push(size, height, tint, f.kind);
    }
    for (const k of g.idx) idx.push(k + offset);
    offset += nv;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
  geo.setAttribute('aInst0', new THREE.Float32BufferAttribute(i0, 4));
  geo.setAttribute('aInst1', new THREE.Float32BufferAttribute(i1, 4));
  geo.setIndex(idx);
  return { geo, count: flowers.length };
}

export async function initGrassHero(container) {
  // ── Config — performance-tuned ──────────────────────
  const isMobile = window.innerWidth < 768;
  const isLowEnd = navigator.hardwareConcurrency <= 4;
  const BLADE_COUNT = isLowEnd ? 40000 : (isMobile ? 65000 : 80000);
  const FIELD_SIZE = 45;
  const SEGMENTS = 4;

  // Warm light beige background
  const BG_HEX = '#3d3325';
  const BG_DARK = '#332b1e';
  const FOG_HEX = '#382f22';

  // ── Scene ───────────────────────────────────────────
  const scene = new THREE.Scene();

  // Sky gradient — very dark green, almost black
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2e2619');
  grad.addColorStop(0.3, '#332b1e');
  grad.addColorStop(0.6, '#382f22');
  grad.addColorStop(1.0, '#3d3325');
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, 2, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(FOG_HEX, 0.028);

  // ── Camera ──────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(-2.8, 6.5, 17.5);
  camera.lookAt(0.5, 1.2, 0.4);

  // ── Renderer (WebGPU with automatic WebGL2 fallback for iOS) ──
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  const maxDPR = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(maxDPR);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;';
  await renderer.init();

  // ── GPU Buffers ─────────────────────────────────────
  const bladeData = instancedArray(BLADE_COUNT, 'vec4');
  const bendState = instancedArray(BLADE_COUNT, 'vec4');
  const bladeBound = instancedArray(BLADE_COUNT, 'float');

  // ── Uniforms ────────────────────────────────────────
  const windSpeed = uniform(1.3);
  const windAmplitude = uniform(0.21);
  const bladeWidth = uniform(4.0);
  const bladeTipWidth = uniform(0.19);
  const bladeHeight = uniform(1.6);
  const bladeHeightVariation = uniform(0.5);
  const bladeLean = uniform(1.1);
  const noiseAmplitude = uniform(1.85);
  const noiseFrequency = uniform(0.3);
  const noise2Amplitude = uniform(0.2);
  const noise2Frequency = uniform(15);
  const bladeColorVariation = uniform(0.93);
  const fogStart = uniform(8.0);
  const fogEnd = uniform(16.0);
  const fogIntensity = uniform(1.0);
  const grassDensity = uniform(1.0);

  // Dark fog/ground — deep forest green
  const fogColor = uniform(new THREE.Color(FOG_HEX));
  const groundColor = uniform(new THREE.Color(BG_DARK));
  const backgroundColor = uniform(new THREE.Color(BG_HEX));
  const groundRadius = uniform(20.0);
  const groundFalloff = uniform(3.0);

  // VIBRANT grass colors — rich greens with golden tips
  const bladeBaseColor = uniform(new THREE.Color(0.01, 0.04, 0.005));
  const bladeTipColor = uniform(new THREE.Color(0.35, 0.55, 0.05));
  const goldenTipColor = uniform(new THREE.Color(0.50, 0.52, 0.04));
  const greenTipColor = uniform(new THREE.Color(0.10, 0.32, 0.02));
  const midColor = uniform(new THREE.Color(0.04, 0.15, 0.01));

  // ── Helpers ─────────────────────────────────────────
  const noise2D = Fn(([x, z]) => mx_noise_float(vec3(x, float(0), z)).mul(0.5).add(0.5));

  // ── Compute: Init ───────────────────────────────────
  const computeInit = Fn(() => {
    const blade = bladeData.element(instanceIndex);
    const col = instanceIndex.mod(283);
    const row = instanceIndex.div(283);
    const jx = hash(instanceIndex).sub(0.5);
    const jz = hash(instanceIndex.add(7919)).sub(0.5);
    const wx = col.toFloat().add(jx).div(float(283)).sub(0.5).mul(FIELD_SIZE);
    const wz = row.toFloat().add(jz).div(float(283)).sub(0.5).mul(FIELD_SIZE);
    blade.x.assign(wx);
    blade.y.assign(wz);
    blade.z.assign(hash(instanceIndex.add(1337)).mul(PI.mul(2)));
    const n1 = noise2D(wx.mul(noiseFrequency), wz.mul(noiseFrequency));
    const n2 = noise2D(wx.mul(noiseFrequency.mul(noise2Frequency)).add(50), wz.mul(noiseFrequency.mul(noise2Frequency)).add(50));
    const clump = n1.mul(noiseAmplitude).sub(noise2Amplitude).add(n2.mul(noise2Amplitude).mul(2)).max(0);
    blade.w.assign(clump);
    const absX = wx.abs();
    const absZ = wz.abs();
    const edgeNoise = noise2D(wx.mul(0.25).add(100), wz.mul(0.25).add(100));
    const maxRX = float(20.0).add(edgeNoise.sub(0.5).mul(4.0));
    const maxRZ = float(10.0).add(edgeNoise.sub(0.5).mul(4.0));
    const boundaryX = float(1).sub(smoothstep(maxRX.sub(2.0), maxRX, absX));
    const boundaryZ = float(1).sub(smoothstep(maxRZ.sub(1.5), maxRZ, absZ));
    const boundary = boundaryX.mul(boundaryZ);
    bladeBound.element(instanceIndex).assign(select(boundary.lessThan(0.05), float(0), boundary));
  })().compute(BLADE_COUNT);

  // ── Compute: Update (wind only) ─────────────────────
  const computeUpdate = Fn(() => {
    const blade = bladeData.element(instanceIndex);
    const bend = bendState.element(instanceIndex);
    const bx = blade.x;
    const bz = blade.y;
    const w1 = sin(bx.mul(0.35).add(bz.mul(0.12)).add(time.mul(windSpeed)));
    const w2 = sin(bx.mul(0.18).add(bz.mul(0.28)).add(time.mul(windSpeed.mul(0.67))).add(1.7));
    const windX = w1.add(w2).mul(windAmplitude);
    const windZ = w1.sub(w2).mul(windAmplitude.mul(0.55));
    const lw = deltaTime.mul(4.0).saturate();
    bend.x.assign(mix(bend.x, windX, lw));
    bend.y.assign(mix(bend.y, windZ, lw));
    bend.z.assign(mix(bend.z, float(0), deltaTime.mul(1).saturate()));
    bend.w.assign(mix(bend.w, float(0), deltaTime.mul(1).saturate()));
  })().compute(BLADE_COUNT);

  // ── Blade Geometry ──────────────────────────────────
  function createBladeGeometry() {
    const segs = SEGMENTS, W = 0.055, H = 1.0;
    const verts = [], norms = [], uvArr = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, y = t * H, hw = W * 0.5 * (1.0 - t * 0.82);
      verts.push(-hw, y, 0, hw, y, 0);
      norms.push(0, 0, 1, 0, 0, 1);
      uvArr.push(0, t, 1, t);
    }
    for (let i = 0; i < segs; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    geo.setIndex(idx);
    return geo;
  }

  // ── Grass Material ──────────────────────────────────
  const grassMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: true });

  grassMat.positionNode = Fn(() => {
    const blade = bladeData.element(instanceIndex);
    const bend = bendState.element(instanceIndex);
    const worldX = blade.x, worldZ = blade.y, rotY = blade.z;
    const boundary = bladeBound.element(instanceIndex);
    const visible = select(hash(instanceIndex.add(9999)).lessThan(grassDensity.mul(0.5)), float(1), float(0));
    const hVar = hash(instanceIndex.add(5555)).mul(bladeHeightVariation);
    const heightScale = float(0.35).add(blade.w).add(hVar).mul(boundary).mul(visible);
    const taper = float(1).sub(uv().y.mul(float(1).sub(bladeTipWidth)));
    const lx = positionGeometry.x.mul(bladeWidth).mul(taper).mul(heightScale.sign());
    const ly = positionGeometry.y.mul(heightScale).mul(bladeHeight);
    const cY = cos(rotY), sY = sin(rotY);
    const rx = lx.mul(cY), rz = lx.mul(sY);
    const t = uv().y;
    const bendFactor = pow(t, 1.8);
    const staticBendX = hash(instanceIndex.add(7777)).sub(0.5).mul(bladeLean);
    const staticBendZ = hash(instanceIndex.add(8888)).sub(0.5).mul(bladeLean);
    const bendX = staticBendX.add(bend.x).add(bend.z);
    const bendZ = staticBendX.add(bend.y).add(bend.w);
    const relX = rx.add(bendX.mul(bendFactor).mul(bladeHeight));
    const relY = ly;
    const relZ = rz.add(bendZ.mul(bendFactor).mul(bladeHeight));
    const origLen = sqrt(rx.mul(rx).add(ly.mul(ly)).add(rz.mul(rz)));
    const newLen = sqrt(relX.mul(relX).add(relY.mul(relY)).add(relZ.mul(relZ)));
    const scale = origLen.div(newLen.max(0.0001));
    return vec3(worldX.add(relX.mul(scale)), relY.mul(scale), worldZ.add(relZ.mul(scale)));
  })();

  grassMat.colorNode = Fn(() => {
    const t = uv().y;
    const clump = bladeData.element(instanceIndex).w.saturate();
    const bladeHash = hash(instanceIndex.add(4242));
    const isGolden = bladeHash.lessThan(0.35);
    const lowerGrad = smoothstep(float(0.0), float(0.45), t);
    const upperGrad = smoothstep(float(0.4), float(0.85), t);
    const tipMix = float(1).sub(bladeColorVariation).add(clump.mul(bladeColorVariation));
    const greenTip = mix(greenTipColor, bladeTipColor, tipMix);
    const warmTip = mix(greenTipColor, goldenTipColor, tipMix);
    const tipFinal = mix(greenTip, warmTip, select(isGolden, float(1), float(0)));
    const lowerColor = mix(bladeBaseColor, midColor, lowerGrad);
    const grassColor = mix(lowerColor, tipFinal, upperGrad);
    const blade = bladeData.element(instanceIndex);
    const dist = sqrt(blade.x.mul(blade.x).add(blade.y.mul(blade.y)));
    const fogFactor = smoothstep(fogStart, fogEnd, dist).mul(fogIntensity);
    return mix(grassColor, fogColor, fogFactor);
  })();

  grassMat.opacityNode = Fn(() => {
    const blade = bladeData.element(instanceIndex);
    const dist = sqrt(blade.x.mul(blade.x).add(blade.y.mul(blade.y)));
    const fadeEnd = fogEnd.add(2.0);
    const fadeFactor = float(1).sub(smoothstep(fadeEnd.sub(5.0), fadeEnd, dist));
    return smoothstep(float(0.0), float(0.1), uv().y).mul(fadeFactor);
  })();
  grassMat.transparent = true;

  // ── Instances ───────────────────────────────────────
  const bladeGeo = createBladeGeometry();
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, BLADE_COUNT);
  grass.frustumCulled = false;
  scene.add(grass);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < BLADE_COUNT; i++) grass.setMatrixAt(i, dummy.matrix);
  grass.instanceMatrix.needsUpdate = true;

  // ── Ground — dark ───────────────────────────────────
  const groundMat = new THREE.MeshBasicNodeMaterial();
  groundMat.colorNode = Fn(() => {
    const wx = positionWorld.x, wz = positionWorld.z;
    const dist = sqrt(wx.mul(wx).add(wz.mul(wz)));
    const edgeNoise = noise2D(wx.mul(0.25).add(100), wz.mul(0.25).add(100));
    const maxR = groundRadius.add(edgeNoise.sub(0.5).mul(4.0));
    const t = smoothstep(maxR.sub(groundFalloff), maxR, dist);
    return mix(groundColor, backgroundColor, t);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_SIZE * 5, FIELD_SIZE * 5), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ── Wiesenblumen ────────────────────────────────────
  // Köpfe sitzen auf Höhe der Halmspitzen und wiegen im selben Wind.
  const level = flowerLevel(container);
  if (level !== 'aus') {
    const { geo: flowerGeo, count: flowerCount } = buildFlowerGeometry(THREE, level);
    const petalWhite = uniform(new THREE.Color(0.66, 0.66, 0.60));
    const petalBase = uniform(new THREE.Color(0.36, 0.38, 0.30));
    const petalBlush = uniform(new THREE.Color(0.62, 0.40, 0.46));
    const discYellow = uniform(new THREE.Color(0.78, 0.50, 0.04));
    const discDeep = uniform(new THREE.Color(0.55, 0.30, 0.02));
    const cloverTop = uniform(new THREE.Color(0.58, 0.56, 0.46));
    const cloverBase = uniform(new THREE.Color(0.30, 0.26, 0.16));
    const redCloverTop = uniform(new THREE.Color(0.50, 0.20, 0.32));
    const redCloverBase = uniform(new THREE.Color(0.26, 0.09, 0.15));
    const stemColor = uniform(new THREE.Color(0.05, 0.16, 0.02));

    const aPart = attribute('aPart', 'float');
    const aShade = attribute('aShade', 'float');
    const aInst0 = attribute('aInst0', 'vec4');
    const aInst1 = attribute('aInst1', 'vec4');

    const flowerMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: true });

    flowerMat.positionNode = Fn(() => {
      const wx = aInst0.x, wz = aInst0.y, rotY = aInst0.z, tilt = aInst0.w;
      const headSize = aInst1.x, heightFac = aInst1.y;
      // Halmhöhe an dieser Stelle, gleiche Rechnung wie beim Gras
      const n1 = noise2D(wx.mul(noiseFrequency), wz.mul(noiseFrequency));
      const n2 = noise2D(wx.mul(noiseFrequency.mul(noise2Frequency)).add(50), wz.mul(noiseFrequency.mul(noise2Frequency)).add(50));
      const clump = n1.mul(noiseAmplitude).sub(noise2Amplitude).add(n2.mul(noise2Amplitude).mul(2)).max(0);
      const edgeNoise = noise2D(wx.mul(0.25).add(100), wz.mul(0.25).add(100));
      const maxRX = float(20.0).add(edgeNoise.sub(0.5).mul(4.0));
      const maxRZ = float(10.0).add(edgeNoise.sub(0.5).mul(4.0));
      const boundary = float(1).sub(smoothstep(maxRX.sub(2.0), maxRX, wx.abs()))
        .mul(float(1).sub(smoothstep(maxRZ.sub(1.5), maxRZ, wz.abs())));
      const stemH = float(0.35).add(clump.min(1.1)).add(0.3).mul(bladeHeight).mul(heightFac).mul(boundary);
      // Wind wie im Compute-Shader, ungeglättet
      const w1 = sin(wx.mul(0.35).add(wz.mul(0.12)).add(time.mul(windSpeed)));
      const w2 = sin(wx.mul(0.18).add(wz.mul(0.28)).add(time.mul(windSpeed.mul(0.67))).add(1.7));
      const lean = hash(wx.mul(13.1).add(wz.mul(7.7)).abs().mul(1000)).sub(0.5).mul(0.5);
      const windX = w1.add(w2).mul(windAmplitude).add(lean);
      const windZ = w1.sub(w2).mul(windAmplitude.mul(0.55));
      const isStem = aPart.lessThan(0.5);
      const t = select(isStem, positionGeometry.y, float(1));
      const bendF = pow(t, 1.8).mul(stemH).mul(0.55);
      const topX = wx.add(windX.mul(bendF));
      const topZ = wz.add(windZ.mul(bendF));
      const topY = t.mul(stemH).mul(float(1).sub(windX.mul(windX).mul(0.08)));
      // Stiel: schmales Band quer zur Blickrichtung
      const stemPos = vec3(topX.add(positionGeometry.x.mul(0.035)), topY, topZ);
      // Kopf: drehen, zur Kamera neigen, mit dem Wind leicht kippen
      const p = positionGeometry;
      const cR = cos(rotY), sR = sin(rotY);
      const x1 = p.x.mul(cR).sub(p.z.mul(sR));
      const z1 = p.x.mul(sR).add(p.z.mul(cR));
      const tiltW = tilt.add(windZ.mul(0.25));
      const cT = cos(tiltW), sT = sin(tiltW);
      const y2 = p.y.mul(cT).sub(z1.mul(sT));
      const z2 = p.y.mul(sT).add(z1.mul(cT));
      const roll = windX.mul(0.35);
      const cW = cos(roll), sW = sin(roll);
      const x3 = x1.mul(cW).sub(y2.mul(sW));
      const y3 = x1.mul(sW).add(y2.mul(cW));
      const headPos = vec3(topX.add(x3.mul(headSize)), topY.add(y3.mul(headSize)), topZ.add(z2.mul(headSize)));
      return select(isStem, stemPos, headPos);
    })();

    flowerMat.colorNode = Fn(() => {
      const tint = aInst1.z, kind = aInst1.w;
      const petal = mix(petalBase, petalWhite, smoothstep(float(0.0), float(0.7), aShade));
      const blush = select(kind.lessThan(0.5).and(tint.lessThan(0.3)), smoothstep(float(0.75), float(1.0), aShade).mul(0.55), float(0));
      const petalCol = mix(petal, petalBlush, blush).mul(float(0.92).add(tint.mul(0.12)));
      const disc = mix(discDeep, discYellow, aShade);
      // Weissklee crème, jedes dritte Köpfchen Rotklee
      const cloverMix = smoothstep(float(0.1), float(0.8), aShade);
      const clover = select(tint.lessThan(0.33), mix(redCloverBase, redCloverTop, cloverMix), mix(cloverBase, cloverTop, cloverMix));
      const stem = stemColor.mul(float(0.6).add(aShade.mul(0.6)));
      const col = select(aPart.lessThan(0.5), stem,
        select(aPart.lessThan(1.5), petalCol,
          select(aPart.lessThan(2.5), disc, clover)));
      const wx = aInst0.x, wz = aInst0.y;
      const dist = sqrt(wx.mul(wx).add(wz.mul(wz)));
      const fogFactor = smoothstep(fogStart, fogEnd, dist).mul(fogIntensity);
      return mix(col, fogColor, fogFactor);
    })();

    const flowers = new THREE.Mesh(flowerGeo, flowerMat);
    flowers.frustumCulled = false;
    flowers.name = `wiesenblumen-${level}-${flowerCount}`;
    scene.add(flowers);
    container.dataset.blumenAktiv = `${level}:${flowerCount}`;
  }

  // ── Lighting — warm, brings out green ───────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // ── Boot ────────────────────────────────────────────
  await renderer.computeAsync(computeInit);

  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 0.6s ease';
  renderer.compute(computeUpdate);
  renderer.render(scene, camera);
  await new Promise(r => requestAnimationFrame(r));
  renderer.domElement.style.opacity = '1';

  // ── Subtle Camera Drift ─────────────────────────────
  const baseCamPos = { x: -2.8, y: 6.5, z: 17.5 };
  const lookTarget = new THREE.Vector3(0.5, 1.2, 0.4);
  const clock = new THREE.Clock();

  // ── Animation Loop ──────────────────────────────────
  function animate() {
    const elapsed = clock.getElapsedTime();
    camera.position.x = baseCamPos.x + Math.sin(elapsed * 0.08) * 0.4;
    camera.position.y = baseCamPos.y + Math.sin(elapsed * 0.05 + 1.2) * 0.15;
    camera.position.z = baseCamPos.z + Math.cos(elapsed * 0.06) * 0.3;
    camera.lookAt(lookTarget);
    renderer.compute(computeUpdate);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);

  // ── Resize ──────────────────────────────────────────
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }, 150);
  });

  container.classList.add('grass-loaded');
  return { renderer, scene, camera };
}
