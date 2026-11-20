import * as THREE from 'three';
import { CrystalCategory, PlayerAppearance } from '../types/game';
import { ProceduralTextureSet } from './materials';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  headGroup: THREE.Group;
  gogglesGroup: THREE.Group;
  satchelGroup: THREE.Group;
  capeMesh: THREE.Mesh;
  crownGroup: THREE.Group;
}

function addContactShadow(parent: THREE.Group, tex: THREE.Texture, radius = 0.75) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  parent.add(shadow);
  return shadow;
}

/**
 * Composite 10+ part stylized 3D Apprentice character (bottom-center pivot at y=0).
 * Used both in the Character Creator 3D turntable and in the 2.5D village world.
 */
export function buildCharacterRig(
  appearance: PlayerAppearance,
  contactShadowTex?: THREE.Texture,
  options?: {
    hasSatchel?: boolean;
    gogglesOn?: boolean;
    equippedCosmetic?: string | null;
  }
): CharacterRig {
  const root = new THREE.Group();
  if (contactShadowTex) {
    addContactShadow(root, contactShadowTex, 0.72);
  }

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.72,
    metalness: 0.02,
  });
  const tunicMat = new THREE.MeshStandardMaterial({
    color: appearance.tunicColor,
    roughness: 0.85,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.6,
    metalness: 0.1,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.82,
    metalness: 0.04,
  });

  // Legs (pivot near hip)
  const legGeo = new THREE.CylinderGeometry(0.11, 0.095, 0.5, 10);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.15, 0.28, 0);
  leftLeg.castShadow = true;
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.15, 0.28, 0);
  rightLeg.castShadow = true;
  bodyPivot.add(rightLeg);

  // Boots attached to legs
  const bootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.26);
  const lBoot = new THREE.Mesh(bootGeo, bootMat);
  lBoot.position.set(0, -0.22, 0.04);
  leftLeg.add(lBoot);

  const rBoot = new THREE.Mesh(bootGeo, bootMat);
  rBoot.position.set(0, -0.22, 0.04);
  rightLeg.add(rBoot);

  // Torso tunic
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.56, 12), tunicMat);
  torso.position.set(0, 0.78, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Belt & brass buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.295, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 })
  );
  belt.position.set(0, 0.58, 0);
  bodyPivot.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.09, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.28, metalness: 0.8 })
  );
  buckle.position.set(0, 0.58, 0.28);
  bodyPivot.add(buckle);

  // Neck scarf
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.85 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 1.05, 0);
  bodyPivot.add(scarf);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.44, 8);
  const leftArm = new THREE.Mesh(armGeo, tunicMat);
  leftArm.position.set(-0.33, 0.82, 0);
  leftArm.rotation.z = 0.18;
  leftArm.castShadow = true;
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, tunicMat);
  rightArm.position.set(0.33, 0.82, 0);
  rightArm.rotation.z = -0.18;
  rightArm.castShadow = true;
  bodyPivot.add(rightArm);

  const handGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const lHand = new THREE.Mesh(handGeo, skinMat);
  lHand.position.set(0, -0.23, 0);
  leftArm.add(lHand);
  const rHand = new THREE.Mesh(handGeo, skinMat);
  rHand.position.set(0, -0.23, 0);
  rightArm.add(rHand);

  // Head group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.32, 0);
  bodyPivot.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Friendly eyes + rosy cheeks
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
  const eyeGeo = new THREE.SphereGeometry(0.036, 8, 8);
  const lEye = new THREE.Mesh(eyeGeo, eyeMat);
  lEye.position.set(-0.1, 0.03, 0.27);
  const rEye = new THREE.Mesh(eyeGeo, eyeMat);
  rEye.position.set(0.1, 0.03, 0.27);
  headGroup.add(lEye, rEye);

  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.9 });
  const cheekGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const lCheek = new THREE.Mesh(cheekGeo, cheekMat);
  lCheek.scale.set(1.2, 0.7, 0.5);
  lCheek.position.set(-0.17, -0.04, 0.24);
  const rCheek = lCheek.clone();
  rCheek.position.x = 0.17;
  headGroup.add(lCheek, rCheek);

  // Hair styles
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.315, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.rotation.x = -0.2;
  headGroup.add(hairCap);

  if (appearance.hairStyle === 'bob') {
    const backBob = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.28, 12), hairMat);
    backBob.position.set(0, -0.06, -0.06);
    headGroup.add(backBob);
  } else if (appearance.hairStyle === 'spiky') {
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), hairMat);
      spike.position.set(i * 0.09, 0.28, 0.05 - Math.abs(i) * 0.04);
      spike.rotation.z = -i * 0.25;
      spike.rotation.x = 0.2;
      headGroup.add(spike);
    }
  } else if (appearance.hairStyle === 'braids') {
    const lBraid = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.36, 8), hairMat);
    lBraid.position.set(-0.26, -0.14, -0.04);
    lBraid.rotation.z = 0.15;
    const rBraid = lBraid.clone();
    rBraid.position.x = 0.26;
    rBraid.rotation.z = -0.15;
    headGroup.add(lBraid, rBraid);
  } else if (appearance.hairStyle === 'curly') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), hairMat);
      puff.position.set(Math.cos(a) * 0.24, 0.12 + (i % 2) * 0.08, Math.sin(a) * 0.22 - 0.05);
      headGroup.add(puff);
    }
  }

  // Hat styles
  if (appearance.hatStyle === 'explorer') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.05, 16), hatMat);
    brim.position.set(0, 0.22, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.22, 14), hatMat);
    crown.position.set(0, 0.33, 0);
    const ribbon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.28, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.6 })
    );
    ribbon.position.set(0, 0.26, 0);
    headGroup.add(brim, crown, ribbon);
  } else if (appearance.hatStyle === 'beanie') {
    const beanieMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.9 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.325, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), beanieMat);
    dome.position.set(0, 0.1, 0);
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 })
    );
    pom.position.set(0, 0.44, -0.03);
    headGroup.add(dome, pom);
  } else if (appearance.hatStyle === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.75 });
    const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    capDome.position.set(0, 0.1, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.26), capMat);
    visor.position.set(0, 0.12, 0.3);
    headGroup.add(capDome, visor);
  }

  // Germ Goggles accessory
  const gogglesGroup = new THREE.Group();
  const goggleFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.6 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.2,
  });
  const lLens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12), goggleFrameMat);
  lLens.rotation.x = Math.PI / 2;
  lLens.position.set(-0.11, 0.04, 0.3);
  const rLens = lLens.clone();
  rLens.position.x = 0.11;
  const lGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.075, 12), lensMat);
  lGlass.rotation.x = Math.PI / 2;
  lGlass.position.set(-0.11, 0.04, 0.31);
  const rGlass = lGlass.clone();
  rGlass.position.x = 0.11;
  gogglesGroup.add(lLens, rLens, lGlass, rGlass);
  gogglesGroup.visible = Boolean(options?.gogglesOn);
  headGroup.add(gogglesGroup);

  // Flower Crown cosmetic
  const crownGroup = new THREE.Group();
  const stemRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.025, 6, 18),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })
  );
  stemRing.rotation.x = Math.PI / 2;
  stemRing.position.y = 0.2;
  crownGroup.add(stemRing);
  const flowerColors = [0xfef08a, 0xf472b6, 0x38bdf8, 0xfb923c, 0xa78bfa];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fl = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.6 })
    );
    fl.position.set(Math.cos(a) * 0.33, 0.21, Math.sin(a) * 0.33);
    crownGroup.add(fl);
  }
  crownGroup.visible = options?.equippedCosmetic === 'cosmetic_flower_crown';
  headGroup.add(crownGroup);

  // Healing Satchel backpack
  const satchelGroup = new THREE.Group();
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.78 })
  );
  bag.position.set(0, 0.78, -0.32);
  const bagCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.05, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  bagCross.position.set(0, 0.78, -0.415);
  const bagCrossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.14, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  bagCrossV.position.set(0, 0.78, -0.415);
  satchelGroup.add(bag, bagCross, bagCrossV);
  satchelGroup.visible = Boolean(options?.hasSatchel);
  bodyPivot.add(satchelGroup);

  // Sunbeam Explorer Cape cosmetic
  const capeGeo = new THREE.BoxGeometry(0.48, 0.62, 0.04);
  const capeMesh = new THREE.Mesh(
    capeGeo,
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 })
  );
  capeMesh.position.set(0, 0.72, -0.29);
  capeMesh.rotation.x = 0.14;
  capeMesh.visible = options?.equippedCosmetic === 'cosmetic_sun_cape';
  bodyPivot.add(capeMesh);

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    gogglesGroup,
    satchelGroup,
    capeMesh,
    crownGroup,
  };
}

