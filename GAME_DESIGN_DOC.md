# HealthQuest: Journey to Wellness — Game Design Document

## 1. High-Level Concept
- **Title**: HealthQuest: Journey to Wellness
- **Genre**: Cozy 2.5D Educational Adventure / RPG with Interactive Mini-Games
- **Target Audience**: Ages 8–14 (selectable reading & fact level: Ages 8–10 and Ages 11–14)
- **Tone & Learning Philosophy**: Warm, encouraging, evidence-based (aligned with WHO & CDC public health guidance), never preachy or fear-based. Wrong choices give gentle hints and retries; every quest ends with a "Did You Know?" fact and a reminder to ask a trusted adult or doctor when unwell.

## 2. 2.5D Architecture & Camera Setup
- **Engine**: Three.js WebGL (`SunnybrookWorldEngine`) mounted in an isolated React ref container.
- **2.5D Camera (`CameraRig25D`)**: Fixed-angle perspective camera tilted ~52° downward (`baseOffset = (0, 14.2, 11.2)`, FOV 40°) with frame-rate-independent exponential damping (`THREE.MathUtils.damp`), subtle pointer parallax (disabled when Reduce Motion is enabled), and scripted cinematic sweeps for the Boss Arena and Ending Cutscene.
- **2.5D Ground Movement & Depth**: 8-direction keyboard (`WASD` / Arrows), Point-and-Click ground raycasting, mobile Virtual Joystick, and Gamepad API support constrained along continuous elevated terrain (`groundHeightAt(x, z)`), including an arched bridge and stone stairways.
- **Lighting & Progressive World Restoration**:
  - `RoomEnvironment` IBL + warm sun `DirectionalLight` (soft shadow map) + cool `HemisphereLight` + warm window/lantern `PointLight`s.
  - Day/Night cycle slider + progressive brightening: as Wellness Crystals (1→5) are restored, volumetric Grumble Fog thins, flowers sprout and bloom, village lights warm, and music livens.
- **Cutaway Interior**: Granny Luna's Cozy Cottage uses a cutaway front wall so the 2.5D camera looks straight into the hearth, rug, and quilted bed.

## 3. World Map (8 Connected Zones)
1. **Town Square** (Hub): Wellness Fountain with 5 Crystal Sockets, Elder Rowan, Quest Board, Pip's Wellness Shop.
2. **Bathhouse & Well** (West, via arched wooden bridge): Old Mr. Splash (Hygiene & Clean Water).
3. **Sunnybrook Market** (East): Farmer Fig & Baker Bea (Nutrition & Balanced Meals).
4. **Sports Field** (Southeast): Coach Kiko, running track & hurdles (Exercise & Hydration).
5. **Sunnybrook Clinic** (Southwest): Nurse Nora (Vaccines & Mosquito Patrol).
6. **Cozy Cottage** (Northwest Rise): Granny Luna cutaway interior (Sleep & Mental Wellness).
7. **Sunnybrook School** (Northeast Rise): Teacher Tam (Germ Goggles & Cough Etiquette).
8. **Misty Forest** (Northern Ridge via stone stairs): Swirling Grumble Fog & Boss Arena.

## 4. Quests (16 Total) & 5-Question Chapter Quizzes
- **Hygiene**: *The Great Handwashing Rescue* (20s scrub timer), *Brush Brigade* (sequence), *Clean Water Quest* (water safety). + 5Q Chapter 1 Quiz.
- **Nutrition**: *Rainbow Plate* (meal builder), *Sugar Sneak* (label inspector), *Harvest Helper* (food group sorter). + 5Q Chapter 2 Quiz.
- **Exercise**: *Field Day Fitness* (side-view rhythm hurdles), *Stretch It Out* (warm-up sequence), *Walk the Trail* (cadence & hydration). + 5Q Chapter 3 Quiz.
- **Rest & Mental Wellness**: *Sleepy Sam* (bedtime sequence), *Worry Clouds* (4-3-4 belly breathing guide). + 5Q Chapter 4 Quiz.
- **Disease Prevention**: *Germ Detectives* (UV Germ Goggles hotspot scene), *Sneeze Safe* (etiquette sequence), *Vaccine Visit* (Immune Team drill), *Mosquito Patrol* (tip standing water). + 5Q Chapter 5 Quiz.
- **Final Quest**: *Clear the Grumble Fog* (5-wave Boss Arena challenge) → Cinematic Ending Cutscene + Wellness Report + Free Play Mode with Daily Challenges & Memory Match!

## 5. Asset, Polygon & Texture Budget (100% Zero-404 Procedural)
All 3D models, textures, and audio are procedurally generated at runtime with zero external asset failures:

| Asset Group | Implementation | Polygon Budget | Texture / Audio Budget |
|---|---|---|---|
| Player Apprentice & 8 NPCs | Multi-part `THREE.Group` (12+ parts: boots, legs, torso, belt, scarf, arms, head, hair, hat, goggles, satchel, cape/crown) | ~950 tris per character | Shared PBR materials + `128×128` radial contact shadow |
| Village Buildings (6 landmarks + stalls) | Composite low-poly `THREE.Group` (walls, roofs, windows, cutaway cottage furniture, fountain & crystals) | ~350–900 tris per landmark | `256×256` CanvasTextures (grass, cobble, wood, roof tile, water, track) in `SRGBColorSpace` |
| Nature Perimeter (84 Trees + 90 Flowers) | `THREE.InstancedMesh` trunks, canopies, and blooming wildflowers | ~140 tris per tree (2 draw calls total) | Vertex/instance color variation (±15% scale) |
| Grumble Fog & Germ Particles | 24 translucent `DodecahedronGeometry` puffs + `THREE.Points` germ cloud | ~1,920 tris total | Zero extra textures; toggled by Germ Goggles |
| Audio & Voice | Web Audio API procedural pentatonic synth + chimes + Web Speech API TTS | N/A | Zero external `.mp3`/`.wav` files |
