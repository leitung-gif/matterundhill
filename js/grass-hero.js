/**
 * Matter & Hill — Grass Hero Animation
 * Three.js WebGPU grass field with auto-wind
 * Dark green background, vibrant green grass
 */
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, instancedArray, instanceIndex, uv,
  positionGeometry, positionWorld, sin, cos, pow, smoothstep, mix,
  sqrt, select, hash, time, deltaTime, PI, mx_noise_float,
} from 'three/tsl';

export async function initGrassHero(container) {
  // ── Config — performance-tuned ──────────────────────
  const isMobile = window.innerWidth < 768;
  const isLowEnd = isMobile || navigator.hardwareConcurrency <= 4;
  const BLADE_COUNT = isLowEnd ? 35000 : 80000;
  const FIELD_SIZE = 45;
  const SEGMENTS = isLowEnd ? 3 : 4;

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
  const fov = isMobile ? 65 : 50;
  const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 0.1, 100);
  if (isMobile) {
    camera.position.set(0, 3.5, 8);
    camera.lookAt(0, 1.0, -3);
  } else {
    camera.position.set(-2.8, 6.5, 17.5);
    camera.lookAt(0.5, 1.2, 0.4);
  }

  // ── Renderer ────────────────────────────────────────
  const renderer = new THREE.WebGPURenderer({ antialias: !isLowEnd, alpha: false });
  const maxDPR = isLowEnd ? 1.0 : Math.min(devicePixelRatio, 1.25);
  renderer.setPixelRatio(maxDPR);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
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
  const baseCamPos = isMobile ? { x: 0, y: 3.5, z: 8 } : { x: -2.8, y: 6.5, z: 17.5 };
  const lookTarget = isMobile ? new THREE.Vector3(0, 1.0, -3) : new THREE.Vector3(0.5, 1.2, 0.4);
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