export interface NpcActor {
  id: string;
  group: THREE.Group;
  rig: CharacterRig;
  markerMesh: THREE.Mesh;
  baseY: number;
}

const NPC_PRESETS: Record<
  string,
  { skin: string; tunic: string; hair: string; hat: PlayerAppearance['hatStyle']; hairStyle: PlayerAppearance['hairStyle']; propColor: number }
> = {
  elder_rowan: { skin: '#EAC09E', tunic: '#047857', hair: '#E2E8F0', hat: 'none', hairStyle: 'bob', propColor: 0x92400e },
  mr_splash: { skin: '#D9A17C', tunic: '#0284C7', hair: '#CBD5E1', hat: 'beanie', hairStyle: 'bob', propColor: 0x38bdf8 },
  baker_bea: { skin: '#C6865C', tunic: '#EA580C', hair: '#451A03', hat: 'cap', hairStyle: 'curly', propColor: 0xfbbf24 },
  farmer_fig: { skin: '#E5B28A', tunic: '#65A30D', hair: '#78350F', hat: 'explorer', hairStyle: 'spiky', propColor: 0xef4444 },
  coach_kiko: { skin: '#8D5524', tunic: '#E11D48', hair: '#1E293B', hat: 'cap', hairStyle: 'spiky', propColor: 0xfacc15 },
  granny_luna: { skin: '#F1C7A8', tunic: '#7C3AED', hair: '#F1F5F9', hat: 'none', hairStyle: 'braids', propColor: 0xc4b5fd },
  teacher_tam: { skin: '#D19A72', tunic: '#0D9488', hair: '#3B2F2F', hat: 'none', hairStyle: 'bob', propColor: 0x34d399 },
  nurse_nora: { skin: '#F3CBB0', tunic: '#F8FAFC', hair: '#9A3412', hat: 'none', hairStyle: 'braids', propColor: 0xef4444 },
};

