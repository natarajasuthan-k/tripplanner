// Fixture destinations for PROVIDER_MODE=fake (local dev without an API key, tests, E2E).
import type { ProviderDestination } from '../repositories/destinationRepo';

const CITIES: ProviderDestination[] = [
  ['fake:kyoto', 'Kyoto', 'Kyoto Prefecture', 'Japan', 'JP', 35.0116, 135.7681],
  ['fake:tokyo', 'Tokyo', 'Tokyo', 'Japan', 'JP', 35.6762, 139.6503],
  ['fake:paris', 'Paris', 'Île-de-France', 'France', 'FR', 48.8566, 2.3522],
  ['fake:goa', 'Panaji', 'Goa', 'India', 'IN', 15.4909, 73.8278],
  ['fake:chennai', 'Chennai', 'Tamil Nadu', 'India', 'IN', 13.0827, 80.2707],
  ['fake:munnar', 'Munnar', 'Kerala', 'India', 'IN', 10.0889, 77.0595],
  ['fake:london', 'London', 'England', 'United Kingdom', 'GB', 51.5072, -0.1276],
  ['fake:rome', 'Rome', 'Lazio', 'Italy', 'IT', 41.9028, 12.4964],
  ['fake:barcelona', 'Barcelona', 'Catalonia', 'Spain', 'ES', 41.3874, 2.1686],
  ['fake:newyork', 'New York', 'New York', 'United States', 'US', 40.7128, -74.006],
  ['fake:singapore', 'Singapore', null, 'Singapore', 'SG', 1.3521, 103.8198],
  ['fake:sydney', 'Sydney', 'New South Wales', 'Australia', 'AU', -33.8688, 151.2093],
].map(([providerPlaceId, name, region, country, countryCode, lat, lon]) => ({
  providerPlaceId: providerPlaceId as string,
  name: name as string,
  region: region as string | null,
  country: country as string,
  countryCode: countryCode as string,
  lat: lat as number,
  lon: lon as number,
}));

export function fakeAutocomplete(query: string, limit: number): ProviderDestination[] {
  const q = query.trim().toLowerCase();
  return CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      (c.region ?? '').toLowerCase().includes(q),
  ).slice(0, limit);
}
