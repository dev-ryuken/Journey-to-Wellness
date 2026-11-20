# HealthQuest: Journey to Wellness

A complete, playable 2.5D educational adventure RPG built with **React**, **TypeScript**, **Tailwind CSS**, and **Three.js**.

## Quick Setup & Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

For production builds:

```bash
npm run build
npm run lint
```

## Controls
- **Move**: `WASD` / Arrow Keys, Click-to-Move on the ground, Mobile Virtual Joystick, or Gamepad
- **Interact**: `E` / `Space` when near a villager, Quest Board, Shop, or Fountain (or click directly on them)
- **Mini-Map**: Click the Map Pin icon (top-right) to fast-travel between all 8 Sunnybrook zones

## Modular Project Structure
- `src/data/quests.json` — Editable JSON for all 16 quests, WHO/CDC "Did You Know?" facts, and rewards
- `src/data/dialogues.json` — Editable JSON for all 8 NPCs, greetings, hints, and completion lines
- `src/data/quizzes.json` — Editable JSON for the 5-question quizzes at the end of each chapter
- `src/data/zones.ts` & `src/data/items.ts` — 8 connected 2.5D terrain zones (`groundHeightAt`) and shop/inventory catalog
- `src/data/storage.ts` — Browser `localStorage` persistence and Free Play daily challenges
- `src/engine/worldScene.ts` — Three.js 2.5D scene, lighting, day/night cycle, instanced foliage, fog, and movement
- `src/engine/camera.ts` — Fixed-angle (~52°) 2.5D perspective camera with damped follow, parallax, and cutscenes
- `src/engine/models.ts` & `src/engine/materials.ts` — Composite multi-part 3D character/building models & procedural CanvasTextures
- `src/engine/audio.ts` — Procedural Web Audio music/chimes and optional Web Speech API text-to-speech
- `src/components/minigames/` — All playable mini-games & 5-question chapter quizzes
- `GAME_DESIGN_DOC.md` — Complete Game Design Document summary and asset/polygon budget