export function buildNpcActor(npcId: string, contactShadowTex: THREE.Texture): NpcActor {
  const preset = NPC_PRESETS[npcId] ?? NPC_PRESETS.elder_rowan;
  const rig = buildCharacterRig(
    {
      name: npcId,
      ageBracket: '8-10',
      skinTone: preset.skin,
      hairStyle: preset.hairStyle,
      hairColor: preset.hair,
      tunicColor: preset.tunic,
      hatStyle: preset.hat,
    },
    contactShadowTex
  );

  // Add signature prop for Elder Rowan's staff or Nurse Nora's medical badge
  if (npcId === 'elder_rowan') {
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 1.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 })
    );
    staff.position.set(0.42, 0.78, 0.14);
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.5, roughness: 0.2 })
    );
    orb.position.set(0.42, 1.58, 0.14);
    rig.bodyPivot.add(staff, orb);
  } else {
    const charm = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: preset.propColor, roughness: 0.45 })
    );
    charm.position.set(0.36, 0.76, 0.2);
    rig.bodyPivot.add(charm);
  }

  // Floating Quest Indicator Diamond above NPC head
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.3,
  });
  const markerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), markerMat);
  markerMesh.position.set(0, 2.25, 0);
  rig.root.add(markerMesh);

  return {
    id: npcId,
    group: rig.root,
    rig,
    markerMesh,
    baseY: 0,
  };
}

