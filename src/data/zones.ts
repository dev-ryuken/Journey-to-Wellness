import { ZoneDefinition, ZoneId } from '../types/game';

export const ZONES: ZoneDefinition[] = [
  {
    id: 'town_square',
    name: 'Town Square',
    subtitle: 'Sunnybrook Heart · Fountain, Quest Board & Shop',
    center: { x: 0, z: 0 },
    elevation: 0,
    radius: 13,
    themeColor: '#10B981',
    ambientMood: 'warm',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'bathhouse',
    name: 'Bathhouse & Well',
    subtitle: 'West Spring · Clean Water & Hygiene',
    center: { x: -23, z: -1 },
    elevation: 0.4,
    radius: 9,
    themeColor: '#0EA5E9',
    ambientMood: 'fresh',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'market',
    name: 'Sunnybrook Market',
    subtitle: 'East Plaza · Fresh Produce & Whole-Grain Bakery',
    center: { x: 23, z: -1 },
    elevation: 0.4,
    radius: 9,
    themeColor: '#F59E0B',
    ambientMood: 'warm',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'sports_field',
    name: 'Sports Field',
    subtitle: 'Southeast Track · Fitness & Teamwork',
    center: { x: 20, z: 21 },
    elevation: 0,
    radius: 10.5,
    themeColor: '#F97316',
    ambientMood: 'fresh',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'clinic',
    name: 'Sunnybrook Clinic',
    subtitle: 'Southwest Terrace · Vaccines & Prevention',
    center: { x: -20, z: 20 },
    elevation: 0.4,
    radius: 9,
    themeColor: '#EF4444',
    ambientMood: 'fresh',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'cozy_cottage',
    name: 'Cozy Cottage',
    subtitle: 'Northwest Rise · Cutaway Hearth, Rest & Calm',
    center: { x: -18, z: -22 },
    elevation: 0.9,
    radius: 8.5,
    themeColor: '#8B5CF6',
    ambientMood: 'cozy',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'school',
    name: 'Sunnybrook School',
    subtitle: 'Northeast Rise · Germ Lab & Classroom',
    center: { x: 18, z: -22 },
    elevation: 0.9,
    radius: 9,
    themeColor: '#14B8A6',
    ambientMood: 'warm',
    unlockRequirementCrystals: 0,
  },
  {
    id: 'misty_forest',
    name: 'Misty Forest',
    subtitle: 'Northern Ridge · Source of the Grumble Fog',
    center: { x: 0, z: -35 },
    elevation: 2.0,
    radius: 11,
    themeColor: '#6366F1',
    ambientMood: 'misty',
    unlockRequirementCrystals: 5,
  },
];

export const ZONE_MAP: Record<ZoneId, ZoneDefinition> = ZONES.reduce(
  (acc, z) => {
    acc[z.id] = z;
    return acc;
  },
  {} as Record<ZoneId, ZoneDefinition>
);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Continuous 2.5D terrain elevation function so ramps, bridges,
 * elevated terraces, and the northern Misty Forest ridge align flush
 * with all buildings, stairs, and character feet.
 */
export function groundHeightAt(x: number, z: number): number {
  let h = 0;

  // Bathhouse west terrace (x <= -14, near z around -1)
  if (x < -11 && z > -13 && z < 11) {
    const t = smoothstep(-11, -15, x);
    h = Math.max(h, 0.4 * t);
  }

  // Market east terrace (x >= 14, near z around -1)
  if (x > 11 && z > -13 && z < 11) {
    const t = smoothstep(11, 15, x);
    h = Math.max(h, 0.4 * t);
  }

  // Clinic southwest terrace
  if (x < -9 && z > 10) {
    const t = smoothstep(-9, -13, x) * smoothstep(10, 14, z);
    h = Math.max(h, 0.4 * t);
  }

  // Northwest Cozy Cottage rise
  if (x < -6 && z < -11) {
    const t = smoothstep(-6, -12, x) * smoothstep(-11, -16, z);
    h = Math.max(h, 0.9 * t);
  }

  // Northeast School rise
  if (x > 6 && z < -11) {
    const t = smoothstep(6, 12, x) * smoothstep(-11, -16, z);
    h = Math.max(h, 0.9 * t);
  }

  // Northern Misty Forest ridge & Grand Stone Stairs (x in -14..14, z <= -14)
  if (z < -13 && x > -15 && x < 15) {
    const t = smoothstep(-13, -25, z);
    h = Math.max(h, 2.0 * t);
  }

  // Arched wooden bridge over west stream at x = -13, z = -1
  if (Math.abs(z + 1) < 2.2 && x > -15.5 && x < -10.5) {
    const bridgeProgress = (x + 15.5) / 5.0; // 0..1
    const arch = Math.sin(bridgeProgress * Math.PI) * 0.45;
    h = Math.max(h, 0.22 + arch);
  }

  return h;
}

export function detectZoneAt(x: number, z: number): ZoneDefinition {
  let closest = ZONES[0];
  let bestDist = Infinity;
  for (const zone of ZONES) {
    const dx = x - zone.center.x;
    const dz = z - zone.center.z;
    const d = Math.hypot(dx, dz) - zone.radius * 0.35;
    if (d < bestDist) {
      bestDist = d;
      closest = zone;
    }
  }
  return closest;
}
