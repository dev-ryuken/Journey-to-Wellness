import { WeatherType } from '../types/game';

export type DayPhase = 'sunrise' | 'noon' | 'sunset' | 'night';

export function getDayPhase(dayTime: number): DayPhase {
  const t = ((dayTime % 1) + 1) % 1;
  if (t < 0.1 || t >= 0.8) return 'night';
  if (t < 0.3) return 'sunrise';
  if (t < 0.65) return 'noon';
  return 'sunset';
}

const TIME_GREETINGS: Record<DayPhase, string[]> = {
  sunrise: [
    'Good morning! That warm orange sunrise makes all of Sunnybrook glow.',
    'Rise and shine! Nothing beats crisp morning air to start a healthy day.',
    'Look at that golden dawn light—a fresh morning full of new adventures!',
  ],
  noon: [
    'What a bright midday! The sun is high above the Wellness Fountain.',
    'Happy afternoon, Apprentice! Bright daylight keeps everyone energized.',
    'Midday check-in! Remember to pause for a sip of water while exploring.',
  ],
  sunset: [
    'What a peaceful orange sunset—the village lanterns are starting to warm up.',
    'Golden hour in Sunnybrook! Look at the long cozy shadows across the square.',
    'The evening sky is turning warm amber—hope you had an active, joyful day!',
  ],
  night: [
    'Good evening! Look how the lanterns shine against the deep blue night sky.',
    'Quiet starry night in Sunnybrook—wind-down time is just around the corner.',
    'Even in the cool blue moonlight, the village feels safe and cozy tonight.',
  ],
};

const WEATHER_GREETINGS: Record<WeatherType, string[]> = {
  sunny: [
    'Clear, cheerful sunshine today—great weather for a walk on the trails!',
    'Not a raindrop in sight! The wildflowers are loving this sunshine.',
  ],
  cloudy: [
    'Soft, breezy clouds drifting overhead—nice cool weather for exploring!',
    'A calm cloudy sky keeps the village cool and comfortable for a stroll.',
  ],
  rain: [
    'Listen to that gentle patter of rain—great excuse to splash cleanly and stay cozy!',
    'A soft shower is washing the cobblestones fresh and green today.',
  ],
};

const COMBO_GREETINGS: Partial<Record<`${DayPhase}_${WeatherType}`, string[]>> = {
  sunrise_sunny: [
    'A bright, sunny sunrise! Best time of day to stretch and breathe in fresh air.',
  ],
  sunrise_rain: [
    'Warm orange dawn peeking through gentle morning rain—Sunnybrook looks magical!',
  ],
  noon_sunny: [
    'Bright white noon sunshine! Great time for outdoor play—just stay hydrated!',
  ],
  noon_rain: [
    'A refreshing midday rain shower! Watch the ripples dance on the puddles.',
  ],
  sunset_sunny: [
    'Warm orange sunset glow across a clear sky—what a lovely end to the afternoon!',
  ],
  sunset_cloudy: [
    'Amber sunset light peeking behind the clouds gives the square a cozy glow.',
  ],
  night_rain: [
    'Cool blue night and gentle rain—the cottage hearth and lanterns feel extra warm!',
  ],
  night_sunny: [
    'Clear deep-blue night sky above Sunnybrook—calm, quiet, and peaceful.',
  ],
};

const NPC_ENV_QUIPS: Record<
  string,
  Partial<Record<DayPhase | WeatherType, string[]>>
> = {
  elder_rowan: {
    sunrise: ['I always greet the sunrise by the Wellness Fountain with a deep breath.'],
    night: ['Under the dark blue night sky, Sunnybrook’s lanterns remind us we’re all neighbors.'],
    rain: ['Gentle rain nourishes the meadows—and reminds us how precious clean water is!'],
  },
  mr_splash: {
    rain: ['Free spring water from the sky! Still, remember to wash with soap after splashing!'],
    noon: ['Bright midday sun makes a cool splash by the well feel extra refreshing!'],
    sunrise: ['Morning scrub-up time! Warm sunrise light and sparkling clean hands go together.'],
  },
  baker_bea: {
    cloudy: ['Cloudy skies make the bakery ovens feel extra toasty—want a warm whole-grain roll?'],
    sunrise: ['Fresh whole-wheat loaves just came out of the oven with the sunrise!'],
    night: ['Kitchen’s winding down for the night—herbal tea and a light snack before rest!'],
  },
  farmer_fig: {
    rain: ['Hear that soft rain on the orchard leaves? Nothing helps crisp apples grow better!'],
    sunny: ['Plenty of sunshine today—the berries and leafy greens are soaking up every ray!'],
    sunset: ['Harvesting under an orange sunset sky is my favorite part of the day.'],
  },
  coach_kiko: {
    sunrise: ['Catching the early sunrise is awesome for a gentle morning warm-up!'],
    noon: ['Midday energy check! Remember to take water breaks when you run laps in bright sun.'],
    rain: ['Light rain on the track just adds extra sparkle—watch your footing and have fun!'],
    night: ['Even champions rest at night! Gentle evening stretches help muscles recover.'],
  },
  granny_luna: {
    night: ['The deep blue night is nature’s gentle cue to dim screens and rest your eyes, dear.'],
    sunset: ['As the orange sunset fades, a warm mug of chamomile and a good book work wonders.'],
    rain: ['Doesn’t gentle rain against the cottage roof sound wonderfully soothing?'],
  },
  teacher_tam: {
    sunset: ['Look how that orange sunset stretches the shadows—nature’s own science lesson!'],
    cloudy: ['Cool cloudy weather is ideal for outdoor observations around the schoolyard.'],
    noon: ['Bright white noon light makes it easy to inspect every clue in the schoolhouse!'],
  },
  nurse_nora: {
    rain: ['Rainy days mean we keep an extra eye on flowerpots so standing water doesn’t collect!'],
    noon: ['Bright midday out there—remember shade, hats, and water whenever you play outdoors!'],
    night: ['Clinic lanterns stay lit all night long so everyone knows help is always nearby.'],
  },
};

export function pickNpcGreetingModifier(
  npcId: string,
  weather: WeatherType,
  dayTime: number
): string {
  const phase = getDayPhase(dayTime);
  const candidates: string[] = [
    ...(TIME_GREETINGS[phase] ?? []),
    ...(WEATHER_GREETINGS[weather] ?? []),
    ...(COMBO_GREETINGS[`${phase}_${weather}`] ?? []),
  ];

  const npcQuips = NPC_ENV_QUIPS[npcId];
  if (npcQuips) {
    if (npcQuips[phase]) candidates.push(...npcQuips[phase]!);
    if (npcQuips[weather]) candidates.push(...npcQuips[weather]!);
  }

  if (candidates.length === 0) return '';
  return candidates[Math.floor(Math.random() * candidates.length)];
}