/**
 * Builds the Town Square central Wellness Fountain with 5 Crystal Shrine Gems
 */
export function buildWellnessFountain(tex: ProceduralTextureSet): {
  group: THREE.Group;
  waterDisc: THREE.Mesh;
  sprayDrops: THREE.Mesh[];
  crystalGems: Record<CrystalCategory, THREE.Mesh>;
} {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.78,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.6,
    metalness: 0.12,
  });

  // Outer basin ring (low-poly octagon)
  const basinBase = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.55, 12), stoneMat);
  basinBase.position.y = 0.275;
  basinBase.castShadow = true;
  basinBase.receiveShadow = true;
  group.add(basinBase);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.2, 8, 16), trimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.56;
  group.add(rim);

  // Shimmering water disc
  const waterMat = new THREE.MeshStandardMaterial({
    map: tex.water,
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.25,
  });
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.48, 2.48, 0.08, 16), waterMat);
  waterDisc.position.y = 0.48;
  group.add(waterDisc);

  // Central carved pillar & upper bowl
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.5, 10), stoneMat);
  pillar.position.y = 1.1;
  pillar.castShadow = true;
  group.add(pillar);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.45, 0.35, 12), trimMat);
  topBowl.position.y = 1.75;
  topBowl.castShadow = true;
  group.add(topBowl);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), stoneMat);
  finial.position.y = 2.15;
  group.add(finial);

  // Animated water spray particles
  const sprayDrops: THREE.Mesh[] = [];
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    roughness: 0.1,
  });
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), dropMat);
    drop.position.set(0, 2.3, 0);
    group.add(drop);
    sprayDrops.push(drop);
  }

  // 5 Wellness Crystal sockets mounted around the fountain rim
  const crystalConfigs: Array<{ cat: CrystalCategory; color: number }> = [
    { cat: 'hygiene', color: 0x0ea5e9 },
    { cat: 'nutrition', color: 0xf59e0b },
    { cat: 'exercise', color: 0xf97316 },
    { cat: 'rest', color: 0xa855f7 },
    { cat: 'prevention', color: 0x10b981 },
  ];
  const crystalGems = {} as Record<CrystalCategory, THREE.Mesh>;

  crystalConfigs.forEach((cfg, idx) => {
    const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * 2.62;
    const pz = Math.sin(angle) * 2.62;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.42, 8), trimMat);
    pedestal.position.set(px, 0.72, pz);
    group.add(pedestal);

    const gemMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.color,
      emissiveIntensity: 0.08,
      roughness: 0.2,
      metalness: 0.35,
      transparent: true,
      opacity: 0.35,
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), gemMat);
    gem.position.set(px, 1.18, pz);
    group.add(gem);
    crystalGems[cfg.cat] = gem;
  });

  return { group, waterDisc, sprayDrops, crystalGems };
}

/**
 * Builds composite multi-part stylized village buildings (bottom-center pivot y=0)
 */
