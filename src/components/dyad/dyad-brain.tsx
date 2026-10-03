// Anatomical Dyad brain (Three.js). Receives prepared, normalized visual
// state only — no data fetching here. Data changes light and activity via
// material/uniform updates; the anatomical geometry is never rebuilt or
// deformed. Model: Brain Project (Z-Anatomy + BodyParts3D/DBCLS, CC BY-SA 4.0),
// bundled at /models/brain.glb with a local Draco decoder at /draco/.
import { useEffect, useRef, useState } from "react";
import type * as THREEType from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { DyadVisualState } from "@/lib/dyad/vitals";
import { cn } from "@/lib/utils";
import brainAsset from "@/assets/brain.glb.asset.json";

export type BrainRegion = "human" | "agent" | "center";

type Props = {
  visual: DyadVisualState;
  selected: BrainRegion | null;
  onSelect: (region: BrainRegion) => void;
  className?: string;
};

const MODEL_URL = brainAsset.url;
const DRACO_PATH = "/draco/";

// Module-level cache: the GLB is fetched and decoded once per page session.
let modelPromise: Promise<GLTF> | null = null;
async function loadBrainModel(): Promise<GLTF> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/loaders/DRACOLoader.js"),
      ]);
      const draco = new DRACOLoader();
      draco.setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      try {
        return await loader.loadAsync(MODEL_URL);
      } finally {
        draco.dispose();
      }
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

