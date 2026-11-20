import { InventoryItemDef } from '../types/game';

export const ITEMS: InventoryItemDef[] = [
  {
    id: 'crisp_apple',
    name: 'Orchard Crisp Apple',
    category: 'food',
    price: 15,
    description: 'Sweet, crunchy fruit packed with fiber and vitamin C from Farmer Fig.',
    effectText: '+18 Nutrition · +10 Energy',
    meterRestore: { nutrition: 18, energy: 10 },
    iconKey: 'apple',
  },
  {
    id: 'rainbow_bento',
    name: 'Rainbow Bento Box',
    category: 'food',
    price: 30,
    description: 'Whole-grain wrap, colorful roasted veggies, and protein beans.',
    effectText: '+30 Nutrition · +20 Energy · +10 Mood',
    meterRestore: { nutrition: 30, energy: 20, mood: 10 },
    iconKey: 'utensils',
  },
  {
    id: 'chamomile_tea',
    name: 'Cozy Lavender Tea',
    category: 'food',
    price: 20,
    description: 'Warm, caffeine-free herbal blend brewed by Granny Luna.',
    effectText: '+25 Mood · +15 Energy',
    meterRestore: { mood: 25, energy: 15 },
    iconKey: 'coffee',
  },
  {
    id: 'herbal_soap',
    name: 'Mint Bubble Soap',
    category: 'tool',
    price: 15,
    description: 'Foamy natural soap bar for 20-second germ-busting handwashes.',
    effectText: '+25 Hygiene',
    meterRestore: { hygiene: 25 },
    iconKey: 'sparkles',
  },
  {
    id: 'water_filter_flask',
    name: 'Clean Spring Flask',
    category: 'tool',
    price: 25,
    description: 'Reusable filtered water bottle to stay hydrated on long trails.',
    effectText: '+20 Energy · +10 Hygiene',
    meterRestore: { energy: 20, hygiene: 10 },
    iconKey: 'droplets',
  },
  {
    id: 'first_aid_kit',
    name: 'Sunny Bandage Pack',
    category: 'medicine',
    price: 25,
    description: 'Gentle antiseptic wipes and star bandages from Nurse Nora.',
    effectText: '+20 Hygiene · +15 Mood',
    meterRestore: { hygiene: 20, mood: 15 },
    iconKey: 'heart',
  },
  {
    id: 'jump_rope',
    name: 'Rhythm Jump Rope',
    category: 'tool',
    price: 30,
    description: 'Braided training rope from Coach Kiko for quick energy bursts.',
    effectText: '+25 Mood · +15 Energy',
    meterRestore: { mood: 25, energy: 15 },
    iconKey: 'zap',
  },
  {
    id: 'cosmetic_sun_cape',
    name: 'Sunbeam Explorer Cape',
    category: 'cosmetic',
    price: 55,
    description: 'Golden woven apprentice cloak celebrating Sunnybrook’s wellness.',
    effectText: 'Wearable Apprentice Cosmetic',
    iconKey: 'award',
  },
  {
    id: 'cosmetic_flower_crown',
    name: 'Meadow Blossom Crown',
    category: 'cosmetic',
    price: 45,
    description: 'A cheerful headband of Sunnybrook daisies and clover.',
    effectText: 'Wearable Apprentice Cosmetic',
    iconKey: 'flower',
  },
  {
    id: 'village_lanterns',
    name: 'Warm Plaza Lanterns',
    category: 'village',
    price: 60,
    description: 'Adds extra golden celebration garlands around Town Square!',
    effectText: 'Upgrades Sunnybrook Square',
    iconKey: 'sun',
  },
];

export const ITEM_MAP: Record<string, InventoryItemDef> = ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, InventoryItemDef>
);
