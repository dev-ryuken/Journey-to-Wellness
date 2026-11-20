import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CrystalCategory, GameSaveState, QuestDefinition, WeatherMode, WeatherType, ZoneId } from '../types/game';
import { detectZoneAt, groundHeightAt, ZONES } from '../data/zones';
import { CameraRig25D } from './camera';
import { createProceduralTextures, ProceduralTextureSet } from './materials';
import {
  buildCharacterRig,
  buildNpcActor,
  buildVillageBuilding,
  buildWellnessFountain,
  CharacterRig,
  NpcActor,
} from './models';
import { AmbientEmitterAnchor, audioEngine, FootstepSurface } from './audio';

export type WorldInteractTarget =
  | { type: 'npc'; npcId: string }
  | { type: 'quest_board' }
  | { type: 'shop' }
  | { type: 'fountain' }
  | { type: 'boss_arena' };

export interface WorldEngineCallbacks {
  onZoneChange: (zoneId: ZoneId) => void;
  onWeatherChange?: (weather: WeatherType) => void;
  onDayTimeChange?: (dayTime: number) => void;
  onInteract: (target: WorldInteractTarget) => void;
  onProximityPrompt: (prompt: { label: string; target: WorldInteractTarget } | null) => void;
  onPlayerMove: (x: number, z: number) => void;
  onLoadProgress: (pct: number, label: string) => void;
}

interface ObstacleCircle {
  x: number;
  z: number;
  r: number;
}

interface PatrolWaypoint {
  x: number;
  z: number;
}

interface NpcPatrolAgent {
  actor: NpcActor;
  pos: THREE.Vector3;
  facing: number;
  walkCycle: number;
  waypoints: PatrolWaypoint[];
  waypointIndex: number;
  pauseDuration: number;
  pauseTimer: number;
  speed: number;
  phaseOffset: number;
  interactablePos: THREE.Vector3;
  obstacle: ObstacleCircle;
}

interface AmbientCritter {
  kind: 'bird' | 'butterfly';
  zone: 'town_square' | 'misty_forest';
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  baseAltitude: number;
  bobAmplitude: number;
  speed: number;
  phase: number;
  freqX: number;
  freqZ: number;
  flapSpeed: number;
  prevX: number;
  prevZ: number;
  prevYaw: number;
  flightTime: number;
  flapTime: number;
  startleBoost: number;
  visScale: number;
  baseScale: number;
  minCrystals: number;
}

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _skyDayColor = new THREE.Color();
const _skySunriseColor = new THREE.Color(0xfdba74);
const _skyNoonColor = new THREE.Color(0xe0f2fe);
const _skySunsetColor = new THREE.Color(0xfb923c);
const _skyNightColor = new THREE.Color(0x0f1f4a);
const _skyCloudColor = new THREE.Color(0x94a3b8);
const _skyRainColor = new THREE.Color(0x64748b);
const _skyFinalColor = new THREE.Color();

const _sunSunriseColor = new THREE.Color(0xff9248);
const _sunNoonColor = new THREE.Color(0xffffff);
const _sunSunsetColor = new THREE.Color(0xff7b2e);
const _sunNightColor = new THREE.Color(0x2e58b8);
const _sunCloudColor = new THREE.Color(0xcbd5e1);
const _sunFinalColor = new THREE.Color();

const _hemiSkySunrise = new THREE.Color(0xffb478);
const _hemiSkyNoon = new THREE.Color(0xf0f9ff);
const _hemiSkySunset = new THREE.Color(0xffa163);
const _hemiSkyNight = new THREE.Color(0x1e3a8a);
const _hemiSkyOvercast = new THREE.Color(0x94a3b8);
const _hemiSkyFinal = new THREE.Color();

const _hemiGroundSunrise = new THREE.Color(0x9a5b32);
const _hemiGroundNoon = new THREE.Color(0x88ba6c);
const _hemiGroundSunset = new THREE.Color(0x854624);
const _hemiGroundNight = new THREE.Color(0x0b1738);
const _hemiGroundFinal = new THREE.Color();

const _giSunriseColor = new THREE.Color(0xfdba74);
const _giNoonColor = new THREE.Color(0xffffff);
const _giSunsetColor = new THREE.Color(0xfb923c);
const _giNightColor = new THREE.Color(0x1d3b8a);
const _giFinalColor = new THREE.Color();

