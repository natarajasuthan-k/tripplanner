// Fixture places for PROVIDER_MODE=fake (local dev, tests).
import type { Place } from '@tripplanner/shared';

const KNOWN: Record<string, [name: string, label: string, description: string][]> = {
  'fake:kyoto': [
    ['Fushimi Inari Taisha', 'Sight', 'Shinto shrine famous for its thousands of torii gates.'],
    ['Kinkaku-ji', 'Heritage site', 'Zen temple covered in gold leaf, beside a reflecting pond.'],
    ['Arashiyama Bamboo Grove', 'Park', 'Towering bamboo paths in western Kyoto.'],
    ['Kyoto National Museum', 'Museum', 'Japanese and Asian art, especially pre-modern.'],
    ['Gion', 'Attraction', 'Historic geisha district with wooden machiya houses.'],
  ],
  'fake:paris': [
    ['Eiffel Tower', 'Sight', 'Wrought-iron lattice tower on the Champ de Mars.'],
    ['Louvre Museum', 'Museum', 'The world’s most-visited art museum.'],
    ['Jardin du Luxembourg', 'Park', 'Formal gardens around the Luxembourg Palace.'],
  ],
};

const CATEGORY: Record<string, string> = {
  Sight: 'tourism.sights',
  'Heritage site': 'heritage',
  Park: 'leisure.park',
  Museum: 'entertainment.museum',
  Attraction: 'tourism.attraction',
};

export function fakePlaces(
  providerPlaceId: string,
  cityName: string,
  lat: number,
  lon: number,
  limit: number,
): Place[] {
  const entries = KNOWN[providerPlaceId] ?? [
    [`${cityName} Old Town`, 'Attraction', `The historic centre of ${cityName}.`],
    [`${cityName} City Museum`, 'Museum', `Local history and culture of ${cityName}.`],
    [`${cityName} Central Park`, 'Park', `A green space in the heart of ${cityName}.`],
  ];
  return entries.slice(0, limit).map(([name, label, description], i) => ({
    id: `fake:${providerPlaceId}:${i}`,
    name,
    category: CATEGORY[label]!,
    categoryLabel: label,
    description,
    address: cityName,
    lat: lat + i * 0.01,
    lon: lon + i * 0.01,
    sourceUrl: null,
    wikipediaUrl: null,
  }));
}
