import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AgeBracket, PlayerAppearance } from '../types/game';
import { buildCharacterRig } from '../engine/models';
import { audioEngine } from '../engine/audio';

interface CharacterCreatorProps {
  initial: PlayerAppearance;
  onComplete: (appearance: PlayerAppearance) => void;
}

const SKIN_TONES = ['#FDE2C8', '#F1C29B', '#D99E73', '#B8764C', '#8D5524', '#5C381C'];
const HAIR_COLORS = ['#1E293B', '#5C3A21', '#B45309', '#D97706', '#7C2D12', '#64748B'];
const TUNIC_COLORS = ['#10B981', '#0EA5E9', '#F59E0B', '#E11D48', '#8B5CF6', '#0D9488'];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ initial, onComplete }) => {
  const [appearance, setAppearance] = useState<PlayerAppearance>(initial);
  const mountRef = useRef<HTMLDivElement>(null);
  const rigGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth || 320;
    const h = container.clientHeight || 360;

    let isSoft = false;
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) isSoft = true;
      else {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      }
    } catch {
      isSoft = true;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: !isSoft, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(isSoft ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.2, 30);
    camera.position.set(0, 1.45, 3.6);
    camera.lookAt(0, 0.9, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x86efac, 0.85);
    const key = new THREE.DirectionalLight(0xfffbeb, 1.4);
    key.position.set(2.5, 4, 3);
    scene.add(hemi, key);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.08, 0.22, 20),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 })
    );
    pedestal.position.y = -0.11;
    scene.add(pedestal);

    const rig = buildCharacterRig(appearance);
    rigGroupRef.current = rig.root;
    scene.add(rig.root);

    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      const dt = clock.getDelta();
      if (rigGroupRef.current) {
        rigGroupRef.current.rotation.y += dt * 0.75;
      }
      renderer.render(scene, camera);
      if (isSoft) {
        frameId = window.setTimeout(tick, 90);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const prevYaw = rigGroupRef.current?.rotation.y ?? 0;
    if (rigGroupRef.current) {
      scene.remove(rigGroupRef.current);
    }
    const nextRig = buildCharacterRig(appearance);
    nextRig.root.rotation.y = prevYaw;
    rigGroupRef.current = nextRig.root;
    scene.add(nextRig.root);
  }, [appearance]);

  const update = <K extends keyof PlayerAppearance>(key: K, value: PlayerAppearance[K]) => {
    audioEngine.playChime('tap');
    setAppearance((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start md:items-center justify-center bg-[#FAFAF8] p-3 sm:p-5 overflow-y-auto hq-scroll">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-12 my-auto">
        {/* Left: 3D Turntable Preview */}
        <div className="md:col-span-5 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200 p-5 sm:p-6 flex flex-col items-center justify-between">
          <div className="text-center">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Create Your Apprentice
            </h1>
            <p className="mt-1 text-xs text-slate-500">Sunnybrook Village</p>
          </div>

          <div
            ref={mountRef}
            className="w-full h-44 sm:h-56 md:h-76 rounded-lg bg-slate-100/70 border border-slate-200/80 my-4"
            aria-label="Rotating 3D character preview"
          />

          <p className="text-xs text-slate-500 text-center">
            Restore all 5 Wellness Crystals across Sunnybrook.
          </p>
        </div>

        {/* Right: Customization Form */}
        <div className="md:col-span-7 p-5 sm:p-6 md:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={appearance.name}
                  onChange={(e) => setAppearance((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Reading Level
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['8-10', '11-14'] as AgeBracket[]).map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => update('ageBracket', age)}
                      className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        appearance.ageBracket === age
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ages {age}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Skin Tone</label>
              <div className="flex flex-wrap gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    aria-label={`Skin tone ${tone}`}
                    onClick={() => update('skinTone', tone)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      appearance.skinTone === tone ? 'border-slate-900 scale-110' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: tone }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Hair Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['bob', 'spiky', 'braids', 'curly'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => update('hairStyle', style)}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        appearance.hairStyle === style
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Hat Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['explorer', 'beanie', 'cap', 'none'] as const).map((hat) => (
                    <button
                      key={hat}
                      type="button"
                      onClick={() => update('hatStyle', hat)}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        appearance.hatStyle === hat
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {hat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Hair Color</label>
                <div className="flex flex-wrap gap-2">
                  {HAIR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      aria-label={`Hair color ${col}`}
                      onClick={() => update('hairColor', col)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        appearance.hairColor === col ? 'border-slate-900 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Outfit Color</label>
                <div className="flex flex-wrap gap-2">
                  {TUNIC_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      aria-label={`Tunic color ${col}`}
                      onClick={() => update('tunicColor', col)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        appearance.tunicColor === col ? 'border-slate-900 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400">Saved locally</span>
            <button
              type="button"
              onClick={() => {
                audioEngine.playChime('success');
                onComplete({
                  ...appearance,
                  name: appearance.name.trim() || 'Avery',
                });
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Start Adventure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