function smoothstep01(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

function sampleDayPhaseWeights(dayTime: number): {
  sunrise: number;
  noon: number;
  sunset: number;
  night: number;
} {
  const t = ((dayTime % 1) + 1) % 1;
  if (t < 0.08) {
    return { sunrise: 0, noon: 0, sunset: 0, night: 1 };
  }
  if (t < 0.18) {
    const u = smoothstep01((t - 0.08) / 0.1);
    return { sunrise: u, noon: 0, sunset: 0, night: 1 - u };
  }
  if (t < 0.36) {
    const u = smoothstep01((t - 0.18) / 0.18);
    return { sunrise: 1 - u, noon: u, sunset: 0, night: 0 };
  }
  if (t < 0.6) {
    return { sunrise: 0, noon: 1, sunset: 0, night: 0 };
  }
  if (t < 0.74) {
    const u = smoothstep01((t - 0.6) / 0.14);
    return { sunrise: 0, noon: 1 - u, sunset: u, night: 0 };
  }
  if (t < 0.85) {
    const u = smoothstep01((t - 0.74) / 0.11);
    return { sunrise: 0, noon: 0, sunset: 1 - u, night: u };
  }
  return { sunrise: 0, noon: 0, sunset: 0, night: 1 };
}

export class SunnybrookWorldEngine {
  private container: HTMLElement;
  private callbacks: WorldEngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private cameraRig!: CameraRig25D;
  private textures!: ProceduralTextureSet;
  private isSoftwareGl = false;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private giBounceLight!: THREE.AmbientLight;
  private sunOffset = new THREE.Vector3(18, 28, 16);
  private lanternLights: THREE.PointLight[] = [];
  private windowMaterials: THREE.MeshStandardMaterial[] = [];

  private playerRig!: CharacterRig;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private playerFacing = 0;
  private walkCycle = 0;
  private clickMoveTarget: THREE.Vector3 | null = null;
  private clickMarker!: THREE.Mesh;

  private npcs: NpcActor[] = [];
  private npcPatrols: NpcPatrolAgent[] = [];
  private interactables: Array<{ pos: THREE.Vector3; radius: number; label: string; target: WorldInteractTarget }> = [];
  private clickHitMeshes: THREE.Object3D[] = [];
  private obstacles: ObstacleCircle[] = [];
  private pathSegments: Array<{ x1: number; z1: number; x2: number; z2: number; halfWidth: number }> = [];

  private fountainData!: ReturnType<typeof buildWellnessFountain>;
  private flowerInstanced!: THREE.InstancedMesh;
  private flowerTransforms: Array<{ x: number; y: number; z: number; rot: number; baseScale: number }> = [];
  private grassUniforms = {
    uGrassTime: { value: 0 },
    uGrassWind: { value: 1 },
  };
  private fogPuffs: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }> = [];
  private germParticles!: THREE.Points;
  private lanternsGroup!: THREE.Group;
  private ambientCritters: AmbientCritter[] = [];
  private wildlifeAnchors: AmbientEmitterAnchor[] = [];
  private mergedAmbientEmitters: AmbientEmitterAnchor[] = [];
  private ambientSyncThrottle = 0;

  // Celebration fireworks system (all quests completed)
  private fireworkPoints!: THREE.Points;
  private fireworkTexture!: THREE.CanvasTexture;
  private fireworkPositions!: Float32Array;
  private fireworkColors!: Float32Array;
  private fireworkShells: Array<{
    phase: 'idle' | 'rising' | 'bursting';
    cooldown: number;
    age: number;
    fuse: number;
    duration: number;
    rx: number;
    ry: number;
    rz: number;
    rvx: number;
    rvy: number;
    rvz: number;
    colorA: THREE.Color;
    colorB: THREE.Color;
    sx: Float32Array;
    sy: Float32Array;
    sz: Float32Array;
    svx: Float32Array;
    svy: Float32Array;
    svz: Float32Array;
  }> = [];
  private celebrationPersistent = false;
  private celebrationTimer = 0;

  // Dynamic weather state & 3D elements
  private weatherMode: WeatherMode = 'auto';
  private activeWeather: WeatherType = 'sunny';
  private weatherSwitchTimer = 32;
  private weatherCloudiness = 0; // 0 = sunny, 1 = overcast/rain
  private weatherRaininess = 0; // 0 = dry, 1 = light rain
  private cloudGroups: Array<{ group: THREE.Group; speed: number; baseZ: number; phase: number }> = [];
  private cloudMat!: THREE.MeshStandardMaterial;
  private rainLines!: THREE.LineSegments;
  private rainPositions!: Float32Array;
  private rainMat!: THREE.LineBasicMaterial;
  private rainRipples: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number; ox: number; oz: number }> = [];
  private reduceMotion = false;

  // Input state
  private keys: Record<string, boolean> = {};
  private joystickVec = new THREE.Vector2(0, 0);
  private raycaster = new THREE.Raycaster();
  private pointerVec = new THREE.Vector2();

  // Dynamic game state mirrors
  private crystalsCount = 0;
  private restoredSet = new Set<CrystalCategory>();
  private dayTime = 0.28;
  private autoDayNight = true;
  private lastSyncedDayTime = 0.28;
  private dayTimeNotifyThrottle = 0;
  private performanceMode = false;
  private lastZoneId: ZoneId = 'town_square';
  private lastPromptKey = '';
  private lastFrameRenderMs = 0;
  private saveThrottle = 0;

  constructor(container: HTMLElement, initialState: GameSaveState, callbacks: WorldEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.playerPos.set(initialState.playerPos.x, groundHeightAt(initialState.playerPos.x, initialState.playerPos.z), initialState.playerPos.z);
    this.crystalsCount = initialState.restoredCrystals.length;
    this.restoredSet = new Set(initialState.restoredCrystals);
    this.dayTime = initialState.dayTime;
    this.lastSyncedDayTime = initialState.dayTime;
    this.autoDayNight = initialState.settings.autoDayNight ?? true;
    this.performanceMode = initialState.settings.performanceMode;

    this.init(initialState);
  }

  private detectSoftwareGl(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private init(state: GameSaveState) {
    this.callbacks.onLoadProgress(15, 'Initializing 2.5D renderer...');
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.015);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.cameraRig = new CameraRig25D(w / h);
    this.cameraRig.setReduceMotion(state.settings.reduceMotion);
    this.cameraRig.setTarget(this.playerPos.x, this.playerPos.y, this.playerPos.z, true);

    this.callbacks.onLoadProgress(35, 'Generating procedural textures...');
    this.textures = createProceduralTextures(this.renderer);

    this.setupLighting();
    this.callbacks.onLoadProgress(55, 'Sculpting Sunnybrook terrain & bridges...');
    this.buildTerrainAndPaths();
    this.callbacks.onLoadProgress(72, 'Building Town Square & village zones...');
    this.buildVillageZones(state);
    this.callbacks.onLoadProgress(88, 'Placing villagers, forest & Wellness Spirit...');
    this.weatherMode = state.settings.weatherMode ?? 'auto';
    this.reduceMotion = state.settings.reduceMotion;

    this.buildInstancedNature();
    this.buildInstancedGrass();
    this.buildFireworksSystem();
    this.buildFogAndGerms();
    this.buildAmbientCritters();
    this.buildWeatherSystem();
    this.buildPlayer(state);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.cameraRig.camera);
    }

    this.applyProgressVisuals();
    this.bindEvents();
    this.callbacks.onLoadProgress(100, 'Welcome to Sunnybrook!');
    this.callbacks.onWeatherChange?.(this.activeWeather);

    this.startLoop();
  }

  private setupLighting() {
    this.giBounceLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(this.giBounceLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x65a30d, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    this.sunLight.position.set(18, 28, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 68;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Warm village lantern point lights (non-shadow-casting for performance)
    const lanternPositions = [
      [0, 3.2, 0],
      [-18, 3.2, -21],
      [18, 3.2, -21],
      [-20, 3.0, 20],
      [22, 3.0, -1],
    ];
    for (const [lx, ly, lz] of lanternPositions) {
      const pl = new THREE.PointLight(0xfbbf24, 0.4, 15, 1.8);
      pl.position.set(lx, ly, lz);
      this.scene.add(pl);
      this.lanternLights.push(pl);
    }
  }

  private buildTerrainAndPaths() {
    // Extended rolling terrain beyond playable bounds (no rectangular void walls!)
    const geo = new THREE.PlaneGeometry(130, 130, 80, 80);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = this.sampleTerrainHeight(x, z);

      // Carve subtle stream bed at x ≈ -13
      if (Math.abs(x + 13) < 2.2 && z > -14 && z < 16) {
        const streamDepth = 1 - Math.abs(x + 13) / 2.2;
        y -= streamDepth * 0.35;
      }

      pos.setY(i, y);

      // Vertex color tinting by biome
      if (z < -25) {
        _color.setHex(0x6b9e78); // Misty Forest moss
      } else if (y > 0.7) {
        _color.setHex(0x88cb7d); // Upper terraces
      } else {
        _color.setHex(0x8ed484); // Sunnybrook meadow
      }
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.textures.grass,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Cobblestone Town Square Plaza
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(10.5, 10.8, 0.08, 28),
      new THREE.MeshStandardMaterial({ map: this.textures.cobble, roughness: 0.86 })
    );
    plaza.position.set(0, 0.04, 0);
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Cobblestone paths connecting zones
    const pathMat = new THREE.MeshStandardMaterial({
      map: this.textures.cobble,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const addPathSegment = (x1: number, z1: number, x2: number, z2: number, width = 2.6) => {
      this.pathSegments.push({ x1, z1, x2, z2, halfWidth: width * 0.5 });
      const steps = 10;
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        const px = THREE.MathUtils.lerp(x1, x2, t);
        const pz = THREE.MathUtils.lerp(z1, z2, t);
        const py = groundHeightAt(px, pz) + 0.05;
        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.hypot(dx, dz) / steps + 0.25;
        const stone = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, segLen), pathMat);
        stone.position.set(px, py, pz);
        stone.rotation.y = Math.atan2(dx, dz);
        stone.receiveShadow = true;
        this.scene.add(stone);
      }
    };

    addPathSegment(0, 0, 22, -1); // Town Square -> Market
    addPathSegment(0, 0, -22, -1); // Town Square -> Bathhouse
    addPathSegment(0, 0, 19, 19); // Town Square -> Sports Field
    addPathSegment(0, 0, -19, 19); // Town Square -> Clinic
    addPathSegment(0, -6, -17, -20); // Town Square -> Cozy Cottage
    addPathSegment(0, -6, 17, -20); // Town Square -> School
    addPathSegment(0, -8, 0, -33); // Grand Stone Stairs -> Misty Forest

    // West Stream water ribbon + Arched Wooden Bridge
    const stream = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 34),
      new THREE.MeshStandardMaterial({
        map: this.textures.water,
        color: 0x38bdf8,
        roughness: 0.14,
        metalness: 0.25,
      })
    );
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(-13, -0.08, 1);
    this.scene.add(stream);

    // Arched bridge planks & railings at x = -13, z = -1
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.78 });
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const bx = THREE.MathUtils.lerp(-15.5, -10.5, t);
      const by = 0.2 + Math.sin(t * Math.PI) * 0.44;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 3.0), woodMat);
      plank.position.set(bx, by, -1);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.scene.add(plank);
    }
    for (const rz of [-2.45, 0.45]) {
      for (const rx of [-15.2, -13, -10.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), woodMat);
        post.position.set(rx, groundHeightAt(rx, -1) + 0.45, rz);
        this.scene.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.12), woodMat);
      rail.position.set(-13, 0.92, rz);
      this.scene.add(rail);
    }

    // Grand Stone Stair steps heading north to Misty Forest
    const stairMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.82 });
    for (let s = 0; s < 10; s++) {
      const sz = -13.5 - s * 1.15;
      const sy = groundHeightAt(0, sz);
      const step = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 1.1), stairMat);
      step.position.set(0, sy - 0.08, sz);
      step.receiveShadow = true;
      this.scene.add(step);
    }

    // Sports Field running track oval
    const track = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 6.8, 28),
      new THREE.MeshStandardMaterial({
        map: this.textures.track,
        roughness: 0.85,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(20, 0.06, 21);
    track.receiveShadow = true;
    this.scene.add(track);

    // Hurdles on Sports Field
    const hurdleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    for (const ang of [0.3, 1.6, 3.1, 4.7]) {
      const hx = 20 + Math.cos(ang) * 5.5;
      const hz = 21 + Math.sin(ang) * 5.5;
      const hGroup = new THREE.Group();
      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), hurdleMat);
      pL.position.set(-0.45, 0.375, 0);
      const pR = pL.clone();
      pR.position.x = 0.45;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.08), barMat);
      bar.position.set(0, 0.68, 0);
      hGroup.add(pL, pR, bar);
      hGroup.position.set(hx, 0, hz);
      hGroup.rotation.y = -ang;
      this.scene.add(hGroup);
    }

    // Click-to-move destination ring
    this.clickMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 20),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.clickMarker.rotation.x = -Math.PI / 2;
    this.clickMarker.visible = false;
    this.scene.add(this.clickMarker);
  }

  private registerInteractable(
    obj: THREE.Object3D,
    x: number,
    z: number,
    radius: number,
    label: string,
    target: WorldInteractTarget,
    addCollider = false,
    colliderRadius = 1.2
  ): { interactablePos: THREE.Vector3; obstacle?: ObstacleCircle } {
    const y = groundHeightAt(x, z);
    obj.position.set(x, y, z);
    this.scene.add(obj);
    obj.userData.interactTarget = target;
    this.clickHitMeshes.push(obj);
    const interactablePos = new THREE.Vector3(x, y, z);
    this.interactables.push({
      pos: interactablePos,
      radius,
      label,
      target,
    });
    let obstacle: ObstacleCircle | undefined;
    if (addCollider) {
      obstacle = { x, z, r: colliderRadius };
      this.obstacles.push(obstacle);
    }
    return { interactablePos, obstacle };
  }

  private buildVillageZones(state: GameSaveState) {
    // 1. Town Square Fountain
    this.fountainData = buildWellnessFountain(this.textures);
    this.registerInteractable(
      this.fountainData.group,
      0,
      -2,
      4.1,
      'Inspect Wellness Fountain',
      { type: 'fountain' },
      true,
      2.85
    );

    // 2. Quest Board
    const qb = buildVillageBuilding('quest_board', this.textures);
    this.registerInteractable(qb.group, -5.5, -5.5, 2.8, 'Open Quest Board', { type: 'quest_board' }, true, 1.3);

    // 3. Pip's Wellness Shop
    const shop = buildVillageBuilding('shop_stall', this.textures);
    this.registerInteractable(shop.group, 5.8, -5.5, 3.0, 'Visit Wellness Shop', { type: 'shop' }, true, 1.5);

    // Optional celebration Plaza Lanterns (unlocked via shop)
    this.lanternsGroup = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.5 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    for (const [lx, lz] of [
      [-6.5, 4.5],
      [6.5, 4.5],
      [-7.5, -1.5],
      [7.5, -1.5],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), postMat);
      post.position.set(lx, groundHeightAt(lx, lz) + 1.2, lz);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), glowMat);
      lamp.position.set(lx, groundHeightAt(lx, lz) + 2.5, lz);
      this.lanternsGroup.add(post, lamp);
    }
    this.lanternsGroup.visible = state.unlockedCosmetics.includes('village_lanterns');
    this.scene.add(this.lanternsGroup);

    // 4. Buildings in each Zone
    const placeBuilding = (
      kind: 'clinic' | 'market' | 'bathhouse' | 'school' | 'cottage_cutaway',
      bx: number,
      bz: number,
      colliderR: number
    ) => {
      const b = buildVillageBuilding(kind, this.textures);
      b.group.position.set(bx, groundHeightAt(bx, bz), bz);
      this.scene.add(b.group);
      this.windowMaterials.push(...b.windowMaterials);
      this.obstacles.push({ x: bx, z: bz, r: colliderR });
    };

    placeBuilding('clinic', -21.5, 24.5, 2.6);
    placeBuilding('market', 23.5, -4.5, 2.4);
    placeBuilding('bathhouse', -23.5, -4.5, 2.5);
    placeBuilding('school', 19.5, -26.0, 2.7);
    // Cutaway Cozy Cottage: place back so player can walk onto its porch/rug!
    const cottage = buildVillageBuilding('cottage_cutaway', this.textures);
    cottage.group.position.set(-18.5, groundHeightAt(-18.5, -24.5), -24.5);
    this.scene.add(cottage.group);
    this.windowMaterials.push(...cottage.windowMaterials);
    this.obstacles.push({ x: -18.5, z: -26.8, r: 1.5 });

    // 5. Boss Arena Ring in Misty Forest
    const arenaGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.9, 24), stoneMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    arenaGroup.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 2.5, 8), stoneMat);
      pillar.position.set(Math.cos(a) * 4.8, 1.25, Math.sin(a) * 4.8);
      pillar.castShadow = true;
      arenaGroup.add(pillar);
    }
    this.registerInteractable(
      arenaGroup,
      0,
      -35,
      4.5,
      'Confront the Grumble Fog Arena',
      { type: 'boss_arena' },
      false
    );

    // 6. Place all 8 Sunnybrook NPCs with tailored zone patrol paths
    const coachTrackWaypoints: PatrolWaypoint[] = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return {
        x: 20 + Math.cos(a) * 4.55,
        z: 21 + Math.sin(a) * 4.55,
      };
    });

    const npcPlacements: Array<{
      id: string;
      label: string;
      x: number;
      z: number;
      speed: number;
      pauseDuration: number;
      waypoints: PatrolWaypoint[];
    }> = [
      {
        id: 'elder_rowan',
        label: 'Talk to Elder Rowan',
        x: -2.0,
        z: 2.2,
        speed: 1.55,
        pauseDuration: 2.4,
        waypoints: [
          { x: -3.8, z: 2.2 },
          { x: 3.6, z: 2.2 },
          { x: 4.4, z: -1.6 },
          { x: -4.4, z: -1.6 },
        ],
      },
      {
        id: 'mr_splash',
        label: 'Talk to Old Mr. Splash',
        x: -20.5,
        z: -0.5,
        speed: 1.45,
        pauseDuration: 2.2,
        waypoints: [
          { x: -20.5, z: -0.5 },
          { x: -17.4, z: -0.5 },
          { x: -19.2, z: 2.2 },
          { x: -23.2, z: 1.4 },
        ],
      },
      {
        id: 'baker_bea',
        label: 'Talk to Baker Bea',
        x: 25.0,
        z: -1.0,
        speed: 1.75,
        pauseDuration: 2.0,
        waypoints: [
          { x: 25.2, z: -1.0 },
          { x: 26.8, z: 1.6 },
          { x: 23.2, z: 1.6 },
          { x: 23.8, z: -1.0 },
        ],
      },
      {
        id: 'farmer_fig',
        label: 'Talk to Farmer Fig',
        x: 20.5,
        z: 0.8,
        speed: 1.65,
        pauseDuration: 2.3,
        waypoints: [
          { x: 20.5, z: 0.8 },
          { x: 17.2, z: -0.5 },
          { x: 19.0, z: 2.8 },
          { x: 21.8, z: 1.2 },
        ],
      },
      {
        id: 'coach_kiko',
        label: 'Talk to Coach Kiko',
        x: coachTrackWaypoints[3].x,
        z: coachTrackWaypoints[3].z,
        speed: 3.1,
        pauseDuration: 0.35,
        waypoints: coachTrackWaypoints,
      },
      {
        id: 'granny_luna',
        label: 'Talk to Granny Luna',
        x: -17.8,
        z: -22.2,
        speed: 1.35,
        pauseDuration: 2.6,
        waypoints: [
          { x: -17.6, z: -22.2 },
          { x: -16.4, z: -23.4 },
          { x: -18.8, z: -23.0 },
          { x: -18.2, z: -20.2 },
        ],
      },
      {
        id: 'teacher_tam',
        label: 'Talk to Teacher Tam',
        x: 18.0,
        z: -21.2,
        speed: 1.7,
        pauseDuration: 2.1,
        waypoints: [
          { x: 18.0, z: -21.2 },
          { x: 21.4, z: -21.4 },
          { x: 19.6, z: -18.8 },
          { x: 16.0, z: -20.2 },
        ],
      },
      {
        id: 'nurse_nora',
        label: 'Talk to Nurse Nora',
        x: -19.5,
        z: 19.5,
        speed: 1.65,
        pauseDuration: 2.2,
        waypoints: [
          { x: -19.5, z: 19.5 },
          { x: -22.0, z: 20.6 },
          { x: -20.2, z: 17.4 },
          { x: -17.2, z: 19.0 },
        ],
      },
    ];

    npcPlacements.forEach((np, idx) => {
      const actor = buildNpcActor(np.id, this.textures.contactShadow);
      actor.baseY = groundHeightAt(np.x, np.z);
      const reg = this.registerInteractable(
        actor.group,
        np.x,
        np.z,
        2.7,
        np.label,
        { type: 'npc', npcId: np.id },
        true,
        0.55
      );
      this.npcs.push(actor);
      if (reg.obstacle) {
        this.npcPatrols.push({
          actor,
          pos: new THREE.Vector3(np.x, actor.baseY, np.z),
          facing: 0,
          walkCycle: idx * 0.9,
          waypoints: np.waypoints,
          waypointIndex: 1 % np.waypoints.length,
          pauseDuration: np.pauseDuration,
          pauseTimer: 0.5 + (idx % 3) * 0.6,
          speed: np.speed,
          phaseOffset: idx * 0.85,
          interactablePos: reg.interactablePos,
          obstacle: reg.obstacle,
        });
      }
    });
  }

  private buildInstancedNature() {
    // 80 Instanced Trees around perimeters & Misty Forest
    const treePositions: Array<{ x: number; z: number; scale: number; isPine: boolean }> = [];
    for (let i = 0; i < 84; i++) {
      const angle = (i / 84) * Math.PI * 2;
      const ringRadius = i < 48 ? 33 + (i % 5) * 3.5 : 14 + (i % 6) * 2.5;
      const x = Math.cos(angle) * ringRadius + Math.sin(i * 3.1) * 2.5;
      const z = (i >= 48 ? -34 : -4) + Math.sin(angle) * (i >= 48 ? 11 + (i % 3) * 3 : ringRadius);

      // Keep playable center & paths clear
      let tooClose = false;
      for (const zone of ZONES) {
        if (Math.hypot(x - zone.center.x, z - zone.center.z) < zone.radius * 0.72) {
          tooClose = true;
          break;
        }
      }
      if (Math.abs(x) < 4.5 && z > -35 && z < 8) tooClose = true;
      if (tooClose) continue;

      treePositions.push({
        x,
        z,
        scale: 0.85 + ((i * 37) % 30) / 100, // ±15% scale variation
        isPine: z < -18 || i % 2 === 0,
      });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.9, 7);
    trunkGeo.translate(0, 0.95, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    const canopyGeo = new THREE.ConeGeometry(1.35, 3.0, 8);
    canopyGeo.translate(0, 3.0, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
    canopyInst.castShadow = true;

    treePositions.forEach((tp, idx) => {
      const y = groundHeightAt(tp.x, tp.z);
      _vec3.set(tp.x, y, tp.z);
      _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), idx * 0.9);
      _scale.setScalar(tp.scale);
      _mat4.compose(_vec3, _quat, _scale);
      trunkInst.setMatrixAt(idx, _mat4);
      canopyInst.setMatrixAt(idx, _mat4);

      _color.setHex(tp.isPine ? 0x15803d : 0x22c55e);
      _color.offsetHSL(((idx % 7) - 3) * 0.015, 0, ((idx % 5) - 2) * 0.025);
      canopyInst.setColorAt(idx, _color);

      // Register tree canopy anchors for positional birdsong & leaf wind rustle
      if (idx % 2 === 0) {
        this.wildlifeAnchors.push({
          kind: 'bird',
          x: tp.x,
          y: y + 3.1 * tp.scale,
          z: tp.z,
        });
      }
      if (idx % 3 === 0) {
        this.wildlifeAnchors.push({
          kind: 'wind',
          x: tp.x,
          y: y + 2.8 * tp.scale,
          z: tp.z,
        });
      }
    });
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    this.scene.add(trunkInst, canopyInst);

    // Blooming Wildflowers (scale up dynamically as Crystals are restored!)
    const flowerGeo = new THREE.DodecahedronGeometry(0.18, 0);
    flowerGeo.translate(0, 0.18, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const flowerCount = 90;
    this.flowerInstanced = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    const palette = [0xfef08a, 0xf472b6, 0x38bdf8, 0xfb923c, 0xc084fc];

    for (let i = 0; i < flowerCount; i++) {
      const a = (i / flowerCount) * Math.PI * 2 * 3.7;
      const rad = 7 + (i % 18) * 1.15;
      const fx = Math.cos(a) * rad;
      const fz = Math.sin(a) * rad - 2;
      const fy = groundHeightAt(fx, fz);
      this.flowerTransforms.push({ x: fx, y: fy, z: fz, rot: a, baseScale: 0.7 + (i % 4) * 0.15 });
      this.flowerInstanced.setColorAt(i, _color.setHex(palette[i % palette.length]));
      if (i % 6 === 0) {
        this.wildlifeAnchors.push({
          kind: 'insect',
          x: fx,
          y: fy + 0.45,
          z: fz,
        });
      }
    }
    this.flowerInstanced.computeBoundingSphere();
    this.scene.add(this.flowerInstanced);

    // Curated zone nature anchors so every Sunnybrook district has distinct positional wildlife
    const zoneNatureAnchors: AmbientEmitterAnchor[] = [
      // Bathhouse stream & willow breeze
      { kind: 'wind', x: -13.2, y: 2.2, z: -6.5 },
      { kind: 'insect', x: -13.5, y: 0.5, z: 3.8 },
      { kind: 'bird', x: -27.5, y: 3.4, z: 2.5 },
      // Market sunny awnings & orchard edges
      { kind: 'bird', x: 26.8, y: 3.5, z: -7.2 },
      { kind: 'insect', x: 21.2, y: 0.8, z: 4.5 },
      { kind: 'wind', x: 28.0, y: 2.6, z: 1.5 },
      // Sports Field open breeze & meadow grass
      { kind: 'wind', x: 14.5, y: 2.8, z: 24.5 },
      { kind: 'wind', x: 26.5, y: 2.8, z: 16.5 },
      { kind: 'insect', x: 20.0, y: 0.4, z: 21.0 },
      { kind: 'bird', x: 26.2, y: 4.0, z: 25.5 },
      // Clinic herb beds & calm courtyard
      { kind: 'insect', x: -16.8, y: 0.6, z: 23.8 },
      { kind: 'bird', x: -25.2, y: 3.6, z: 17.5 },
      { kind: 'wind', x: -15.5, y: 2.4, z: 16.0 },
      // Cozy Cottage sheltered pines & hearthside crickets
      { kind: 'insect', x: -22.2, y: 1.2, z: -19.5 },
      { kind: 'wind', x: -24.5, y: 3.6, z: -26.0 },
      { kind: 'bird', x: -14.0, y: 3.8, z: -18.5 },
      // School courtyard trees
      { kind: 'bird', x: 14.2, y: 3.8, z: -19.5 },
      { kind: 'bird', x: 23.5, y: 4.0, z: -20.0 },
      { kind: 'wind', x: 18.0, y: 3.0, z: -16.5 },
      // Misty Forest deep canopy & twilight cicadas
      { kind: 'bird', x: -6.5, y: 5.0, z: -33.0 },
      { kind: 'bird', x: 6.5, y: 5.2, z: -36.5 },
      { kind: 'wind', x: 0, y: 5.5, z: -38.5 },
      { kind: 'insect', x: -5.2, y: 2.4, z: -31.5 },
      { kind: 'insect', x: 5.4, y: 2.4, z: -32.0 },
    ];
    this.wildlifeAnchors.push(...zoneNatureAnchors);
    audioEngine.setAmbientEmitters(this.wildlifeAnchors);
  }

  private sampleTerrainHeight(x: number, z: number): number {
    let y = groundHeightAt(x, z);
    const edgeDist = Math.max(Math.abs(x) - 34, Math.abs(z + 5) - 38);
    if (edgeDist > 0) {
      y += Math.min(8, edgeDist * 0.28 + Math.sin(x * 0.18) * Math.cos(z * 0.18) * 0.8);
    }
    return y;
  }

  private createGrassTuftGeometry(): THREE.BufferGeometry {
    // 3 crossed tapered grass blades per tuft, rooted at y=0
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const blades = [
      { angle: 0.0, offsetX: 0, offsetZ: 0, width: 0.095, height: 0.42, lean: 0.06 },
      { angle: (Math.PI * 2) / 3, offsetX: 0.04, offsetZ: -0.02, width: 0.085, height: 0.36, lean: 0.08 },
      { angle: (Math.PI * 4) / 3, offsetX: -0.04, offsetZ: 0.03, width: 0.09, height: 0.39, lean: 0.07 },
    ];

    blades.forEach((b, idx) => {
      const cosA = Math.cos(b.angle);
      const sinA = Math.sin(b.angle);
      const hw = b.width * 0.5;
      const midW = b.width * 0.3;

      // Local coordinates rotated around Y by blade angle
      const pushVert = (lx: number, ly: number, lz: number) => {
        const wx = lx * cosA - lz * sinA + b.offsetX;
        const wz = lx * sinA + lz * cosA + b.offsetZ;
        positions.push(wx, ly, wz);
        normals.push(0, 1, 0);
      };

      const base = idx * 5;
      pushVert(-hw, 0, 0);
      pushVert(hw, 0, 0);
      pushVert(-midW, b.height * 0.55, b.lean * 0.4);
      pushVert(midW, b.height * 0.55, b.lean * 0.4);
      pushVert(0, b.height, b.lean);

      indices.push(base, base + 1, base + 3);
      indices.push(base, base + 3, base + 2);
      indices.push(base + 2, base + 3, base + 4);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }

  private isGrassAllowedAt(x: number, z: number): boolean {
    // 1. Town Square cobblestone plaza
    if (Math.hypot(x, z) < 11.1) return false;

    // 2. Cobblestone paths
    for (const seg of this.pathSegments) {
      const vx = seg.x2 - seg.x1;
      const vz = seg.z2 - seg.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-4) continue;
      const proj = THREE.MathUtils.clamp(((x - seg.x1) * vx + (z - seg.z1) * vz) / lenSq, 0, 1);
      const px = seg.x1 + proj * vx;
      const pz = seg.z1 + proj * vz;
      if (Math.hypot(x - px, z - pz) <= seg.halfWidth + 0.65) return false;
    }

    // 3. West stream bed & wooden bridge
    if (Math.abs(x + 13) < 2.35 && z > -14.5 && z < 16.5) return false;
    if (x >= -16.1 && x <= -9.9 && z >= -3.1 && z <= 1.1) return false;

    // 4. Grand stone stairs
    if (Math.abs(x) < 2.6 && z > -25.0 && z < -12.5) return false;

    // 5. Sports field track ring (keep grass in infield & outer meadow!)
    const trackDist = Math.hypot(x - 20, z - 21);
    if (trackDist >= 3.85 && trackDist <= 7.2) return false;

    // 6. Cozy cottage floor & porch
    if (x >= -22.5 && x <= -14.5 && z >= -28.0 && z <= -20.8) return false;

    // 7. Boss arena stone ring interior
    if (Math.hypot(x, z + 35) < 5.15) return false;

    // 8. Buildings & world obstacles
    for (const obs of this.obstacles) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.r + 0.65) return false;
    }

    return true;
  }

  private buildInstancedGrass() {
    const placements: Array<{ x: number; y: number; z: number; rot: number; sx: number; sy: number; hex: number }> = [];
    const meadowPalette = [0x4ca64c, 0x5cbd57, 0x70cb62, 0x82d669, 0x459946];
    const forestPalette = [0x3b7a57, 0x488a62, 0x56996b, 0x3f7550];

    const step = 1.6;
    let seed = 1337;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let gx = -45; gx <= 45; gx += step) {
      for (let gz = -44; gz <= 35; gz += step) {
        const jx = gx + (nextRand() - 0.5) * 1.35;
        const jz = gz + (nextRand() - 0.5) * 1.35;
        if (!this.isGrassAllowedAt(jx, jz)) continue;

        // Slightly thinner on very high outer hilltops, lush around village meadows
        const rKeep = nextRand();
        if (rKeep > 0.72) continue;

        const y = this.sampleTerrainHeight(jx, jz);
        const palette = jz < -24 ? forestPalette : meadowPalette;
        const hex = palette[Math.floor(nextRand() * palette.length)];
        const baseScale = 0.78 + nextRand() * 0.58;

        placements.push({
          x: jx,
          y,
          z: jz,
          rot: nextRand() * Math.PI * 2,
          sx: baseScale * (0.9 + nextRand() * 0.2),
          sy: baseScale * (0.82 + nextRand() * 0.42),
          hex,
        });
      }
    }

    if (placements.length === 0) return;

    const grassGeo = this.createGrassTuftGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassTime = this.grassUniforms.uGrassTime;
      shader.uniforms.uGrassWind = this.grassUniforms.uGrassWind;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uGrassTime;
        uniform float uGrassWind;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float grassPhase = instanceMatrix[3][0] * 0.42 + instanceMatrix[3][2] * 0.34;
        #else
          float grassPhase = 0.0;
        #endif
        float tipHeight = clamp(position.y / 0.42, 0.0, 1.0);
        float grassSwayX = sin(uGrassTime * 2.15 + grassPhase) * 0.085 * uGrassWind * tipHeight * tipHeight;
        float grassSwayZ = cos(uGrassTime * 1.65 + grassPhase * 1.25) * 0.05 * uGrassWind * tipHeight * tipHeight;
        transformed.x += grassSwayX;
        transformed.z += grassSwayZ;`
      );
    };

    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, placements.length);
    grassInst.receiveShadow = true;

    const upAxis = new THREE.Vector3(0, 1, 0);
    placements.forEach((g, idx) => {
      _vec3.set(g.x, g.y, g.z);
      _quat.setFromAxisAngle(upAxis, g.rot);
      _scale.set(g.sx, g.sy, g.sx);
      _mat4.compose(_vec3, _quat, _scale);
      grassInst.setMatrixAt(idx, _mat4);
      grassInst.setColorAt(idx, _color.setHex(g.hex));
    });
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    this.scene.add(grassInst);
  }

  private createSparkSpriteTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.32)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildFireworksSystem() {
    const SHELLS = 6;
    const SPARKS = 54;
    const TOTAL = SHELLS * (SPARKS + 1); // +1 rocket head per shell

    this.fireworkPositions = new Float32Array(TOTAL * 3);
    this.fireworkColors = new Float32Array(TOTAL * 3);
    this.fireworkTexture = this.createSparkSpriteTexture();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.fireworkPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.fireworkColors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.72,
      map: this.fireworkTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.fireworkPoints = new THREE.Points(geo, mat);
    this.fireworkPoints.frustumCulled = false;
    this.fireworkPoints.visible = false;
    this.scene.add(this.fireworkPoints);

    for (let s = 0; s < SHELLS; s++) {
      this.fireworkShells.push({
        phase: 'idle',
        cooldown: s * 0.42,
        age: 0,
        fuse: 0.9,
        duration: 1.55,
        rx: 0,
        ry: -10,
        rz: 0,
        rvx: 0,
        rvy: 0,
        rvz: 0,
        colorA: new THREE.Color(0xfde047),
        colorB: new THREE.Color(0x34d399),
        sx: new Float32Array(SPARKS),
        sy: new Float32Array(SPARKS),
        sz: new Float32Array(SPARKS),
        svx: new Float32Array(SPARKS),
        svy: new Float32Array(SPARKS),
        svz: new Float32Array(SPARKS),
      });
    }
  }

  public setCelebrationActive(active: boolean) {
    this.celebrationPersistent = active;
    if (active) {
      this.fireworkPoints.visible = true;
    } else if (this.celebrationTimer <= 0) {
      this.fireworkPoints.visible = false;
    }
  }

  public triggerCelebrationFireworks(durationSec = 10) {
    this.celebrationPersistent = false;
    this.celebrationTimer = durationSec;
    this.fireworkPoints.visible = true;
    // Stagger immediate launch on idle shells so fireworks start right away
    this.fireworkShells.forEach((sh, idx) => {
      if (sh.phase === 'idle') {
        sh.cooldown = idx * 0.25;
      }
    });
  }

  private updateFireworks(dt: number) {
    if (this.celebrationTimer > 0) {
      this.celebrationTimer = Math.max(0, this.celebrationTimer - dt);
    }

    const canLaunchNew = this.celebrationPersistent || this.celebrationTimer > 2.2;
    const active = this.celebrationPersistent || this.celebrationTimer > 0;

    if (!active) {
      this.fireworkShells.forEach((sh) => {
        sh.phase = 'idle';
      });
      this.fireworkPoints.visible = false;
      return;
    }

    this.fireworkPoints.visible = true;
    const SPARKS = 54;
    const STRIDE = SPARKS + 1;
    const launchSites: Array<[number, number]> = [
      [-8.5, -5.5],
      [8.5, -5.5],
      [0, -14.5],
      [-10.5, 6.5],
      [10.5, 6.5],
      [0, 3.5],
    ];
    const palettes: Array<[number, number]> = [
      [0xfde047, 0xf97316], // Gold & tangerine
      [0x34d399, 0x38bdf8], // Emerald & sky
      [0xfb7185, 0xfde047], // Coral rose & gold
      [0xc084fc, 0x38bdf8], // Violet & cyan
      [0x60a5fa, 0xf472b6], // Azure & pink
      [0x4ade80, 0xfef08a], // Mint & lemon
    ];

    const safeDt = Math.min(dt, 0.05);
    const drag = Math.exp(-1.55 * safeDt);
    const gravity = 5.4;

    this.fireworkShells.forEach((sh, shellIdx) => {
      const basePt = shellIdx * STRIDE;

      if (sh.phase === 'idle') {
        // Hide all particles for this shell
        for (let k = 0; k < STRIDE; k++) {
          const p3 = (basePt + k) * 3;
          this.fireworkPositions[p3 + 1] = -50;
          this.fireworkColors[p3] = 0;
          this.fireworkColors[p3 + 1] = 0;
          this.fireworkColors[p3 + 2] = 0;
        }
        if (canLaunchNew) {
          sh.cooldown -= safeDt;
          if (sh.cooldown <= 0) {
            const site = launchSites[(shellIdx + Math.floor(Math.random() * 2)) % launchSites.length];
            const pal = palettes[Math.floor(Math.random() * palettes.length)];
            sh.phase = 'rising';
            sh.age = 0;
            sh.fuse = 0.72 + Math.random() * 0.38;
            sh.duration = 1.45 + Math.random() * 0.45;
            sh.rx = site[0] + (Math.random() - 0.5) * 3.0;
            sh.ry = groundHeightAt(site[0], site[1]) + 0.6;
            sh.rz = site[1] + (Math.random() - 0.5) * 3.0;
            sh.rvx = (Math.random() - 0.5) * 2.2;
            sh.rvy = 12.2 + Math.random() * 3.6;
            sh.rvz = (Math.random() - 0.5) * 2.2;
            sh.colorA.setHex(pal[0]);
            sh.colorB.setHex(pal[1]);
          }
        }
        return;
      }

      if (sh.phase === 'rising') {
        sh.age += safeDt;
        sh.rvy -= 3.0 * safeDt;
        sh.rx += sh.rvx * safeDt;
        sh.ry += sh.rvy * safeDt;
        sh.rz += sh.rvz * safeDt;

        const r3 = basePt * 3;
        this.fireworkPositions[r3] = sh.rx;
        this.fireworkPositions[r3 + 1] = sh.ry;
        this.fireworkPositions[r3 + 2] = sh.rz;
        this.fireworkColors[r3] = 1.0;
        this.fireworkColors[r3 + 1] = 0.92;
        this.fireworkColors[r3 + 2] = 0.65;

        // Hide sparks until burst
        for (let i = 0; i < SPARKS; i++) {
          const p3 = (basePt + 1 + i) * 3;
          this.fireworkPositions[p3 + 1] = -50;
          this.fireworkColors[p3] = 0;
          this.fireworkColors[p3 + 1] = 0;
          this.fireworkColors[p3 + 2] = 0;
        }

        if (sh.age >= sh.fuse) {
          sh.phase = 'bursting';
          sh.age = 0;
          const speedBase = this.reduceMotion ? 3.8 : 6.2;
          for (let i = 0; i < SPARKS; i++) {
            // Fibonacci sphere distribution + subtle jitter for round starburst
            const phi = Math.acos(1 - (2 * (i + 0.5)) / SPARKS);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i + Math.random() * 0.25;
            const speed = speedBase * (0.7 + Math.random() * 0.55);
            sh.sx[i] = sh.rx;
            sh.sy[i] = sh.ry;
            sh.sz[i] = sh.rz;
            sh.svx[i] = Math.sin(phi) * Math.cos(theta) * speed;
            sh.svy[i] = Math.cos(phi) * speed + 1.2;
            sh.svz[i] = Math.sin(phi) * Math.sin(theta) * speed;
          }
          audioEngine.playFireworkBurst();
        }
        return;
      }

      // Bursting phase
      sh.age += safeDt;
      const progress = Math.min(1, sh.age / sh.duration);
      const fade = Math.pow(1 - progress, 1.35);

      // Hide rocket head
      const r3 = basePt * 3;
      this.fireworkPositions[r3 + 1] = -50;
      this.fireworkColors[r3] = 0;
      this.fireworkColors[r3 + 1] = 0;
      this.fireworkColors[r3 + 2] = 0;

      for (let i = 0; i < SPARKS; i++) {
        sh.svx[i] *= drag;
        sh.svy[i] = sh.svy[i] * drag - gravity * safeDt;
        sh.svz[i] *= drag;
        sh.sx[i] += sh.svx[i] * safeDt;
        sh.sy[i] += sh.svy[i] * safeDt;
        sh.sz[i] += sh.svz[i] * safeDt;

        const p3 = (basePt + 1 + i) * 3;
        this.fireworkPositions[p3] = sh.sx[i];
        this.fireworkPositions[p3 + 1] = sh.sy[i];
        this.fireworkPositions[p3 + 2] = sh.sz[i];

        const baseCol = i % 3 === 0 ? sh.colorB : sh.colorA;
        const twinkle = 0.8 + 0.2 * Math.sin(sh.age * 18 + i * 1.7);
        const lum = fade * twinkle;
        this.fireworkColors[p3] = baseCol.r * lum;
        this.fireworkColors[p3 + 1] = baseCol.g * lum;
        this.fireworkColors[p3 + 2] = baseCol.b * lum;
      }

      if (progress >= 1) {
        sh.phase = 'idle';
        sh.cooldown = 0.35 + Math.random() * 0.95;
      }
    });

    (this.fireworkPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.fireworkPoints.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  private buildFogAndGerms() {
    // Volumetric Grumble Fog puffs concentrated near Misty Forest & drifting over paths
    const puffGeo = new THREE.DodecahedronGeometry(1.6, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.42,
      roughness: 1,
      depthWrite: false,
    });

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(puffGeo, puffMat);
      const bx = (Math.sin(i * 2.3) * 14);
      const bz = i < 14 ? -28 - (i % 4) * 3.5 : -10 - (i % 5) * 4;
      const by = groundHeightAt(bx, bz) + 1.4 + (i % 3) * 0.5;
      mesh.position.set(bx, by, bz);
      this.scene.add(mesh);
      this.fogPuffs.push({ mesh, baseX: bx, baseZ: bz, phase: i * 0.7 });
    }

    // Glowing 3D Germ Particles (visible when Germ Goggles are active!)
    const germPositions: number[] = [];
    const anchors = [
      [0, -2],
      [23.5, -2.5],
      [-23.5, -2.5],
      [19.5, -23.0],
      [-21.5, 22.0],
      [20, 21],
    ];
    for (const [ax, az] of anchors) {
      const ay = groundHeightAt(ax, az);
      for (let j = 0; j < 14; j++) {
        germPositions.push(
          ax + (Math.random() - 0.5) * 4.2,
          ay + 0.5 + Math.random() * 1.4,
          az + (Math.random() - 0.5) * 4.2
        );
      }
    }
    const germGeo = new THREE.BufferGeometry();
    germGeo.setAttribute('position', new THREE.Float32BufferAttribute(germPositions, 3));
    const germMat = new THREE.PointsMaterial({
      color: 0x4ade80,
      size: 0.34,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.germParticles = new THREE.Points(germGeo, germMat);
    this.germParticles.visible = false;
    this.scene.add(this.germParticles);
  }

  private buildWeatherSystem() {
    // 1. Stylized low-poly overhead clouds that gather during Cloudy / Light Rain
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puffGeo = new THREE.DodecahedronGeometry(1.3, 1);

    for (let i = 0; i < 14; i++) {
      const group = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const mesh = new THREE.Mesh(puffGeo, this.cloudMat);
        mesh.position.set((p - 1) * 1.45, (p % 2) * 0.35, ((p * 7) % 3 - 1) * 0.55);
        mesh.scale.set(1.15 - p * 0.12, 0.65, 0.95);
        group.add(mesh);
      }
      const x = -38 + ((i * 19) % 76);
      const z = -34 + ((i * 13) % 62);
      const y = 13.5 + (i % 3) * 1.6;
      group.position.set(x, y, z);
      group.visible = false;
      this.scene.add(group);
      this.cloudGroups.push({
        group,
        speed: 0.85 + (i % 4) * 0.35,
        baseZ: z,
        phase: i * 1.1,
      });
    }

    // 2. Light Rain streaks (pre-allocated LineSegments buffer for zero-GC loop)
    const dropCount = 260;
    this.rainPositions = new Float32Array(dropCount * 6);
    for (let i = 0; i < dropCount; i++) {
      const rx = (Math.random() - 0.5) * 38;
      const ry = 0.5 + Math.random() * 14;
      const rz = (Math.random() - 0.5) * 34;
      const base = i * 6;
      this.rainPositions[base] = rx;
      this.rainPositions[base + 1] = ry;
      this.rainPositions[base + 2] = rz;
      this.rainPositions[base + 3] = rx - 0.14;
      this.rainPositions[base + 4] = ry - 0.62;
      this.rainPositions[base + 5] = rz + 0.08;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);

    // 3. Subtle ground rain splash ripples around the player viewport
    const rippleGeo = new THREE.RingGeometry(0.14, 0.2, 14);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.rainRipples.push({
        mesh,
        mat,
        phase: (i / 16) * Math.PI * 2,
        ox: ((i * 7) % 18) - 9,
        oz: ((i * 11) % 16) - 8,
      });
    }
  }

  private buildAmbientCritters() {
    // Shared lightweight composite geometries for birds & butterflies
    const birdBodyGeo = new THREE.SphereGeometry(0.088, 8, 6);
    birdBodyGeo.scale(0.85, 0.78, 1.48);
    const birdHeadGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const birdBeakGeo = new THREE.ConeGeometry(0.022, 0.075, 5);
    birdBeakGeo.rotateX(Math.PI / 2);
    const birdTailGeo = new THREE.BoxGeometry(0.075, 0.015, 0.13);
    const birdWingGeo = new THREE.BoxGeometry(0.21, 0.014, 0.105);

    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 });

    const bflyBodyGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.16, 6);
    bflyBodyGeo.rotateX(Math.PI / 2);
    const bflyForeWingGeo = new THREE.CircleGeometry(0.105, 6);
    bflyForeWingGeo.rotateX(-Math.PI / 2);
    const bflyHindWingGeo = new THREE.CircleGeometry(0.072, 6);
    bflyHindWingGeo.rotateX(-Math.PI / 2);
    const bflyBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const spawnButterfly = (
      zone: 'town_square' | 'misty_forest',
      idx: number,
      colorHex: number,
      glowing: boolean,
      cx: number,
      cz: number,
      rx: number,
      rz: number,
      minCrystals: number
    ) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bflyBodyGeo, bflyBodyMat);
      group.add(body);

      const wingMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: glowing ? colorHex : 0x000000,
        emissiveIntensity: glowing ? 0.35 : 0,
        roughness: 0.55,
        side: THREE.DoubleSide,
      });

      const leftWing = new THREE.Group();
      leftWing.position.set(-0.012, 0.005, 0);
      const lFore = new THREE.Mesh(bflyForeWingGeo, wingMat);
      lFore.position.set(-0.085, 0, 0.04);
      const lHind = new THREE.Mesh(bflyHindWingGeo, wingMat);
      lHind.position.set(-0.065, 0, -0.055);
      leftWing.add(lFore, lHind);

      const rightWing = new THREE.Group();
      rightWing.position.set(0.012, 0.005, 0);
      const rFore = new THREE.Mesh(bflyForeWingGeo, wingMat);
      rFore.position.set(0.085, 0, 0.04);
      const rHind = new THREE.Mesh(bflyHindWingGeo, wingMat);
      rHind.position.set(0.065, 0, -0.055);
      rightWing.add(rFore, rHind);

      group.add(leftWing, rightWing);
      const baseScale = 0.92 + (idx % 3) * 0.14;
      group.scale.setScalar(baseScale);
      this.scene.add(group);

      const phase = idx * 1.47 + (zone === 'misty_forest' ? 2.1 : 0.3);
      const initX = cx + Math.sin(phase) * rx;
      const initZ = cz + Math.cos(phase * 1.3) * rz;
      group.position.set(initX, groundHeightAt(initX, initZ) + 0.9, initZ);

      this.ambientCritters.push({
        kind: 'butterfly',
        zone,
        group,
        leftWing,
        rightWing,
        centerX: cx,
        centerZ: cz,
        radiusX: rx,
        radiusZ: rz,
        baseAltitude: 0.65 + (idx % 4) * 0.22,
        bobAmplitude: 0.22 + (idx % 3) * 0.06,
        speed: 0.42 + (idx % 4) * 0.08,
        phase,
        freqX: 0.85 + (idx % 3) * 0.17,
        freqZ: 1.13 + (idx % 2) * 0.21,
        flapSpeed: 13 + (idx % 3) * 2.2,
        prevX: initX,
        prevZ: initZ,
        prevYaw: 0,
        flightTime: 0,
        flapTime: phase,
        startleBoost: 0,
        visScale: 1,
        baseScale,
        minCrystals,
      });
    };

    const spawnBird = (
      zone: 'town_square' | 'misty_forest',
      idx: number,
      plumageHex: number,
      breastHex: number,
      cx: number,
      cz: number,
      rx: number,
      rz: number,
      alt: number,
      minCrystals: number
    ) => {
      const group = new THREE.Group();
      const plumageMat = new THREE.MeshStandardMaterial({ color: plumageHex, roughness: 0.72 });
      const breastMat = new THREE.MeshStandardMaterial({ color: breastHex, roughness: 0.78 });

      const body = new THREE.Mesh(birdBodyGeo, breastMat);
      body.castShadow = true;
      const head = new THREE.Mesh(birdHeadGeo, plumageMat);
      head.position.set(0, 0.055, 0.105);
      const beak = new THREE.Mesh(birdBeakGeo, beakMat);
      beak.position.set(0, 0.05, 0.18);
      const tail = new THREE.Mesh(birdTailGeo, plumageMat);
      tail.position.set(0, 0.015, -0.14);
      tail.rotation.x = 0.18;

      const leftWing = new THREE.Group();
      leftWing.position.set(-0.045, 0.03, 0.01);
      const lWingMesh = new THREE.Mesh(birdWingGeo, plumageMat);
      lWingMesh.position.set(-0.105, 0, 0);
      leftWing.add(lWingMesh);

      const rightWing = new THREE.Group();
      rightWing.position.set(0.045, 0.03, 0.01);
      const rWingMesh = new THREE.Mesh(birdWingGeo, plumageMat);
      rWingMesh.position.set(0.105, 0, 0);
      rightWing.add(rWingMesh);

      group.add(body, head, beak, tail, leftWing, rightWing);
      const baseScale = 0.95 + (idx % 3) * 0.12;
      group.scale.setScalar(baseScale);
      this.scene.add(group);

      const phase = idx * 1.9 + (zone === 'misty_forest' ? 1.4 : 0.2);
      const initX = cx + Math.sin(phase) * rx;
      const initZ = cz + Math.cos(phase * 1.3) * rz;
      group.position.set(initX, groundHeightAt(initX, initZ) + alt, initZ);

      this.ambientCritters.push({
        kind: 'bird',
        zone,
        group,
        leftWing,
        rightWing,
        centerX: cx,
        centerZ: cz,
        radiusX: rx,
        radiusZ: rz,
        baseAltitude: alt,
        bobAmplitude: 0.35 + (idx % 3) * 0.12,
        speed: 0.36 + (idx % 3) * 0.07,
        phase,
        freqX: 0.92 + (idx % 2) * 0.19,
        freqZ: 0.78 + (idx % 3) * 0.16,
        flapSpeed: 10.5 + (idx % 3) * 1.6,
        prevX: initX,
        prevZ: initZ,
        prevYaw: 0,
        flightTime: 0,
        flapTime: phase,
        startleBoost: 0,
        visScale: 1,
        baseScale,
        minCrystals,
      });
    };

    // 1. Town Square Butterflies (meadow wildflowers & plaza perimeter)
    const sqButterflyColors = [0xfb923c, 0x38bdf8, 0xfef08a, 0xf472b6, 0xc084fc, 0x34d399, 0xfbbf24, 0x60a5fa];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const anchorDist = 4.2 + (i % 3) * 2.2;
      spawnButterfly(
        'town_square',
        i,
        sqButterflyColors[i % sqButterflyColors.length],
        false,
        Math.cos(angle) * anchorDist,
        Math.sin(angle) * anchorDist - 1.0,
        2.6 + (i % 3) * 0.8,
        2.4 + ((i + 1) % 3) * 0.8,
        i < 4 ? 0 : Math.min(4, i - 3)
      );
    }

    // 2. Town Square Songbirds (bluebirds, robins, goldfinches wheeling overhead)
    const sqBirds: Array<[number, number]> = [
      [0x0284c7, 0xfef3c7],
      [0x78350f, 0xfb7185],
      [0xeab308, 0xfef08a],
      [0x0ea5e9, 0xf8fafc],
      [0x15803d, 0xfde047],
    ];
    sqBirds.forEach(([plumage, breast], i) => {
      spawnBird(
        'town_square',
        i,
        plumage,
        breast,
        (i - 2) * 1.4,
        -1.2 + (i % 2) * 2.0,
        6.5 + (i % 3) * 1.8,
        5.8 + ((i + 1) % 3) * 1.6,
        3.5 + (i % 3) * 0.75,
        i < 3 ? 0 : i - 1
      );
    });

    // 3. Misty Forest Luna Moths & Woodland Butterflies (glowing gently above the northern ridge)
    const forestMothColors = [0x6ee7b7, 0xc4b5fd, 0x7dd3fc, 0xa7f3d0, 0xd8b4fe, 0x5eead4, 0x93c5fd];
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      spawnButterfly(
        'misty_forest',
        i,
        forestMothColors[i % forestMothColors.length],
        true,
        Math.cos(angle) * 4.5,
        -34.5 + Math.sin(angle) * 3.8,
        2.4 + (i % 3) * 0.7,
        2.2 + ((i + 1) % 3) * 0.7,
        0
      );
    }

    // 4. Misty Forest Woodland Birds (jays, twilight owls & forest kingfishers)
    const forestBirds: Array<[number, number]> = [
      [0x4f46e5, 0xe0e7ff],
      [0x0d9488, 0xccfbf1],
      [0x7c3aed, 0xede9fe],
      [0x334155, 0xcbd5e1],
      [0x0284c7, 0xbae6fd],
    ];
    forestBirds.forEach(([plumage, breast], i) => {
      spawnBird(
        'misty_forest',
        i,
        plumage,
        breast,
        (i - 2) * 1.6,
        -34.5 + (i % 2) * 2.2,
        6.2 + (i % 3) * 1.5,
        5.2 + ((i + 1) % 3) * 1.4,
        3.8 + (i % 3) * 0.85,
        0
      );
    });
  }

  public getWeather(): WeatherType {
    return this.activeWeather;
  }

  public triggerRandomWeather(): WeatherType {
    const options: WeatherType[] = ['sunny', 'cloudy', 'rain'].filter(
      (w) => w !== this.activeWeather
    ) as WeatherType[];
    const next = options[Math.floor(Math.random() * options.length)];
    this.activeWeather = next;
    this.weatherSwitchTimer = 32 + Math.random() * 22;
    this.callbacks.onWeatherChange?.(this.activeWeather);
    return next;
  }

  private buildPlayer(state: GameSaveState) {
    this.playerRig = buildCharacterRig(state.appearance, this.textures.contactShadow, {
      hasSatchel: state.unlockedTools.includes('healing_satchel'),
      gogglesOn: state.germGogglesActive,
      equippedCosmetic: state.equippedCosmetic,
    });
    this.playerRig.root.position.copy(this.playerPos);
    this.scene.add(this.playerRig.root);
  }

  public syncState(state: GameSaveState, quests: QuestDefinition[]) {
    this.crystalsCount = state.restoredCrystals.length;
    this.restoredSet = new Set(state.restoredCrystals);
    this.autoDayNight = state.settings.autoDayNight ?? true;
    if (Math.abs(state.dayTime - this.lastSyncedDayTime) > 0.002) {
      this.dayTime = state.dayTime;
      this.lastSyncedDayTime = state.dayTime;
    }
    this.performanceMode = state.settings.performanceMode;
    this.reduceMotion = state.settings.reduceMotion;
    this.cameraRig.setReduceMotion(state.settings.reduceMotion);

    const nextMode = state.settings.weatherMode ?? 'auto';
    if (nextMode !== this.weatherMode) {
      this.weatherMode = nextMode;
      if (nextMode !== 'auto' && nextMode !== this.activeWeather) {
        this.activeWeather = nextMode;
        this.callbacks.onWeatherChange?.(this.activeWeather);
      }
    }

    // Toggle tools & cosmetics on player rig
    this.playerRig.satchelGroup.visible = state.unlockedTools.includes('healing_satchel');
    this.playerRig.gogglesGroup.visible = state.germGogglesActive;
    this.playerRig.capeMesh.visible = state.equippedCosmetic === 'cosmetic_sun_cape';
    this.playerRig.crownGroup.visible = state.equippedCosmetic === 'cosmetic_flower_crown';
    this.germParticles.visible = state.germGogglesActive;
    this.lanternsGroup.visible = state.unlockedCosmetics.includes('village_lanterns');

    // Update NPC floating quest markers
    const completed = new Set(state.completedQuestIds);
    for (const actor of this.npcs) {
      const hasAvailable = quests.some(
        (q) =>
          q.npcId === actor.id &&
          !completed.has(q.id) &&
          q.prerequisiteQuestIds.every((pre) => completed.has(pre))
      );
      actor.markerMesh.visible = hasAvailable;
    }

    this.applyProgressVisuals();
  }

  public rebuildPlayerAppearance(state: GameSaveState) {
    this.scene.remove(this.playerRig.root);
    this.buildPlayer(state);
  }

  public teleportToZone(zoneId: ZoneId) {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    const x = zone.center.x;
    const z = zone.center.z + 3.2;
    this.playerPos.set(x, groundHeightAt(x, z), z);
    this.playerRig.root.position.copy(this.playerPos);
    this.clickMoveTarget = null;
    this.clickMarker.visible = false;
    this.cameraRig.setTarget(this.playerPos.x, this.playerPos.y, this.playerPos.z, false);
    this.callbacks.onPlayerMove(x, z);
  }

  public resetWorld(freshState: GameSaveState) {
    const x = freshState.playerPos.x;
    const z = freshState.playerPos.z;
    const y = groundHeightAt(x, z);
    this.playerPos.set(x, y, z);
    this.playerFacing = 0;
    this.walkCycle = 0;
    this.clickMoveTarget = null;
    this.clickMarker.visible = false;
    this.celebrationPersistent = false;
    this.celebrationTimer = 0;
    this.fireworkShells.forEach((sh) => {
      sh.phase = 'idle';
      sh.cooldown = 0;
    });
    if (this.fireworkPoints) this.fireworkPoints.visible = false;
    this.cameraRig.startCinematic('none');
    this.cameraRig.setTarget(x, y, z, true);
    this.activeWeather = 'sunny';
    this.weatherCloudiness = 0;
    this.weatherRaininess = 0;
    this.weatherSwitchTimer = 32;
    this.callbacks.onWeatherChange?.('sunny');
    this.lastZoneId = 'town_square';
    this.callbacks.onZoneChange('town_square');
    this.rebuildPlayerAppearance(freshState);
  }

  public setCinematicMode(mode: 'none' | 'ending_sweep' | 'boss_focus') {
    this.cameraRig.startCinematic(mode);
  }

  public setVirtualJoystick(x: number, y: number) {
    this.joystickVec.set(x, y);
    if (Math.hypot(x, y) > 0.1) {
      this.clickMoveTarget = null;
      this.clickMarker.visible = false;
    }
  }

  private applyProgressVisuals() {
    // 1. Fountain Crystal Gems light up
    (['hygiene', 'nutrition', 'exercise', 'rest', 'prevention'] as CrystalCategory[]).forEach((cat) => {
      const gem = this.fountainData.crystalGems[cat];
      const mat = gem.material as THREE.MeshStandardMaterial;
      if (this.restoredSet.has(cat)) {
        mat.opacity = 1.0;
        mat.emissiveIntensity = 1.15;
        gem.scale.setScalar(1.25);
      } else {
        mat.opacity = 0.3;
        mat.emissiveIntensity = 0.08;
        gem.scale.setScalar(0.85);
      }
    });

    // 2. Flowers bloom progressively (0 crystals = tiny buds, 5 crystals = full meadow bloom!)
    const bloomRatio = 0.25 + (this.crystalsCount / 5) * 0.95;
    this.flowerTransforms.forEach((ft, idx) => {
      _vec3.set(ft.x, ft.y, ft.z);
      _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ft.rot);
      _scale.setScalar(ft.baseScale * bloomRatio);
      _mat4.compose(_vec3, _quat, _scale);
      this.flowerInstanced.setMatrixAt(idx, _mat4);
    });
    this.flowerInstanced.instanceMatrix.needsUpdate = true;

    // 3. Day/Night + Fog Thinning + Weather Atmosphere
    this.applyAtmosphericLighting();

    // 4. Grumble Fog Puffs visibly shrink & fade as Crystals restore!
    const progress = this.crystalsCount / 5;
    const fogRemain = Math.max(0, 1 - progress);
    this.fogPuffs.forEach((p) => {
      p.mesh.visible = fogRemain > 0.02;
      p.mesh.scale.setScalar(0.4 + fogRemain * 0.9);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.45 * fogRemain;
    });
  }

  private applyAtmosphericLighting() {
    const progress = this.crystalsCount / 5;
    const isMistyZone = this.lastZoneId === 'misty_forest';
    const isCozyZone = this.lastZoneId === 'cozy_cottage';

    // Smooth real-time color temperature weights across the 24h cycle:
    // Orange for Sunrise/Sunset, Bright White for Noon, Dark Blue for Night
    const w = sampleDayPhaseWeights(this.dayTime);
    const warmEdge = w.sunrise + w.sunset;
    const daylightStrength = w.noon + warmEdge * 0.75;

    // 1. Solar arc position (east sunrise -> overhead noon -> west sunset -> high moon at night)
    const t = ((this.dayTime % 1) + 1) % 1;
    const dayArc = THREE.MathUtils.clamp((t - 0.1) / 0.7, 0, 1);
    const sunAngle = dayArc * Math.PI;
    const sunX = THREE.MathUtils.lerp(Math.cos(sunAngle) * 24, 12, w.night);
    const sunY = THREE.MathUtils.lerp(13 + Math.sin(sunAngle) * 19, 24, w.night);
    const sunZ = THREE.MathUtils.lerp(18 - Math.sin(sunAngle) * 6, 14, w.night);
    this.sunOffset.set(sunX, sunY, sunZ);

    // 2. Sky & Horizon Fog Global Illumination Base
    _skyDayColor
      .setRGB(
        _skySunriseColor.r * w.sunrise +
          _skyNoonColor.r * w.noon +
          _skySunsetColor.r * w.sunset +
          _skyNightColor.r * w.night,
        _skySunriseColor.g * w.sunrise +
          _skyNoonColor.g * w.noon +
          _skySunsetColor.g * w.sunset +
          _skyNightColor.g * w.night,
        _skySunriseColor.b * w.sunrise +
          _skyNoonColor.b * w.noon +
          _skySunsetColor.b * w.sunset +
          _skyNightColor.b * w.night
      );
    // Early-game Grumble Fog slightly mutes bright daylight until Crystals restore
    _skyFinalColor
      .copy(_skyDayColor)
      .lerp(_color.setHex(0x8a99ad), (1 - progress) * 0.25 * daylightStrength);
    _skyFinalColor.lerp(_skyCloudColor, this.weatherCloudiness * (0.48 - w.night * 0.25));
    _skyFinalColor.lerp(_skyRainColor, this.weatherRaininess * 0.45);

    this.scene.background = _skyFinalColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_skyFinalColor);
      const baseFog = 0.0165 - progress * 0.0095;
      const weatherFogBoost = this.weatherCloudiness * 0.0038 + this.weatherRaininess * 0.005;
      const zoneFogBoost = isMistyZone ? 0.0055 : 0;
      const nightFogBoost = w.night * 0.0025;
      this.scene.fog.density = Math.max(
        0.005,
        baseFog + weatherFogBoost + zoneFogBoost + nightFogBoost
      );
    }

    // 3. Primary Key Light (Directional Sun / Moon) Temperature & Intensity
    _sunFinalColor.setRGB(
      _sunSunriseColor.r * w.sunrise +
        _sunNoonColor.r * w.noon +
        _sunSunsetColor.r * w.sunset +
        _sunNightColor.r * w.night,
      _sunSunriseColor.g * w.sunrise +
        _sunNoonColor.g * w.noon +
        _sunSunsetColor.g * w.sunset +
        _sunNightColor.g * w.night,
      _sunSunriseColor.b * w.sunrise +
        _sunNoonColor.b * w.noon +
        _sunSunsetColor.b * w.sunset +
        _sunNightColor.b * w.night
    );
    _sunFinalColor.lerp(_sunCloudColor, this.weatherCloudiness * 0.52);
    this.sunLight.color.copy(_sunFinalColor);

    const weatherSunScale = 1 - this.weatherCloudiness * 0.4 - this.weatherRaininess * 0.18;
    const baseSunIntensity =
      w.noon * 1.62 + warmEdge * 1.2 + w.night * 0.46 + progress * 0.22 * daylightStrength;
    this.sunLight.intensity = baseSunIntensity * weatherSunScale;

    // 4. Hemisphere Global Illumination (Sky Dome + Ground Bounce Temperature)
    _hemiSkyFinal.setRGB(
      _hemiSkySunrise.r * w.sunrise +
        _hemiSkyNoon.r * w.noon +
        _hemiSkySunset.r * w.sunset +
        _hemiSkyNight.r * w.night,
      _hemiSkySunrise.g * w.sunrise +
        _hemiSkyNoon.g * w.noon +
        _hemiSkySunset.g * w.sunset +
        _hemiSkyNight.g * w.night,
      _hemiSkySunrise.b * w.sunrise +
        _hemiSkyNoon.b * w.noon +
        _hemiSkySunset.b * w.sunset +
        _hemiSkyNight.b * w.night
    );
    _hemiSkyFinal.lerp(_hemiSkyOvercast, this.weatherCloudiness * (0.6 - w.night * 0.3));
    this.hemiLight.color.copy(_hemiSkyFinal);

    _hemiGroundFinal.setRGB(
      _hemiGroundSunrise.r * w.sunrise +
        _hemiGroundNoon.r * w.noon +
        _hemiGroundSunset.r * w.sunset +
        _hemiGroundNight.r * w.night,
      _hemiGroundSunrise.g * w.sunrise +
        _hemiGroundNoon.g * w.noon +
        _hemiGroundSunset.g * w.sunset +
        _hemiGroundNight.g * w.night,
      _hemiGroundSunrise.b * w.sunrise +
        _hemiGroundNoon.b * w.noon +
        _hemiGroundSunset.b * w.sunset +
        _hemiGroundNight.b * w.night
    );
    this.hemiLight.groundColor.copy(_hemiGroundFinal);
    this.hemiLight.intensity =
      w.noon * 0.85 +
      warmEdge * 0.7 +
      w.night * 0.45 +
      progress * 0.14 +
      this.weatherCloudiness * 0.06;

    // 5. Indirect Ambient GI Bounce + IBL Environment Intensity
    _giFinalColor.setRGB(
      _giSunriseColor.r * w.sunrise +
        _giNoonColor.r * w.noon +
        _giSunsetColor.r * w.sunset +
        _giNightColor.r * w.night,
      _giSunriseColor.g * w.sunrise +
        _giNoonColor.g * w.noon +
        _giSunsetColor.g * w.sunset +
        _giNightColor.g * w.night,
      _giSunriseColor.b * w.sunrise +
        _giNoonColor.b * w.noon +
        _giSunsetColor.b * w.sunset +
        _giNightColor.b * w.night
    );
    this.giBounceLight.color.copy(_giFinalColor);
    this.giBounceLight.intensity = w.noon * 0.22 + warmEdge * 0.24 + w.night * 0.28;

    // Scale RoomEnvironment IBL reflections so night stays dark blue & noon stays crisp bright white
    const iblWeatherScale = 1 - this.weatherCloudiness * 0.28;
    this.scene.environmentIntensity =
      (w.noon * 1.0 + warmEdge * 0.65 + w.night * 0.26) * iblWeatherScale;

    // 6. Warm Architectural Lanterns & Windows (contrast with blue night / warm dusk & dawn)
    const weatherCozyWarmth =
      this.weatherCloudiness * 0.4 + this.weatherRaininess * 0.45 + (isCozyZone ? 0.25 : 0);
    const lanternPower =
      w.night * 1.65 + warmEdge * 0.85 + w.noon * 0.15 + progress * 0.35 + weatherCozyWarmth;
    for (const pl of this.lanternLights) {
      pl.intensity = lanternPower;
    }
    for (const wm of this.windowMaterials) {
      wm.emissiveIntensity =
        w.night * 1.45 +
        warmEdge * 0.72 +
        w.noon * 0.14 +
        progress * 0.15 +
        weatherCozyWarmth * 0.65;
    }
  }

  private updateWeather(dt: number, elapsed: number) {
    // 1. Random weather toggling when in auto mode
    if (this.weatherMode === 'auto') {
      this.weatherSwitchTimer -= dt;
      if (this.weatherSwitchTimer <= 0) {
        this.triggerRandomWeather();
      }
    }

    // 2. Smoothly interpolate cloudiness & raininess
    const targetCloud = this.activeWeather === 'sunny' ? 0 : this.activeWeather === 'cloudy' ? 0.82 : 1.0;
    const targetRain = this.activeWeather === 'rain' ? 1.0 : 0.0;
    const prevCloud = this.weatherCloudiness;
    const prevRain = this.weatherRaininess;

    this.weatherCloudiness = THREE.MathUtils.damp(this.weatherCloudiness, targetCloud, 1.4, dt);
    this.weatherRaininess = THREE.MathUtils.damp(this.weatherRaininess, targetRain, 1.8, dt);

    if (
      Math.abs(this.weatherCloudiness - prevCloud) > 0.0005 ||
      Math.abs(this.weatherRaininess - prevRain) > 0.0005
    ) {
      this.applyAtmosphericLighting();
    }

    // 3. Animate overhead clouds
    const showClouds = this.weatherCloudiness > 0.02;
    this.cloudMat.opacity = this.weatherCloudiness * 0.68;
    const windSpeed = this.reduceMotion ? 0.15 : 1 + this.weatherRaininess * 0.6;
    for (const c of this.cloudGroups) {
      c.group.visible = showClouds;
      if (!showClouds) continue;
      c.group.position.x += c.speed * windSpeed * dt;
      if (c.group.position.x > 42) {
        c.group.position.x = -42;
      }
      c.group.position.z = c.baseZ + Math.sin(elapsed * 0.25 + c.phase) * 0.6;
    }

    // 4. Animate light rain streaks & splash ripples centered around player
    const showRain = this.weatherRaininess > 0.03;
    this.rainLines.visible = showRain;
    if (showRain) {
      this.rainMat.opacity = this.weatherRaininess * 0.55;
      const fallSpeed = this.reduceMotion ? 6.5 : 16.5;
      const windX = this.reduceMotion ? -0.4 : -2.2;
      const arr = this.rainPositions;
      const px = this.playerPos.x;
      const pz = this.playerPos.z;

      for (let i = 0; i < arr.length; i += 6) {
        arr[i] += windX * dt;
        arr[i + 1] -= fallSpeed * dt;
        arr[i + 2] += 0.5 * dt;

        // Keep rain volume centered near player X/Z
        if (arr[i] < px - 19) arr[i] += 38;
        if (arr[i] > px + 19) arr[i] -= 38;
        if (arr[i + 2] < pz - 17) arr[i + 2] += 34;
        if (arr[i + 2] > pz + 17) arr[i + 2] -= 34;

        if (arr[i + 1] < 0.2) {
          arr[i + 1] = 13.5 + (i % 5) * 0.6;
          arr[i] = px + ((Math.sin(i * 12.9898) * 0.5) * 38);
          arr[i + 2] = pz + ((Math.cos(i * 78.233) * 0.5) * 34);
        }

        arr[i + 3] = arr[i] - 0.13;
        arr[i + 4] = arr[i + 1] - 0.62;
        arr[i + 5] = arr[i + 2] + 0.06;
      }
      (this.rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    for (const rip of this.rainRipples) {
      rip.mesh.visible = showRain;
      if (!showRain) continue;
      const t = (elapsed * (this.reduceMotion ? 0.6 : 1.7) + rip.phase) % 1;
      const rx = this.playerPos.x + rip.ox;
      const rz = this.playerPos.z + rip.oz;
      rip.mesh.position.set(rx, groundHeightAt(rx, rz) + 0.06, rz);
      rip.mesh.scale.setScalar(0.5 + t * 2.2);
      rip.mat.opacity = (1 - t) * 0.42 * this.weatherRaininess;
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.cameraRig.setAspect(w / h);
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    audioEngine.unlock();
    this.keys[e.code] = true;
    if (e.code === 'KeyE' || e.code === 'Space') {
      const nearest = this.findNearestInteractable();
      if (nearest) {
        this.callbacks.onInteract(nearest.target);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.cameraRig.setPointerNormalized(nx, ny);
  };

  private onCanvasClick = (e: MouseEvent) => {
    audioEngine.unlock();
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerVec, this.cameraRig.camera);

    // 1. Check direct click on NPC / Quest Board / Shop / Fountain
    const hitObjs = this.raycaster.intersectObjects(this.clickHitMeshes, true);
    if (hitObjs.length > 0) {
      let cur: THREE.Object3D | null = hitObjs[0].object;
      while (cur) {
        if (cur.userData?.interactTarget) {
          const target = cur.userData.interactTarget as WorldInteractTarget;
          const worldPt = hitObjs[0].point;
          if (Math.hypot(worldPt.x - this.playerPos.x, worldPt.z - this.playerPos.z) < 5.5) {
            this.callbacks.onInteract(target);
            return;
          } else {
            this.clickMoveTarget = new THREE.Vector3(worldPt.x, 0, worldPt.z);
            this.clickMarker.position.set(worldPt.x, groundHeightAt(worldPt.x, worldPt.z) + 0.08, worldPt.z);
            this.clickMarker.visible = true;
            return;
          }
        }
        cur = cur.parent;
      }
    }

    // 2. Point-and-click movement on ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.playerPos.y);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(groundPlane, pt)) {
      pt.x = THREE.MathUtils.clamp(pt.x, -30, 30);
      pt.z = THREE.MathUtils.clamp(pt.z, -39, 28);
      this.clickMoveTarget = pt.clone();
      this.clickMarker.position.set(pt.x, groundHeightAt(pt.x, pt.z) + 0.08, pt.z);
      this.clickMarker.visible = true;
    }
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private findNearestInteractable() {
    let best: (typeof this.interactables)[0] | null = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      const d = Math.hypot(item.pos.x - this.playerPos.x, item.pos.z - this.playerPos.z);
      if (d <= item.radius && d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }

  private readGamepadMove(): [number, number] {
    try {
      const pads = navigator.getGamepads?.();
      if (!pads) return [0, 0];
      for (const pad of pads) {
        if (!pad) continue;
        const gx = Math.abs(pad.axes[0] || 0) > 0.2 ? pad.axes[0] : 0;
        const gy = Math.abs(pad.axes[1] || 0) > 0.2 ? pad.axes[1] : 0;
        if (pad.buttons[0]?.pressed) {
          const nearest = this.findNearestInteractable();
          if (nearest) this.callbacks.onInteract(nearest.target);
        }
        if (gx !== 0 || gy !== 0) return [gx, gy];
      }
    } catch {
      // Ignore gamepad permissions
    }
    return [0, 0];
  }

  private updateSimulation(dt: number, elapsed: number) {
    // 1. Movement input (Keyboard + Virtual Joystick + Gamepad + Point-and-Click)
    let mx = 0;
    let mz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    if (mx === 0 && mz === 0 && (Math.abs(this.joystickVec.x) > 0.08 || Math.abs(this.joystickVec.y) > 0.08)) {
      mx = this.joystickVec.x;
      mz = this.joystickVec.y;
    }

    if (mx === 0 && mz === 0) {
      const [gx, gy] = this.readGamepadMove();
      mx = gx;
      mz = gy;
    }

    if (mx !== 0 || mz !== 0) {
      this.clickMoveTarget = null;
      this.clickMarker.visible = false;
    } else if (this.clickMoveTarget) {
      const dx = this.clickMoveTarget.x - this.playerPos.x;
      const dz = this.clickMoveTarget.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) {
        this.clickMoveTarget = null;
        this.clickMarker.visible = false;
      } else {
        mx = dx / dist;
        mz = dz / dist;
      }
    }

    const prevWalkCycle = this.walkCycle;
    const moveStep = this.stepCharacterMovement(
      this.playerRig,
      this.playerPos,
      this.playerFacing,
      this.walkCycle,
      mx,
      mz,
      7.4,
      dt,
      elapsed
    );
    this.playerFacing = moveStep.facing;
    this.walkCycle = moveStep.walkCycle;

    // Detect Zone changes & Proximity Interact Prompt
    const zone = detectZoneAt(this.playerPos.x, this.playerPos.z);
    if (zone.id !== this.lastZoneId) {
      this.lastZoneId = zone.id;
      this.applyAtmosphericLighting();
      audioEngine.setAmbientEnvironment(this.lastZoneId, this.activeWeather, this.dayTime);
      this.callbacks.onZoneChange(zone.id);
    }

    if (moveStep.moved) {
      if (Math.floor(prevWalkCycle / Math.PI) !== Math.floor(moveStep.walkCycle / Math.PI)) {
        const surface = this.detectGroundSurface(this.playerPos.x, this.playerPos.z, zone.id);
        audioEngine.playFootstep(surface);
      }
      this.saveThrottle += dt;
      if (this.saveThrottle > 0.45) {
        this.saveThrottle = 0;
        this.callbacks.onPlayerMove(this.playerPos.x, this.playerPos.z);
      }
    }

    // Keep key directional shadow frustum centered near player along dynamic solar arc
    this.sunLight.position.set(
      this.playerPos.x + this.sunOffset.x,
      this.sunOffset.y,
      this.playerPos.z + this.sunOffset.z
    );
    this.sunLight.target.position.copy(this.playerPos);

    this.cameraRig.setTarget(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.cameraRig.update(dt);

    // Animate fountain spray & crystal gems
    this.textures.water.offset.x = (elapsed * 0.06) % 1;
    this.fountainData.sprayDrops.forEach((drop, idx) => {
      const t = (elapsed * 1.4 + idx / 8) % 1;
      const a = (idx / 8) * Math.PI * 2;
      drop.position.set(Math.cos(a) * t * 0.9, 2.25 + Math.sin(t * Math.PI) * 0.85 - t * 0.4, Math.sin(a) * t * 0.9);
    });
    Object.values(this.fountainData.crystalGems).forEach((gem, idx) => {
      gem.rotation.y = elapsed * 1.3 + idx;
      gem.position.y = 1.18 + Math.sin(elapsed * 2 + idx) * 0.06;
    });

    // Update NPC patrols along their village routes & animate quest markers
    this.updateNpcPatrols(dt, elapsed);

    // Drift Grumble Fog puffs
    for (const p of this.fogPuffs) {
      if (!p.mesh.visible) continue;
      p.mesh.position.x = p.baseX + Math.sin(elapsed * 0.5 + p.phase) * 0.8;
      p.mesh.position.z = p.baseZ + Math.cos(elapsed * 0.4 + p.phase) * 0.6;
      p.mesh.rotation.y = elapsed * 0.2 + p.phase;
    }

    // Pulse germ particles when Germ Goggles active
    if (this.germParticles.visible) {
      this.germParticles.rotation.y = Math.sin(elapsed * 0.5) * 0.04;
    }

    // Real-time time-of-day progression & Global Illumination shift
    if (this.autoDayNight) {
      this.dayTime = (this.dayTime + dt / 180) % 1;
      this.applyAtmosphericLighting();
      this.dayTimeNotifyThrottle += dt;
      if (this.dayTimeNotifyThrottle >= 1.0) {
        this.dayTimeNotifyThrottle = 0;
        this.lastSyncedDayTime = this.dayTime;
        this.callbacks.onDayTimeChange?.(this.dayTime);
      }
    }

    // Animate swaying meadow grass wind uniform
    this.grassUniforms.uGrassTime.value = elapsed;
    this.grassUniforms.uGrassWind.value = this.reduceMotion ? 0.25 : 1 + this.weatherRaininess * 0.55;

    // Update celebration fireworks
    this.updateFireworks(dt);

    // Update dynamic weather (sunny / cloudy / light rain)
    this.updateWeather(dt, elapsed);

    // Update ambient birds & butterflies in Town Square & Misty Forest
    this.updateAmbientCritters(dt, elapsed);

    // Sync listener coordinates & live critter positions to positional ambient wildlife audio
    this.ambientSyncThrottle += dt;
    if (this.ambientSyncThrottle >= 0.25) {
      this.ambientSyncThrottle = 0;
      audioEngine.updateListenerPosition(this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z);
      audioEngine.setAmbientEnvironment(this.lastZoneId, this.activeWeather, this.dayTime);
      this.syncLiveAmbientEmitters();
    }

    const nearest = this.findNearestInteractable();
    const promptKey = nearest ? nearest.label : '';
    if (promptKey !== this.lastPromptKey) {
      this.lastPromptKey = promptKey;
      this.callbacks.onProximityPrompt(nearest ? { label: nearest.label, target: nearest.target } : null);
    }
  }

  private detectGroundSurface(x: number, z: number, zoneId: ZoneId): FootstepSurface {
    // 1. Wood surfaces: Arched West Stream Bridge & Cutaway Cozy Cottage floor
    if (x >= -15.6 && x <= -10.4 && z >= -2.5 && z <= 0.5) {
      return 'wood';
    }
    if (zoneId === 'cozy_cottage' && x >= -21.7 && x <= -15.3 && z >= -27.1 && z <= -21.9) {
      return 'wood';
    }

    // 2. Gravel / Cobblestone surfaces: Town Square Plaza, connecting paths, stairs, running track, arena ring
    if (Math.hypot(x, z) <= 10.6) {
      return 'gravel';
    }
    if (zoneId === 'sports_field') {
      const trackDist = Math.hypot(x - 20, z - 21);
      if (trackDist >= 4.1 && trackDist <= 6.9) {
        return 'gravel';
      }
    }
    if (zoneId === 'misty_forest') {
      const arenaDist = Math.hypot(x, z + 35);
      if (arenaDist >= 4.0 && arenaDist <= 5.1) {
        return 'gravel';
      }
    }
    for (const seg of this.pathSegments) {
      const vx = seg.x2 - seg.x1;
      const vz = seg.z2 - seg.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-4) continue;
      const proj = THREE.MathUtils.clamp(((x - seg.x1) * vx + (z - seg.z1) * vz) / lenSq, 0, 1);
      const px = seg.x1 + proj * vx;
      const pz = seg.z1 + proj * vz;
      if (Math.hypot(x - px, z - pz) <= seg.halfWidth + 0.18) {
        return 'gravel';
      }
    }

    // 3. Grass meadows, sports infield, clinic/bathhouse lawns, and Misty Forest moss
    return 'grass';
  }

  private stepCharacterMovement(
    rig: CharacterRig,
    pos: THREE.Vector3,
    facing: number,
    walkCycle: number,
    mx: number,
    mz: number,
    speed: number,
    dt: number,
    elapsed: number,
    options?: {
      selfObstacle?: ObstacleCircle;
      avoidPos?: THREE.Vector3;
      lookAtPos?: THREE.Vector3;
      phaseOffset?: number;
    }
  ): { facing: number; walkCycle: number; moved: boolean } {
    const moveDt = Math.min(dt, 0.1);
    const moveLen = Math.hypot(mx, mz);
    let nextFacing = facing;
    let nextWalkCycle = walkCycle;
    let moved = false;

    if (moveLen > 0.01) {
      const nx = mx / moveLen;
      const nz = mz / moveLen;
      let nextX = THREE.MathUtils.clamp(pos.x + nx * speed * moveDt, -30, 30);
      let nextZ = THREE.MathUtils.clamp(pos.z + nz * speed * moveDt, -39, 28);

      // Gentle circle collision sliding against world obstacles
      for (const obs of this.obstacles) {
        if (obs === options?.selfObstacle) continue;
        const dx = nextX - obs.x;
        const dz = nextZ - obs.z;
        const dist = Math.hypot(dx, dz);
        const minR = obs.r + 0.45;
        if (dist < minR && dist > 0.001) {
          nextX = obs.x + (dx / dist) * minR;
          nextZ = obs.z + (dz / dist) * minR;
        }
      }

      // Avoid crowding another dynamic actor (e.g. NPC avoiding player)
      if (options?.avoidPos) {
        const dx = nextX - options.avoidPos.x;
        const dz = nextZ - options.avoidPos.z;
        const dist = Math.hypot(dx, dz);
        const minR = 1.05;
        if (dist < minR && dist > 0.001) {
          nextX = options.avoidPos.x + (dx / dist) * minR;
          nextZ = options.avoidPos.z + (dz / dist) * minR;
        }
      }

      pos.set(nextX, groundHeightAt(nextX, nextZ), nextZ);

      const targetYaw = Math.atan2(nx, nz);
      const diff = Math.atan2(
        Math.sin(targetYaw - nextFacing),
        Math.cos(targetYaw - nextFacing)
      );
      nextFacing += diff * Math.min(1, moveDt * 12);

      nextWalkCycle += moveDt * Math.max(5.5, speed * 1.48);
      const swing = Math.sin(nextWalkCycle) * 0.55;
      rig.leftLeg.rotation.x = swing;
      rig.rightLeg.rotation.x = -swing;
      rig.leftArm.rotation.x = -swing * 0.7;
      rig.rightArm.rotation.x = swing * 0.7;
      rig.bodyPivot.position.y = Math.abs(Math.sin(nextWalkCycle)) * 0.06;
      moved = true;
    } else {
      rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 10, moveDt);
      rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 10, moveDt);
      rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0, 10, moveDt);
      rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0, 10, moveDt);
      rig.bodyPivot.position.y = Math.sin(elapsed * 2.4 + (options?.phaseOffset ?? 0)) * 0.02;

      if (options?.lookAtPos) {
        const lx = options.lookAtPos.x - pos.x;
        const lz = options.lookAtPos.z - pos.z;
        if (Math.hypot(lx, lz) > 0.05) {
          const targetYaw = Math.atan2(lx, lz);
          const diff = Math.atan2(
            Math.sin(targetYaw - nextFacing),
            Math.cos(targetYaw - nextFacing)
          );
          nextFacing += diff * Math.min(1, moveDt * 8);
        }
      }
    }

    rig.root.position.copy(pos);
    rig.root.rotation.y = nextFacing;

    return { facing: nextFacing, walkCycle: nextWalkCycle, moved };
  }

  private updateNpcPatrols(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.1);
    const speedScale = this.reduceMotion ? 0.45 : 1;

    for (const agent of this.npcPatrols) {
      const distToPlayer = Math.hypot(
        this.playerPos.x - agent.pos.x,
        this.playerPos.z - agent.pos.z
      );

      let mx = 0;
      let mz = 0;
      let lookAtPos: THREE.Vector3 | undefined;

      if (distToPlayer < 3.1) {
        // Politely pause and face the player when nearby for easy interaction
        lookAtPos = this.playerPos;
      } else if (agent.pauseTimer > 0) {
        agent.pauseTimer -= safeDt;
      } else if (agent.waypoints.length > 0) {
        const wp = agent.waypoints[agent.waypointIndex];
        const dx = wp.x - agent.pos.x;
        const dz = wp.z - agent.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25) {
          agent.waypointIndex = (agent.waypointIndex + 1) % agent.waypoints.length;
          agent.pauseTimer = agent.pauseDuration;
        } else {
          mx = dx / dist;
          mz = dz / dist;
        }
      }

      const step = this.stepCharacterMovement(
        agent.actor.rig,
        agent.pos,
        agent.facing,
        agent.walkCycle,
        mx,
        mz,
        agent.speed * speedScale,
        safeDt,
        elapsed,
        {
          selfObstacle: agent.obstacle,
          avoidPos: this.playerPos,
          lookAtPos,
          phaseOffset: agent.phaseOffset,
        }
      );

      agent.facing = step.facing;
      agent.walkCycle = step.walkCycle;
      agent.actor.baseY = agent.pos.y;
      agent.interactablePos.copy(agent.pos);
      agent.obstacle.x = agent.pos.x;
      agent.obstacle.z = agent.pos.z;

      if (agent.actor.markerMesh.visible) {
        agent.actor.markerMesh.rotation.y = elapsed * 2.2 + agent.phaseOffset;
        agent.actor.markerMesh.position.y = 2.25 + Math.sin(elapsed * 3.2 + agent.phaseOffset) * 0.1;
      }
    }
  }

  private updateAmbientCritters(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.1);
    const motionScale = this.reduceMotion ? 0.4 : 1;
    const tDay = ((this.dayTime % 1) + 1) % 1;
    const isNight = tDay < 0.1 || tDay >= 0.8;
    const isRaining = this.weatherRaininess > 0.55;

    for (const c of this.ambientCritters) {
      // Unlock bonus critters smoothly as Crystals restore; tuck daytime critters gently in rain/night
      const crystalActive = this.crystalsCount >= c.minCrystals;
      let weatherAndTimeActive = true;
      if (c.kind === 'butterfly') {
        if (isRaining) weatherAndTimeActive = false;
        if (isNight && c.zone === 'town_square') weatherAndTimeActive = false;
      } else {
        // Birds roost during heavy night in Town Square; forest birds quiet down mostly at night
        if (isNight && c.zone === 'town_square') weatherAndTimeActive = false;
        if (isRaining && c.phase % 2 > 1.0) weatherAndTimeActive = false;
      }

      const targetVis = crystalActive && weatherAndTimeActive ? c.baseScale : 0;
      c.visScale = THREE.MathUtils.damp(c.visScale, targetVis, 3.2, safeDt);
      if (c.visScale < 0.02) {
        c.group.visible = false;
        continue;
      }
      c.group.visible = true;
      c.group.scale.setScalar(c.visScale);

      // Advance organic Lissajous flight path
      c.flightTime += safeDt * c.speed * motionScale;
      const x = c.centerX + Math.sin(c.flightTime * c.freqX + c.phase) * c.radiusX;
      const z = c.centerZ + Math.cos(c.flightTime * c.freqZ + c.phase * 1.3) * c.radiusZ;

      // Player proximity startle flutter for butterflies (visual + delicate positional wing flutter)
      const distPlayer = Math.hypot(x - this.playerPos.x, z - this.playerPos.z);
      const isStartled = c.kind === 'butterfly' && distPlayer < 2.2;
      const targetStartle = isStartled ? 0.95 : 0;
      if (isStartled && c.startleBoost < 0.15) {
        audioEngine.playButterflyFlutterAt(x, groundHeightAt(x, z) + c.baseAltitude, z);
      }
      c.startleBoost = THREE.MathUtils.damp(c.startleBoost, targetStartle, 4.5, safeDt);

      const y =
        groundHeightAt(x, z) +
        c.baseAltitude +
        Math.sin(elapsed * 2.2 * motionScale + c.phase) * c.bobAmplitude +
        c.startleBoost;

      c.group.position.set(x, y, z);

      // Face along travel direction and gently bank birds into turns
      const dx = x - c.prevX;
      const dz = z - c.prevZ;
      if (dx * dx + dz * dz > 1e-7) {
        const yaw = Math.atan2(dx, dz);
        const yawDelta = Math.atan2(Math.sin(yaw - c.prevYaw), Math.cos(yaw - c.prevYaw));
        c.group.rotation.y = yaw;
        if (c.kind === 'bird') {
          const targetBank = THREE.MathUtils.clamp(-yawDelta * 8, -0.45, 0.45);
          c.group.rotation.z = THREE.MathUtils.damp(c.group.rotation.z, targetBank, 6, safeDt);
        } else {
          c.group.rotation.x = Math.sin(elapsed * 3.1 + c.phase) * 0.16;
        }
        c.prevYaw = yaw;
      }
      c.prevX = x;
      c.prevZ = z;

      // Articulated wing-flap / soar cycle
      const flapMult = c.startleBoost > 0.2 ? 1.85 : 1.0;
      c.flapTime += safeDt * c.flapSpeed * motionScale * flapMult;
      if (c.kind === 'butterfly') {
        const flap = Math.sin(c.flapTime) * 0.95 + 0.15;
        c.leftWing.rotation.z = flap;
        c.rightWing.rotation.z = -flap;
      } else {
        const isGliding = Math.sin(elapsed * 0.9 + c.phase) > 0.45;
        const targetFlap = isGliding ? 0.16 : Math.sin(c.flapTime) * 0.72;
        c.leftWing.rotation.z = THREE.MathUtils.damp(c.leftWing.rotation.z, targetFlap, 14, safeDt);
        c.rightWing.rotation.z = THREE.MathUtils.damp(c.rightWing.rotation.z, -targetFlap, 14, safeDt);
      }
    }
  }

  private syncLiveAmbientEmitters() {
    this.mergedAmbientEmitters.length = 0;
    for (let i = 0; i < this.wildlifeAnchors.length; i++) {
      this.mergedAmbientEmitters.push(this.wildlifeAnchors[i]);
    }
    for (let i = 0; i < this.ambientCritters.length; i++) {
      const c = this.ambientCritters[i];
      if (!c.group.visible) continue;
      this.mergedAmbientEmitters.push({
        kind: c.kind === 'bird' ? 'bird' : 'insect',
        x: c.group.position.x,
        y: c.group.position.y,
        z: c.group.position.z,
      });
    }
    audioEngine.setAmbientEmitters(this.mergedAmbientEmitters);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      // Optional 30 FPS performance cap on GPU devices
      if (!this.isSoftwareGl && this.performanceMode && now - this.lastFrameRenderMs < 32) {
        this.frameId = requestAnimationFrame(tick);
        return;
      }
      this.lastFrameRenderMs = now;

      const dt = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      this.updateSimulation(dt, elapsed);
      this.renderer.render(this.scene, this.cameraRig.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  public dispose() {
    this.disposed = true;
    audioEngine.stopAmbient();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Points ||
        obj instanceof THREE.InstancedMesh ||
        obj instanceof THREE.LineSegments
      ) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.textures.dispose();
    this.fireworkTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