const POINT_VERT = /* glsl */ `
  attribute float aRand;
  attribute float aSide;
  uniform float uTime;
  uniform float uSize;
  uniform vec4 uH1; // intensity, coherence, eventRate, speed
  uniform vec4 uH2; // clarity, warmth, present, 0
  uniform vec4 uA1; // intensity, coherence, eventRate, speed
  uniform vec4 uA2; // clarity, anomaly, jitter, echo
  uniform vec2 uA3; // load, present
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSharp;
  void main() {
    bool agent = aSide > 0.75;
    bool human = aSide < 0.25;
    vec4 p1 = agent ? uA1 : (human ? uH1 : mix(uH1, uA1, 0.5));
    vec4 p2 = agent ? uA2 : (human ? uH2 : mix(uH2, uA2, 0.5));
    float present = agent ? uA3.y : (human ? uH2.z : 1.0);
    float t = uTime;
    if (agent) t += p2.z * 0.5 * sin(uTime * 2.7 + aRand * 41.0);
    float phase = mix(aRand * 6.2832, aRand * 0.7, p1.y);
    float wave = 0.5 + 0.5 * sin(t * (0.4 + p1.w * 1.1) + phase);
    float cyc = fract(t * (0.03 + p1.z * 0.22) + aRand * 17.13);
    float flare = 1.0 - smoothstep(0.0, 0.035, cyc);
    if (agent) flare += p2.w * (1.0 - smoothstep(0.0, 0.03, fract(cyc - 0.09))) * 0.8;
    vAlpha = present * (0.08 + 0.32 * p1.x * wave + 0.85 * flare);
    vec3 gold = vec3(0.96, 0.77, 0.09);
    vec3 ember = vec3(0.88, 0.47, 0.19);
    vec3 teal = vec3(0.0, 0.83, 0.78);
    vec3 amber = vec3(0.95, 0.80, 0.52);
    vec3 shared = vec3(0.62, 0.96, 0.85);
    if (human) vColor = mix(gold, ember, p2.y * 0.45);
    else if (agent) vColor = mix(teal, amber, p2.y * step(0.72, aRand) * 0.7);
    else vColor = shared;
    vSharp = p2.x;
    float load = agent ? uA3.x : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 + flare * 2.0) * (1.0 + load * 0.35) * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSharp;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(mix(0.05, 0.32, vSharp), 0.5, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function DyadBrain({ visual, selected, onSelect, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef(visual);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const interactRef = useRef<(on: boolean) => void>(() => {});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [coarse, setCoarse] = useState(false);
  const [rotating, setRotating] = useState(false);

  visualRef.current = visual;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        const [THREE, { OrbitControls }, gltf] = await Promise.all([
          import("three"),
          import("three/addons/controls/OrbitControls.js"),
          loadBrainModel(),
        ]);
        if (disposed) return;
        build(THREE, OrbitControls, gltf);
        setStatus("ready");
      } catch (e) {
        console.error("Dyad brain failed to load", e);
        if (!disposed) setStatus("error");
      }
    })();

    function build(
      THREE: typeof THREEType,
      OrbitControls: typeof import("three/addons/controls/OrbitControls.js").OrbitControls,
      gltf: GLTF,
    ) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      // Fully transparent clear: the page background shows through, no black box.
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.className = "block h-full w-full";
      wrap!.appendChild(canvas);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.055;
      controls.enablePan = false;
      controls.enableZoom = false;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotate = !reduceMotion;
      controls.autoRotateSpeed = 0.5;

      // On touch devices, only capture gestures while the user opts in.
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const setInteract = (on: boolean) => {
        controls.enabled = !isCoarse || on;
        canvas.style.touchAction = !isCoarse || on ? "none" : "pan-y";
      };
      setInteract(false);
      interactRef.current = setInteract;

      scene.add(new THREE.HemisphereLight(0xdbeeff, 0x04101a, 1.45));
      const keyL = new THREE.DirectionalLight(0xffdb68, 2.1);
      keyL.position.set(-4.5, 3, 5.5);
      const keyR = new THREE.DirectionalLight(0x61fff3, 2.15);
      keyR.position.set(4.5, 2.6, 4.8);
      const rim = new THREE.DirectionalLight(0xbfe9ff, 1.3);
      rim.position.set(0, 1.6, -5);
      scene.add(keyL, keyR, rim);

      const gold = new THREE.Color("#F5C518");
      const ember = new THREE.Color("#E07830");
      const teal = new THREE.Color("#00D4C8");
      const shared = new THREE.Color("#9df6d9");

      const material = (color: THREEType.Color, opacity: number, emissive: number) =>
        new THREE.MeshPhysicalMaterial({
          color,
          emissive: color.clone().multiplyScalar(0.58),
          emissiveIntensity: emissive,
          metalness: 0.04,
          roughness: 0.24,
          clearcoat: 0.65,
          clearcoatRoughness: 0.18,
          transparent: true,
          opacity,
          depthWrite: opacity > 0.4,
          side: THREE.DoubleSide,
        });
      const mats = {
        human: material(gold, 0.82, 0.48),
        agent: material(teal, 0.82, 0.48),
        median: material(shared, 0.64, 0.5),
        humanDeep: material(gold, 0.12, 0.42),
        agentDeep: material(teal, 0.12, 0.42),
        medianDeep: material(shared, 0.11, 0.45),
        brainstem: material(shared, 0.4, 0.3),
      };

      const root = new THREE.Group();
      scene.add(root);
      const model = gltf.scene.clone(true);
      root.add(model);

      const meta = (obj: THREEType.Object3D, key: string) => {
        let n: THREEType.Object3D | null = obj;
        while (n) {
          if (n.userData && n.userData[key] != null) return String(n.userData[key]).toLowerCase();
          n = n.parent;
        }
        return "";
      };
      const classify = (obj: THREEType.Object3D) => {
        const side = meta(obj, "bx_side");
        const cat = meta(obj, "bx_cat");
        const label = (meta(obj, "bx_label") || obj.name || "").toLowerCase();
        const isSurface =
          cat.includes("cortex") || cat.includes("cerebell") || label.includes("gyrus") ||
          label.includes("sulcus") || label.includes("cerebell");
        const isBrainstem =
          cat.includes("brainstem") || label.includes("midbrain") || label.includes("pons") || label.includes("medulla");
        const region: BrainRegion = isBrainstem
          ? "center"
          : side.includes("left") ? "human" : side.includes("right") ? "agent" : "center";
        return { region, isSurface, isBrainstem };
      };

      // Show the brain itself; vessels, cranial nerves and dura are left out so
      // the cortex fills the frame. Geometry of what remains is untouched.
      const HIDDEN = ["arter", "vein", "sinus", "cranial_nerve", "meninges", "dura", "tracts"];
      const drop: THREEType.Object3D[] = [];
      model.traverse((obj) => {
        if ((obj as THREEType.Mesh).isMesh && HIDDEN.some((h) => meta(obj, "bx_cat").includes(h))) drop.push(obj);
      });
      drop.forEach((o) => o.removeFromParent());

      const meshes: THREEType.Mesh[] = [];
      model.traverse((obj) => {
        const mesh = obj as THREEType.Mesh;
        if (!mesh.isMesh) return;
        const { region, isSurface, isBrainstem } = classify(mesh);
        mesh.userData['dyadRegion'] = region;
        if (isBrainstem) mesh.material = mats.brainstem;
        else if (region === "human") mesh.material = isSurface ? mats.human : mats.humanDeep;
        else if (region === "agent") mesh.material = isSurface ? mats.agent : mats.agentDeep;
        else mesh.material = isSurface ? mats.median : mats.medianDeep;
        if (!isSurface && !isBrainstem) mesh.renderOrder = -1;
        meshes.push(mesh);
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.scale.setScalar(4.65 / Math.max(size.x, size.y, size.z));
      model.position.multiplyScalar(model.scale.x);
      root.rotation.set(-0.08, -0.46, 0);
      root.updateMatrixWorld(true);

      const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
      controls.target.copy(sphere.center);
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const fitDist = (sphere.radius / Math.sin(fov / 2)) * 0.82;
      camera.position.set(0, 0.22, fitDist);
      camera.lookAt(controls.target);
      controls.update();

      // Activity field sampled from the real cortical vertices (bounded budget).
      const pos: number[] = [];
      const rand: number[] = [];
      const sideAttr: number[] = [];
      const tmp = new THREE.Vector3();
      let budget = 0;
      const BUDGET = 5200;
      root.updateMatrixWorld(true);
      for (const mesh of meshes) {
        if (budget >= BUDGET) break;
        const { region, isSurface } = classify(mesh);
        const a = mesh.geometry?.attributes?.['position'];
        if (!isSurface || !a) continue;
        const step = Math.max(28, Math.floor(a.count / 160));
        for (let i = 0; i < a.count && budget < BUDGET; i += step) {
          tmp.fromBufferAttribute(a, i);
          mesh.localToWorld(tmp);
          pos.push(tmp.x, tmp.y, tmp.z);
          rand.push(Math.random());
          sideAttr.push(region === "human" ? 0 : region === "agent" ? 1 : 0.5);
          budget++;
        }
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      pg.setAttribute("aRand", new THREE.Float32BufferAttribute(rand, 1));
      pg.setAttribute("aSide", new THREE.Float32BufferAttribute(sideAttr, 1));
      const uniforms = {
        uTime: { value: 0 },
        uSize: { value: 0.05 },
        uH1: { value: new THREE.Vector4() },
        uH2: { value: new THREE.Vector4() },
        uA1: { value: new THREE.Vector4() },
        uA2: { value: new THREE.Vector4() },
        uA3: { value: new THREE.Vector2() },
      };
      const pm = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(pg, pm));

      // Neural connections: nearby cortical points linked by lines, with a
      // bright pulse traveling along each one and re-firing at random intervals.
      const sampled: { x: number; y: number; z: number; side: number }[] = [];
      for (let i = 0; i < pos.length / 3; i++) {
        sampled.push({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2], side: sideAttr[i] });
      }
      const CONNECTIONS = 120;
      const linePos: number[] = [];
      const lineT: number[] = [];
      const lineRand: number[] = [];
      const lineSide: number[] = [];
      let made = 0;
      let guard = 0;
      while (made < CONNECTIONS && guard++ < 8000 && sampled.length > 8) {
        const a = sampled[Math.floor(Math.random() * sampled.length)];
        // Prefer a nearby partner on the same side; ~1 in 6 crosses the midline.
        const cross = made % 6 === 5;
        let best: (typeof sampled)[number] | null = null;
        let bestD = Infinity;
        for (let tries = 0; tries < 24; tries++) {
          const b = sampled[Math.floor(Math.random() * sampled.length)];
          if (b === a) continue;
          if (!cross && Math.abs(b.side - a.side) > 0.25) continue;
          if (cross && Math.abs(b.side - a.side) < 0.5) continue;
          const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = b;
          }
        }
        if (!best) continue;
        const r = Math.random();
        const side = (a.side + best.side) / 2;
        linePos.push(a.x, a.y, a.z, best.x, best.y, best.z);
        lineT.push(0, 1);
        lineRand.push(r, r);
        lineSide.push(side, side);
        made++;
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
      lg.setAttribute("aT", new THREE.Float32BufferAttribute(lineT, 1));
      lg.setAttribute("aRand", new THREE.Float32BufferAttribute(lineRand, 1));
      lg.setAttribute("aSide", new THREE.Float32BufferAttribute(lineSide, 1));
      const lineUniforms = {
        uTime: { value: 0 },
        uRateH: { value: 0.4 },
        uRateA: { value: 0.4 },
        uBoostH: { value: 1 },
        uBoostA: { value: 1 },
      };
      const lm = new THREE.ShaderMaterial({
        uniforms: lineUniforms,
        vertexShader: /* glsl */ `
          attribute float aT;
          attribute float aRand;
          attribute float aSide;
          uniform float uTime;
          uniform float uRateH;
          uniform float uRateA;
          uniform float uBoostH;
          uniform float uBoostA;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            bool agent = aSide > 0.75;
            bool human = aSide < 0.25;
            float rate = agent ? uRateA : (human ? uRateH : (uRateH + uRateA) * 0.5);
            float boost = agent ? uBoostA : (human ? uBoostH : 1.0);
            // Pulse position travels 0 -> 1 along the line, then rests.
            float cyc = fract(uTime * (0.12 + rate * 0.5) + aRand * 7.31);
            float head = cyc * 1.6; // 1.0 of travel + 0.6 of rest
            float d = abs(aT - head);
            float pulse = (1.0 - smoothstep(0.0, 0.09, d)) * step(head, 1.0);
            vec3 gold = vec3(0.96, 0.77, 0.09);
            vec3 teal = vec3(0.0, 0.83, 0.78);
            vec3 shared = vec3(0.62, 0.96, 0.85);
            vColor = human ? gold : (agent ? teal : shared);
            vAlpha = (0.05 + pulse * 0.85) * boost;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(vColor, vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.LineSegments(lg, lm));

      // Shared core: compares the two readiness values.
      const coreMat = new THREE.MeshBasicMaterial({
        color: shared.clone(), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 16), coreMat);
      core.position.copy(controls.target);
      const haloMat = new THREE.MeshBasicMaterial({
        color: shared.clone(), transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), haloMat);
      halo.position.copy(core.position);
      scene.add(core, halo);

      const resize = () => {
        const w = Math.max(1, wrap!.clientWidth);
        const h = Math.max(1, wrap!.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(wrap!);

      // Click selection (ignores drags).
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let down: { x: number; y: number } | null = null;
      const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
      const onUp = (e: PointerEvent) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
        down = null;
        const r = canvas.getBoundingClientRect();
        const coreScreen = core.position.clone().project(camera);
        const cx = r.left + ((coreScreen.x + 1) / 2) * r.width;
        const cy = r.top + ((1 - coreScreen.y) / 2) * r.height;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) < 36) return onSelectRef.current("center");
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (hit) onSelectRef.current(hit.object.userData['dyadRegion'] as BrainRegion);
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);

      // Frame loop — paused when off-screen or tab hidden.
      const clock = new THREE.Timer();
      let raf = 0;
      let onScreen = true;
      const tmpColor = new THREE.Color();
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      let smooth = { h: 0.5, a: 0.5 };

      const frame = () => {
        raf = requestAnimationFrame(frame);
        clock.update();
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.getElapsed();
        const v = visualRef.current;
        const sel = selectedRef.current;
        const h = v.human;
        const a = v.agent;
        // Ease readiness changes so updates glide rather than jump.
        const k = 1 - Math.exp(-2 * dt);
        smooth = { h: lerp(smooth.h, h?.intensity ?? 0.35, k), a: lerp(smooth.a, a?.intensity ?? 0.35, k) };

        // Human hemisphere
        const humanSel = sel === "human";
        const agentSel = sel === "agent";
        const sideSel = humanSel || agentSel;
        const hFlicker = h ? 1 + (1 - h.stability) * 0.05 * Math.sin(t * 5.3) * Math.sin(t * 1.7) : 1;
        const hPulse = h ? 1 + 0.03 * Math.sin(t * Math.PI * 2 * h.pulseHz) : 1;
        const hThroughput = h ? 0.9 + 0.2 * h.throughput : 1;
        mats.human.emissiveIntensity =
          (0.16 + 0.5 * smooth.h) * hFlicker * hPulse * hThroughput * (humanSel ? 1.7 : 1);
        mats.human.opacity = (0.62 + 0.16 * smooth.h) * (agentSel ? 0.3 : 1) * (humanSel ? 1.2 : 1);
        tmpColor.copy(gold).lerp(ember, (h?.warmth ?? 0) * 0.35).multiplyScalar(0.5);
        mats.human.emissive.copy(tmpColor);

        // Agent hemisphere
        const fresh = a?.freshness ?? 0.5;
        const load = a?.load ?? 0;
        mats.agent.emissiveIntensity =
          (0.13 + 0.4 * smooth.a + 0.12 * fresh) * (1 - load * 0.12) * (agentSel ? 1.7 : 1);
        mats.agent.opacity =
          (0.55 + 0.14 * fresh + 0.08 * smooth.a) * (humanSel ? 0.3 : 1) * (agentSel ? 1.2 : 1);
        mats.median.emissiveIntensity = 0.26 + 0.3 * v.center.brightness + (sel === "center" ? 0.15 : 0);

        // Selection as transparency: the chosen side fills in, everything else recedes.
        mats.humanDeep.opacity = 0.12 * (agentSel ? 0.22 : humanSel ? 1.8 : 1);
        mats.agentDeep.opacity = 0.12 * (humanSel ? 0.22 : agentSel ? 1.8 : 1);
        mats.median.opacity = 0.64 * (sideSel ? 0.35 : 1);
        mats.medianDeep.opacity = 0.11 * (sideSel ? 0.4 : 1);
        mats.brainstem.opacity = 0.4 * (sideSel ? 0.45 : 1);

        // Activity field
        uniforms.uTime.value = t;
        if (h) {
          uniforms.uH1.value.set(smooth.h, h.coherence, h.eventRate, h.activity * (0.85 + 0.3 * h.throughput));
          uniforms.uH2.value.set(h.clarity, h.warmth, 1, 0);
        } else {
          uniforms.uH1.value.set(0.3, 0.5, 0.2, 0.3);
          uniforms.uH2.value.set(0.5, 0, 0.45, 0);
        }
        if (a) {
          const coherence = Math.max(0, 0.9 - a.correction * 1.5) * (0.6 + 0.4 * fresh);
          const speed = (0.4 + 0.6 * a.activity) * (0.6 + 0.4 * a.speed) * (1 - load * 0.3);
          uniforms.uA1.value.set(smooth.a * (0.8 + 0.2 * a.volume), coherence, a.eventRate, speed);
          uniforms.uA2.value.set(0.4 + 0.6 * a.efficiency, a.anomaly, a.jitter, a.echo);
          uniforms.uA3.value.set(load, 1);
        } else {
          uniforms.uA1.value.set(0.3, 0.5, 0.2, 0.3);
          uniforms.uA2.value.set(0.5, 0, 0, 0);
          uniforms.uA3.value.set(0, 0.45);
        }

        // Shared core: brighter when both sides are ready; tint leans to the stronger side.
        const c = v.center;
        tmpColor.copy(shared);
        if (c.balance < 0) tmpColor.lerp(gold, -c.balance * 0.6);
        else tmpColor.lerp(teal, c.balance * 0.6);
        coreMat.color.copy(tmpColor);
        haloMat.color.copy(tmpColor);
        coreMat.opacity = 0.3 + 0.6 * c.brightness + (sel === "center" ? 0.15 : 0);
        haloMat.opacity = (0.025 + 0.06 * c.brightness) * (1 - load * 0.4);
        const breathe = reduceMotion ? 0 : Math.sin(t * 0.9);
        core.scale.setScalar(1 + 0.12 * breathe);
        halo.scale.setScalar(1 + 0.06 * breathe);
        // Neural connections: firing rate follows each side's activity; the
        // selected side's connections brighten.
        lineUniforms.uTime.value = reduceMotion ? 0 : t;
        lineUniforms.uRateH.value = h ? 0.25 + h.activity * 0.75 : 0.3;
        lineUniforms.uRateA.value = a ? 0.25 + a.activity * 0.75 : 0.3;
        lineUniforms.uBoostH.value = humanSel ? 1.6 : agentSel ? 0.4 : 1;
        lineUniforms.uBoostA.value = agentSel ? 1.6 : humanSel ? 0.4 : 1;

        if (reduceMotion) uniforms.uTime.value = 0;
        controls.update();
        renderer.render(scene, camera);
      };
      const start = () => {
        if (raf || document.hidden || !onScreen) return;
        clock.update();
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        if (onScreen) start();
        else stop();
      });
      io.observe(wrap!);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVis);
      start();

      cleanups.push(() => {
        stop();
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        controls.dispose();
        Object.values(mats).forEach((m) => m.dispose());
        pg.dispose();
        pm.dispose();
        core.geometry.dispose();
        halo.geometry.dispose();
        coreMat.dispose();
        haloMat.dispose();
        composer.dispose();
        renderer.dispose();
        canvas.remove();
      });
    }

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div ref={wrapRef} className="absolute inset-0" aria-label="Dyad brain: gold human hemisphere, teal agent hemisphere" role="img" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Loading brain…
          </span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-muted-foreground">
          The 3D brain couldn't load in this browser. Your vitals are still shown below.
        </div>
      )}
      {coarse && status === "ready" && (
        <button
          type="button"
          onClick={() => {
            const next = !rotating;
            setRotating(next);
            interactRef.current(next);
          }}
          className="glass-card absolute right-3 top-3 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {rotating ? "Done" : "Rotate"}
        </button>
      )}
    </div>
  );
}