export function buildVillageBuilding(
  kind: 'clinic' | 'market' | 'bathhouse' | 'school' | 'cottage_cutaway' | 'quest_board' | 'shop_stall',
  tex: ProceduralTextureSet
): { group: THREE.Group; windowMaterials: THREE.MeshStandardMaterial[] } {
  const group = new THREE.Group();
  const windowMaterials: THREE.MeshStandardMaterial[] = [];

  const wallCream = new THREE.MeshStandardMaterial({ color: 0xfef9ef, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ map: tex.roofTile, roughness: 0.72 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });

  const makeWindowMat = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.2,
      roughness: 0.2,
    });
    windowMaterials.push(m);
    return m;
  };

  if (kind === 'quest_board') {
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), woodMat);
    postL.position.set(-1.1, 1.1, 0);
    const postR = postL.clone();
    postR.position.x = 1.1;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.35, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 })
    );
    board.position.set(0, 1.45, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.85), roofMat);
    roof.position.set(0, 2.25, 0.05);
    roof.rotation.x = 0.2;
    const noteColors = [0xfef08a, 0xbae6fd, 0xbef264, 0xfecdd3];
    for (let i = 0; i < 4; i++) {
      const note = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.44, 0.03),
        new THREE.MeshStandardMaterial({ color: noteColors[i], roughness: 0.8 })
      );
      note.position.set(-0.62 + i * 0.42, 1.46 + (i % 2 === 0 ? 0.1 : -0.1), 0.09);
      note.rotation.z = (i - 1.5) * 0.06;
      group.add(note);
    }
    group.add(postL, postR, board, roof);
    return { group, windowMaterials };
  }

  if (kind === 'shop_stall') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 1.5), woodMat);
    base.position.set(0, 0.5, 0);
    base.castShadow = true;
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), woodMat);
    postL.position.set(-1.3, 1.2, -0.65);
    const postR = postL.clone();
    postR.position.x = 1.3;
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.18, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7 })
    );
    awning.position.set(0, 2.35, 0.15);
    awning.rotation.x = 0.22;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.22, 0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.7 })
    );
    stripe.position.set(0, 2.22, 0.85);
    stripe.rotation.x = 0.22;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.55), woodMat);
    crate.position.set(-0.6, 1.22, 0.1);
    const apple = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    apple.position.set(-0.6, 1.52, 0.1);
    group.add(base, postL, postR, awning, stripe, crate, apple);
    return { group, windowMaterials };
  }

  if (kind === 'cottage_cutaway') {
    // Cutaway-wall cozy cottage: back wall, side walls, half-front roof edge, open front view!
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 5.2), woodMat);
    floor.position.set(0, 0.12, 0);
    floor.receiveShadow = true;

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.0, 0.3), wallCream);
    backWall.position.set(0, 1.62, -2.45);
    backWall.castShadow = true;

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 5.0), wallCream);
    leftWall.position.set(-3.05, 1.62, 0);
    leftWall.castShadow = true;

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 5.0), wallCream);
    rightWall.position.set(3.05, 1.62, 0);
    rightWall.castShadow = true;

    // Back-sloped roof so front interior stays visible from 2.5D camera!
    const roofBack = new THREE.Mesh(
      new THREE.BoxGeometry(6.9, 0.28, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.75 })
    );
    roofBack.position.set(0, 3.45, -1.2);
    roofBack.rotation.x = -0.35;
    roofBack.castShadow = true;

    // Cozy interior rug
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.95 })
    );
    rug.position.set(0, 0.26, 0.4);

    // Stone fireplace & warm hearth glow
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.6, 0.9), stoneMat);
    chimney.position.set(0, 1.8, -1.9);
    const fireGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfb923c, emissive: 0xf97316, emissiveIntensity: 1.4 })
    );
    fireGlow.position.set(0, 0.6, -1.45);

    // Cozy quilt bed
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.2), woodMat);
    bedFrame.position.set(-1.95, 0.45, -0.9);
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.22, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.9 })
    );
    blanket.position.set(-1.95, 0.72, -0.65);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.45), wallCream);
    pillow.position.set(-1.95, 0.76, -1.68);

    // Warm window on right wall
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.9), makeWindowMat());
    win.position.set(2.92, 1.75, -0.5);

    group.add(floor, backWall, leftWall, rightWall, roofBack, rug, chimney, fireGlow, bedFrame, blanket, pillow, win);
    return { group, windowMaterials };
  }

  if (kind === 'clinic') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.0, 4.4), wallCream);
    body.position.set(0, 1.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 1.7, 4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 3.85, 0);
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.75, 0.15), woodMat);
    door.position.set(0, 0.88, 2.22);
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.35 });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.26, 0.14), crossMat);
    crossH.position.set(0, 2.35, 2.25);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.14), crossMat);
    crossV.position.set(0, 2.35, 2.25);
    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.12), makeWindowMat());
    winL.position.set(-1.7, 1.65, 2.22);
    const winR = winL.clone();
    winR.position.x = 1.7;

    // Mosquito Patrol rainwater pots on porch
    const pot1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.24, 0.48, 10),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
    );
    pot1.position.set(-2.3, 0.24, 2.75);
    const pot2 = pot1.clone();
    pot2.position.set(2.3, 0.24, 2.75);

    group.add(body, roof, door, crossH, crossV, winL, winR, pot1, pot2);
    return { group, windowMaterials };
  }

  if (kind === 'market') {
    const stall1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.8), woodMat);
    stall1.position.set(-2.0, 0.55, -1.2);
    stall1.castShadow = true;
    const awning1 = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.2, 2.3),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.72 })
    );
    awning1.position.set(-2.0, 2.3, -1.0);
    awning1.rotation.x = 0.2;

    const stall2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.8), woodMat);
    stall2.position.set(2.2, 0.55, -1.2);
    stall2.castShadow = true;
    const awning2 = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.2, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.72 })
    );
    awning2.position.set(2.2, 2.3, -1.0);
    awning2.rotation.x = 0.2;

    for (const sx of [-3.3, -0.7, 0.9, 3.5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.3, 8), woodMat);
      p.position.set(sx, 1.15, -1.9);
      group.add(p);
    }
    const bread = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
    );
    bread.scale.set(1.4, 0.7, 1);
    bread.position.set(2.2, 1.25, -1.1);
    const veggie = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 })
    );
    veggie.position.set(-2.0, 1.25, -1.1);

    group.add(stall1, awning1, stall2, awning2, bread, veggie);
    return { group, windowMaterials };
  }

  if (kind === 'bathhouse') {
    const house = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.7, 4.0), stoneMat);
    house.position.set(-0.8, 1.35, -1.5);
    house.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.9, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.65 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-0.8, 3.45, -1.5);

    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.12), makeWindowMat());
    win.position.set(-0.8, 1.6, 0.52);

    // Stone Water Well next to bathhouse
    const wellRing = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.85, 12), stoneMat);
    wellRing.position.set(2.8, 0.425, 0.4);
    wellRing.castShadow = true;
    const wellWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.08, 12),
      new THREE.MeshStandardMaterial({ map: tex.water, color: 0x38bdf8, roughness: 0.15 })
    );
    wellWater.position.set(2.8, 0.78, 0.4);
    const wellPostL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), woodMat);
    wellPostL.position.set(2.05, 1.4, 0.4);
    const wellPostR = wellPostL.clone();
    wellPostR.position.x = 3.55;
    const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 4), roofMat);
    wellRoof.rotation.y = Math.PI / 4;
    wellRoof.position.set(2.8, 2.35, 0.4);

    group.add(house, roof, win, wellRing, wellWater, wellPostL, wellPostR, wellRoof);
    return { group, windowMaterials };
  }

  // Default: schoolhouse
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(6.0, 3.1, 4.4),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.82 })
  );
  body.position.set(0, 1.55, 0);
  body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.7, 1.8, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 4.0, 0);
  roof.castShadow = true;
  const bellTower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), wallCream);
  bellTower.position.set(0, 4.6, 0);
  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 })
  );
  bell.position.set(0, 4.65, 0);
  const chalkboard = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.0, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.9 })
  );
  chalkboard.position.set(-1.5, 1.55, 2.25);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.75, 0.15), woodMat);
  door.position.set(0.6, 0.88, 2.22);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.12), makeWindowMat());
  win.position.set(2.0, 1.65, 2.22);
  group.add(body, roof, bellTower, bell, chalkboard, door, win);
  return { group, windowMaterials };
}
