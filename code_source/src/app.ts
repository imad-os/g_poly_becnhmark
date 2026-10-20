/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoopSubdivision } from './subdivide';
import { I18N, Texts } from './i18n';

declare const THREE: any;
declare const Stats: any;
declare const MyPC: any;

interface AppState {
  subdivLevel: number;
  targetRes: string;
  shadowQuality: string;
  antialias: boolean;
  postProcessing: boolean;
  wireframe: boolean;
  materialPreset: string;
  clonesCount: number;
  autoOrbit: boolean;
  orbitSpeed: number;
  hudVisible: boolean;
  lang: string;
}

(function () {
  'use strict';

  const state: AppState = {
    subdivLevel: 0,
    targetRes: 'auto',
    shadowQuality: 'high',
    antialias: true,
    postProcessing: true,
    wireframe: false,
    materialPreset: 'cobalt',
    clonesCount: 1,
    autoOrbit: true,
    orbitSpeed: 1.0,
    hudVisible: true,
    lang: 'en'
  };

  let texts: Texts = I18N.en;

  // Global Three.js References
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let renderTarget: any = null;
  let postScene: any = null;
  let postCamera: any = null;
  let postMaterial: any = null;
  let dirLight: any = null;
  let hemiLight: any = null;
  let ambientLight: any = null;
  let rimLight: any = null;
  let characterGroup: any = null;
  let baseHumanoidGeom: any = null;
  let currentCharacterMesh: any = null;
  let wireframeMesh: any = null;
  let activeSubdividedGeom: any = null;
  let pedestalMesh: any = null;
  let contactShadowMesh: any = null;
  let clonesGroup: any = null;
  let stats: any = null;

  // Fixed-step loop state (60 Hz)
  let rafId = 0;
  let lastTs = 0;
  let acc = 0;
  const STEP = 1000 / 60;
  const DT = 1 / 60;
  let simTime = 0;

  // Camera Orbit State
  let camDistance = 7.8;
  let camAngle = 0.6;
  let camElevation = 2.4;
  let isDragging = false;
  let previousMouseX = 0;
  let previousMouseY = 0;

  // Pre-allocated Benchmark Buffer (Zero per-frame allocation)
  const MAX_BM_SAMPLES = 2400;
  const bmFpsBuffer = new Float32Array(MAX_BM_SAMPLES);
  const benchmark = {
    active: false,
    duration: 15.0,
    elapsed: 0,
    sampleCount: 0,
    uiTick: 0
  };

  // Focus navigation list (pre-cached)
  let focusItems: HTMLElement[] = [];
  let currentFocusIndex = 0;
  const padDevs = ['pad0', 'pad1', 'pad2', 'pad3'];

  // Materials Library
  let materials: Record<string, any> = {};
  let wireframeMat: any = null;

  function initMaterials() {
    materials = {
      cobalt: new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.50, roughness: 0.32 }),
      stealth: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.28 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.25 }),
      emerald: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.40, roughness: 0.35 }),
      clay: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.05, roughness: 0.75 })
    };
    wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      wireframe: true,
      transparent: true,
      opacity: 0.32
    });
  }

  function savePreferences() {
    if (typeof MyPC !== 'undefined' && MyPC.save) {
      MyPC.save('bench_prefs', {
        subdivLevel: state.subdivLevel,
        targetRes: state.targetRes,
        shadowQuality: state.shadowQuality,
        antialias: state.antialias,
        postProcessing: state.postProcessing,
        wireframe: state.wireframe,
        materialPreset: state.materialPreset,
        clonesCount: state.clonesCount,
        autoOrbit: state.autoOrbit,
        orbitSpeed: state.orbitSpeed
      });
    }
  }

  function applyLanguage(langCode: string) {
    state.lang = I18N[langCode] ? langCode : 'en';
    texts = I18N[state.lang];

    const setText = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('i18n-title', texts.title);
    setText('i18n-subtitle', texts.subtitle);
    setText('i18n-run-bm', texts.runBenchmark);
    setText('i18n-smoothing', texts.smoothing);
    setText('i18n-wireframe', texts.wireframe);
    setText('i18n-material', texts.material);
    setText('i18n-resolution', texts.resolution);
    setText('i18n-shadows', texts.shadows);
    setText('i18n-antialias', texts.antialias);
    setText('i18n-post', texts.postProcess);
    setText('i18n-clones', texts.clones);
    setText('i18n-orbit', texts.autoOrbit);
    setText('i18n-speed', texts.orbitSpeed);
    setText('i18n-reset-cam', texts.resetCam);
    setText('i18n-hud-btn', state.hudVisible ? texts.hideHud : texts.showHud);
    setText('i18n-res-label', texts.resLabel);
    setText('i18n-tris-label', texts.trisLabel);
    setText('i18n-verts-label', texts.vertsLabel);
    setText('i18n-draws-label', texts.drawsLabel);
    setText('i18n-level-label', texts.levelLabel);
    setText('i18n-pads-label', texts.padsLabel);
    setText('i18n-bm-title', texts.bmTitle);
    setText('i18n-bm-desc', texts.bmDesc);
    setText('i18n-bm-result', texts.bmResult);
    setText('i18n-bm-close', texts.bmClose);
    setText('i18n-bm-rerun', texts.bmRerun);
  }

  function initStats() {
    if (typeof Stats !== 'undefined') {
      stats = new Stats();
      stats.showPanel(0);
      const container = document.getElementById('stats-container');
      if (container) {
        container.innerHTML = '';
        container.appendChild(stats.dom);
        stats.dom.style.position = 'relative';
      }
    }
  }

  /**
   * Procedurally builds a Minecraft-style humanoid figure using merged BoxGeometries
   * (head, neck, torso, arms, legs) with welded vertices at shared joint planes so
   * Loop Subdivision smooths into organic curved surfaces without joint tearing.
   */
  function createBaseHumanoidGeometry(): any {
    const parts: any[] = [];

    function addBox(w: number, h: number, d: number, x: number, y: number, z: number) {
      const geom = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      // Shift vertically so soles of feet sit flush at y = 0
      geom.translate(x, y + 0.33, z);
      parts.push(geom);
    }

    // Head & Visor
    addBox(0.80, 0.80, 0.80, 0.0, 2.70, 0.0);
    addBox(0.72, 0.16, 0.12, 0.0, 2.73, 0.40);

    // Neck connecting Head and Torso
    addBox(0.40, 0.30, 0.40, 0.0, 2.25, 0.0);

    // Upper & Lower Torso
    addBox(0.92, 0.76, 0.52, 0.0, 1.85, 0.0);
    addBox(0.78, 0.56, 0.46, 0.0, 1.25, 0.0);

    // Left & Right Arms (touching torso shoulder joints)
    addBox(0.36, 0.64, 0.36, -0.62, 1.85, 0.0);
    addBox(0.32, 0.64, 0.32, -0.62, 1.23, 0.0);
    addBox(0.36, 0.64, 0.36, 0.62, 1.85, 0.0);
    addBox(0.32, 0.64, 0.32, 0.62, 1.23, 0.0);

    // Left & Right Legs (touching pelvis hip joints)
    addBox(0.36, 0.68, 0.36, -0.23, 0.65, 0.0);
    addBox(0.34, 0.68, 0.40, -0.23, 0.00, 0.02);
    addBox(0.36, 0.68, 0.36, 0.23, 0.65, 0.0);
    addBox(0.34, 0.68, 0.40, 0.23, 0.00, 0.02);

    let totalVerts = 0;
    let totalIndices = 0;
    for (let i = 0; i < parts.length; i++) {
      totalVerts += parts[i].attributes.position.count;
      if (parts[i].index) totalIndices += parts[i].index.count;
    }

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = new Uint32Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      const pCount = part.attributes.position.count;
      positions.set(part.attributes.position.array, vOffset * 3);
      if (part.attributes.normal) normals.set(part.attributes.normal.array, vOffset * 3);
      if (part.attributes.uv) uvs.set(part.attributes.uv.array, vOffset * 2);

      if (part.index) {
        const idxArr = part.index.array;
        for (let i = 0; i < idxArr.length; i++) {
          indices[iOffset + i] = idxArr[i] + vOffset;
        }
        iOffset += idxArr.length;
      }
      vOffset += pCount;
      part.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeVertexNormals();
    return merged;
  }

  /**
   * Applies Loop Subdivision and explicitly disposes the previous subdivided geometry
   * to prevent GPU memory leaks when the slider moves.
   */
  function updateCharacterSubdivision(level: number) {
    const clampedLevel = Math.max(0, Math.min(4, level));
    state.subdivLevel = clampedLevel;

    // Dispose previous subdivided geometry to prevent memory leaks
    if (activeSubdividedGeom && activeSubdividedGeom !== baseHumanoidGeom) {
      activeSubdividedGeom.dispose();
      activeSubdividedGeom = null;
    }

    let targetGeom = baseHumanoidGeom;
    if (clampedLevel > 0) {
      targetGeom = LoopSubdivision.modify(baseHumanoidGeom, clampedLevel, {
        split: false,
        uvSmooth: true
      });
      activeSubdividedGeom = targetGeom;
    }

    if (currentCharacterMesh) currentCharacterMesh.geometry = targetGeom;
    if (wireframeMesh) wireframeMesh.geometry = targetGeom;

    if (clonesGroup) {
      for (let i = 0; i < clonesGroup.children.length; i++) {
        const child = clonesGroup.children[i];
        if (child.isMesh) child.geometry = targetGeom;
      }
    }

    const sliderEl = document.getElementById('slider-subdiv') as HTMLInputElement | null;
    if (sliderEl && parseInt(sliderEl.value, 10) !== clampedLevel) {
      sliderEl.value = String(clampedLevel);
    }

    updateGeometryTelemetry(targetGeom);
    savePreferences();

    if (typeof MyPC !== 'undefined' && MyPC.announce) {
      const levelName = texts.levels[clampedLevel] || ('Level ' + clampedLevel);
      MyPC.announce(levelName);
    }
  }

  function updateGeometryTelemetry(geom: any) {
    if (!geom || !geom.attributes || !geom.attributes.position) return;
    const triCount = geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3;
    const totalTris = Math.round(triCount * state.clonesCount);
    const totalVerts = Math.round(geom.attributes.position.count * state.clonesCount);

    const trisEl = document.getElementById('hud-tris');
    const vertsEl = document.getElementById('hud-verts');
    const lvlEl = document.getElementById('hud-level');
    const subLabel = document.getElementById('label-subdiv-level');

    if (trisEl) trisEl.textContent = totalTris.toLocaleString();
    if (vertsEl) vertsEl.textContent = totalVerts.toLocaleString();
    if (lvlEl) lvlEl.textContent = String(state.subdivLevel);
    if (subLabel) {
      subLabel.textContent = texts.levels[state.subdivLevel] || ('Level ' + state.subdivLevel);
    }
  }

  function applyResolution(resKey: string) {
    state.targetRes = resKey;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pr = window.devicePixelRatio || 1;

    if (resKey === '480p') {
      width = 854;
      height = 480;
      pr = 1;
    } else if (resKey === '720p') {
      width = 1280;
      height = 720;
      pr = 1;
    } else if (resKey === '1080p') {
      width = 1920;
      height = 1080;
      pr = 1;
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
      pr = Math.min(window.devicePixelRatio || 1, 2);
    }

    if (renderer) {
      renderer.setPixelRatio(pr);
      // 3rd param false locks internal drawing buffer while CSS stretches canvas to 100vw x 100vh
      renderer.setSize(width, height, false);
    }

    if (renderTarget) {
      renderTarget.setSize(width, height);
      if (postMaterial) postMaterial.uniforms.resolution.value.set(width, height);
    }

    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }

    const hudRes = document.getElementById('hud-res');
    const labelRes = document.getElementById('label-res');
    if (hudRes) hudRes.textContent = Math.round(width * pr) + '×' + Math.round(height * pr);
    if (labelRes) labelRes.textContent = resKey.toUpperCase();

    const btns = document.querySelectorAll('#seg-res .seg-btn');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i] as HTMLElement;
      b.classList.toggle('active', b.dataset.res === resKey);
    }
    savePreferences();
  }

  function applyShadowQuality(quality: string) {
    state.shadowQuality = quality;
    if (!renderer || !dirLight) return;

    if (quality === 'off') {
      renderer.shadowMap.enabled = false;
      dirLight.castShadow = false;
    } else {
      renderer.shadowMap.enabled = true;
      dirLight.castShadow = true;

      if (quality === 'low') {
        renderer.shadowMap.type = THREE.BasicShadowMap;
        dirLight.shadow.mapSize.set(512, 512);
      } else if (quality === 'med') {
        renderer.shadowMap.type = THREE.PCFShadowMap;
        dirLight.shadow.mapSize.set(1024, 1024);
      } else {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        dirLight.shadow.mapSize.set(2048, 2048);
      }
    }

    if (dirLight.shadow.map) {
      dirLight.shadow.map.dispose();
      dirLight.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
    if (scene) {
      scene.traverse(function (o: any) {
        if (o.isMesh && o.material) o.material.needsUpdate = true;
      });
    }

    const labelShadow = document.getElementById('label-shadow');
    if (labelShadow) labelShadow.textContent = quality.toUpperCase();

    const btns = document.querySelectorAll('#seg-shadow .seg-btn');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i] as HTMLElement;
      b.classList.toggle('active', b.dataset.shadow === quality);
    }
    savePreferences();
  }

  function applyAntialias(enabled: boolean) {
    state.antialias = enabled;
    const oldCanvas = document.getElementById('webgl-canvas');
    if (!oldCanvas || !oldCanvas.parentNode) return;

    // Replace canvas element so new WebGL context receives updated antialias flag
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'webgl-canvas';
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);

    if (renderer) renderer.dispose();

    renderer = new THREE.WebGLRenderer({
      canvas: newCanvas,
      antialias: enabled,
      powerPreference: 'high-performance'
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    bindCanvasPointerEvents(newCanvas);
    applyResolution(state.targetRes);
    applyShadowQuality(state.shadowQuality);

    const aaToggle = document.getElementById('toggle-aa');
    if (aaToggle) aaToggle.classList.toggle('active', enabled);
    savePreferences();
  }

  function updateClonesCount(count: number) {
    const clamped = Math.max(1, Math.min(25, count));
    state.clonesCount = clamped;

    const labelClones = document.getElementById('label-clones');
    if (labelClones) labelClones.textContent = clamped === 1 ? '1x (Solo)' : clamped + 'x Clones';

    const sliderClones = document.getElementById('slider-clones') as HTMLInputElement | null;
    if (sliderClones && parseInt(sliderClones.value, 10) !== clamped) {
      sliderClones.value = String(clamped);
    }

    if (clonesGroup && scene) {
      scene.remove(clonesGroup);
      clonesGroup = null;
    }

    const curGeom = activeSubdividedGeom || baseHumanoidGeom;
    if (clamped > 1 && scene && curGeom) {
      clonesGroup = new THREE.Group();
      const curMat = materials[state.materialPreset];

      for (let i = 1; i < clamped; i++) {
        const cloneMesh = new THREE.Mesh(curGeom, curMat);
        cloneMesh.castShadow = state.shadowQuality !== 'off';
        cloneMesh.receiveShadow = true;

        const angle = (i / (clamped - 1)) * Math.PI * 2;
        const radius = clamped <= 10 ? 2.5 : (1.8 + (i % 2) * 1.5);
        cloneMesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        cloneMesh.scale.set(0.8, 0.8, 0.8);
        clonesGroup.add(cloneMesh);
      }
      scene.add(clonesGroup);
    }

    updateGeometryTelemetry(curGeom);
    savePreferences();
  }

  function setupPostProcessing() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    postScene = new THREE.Scene();
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(w, h) },
        bloomStrength: { value: 0.35 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 resolution;',
        'uniform float bloomStrength;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec4 col = texture2D(tDiffuse, vUv);',
        '  vec2 offset = vec2(1.5) / resolution;',
        '  vec4 b1 = texture2D(tDiffuse, vUv + vec2( offset.x,  offset.y));',
        '  vec4 b2 = texture2D(tDiffuse, vUv + vec2(-offset.x,  offset.y));',
        '  vec4 b3 = texture2D(tDiffuse, vUv + vec2( offset.x, -offset.y));',
        '  vec4 b4 = texture2D(tDiffuse, vUv + vec2(-offset.x, -offset.y));',
        '  vec4 blur = (b1 + b2 + b3 + b4) * 0.25;',
        '  vec3 glow = max(blur.rgb - 0.45, 0.0) * bloomStrength;',
        '  vec2 uvCenter = vUv - 0.5;',
        '  float vignette = 1.0 - dot(uvCenter, uvCenter) * 0.55;',
        '  gl_FragColor = vec4((col.rgb + glow * 1.4) * vignette, col.a);',
        '}'
      ].join('\n')
    });

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeom, postMaterial);
    postScene.add(quadMesh);
  }

  function updateCameraPosition() {
    if (!camera) return;
    camera.position.x = Math.sin(camAngle) * camDistance;
    camera.position.z = Math.cos(camAngle) * camDistance;
    camera.position.y = camElevation;
    camera.lookAt(0, 1.6, 0);
  }

  function initScene() {
    initMaterials();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.Fog(0x080c14, 12, 35);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    updateCameraPosition();

    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: state.antialias,
      powerPreference: 'high-performance'
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.6);
    scene.add(hemiLight);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xfff1e0, 1.4);
    dirLight.position.set(5, 9, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-5, 6, -6);
    scene.add(rimLight);

    // Circular Floor Pedestal
    const pedestalGeom = new THREE.CylinderGeometry(4.6, 4.9, 0.35, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
      metalness: 0.35
    });
    pedestalMesh = new THREE.Mesh(pedestalGeom, pedestalMat);
    pedestalMesh.position.y = -0.175;
    pedestalMesh.receiveShadow = true;
    scene.add(pedestalMesh);

    const ringGeom = new THREE.RingGeometry(2.0, 2.05, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.003;
    scene.add(ringMesh);

    const outerRingGeom = new THREE.RingGeometry(3.8, 3.84, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const outerRingMesh = new THREE.Mesh(outerRingGeom, outerRingMat);
    outerRingMesh.rotation.x = -Math.PI / 2;
    outerRingMesh.position.y = 0.003;
    scene.add(outerRingMesh);

    const contactGeom = new THREE.CircleGeometry(1.6, 32);
    const contactMat = new THREE.MeshBasicMaterial({
      color: 0x030712,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    contactShadowMesh = new THREE.Mesh(contactGeom, contactMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.005;
    scene.add(contactShadowMesh);

    baseHumanoidGeom = createBaseHumanoidGeometry();
    characterGroup = new THREE.Group();

    currentCharacterMesh = new THREE.Mesh(baseHumanoidGeom, materials[state.materialPreset]);
    currentCharacterMesh.castShadow = true;
    currentCharacterMesh.receiveShadow = true;
    characterGroup.add(currentCharacterMesh);

    wireframeMesh = new THREE.Mesh(baseHumanoidGeom, wireframeMat);
    wireframeMesh.visible = state.wireframe;
    characterGroup.add(wireframeMesh);

    scene.add(characterGroup);

    setupPostProcessing();
    bindCanvasPointerEvents(canvas);
    applyResolution(state.targetRes);
    applyShadowQuality(state.shadowQuality);
    updateCharacterSubdivision(state.subdivLevel);
    updateClonesCount(state.clonesCount);
  }

  /**
   * Fixed 60 Hz simulation step (zero allocations per frame)
   */
  function updateFixedStep() {
    simTime += DT;

    // Poll Gamepad analog sticks & triggers across up to 4 controllers (pad0..pad3)
    if (typeof MyPC !== 'undefined' && MyPC.gamepad && !benchmark.active) {
      let stickRx = 0;
      let stickRy = 0;
      for (let p = 0; p < 4; p++) {
        const dev = padDevs[p];
        const rx = MyPC.gamepad.axis(2, dev) || 0;
        const ry = MyPC.gamepad.axis(3, dev) || 0;
        if (Math.abs(rx) > 0.15) stickRx += rx;
        if (Math.abs(ry) > 0.15) stickRy += ry;
      }
      const lt = MyPC.gamepad.value(6) || 0;
      const rt = MyPC.gamepad.value(7) || 0;

      if (stickRx !== 0 || stickRy !== 0 || lt > 0.1 || rt > 0.1) {
        camAngle += stickRx * 0.035;
        camElevation = Math.max(0.5, Math.min(8.0, camElevation - stickRy * 0.04));
        camDistance = Math.max(3.0, Math.min(16.0, camDistance + (lt - rt) * 0.08));
        updateCameraPosition();
      }
    }

    if (state.autoOrbit && !isDragging && !benchmark.active) {
      camAngle += 0.35 * state.orbitSpeed * DT;
      updateCameraPosition();
    }

    if (characterGroup) {
      characterGroup.position.y = Math.sin(simTime * 2.0) * 0.02;
    }
    if (clonesGroup) {
      const children = clonesGroup.children;
      for (let i = 0; i < children.length; i++) {
        children[i].position.y = Math.sin(simTime * 2.5 + i) * 0.025;
      }
    }
  }

  function drawScene(frameDtSec: number) {
    if (!renderer || !scene || !camera) return;

    if (benchmark.active) {
      updateBenchmarkFrame(frameDtSec);
    }

    if (state.postProcessing && renderTarget) {
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);

      renderer.setRenderTarget(null);
      postMaterial.uniforms.tDiffuse.value = renderTarget.texture;
      renderer.render(postScene, postCamera);
    } else {
      renderer.render(scene, camera);
    }

    if (renderer.info) {
      const drawsEl = document.getElementById('hud-draws');
      if (drawsEl) drawsEl.textContent = String(renderer.info.render.calls);
    }
  }

  function frame(ts: number) {
    rafId = requestAnimationFrame(frame);
    if (stats) stats.begin();

    if (!lastTs) lastTs = ts;
    const rawDeltaMs = Math.min(250, ts - lastTs);
    lastTs = ts;
    acc += rawDeltaMs;

    while (acc >= STEP) {
      updateFixedStep();
      acc -= STEP;
    }

    drawScene(rawDeltaMs / 1000);

    if (stats) stats.end();
  }

  function startLoop() {
    if (!rafId) {
      lastTs = 0;
      acc = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startBenchmark() {
    if (benchmark.active) return;
    benchmark.active = true;
    benchmark.elapsed = 0;
    benchmark.sampleCount = 0;
    benchmark.uiTick = 0;

    const overlay = document.getElementById('benchmark-overlay');
    const runBox = document.getElementById('bm-running-box');
    const resBox = document.getElementById('bm-result-box');
    if (overlay) overlay.classList.add('active');
    if (runBox) runBox.style.display = 'flex';
    if (resBox) resBox.style.display = 'none';

    if (typeof MyPC !== 'undefined' && MyPC.announce) {
      MyPC.announce(texts.bmTitle);
    }
  }

  function updateBenchmarkFrame(dtSec: number) {
    benchmark.elapsed += dtSec;
    const currentFps = dtSec > 0.001 ? 1 / dtSec : 60;
    if (benchmark.sampleCount < MAX_BM_SAMPLES) {
      bmFpsBuffer[benchmark.sampleCount++] = currentFps;
    }

    const progress = Math.min(benchmark.elapsed / benchmark.duration, 1.0);
    camAngle += 0.85 * dtSec;
    camElevation = 1.8 + Math.sin(progress * Math.PI * 4) * 1.5;
    camDistance = 6.0 + Math.cos(progress * Math.PI * 2) * 2.5;
    updateCameraPosition();

    benchmark.uiTick++;
    if (benchmark.uiTick % 4 === 0) {
      const fillEl = document.getElementById('bm-progress-fill');
      const timerEl = document.getElementById('bm-timer-text');
      const fpsEl = document.getElementById('bm-current-fps');
      if (fillEl) fillEl.style.width = (progress * 100).toFixed(1) + '%';
      if (timerEl) timerEl.textContent = Math.max(0, benchmark.duration - benchmark.elapsed).toFixed(1) + 's';
      if (fpsEl) fpsEl.textContent = currentFps.toFixed(0) + ' FPS | ' + (dtSec * 1000).toFixed(1) + ' ms';
    }

    if (benchmark.elapsed >= benchmark.duration) {
      finishBenchmark();
    }
  }

  function finishBenchmark() {
    benchmark.active = false;
    const validSamples: number[] = [];
    for (let i = 0; i < benchmark.sampleCount; i++) {
      const v = bmFpsBuffer[i];
      if (v > 3 && v < 360) validSamples.push(v);
    }
    validSamples.sort((a, b) => a - b);

    let sum = 0;
    for (let i = 0; i < validSamples.length; i++) sum += validSamples[i];
    const avgFps = validSamples.length ? sum / validSamples.length : 60;
    const minFps = validSamples.length ? validSamples[0] : 30;
    const low1Idx = Math.max(0, Math.floor(validSamples.length * 0.01));
    const low1PercentFps = validSamples[low1Idx] || minFps;
    const avgFrameTime = avgFps > 0 ? 1000 / avgFps : 16.6;

    const curGeom = activeSubdividedGeom || baseHumanoidGeom;
    const triCount = curGeom.index ? curGeom.index.count / 3 : curGeom.attributes.position.count / 3;
    const tris = triCount * state.clonesCount;

    const score = Math.round(avgFps * 65 + low1PercentFps * 35 + (tris / 1000) * 15);

    let grade = 'S+ ULTRA PERFORMANCE';
    let gradeClass = 'grade-s';
    if (avgFps >= 58 && low1PercentFps >= 50) {
      grade = 'S+ ULTRA PERFORMANCE'; gradeClass = 'grade-s';
    } else if (avgFps >= 45) {
      grade = 'A GAMING SMOOTH'; gradeClass = 'grade-a';
    } else if (avgFps >= 30) {
      grade = 'B STANDARD COMFORT'; gradeClass = 'grade-b';
    } else {
      grade = 'C NEEDS TUNING'; gradeClass = 'grade-c';
    }

    const setEl = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setEl('bm-final-score', score.toLocaleString());
    const badge = document.getElementById('bm-grade-badge');
    if (badge) {
      badge.textContent = grade;
      badge.className = 'bm-grade-badge ' + gradeClass;
    }

    setEl('bm-stat-avg', avgFps.toFixed(1));
    setEl('bm-stat-low', low1PercentFps.toFixed(1));
    setEl('bm-stat-tris', tris > 999 ? (tris / 1000).toFixed(1) + 'k' : String(Math.round(tris)));
    setEl('bm-stat-res', state.targetRes.toUpperCase());
    setEl('bm-stat-shadow', state.shadowQuality.toUpperCase());
    setEl('bm-stat-time', avgFrameTime.toFixed(1) + 'ms');

    const runBox = document.getElementById('bm-running-box');
    const resBox = document.getElementById('bm-result-box');
    if (runBox) runBox.style.display = 'none';
    if (resBox) resBox.style.display = 'flex';

    const closeBtn = document.getElementById('btn-close-bm');
    if (closeBtn) closeBtn.focus();

    if (typeof MyPC !== 'undefined' && MyPC.announce) {
      MyPC.announce(texts.bmResult + ': ' + score + ', ' + grade);
    }
  }

  function toggleHud() {
    state.hudVisible = !state.hudVisible;
    const panel = document.getElementById('control-panel');
    const tele = document.getElementById('telemetry-bar');
    const statsEl = document.getElementById('stats-container');
    const btnText = document.getElementById('i18n-hud-btn');

    if (panel) panel.classList.toggle('hidden', !state.hudVisible);
    if (tele) tele.style.display = state.hudVisible ? 'flex' : 'none';
    if (statsEl) statsEl.style.display = state.hudVisible ? 'block' : 'none';
    if (btnText) btnText.textContent = state.hudVisible ? texts.hideHud : texts.showHud;

    refreshFocusableItems();
  }

  function bindCanvasPointerEvents(canvas: HTMLElement) {
    canvas.addEventListener('mousedown', function (e: MouseEvent) {
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    });

    canvas.addEventListener('wheel', function (e: WheelEvent) {
      camDistance = Math.max(3.0, Math.min(16.0, camDistance + e.deltaY * 0.005));
      updateCameraPosition();
    }, { passive: true });

    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', function (e: TouchEvent) {
      if (e.touches.length === 1) {
        isDragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', function () {
      isDragging = false;
    });

    canvas.addEventListener('touchmove', function (e: TouchEvent) {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      camAngle -= deltaX * 0.008;
      camElevation = Math.max(0.5, Math.min(8.0, camElevation + deltaY * 0.015));
      updateCameraPosition();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
  }

  function setupUI() {
    const subSlider = document.getElementById('slider-subdiv') as HTMLInputElement;
    if (subSlider) {
      subSlider.addEventListener('input', function () {
        updateCharacterSubdivision(parseInt(subSlider.value, 10));
      });
    }

    const wfToggle = document.getElementById('toggle-wireframe');
    if (wfToggle) {
      wfToggle.addEventListener('click', function () {
        state.wireframe = !state.wireframe;
        wfToggle.classList.toggle('active', state.wireframe);
        if (wireframeMesh) wireframeMesh.visible = state.wireframe;
        savePreferences();
      });
    }

    const swatches = document.querySelectorAll('.swatch-btn');
    for (let i = 0; i < swatches.length; i++) {
      const btn = swatches[i] as HTMLElement;
      btn.addEventListener('click', function () {
        for (let j = 0; j < swatches.length; j++) swatches[j].classList.remove('active');
        btn.classList.add('active');
        const matKey = btn.dataset.mat || 'cobalt';
        state.materialPreset = matKey;
        if (currentCharacterMesh) currentCharacterMesh.material = materials[matKey];
        if (clonesGroup) {
          for (let c = 0; c < clonesGroup.children.length; c++) {
            clonesGroup.children[c].material = materials[matKey];
          }
        }
        const labelMat = document.getElementById('label-mat');
        if (labelMat) labelMat.textContent = btn.title;
        savePreferences();
      });
    }

    const resBtns = document.querySelectorAll('#seg-res .seg-btn');
    for (let i = 0; i < resBtns.length; i++) {
      const btn = resBtns[i] as HTMLElement;
      btn.addEventListener('click', function () {
        if (btn.dataset.res) applyResolution(btn.dataset.res);
      });
    }

    const shadowBtns = document.querySelectorAll('#seg-shadow .seg-btn');
    for (let i = 0; i < shadowBtns.length; i++) {
      const btn = shadowBtns[i] as HTMLElement;
      btn.addEventListener('click', function () {
        if (btn.dataset.shadow) applyShadowQuality(btn.dataset.shadow);
      });
    }

    const aaToggle = document.getElementById('toggle-aa');
    if (aaToggle) {
      aaToggle.addEventListener('click', function () {
        applyAntialias(!state.antialias);
      });
    }

    const postToggle = document.getElementById('toggle-post');
    if (postToggle) {
      postToggle.addEventListener('click', function () {
        state.postProcessing = !state.postProcessing;
        postToggle.classList.toggle('active', state.postProcessing);
        savePreferences();
      });
    }

    const clonesSlider = document.getElementById('slider-clones') as HTMLInputElement;
    if (clonesSlider) {
      clonesSlider.addEventListener('input', function () {
        updateClonesCount(parseInt(clonesSlider.value, 10));
      });
    }

    const orbitToggle = document.getElementById('toggle-orbit');
    if (orbitToggle) {
      orbitToggle.addEventListener('click', function () {
        state.autoOrbit = !state.autoOrbit;
        orbitToggle.classList.toggle('active', state.autoOrbit);
        savePreferences();
      });
    }

    const speedSlider = document.getElementById('slider-speed') as HTMLInputElement;
    if (speedSlider) {
      speedSlider.addEventListener('input', function () {
        state.orbitSpeed = parseFloat(speedSlider.value);
        const lbl = document.getElementById('label-speed');
        if (lbl) lbl.textContent = state.orbitSpeed.toFixed(1) + 'x';
        savePreferences();
      });
    }

    const resetBtn = document.getElementById('btn-reset-cam');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        camDistance = 7.8;
        camAngle = 0.6;
        camElevation = 2.4;
        updateCameraPosition();
      });
    }

    const bmBtn = document.getElementById('btn-start-benchmark');
    if (bmBtn) bmBtn.addEventListener('click', startBenchmark);

    const rerunBtn = document.getElementById('btn-rerun-bm');
    if (rerunBtn) rerunBtn.addEventListener('click', startBenchmark);

    const closeBmBtn = document.getElementById('btn-close-bm');
    if (closeBmBtn) {
      closeBmBtn.addEventListener('click', function () {
        const overlay = document.getElementById('benchmark-overlay');
        if (overlay) overlay.classList.remove('active');
        refreshFocusableItems();
      });
    }

    const toggleHudBtn = document.getElementById('toggle-hud-btn');
    if (toggleHudBtn) toggleHudBtn.addEventListener('click', toggleHud);

    const closeHudBtn = document.getElementById('btn-close-hud');
    if (closeHudBtn) closeHudBtn.addEventListener('click', toggleHud);

    window.addEventListener('mouseup', function () {
      isDragging = false;
    });

    window.addEventListener('mousemove', function (e: MouseEvent) {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;
      camAngle -= deltaX * 0.008;
      camElevation = Math.max(0.5, Math.min(8.0, camElevation + deltaY * 0.015));
      updateCameraPosition();
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    });

    window.addEventListener('resize', function () {
      applyResolution(state.targetRes);
    });

    refreshFocusableItems();
  }

  function refreshFocusableItems() {
    const all = document.querySelectorAll('.ctrl-item');
    focusItems = [];
    const overlayActive = document.getElementById('benchmark-overlay')?.classList.contains('active');

    for (let i = 0; i < all.length; i++) {
      const el = all[i] as HTMLElement;
      if (overlayActive) {
        if (el.id === 'btn-close-bm' || el.id === 'btn-rerun-bm') {
          focusItems.push(el);
        }
      } else if (!state.hudVisible) {
        if (el.id === 'toggle-hud-btn') {
          focusItems.push(el);
        }
      } else {
        if (el.id !== 'btn-close-bm' && el.id !== 'btn-rerun-bm') {
          focusItems.push(el);
        }
      }
    }
    if (focusItems.length > 0) {
      currentFocusIndex = Math.min(currentFocusIndex, focusItems.length - 1);
      applyVisualFocus(currentFocusIndex);
    }
  }

  function applyVisualFocus(idx: number) {
    if (focusItems.length === 0) return;
    for (let i = 0; i < focusItems.length; i++) {
      focusItems[i].classList.toggle('tv-focused', i === idx);
    }
    currentFocusIndex = idx;
    const target = focusItems[idx];
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Handles TV Remote & SDK actions ('up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu')
   * without any raw keydown listeners.
   */
  function handleAction(action: string) {
    refreshFocusableItems();
    if (focusItems.length === 0) return;

    const focused = focusItems[currentFocusIndex];

    if (action === 'up') {
      applyVisualFocus((currentFocusIndex - 1 + focusItems.length) % focusItems.length);
    } else if (action === 'down') {
      applyVisualFocus((currentFocusIndex + 1) % focusItems.length);
    } else if (action === 'left' || action === 'right') {
      const dir = action === 'right' ? 1 : -1;
      if (focused && (focused as HTMLInputElement).type === 'range') {
        const inp = focused as HTMLInputElement;
        const step = parseFloat(inp.step) || 1;
        const nextVal = Math.max(
          parseFloat(inp.min),
          Math.min(parseFloat(inp.max), parseFloat(inp.value) + dir * step)
        );
        inp.value = String(nextVal);
        inp.dispatchEvent(new Event('input'));
      } else if (!state.hudVisible) {
        camAngle += dir * 0.18;
        updateCameraPosition();
      } else {
        applyVisualFocus((currentFocusIndex + dir + focusItems.length) % focusItems.length);
      }
    } else if (action === 'confirm' || action === 'jump') {
      if (focused) focused.click();
    } else if (action === 'cancel' || action === 'menu') {
      const overlay = document.getElementById('benchmark-overlay');
      if (overlay && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
        refreshFocusableItems();
      } else {
        toggleHud();
      }
    }
  }

  function initMyPCSDK() {
    if (typeof MyPC === 'undefined') {
      initStats();
      initScene();
      setupUI();
      startLoop();
      return;
    }

    MyPC.init({
      ownMenu: true,
      onInit: function (info: any) {
        if (MyPC.progress) MyPC.progress(0.3);

        // Apply owner-configurable defaults from MyPC.app_config
        const cfg = MyPC.app_config || {};
        if (cfg.defaultResolution) state.targetRes = String(cfg.defaultResolution);
        if (cfg.defaultShadow) state.shadowQuality = String(cfg.defaultShadow);
        if (typeof cfg.defaultSubdiv === 'number') state.subdivLevel = cfg.defaultSubdiv;
        if (typeof cfg.benchmarkDuration === 'number') benchmark.duration = cfg.benchmarkDuration;

        // Low-resource Smart TV optimization defaults
        if (info && info.quality && info.quality.tier === 'low') {
          state.targetRes = '720p';
          state.shadowQuality = 'low';
          state.postProcessing = false;
          state.antialias = false;
        }

        // Restore saved profile preferences if present
        if (MyPC.load) {
          const saved = MyPC.load('bench_prefs', null);
          if (saved && typeof saved === 'object') {
            if (typeof saved.subdivLevel === 'number') state.subdivLevel = saved.subdivLevel;
            if (saved.targetRes) state.targetRes = saved.targetRes;
            if (saved.shadowQuality) state.shadowQuality = saved.shadowQuality;
            if (typeof saved.antialias === 'boolean') state.antialias = saved.antialias;
            if (typeof saved.postProcessing === 'boolean') state.postProcessing = saved.postProcessing;
            if (typeof saved.wireframe === 'boolean') state.wireframe = saved.wireframe;
            if (saved.materialPreset) state.materialPreset = saved.materialPreset;
            if (typeof saved.clonesCount === 'number') state.clonesCount = saved.clonesCount;
            if (typeof saved.autoOrbit === 'boolean') state.autoOrbit = saved.autoOrbit;
            if (typeof saved.orbitSpeed === 'number') state.orbitSpeed = saved.orbitSpeed;
          }
        }

        applyLanguage(info && info.lang ? info.lang : 'en');

        initStats();
        initScene();
        setupUI();

        MyPC.setMenu([
          { id: 'benchmark', label: texts.menuBenchmark },
          { id: 'res_1080', label: texts.menu1080 },
          { id: 'res_720', label: texts.menu720 },
          { id: 'reset_cam', label: texts.menuResetCam },
          { id: 'toggle_hud', label: texts.menuToggleHud }
        ]);

        if (MyPC.progress) MyPC.progress(1.0);
        MyPC.ready();
      },
      onStart: function () {
        startLoop();
      },
      onPause: function () {
        stopLoop();
      },
      onResume: function () {
        startLoop();
      },
      onDestroy: function () {
        stopLoop();
        if (baseHumanoidGeom) baseHumanoidGeom.dispose();
        if (activeSubdividedGeom) activeSubdividedGeom.dispose();
        if (renderTarget) renderTarget.dispose();
        if (renderer) renderer.dispose();
      },
      onInput: function (action: string, pressed: boolean) {
        if (pressed) handleAction(action);
      },
      onMenu: function (id: string) {
        if (id === 'benchmark') startBenchmark();
        else if (id === 'res_1080') applyResolution('1080p');
        else if (id === 'res_720') applyResolution('720p');
        else if (id === 'reset_cam') document.getElementById('btn-reset-cam')?.click();
        else if (id === 'toggle_hud') toggleHud();
      }
    });

    if (MyPC.gamepad) {
      MyPC.gamepad.on('pads', function (list: any[]) {
        const padsEl = document.getElementById('hud-pads');
        if (padsEl) padsEl.textContent = String(list ? list.length : 0);
      });

      MyPC.gamepad.on('button', function (_i: number, pressed: boolean, _val: number, _dev: string, name: string) {
        if (!pressed) return;
        if (name === 'X') {
          startBenchmark();
        } else if (name === 'Y') {
          document.getElementById('toggle-wireframe')?.click();
        } else if (name === 'LB') {
          updateCharacterSubdivision(Math.max(0, state.subdivLevel - 1));
        } else if (name === 'RB') {
          updateCharacterSubdivision(Math.min(4, state.subdivLevel + 1));
        } else if (name === 'R3') {
          document.getElementById('btn-reset-cam')?.click();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMyPCSDK);
  } else {
    initMyPCSDK();
  }
})();
