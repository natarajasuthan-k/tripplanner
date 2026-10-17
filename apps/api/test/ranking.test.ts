// Ranking and de-duplication of Geoapify data (findings on live data after the first deploy).
import { describe, expect, it } from 'vitest';
import { mergeDuplicateDestinations } from '../src/integrations/geoapify';
import { rankPlaces, type GeoapifyPlaceProps } from '../src/integrations/geoapifyPlaces';

let id = 0;
const place = (name: string, categories: string[], wiki = false): GeoapifyPlaceProps => ({
  place_id: `p${++id}`,
  name,
  categories,
  lat: 13.05,
  lon: 80.27,
  ...(wiki ? { wiki_and_media: { wikidata: `Q${id}` } } : {}),
});

describe('rankPlaces', () => {
  it('puts notable sights ahead of neighbourhood parks (Chennai finding)', () => {
    const raw = [
      ...Array.from({ length: 12 }, (_, i) => place(`Local Park ${i}`, ['leisure.park'])),
      place('Mahatma Gandhi', ['tourism.sights.memorial']),
      place('Fort St. George', ['tourism.sights.fort', 'heritage'], true),
      place('Government Museum', ['entertainment.museum'], true),
      place('Marina Beach', ['beach'], true),
      place('Kapaleeshwarar Temple', ['religion.place_of_worship.hinduism'], true),
      place('Valluvar Kottam', ['tourism.sights'], true),
      place('Small Shrine', ['religion.place_of_worship']),
      place('Guindy National Park', ['leisure.park'], true),
    ];
    const names = rankPlaces(raw, 30).map((p) => p.name);

    // Notable places first: by weight (fort/museum 5, beach 4, sight 3, worship 2, park 1).
    expect(names.slice(0, 6)).toEqual([
      'Fort St. George',
      'Government Museum',
      'Marina Beach',
      'Valluvar Kottam',
      'Kapaleeshwarar Temple',
      'Guindy National Park',
    ]);
    // Only 6 notable results, so un-notable ones fill the list up to 10.
    expect(names).toHaveLength(10);
    expect(names.slice(6)).not.toContain('Fort St. George');
  });

  it('drops un-notable parks and shrines when there are enough good results', () => {
    const raw = [
      ...Array.from({ length: 12 }, (_, i) => place(`Sight ${i}`, ['tourism.sights'])),
      place('Corner Park', ['leisure.park']),
      place('Small Shrine', ['religion.place_of_worship']),
    ];
    const names = rankPlaces(raw, 30).map((p) => p.name);
    expect(names).toHaveLength(12);
    expect(names).not.toContain('Corner Park');
    expect(names).not.toContain('Small Shrine');
  });

  it('labels by the most specific rule and merges duplicate names', () => {
    const raw = [
      place('Fort St. George', ['tourism.sights.fort'], true),
      place('fort st. george', ['heritage'], true),
      place('Kapaleeshwarar Temple', ['religion.place_of_worship.hinduism'], true),
    ];
    expect(rankPlaces(raw, 30).map((p) => [p.name, p.categoryLabel])).toEqual([
      ['Fort St. George', 'Fort'],
      ['Kapaleeshwarar Temple', 'Place of worship'],
    ]);
  });

  it('respects the limit', () => {
    const raw = Array.from({ length: 40 }, (_, i) =>
      place(`Museum ${i}`, ['entertainment.museum']),
    );
    expect(rankPlaces(raw, 30)).toHaveLength(30);
  });
});

describe('mergeDuplicateDestinations', () => {
  const kyoto = (providerPlaceId: string, region: string | null, lat = 35.0115754) => ({
    providerPlaceId,
    name: 'Kyoto',
    region,
    country: 'Japan',
    countryCode: 'JP',
    lat,
    lon: 135.7681441,
  });

  it('keeps one entry per city, preferring the one with a region (Kyoto finding)', () => {
    const merged = mergeDuplicateDestinations([kyoto('a', null), kyoto('b', 'Kyoto Prefecture')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ providerPlaceId: 'b', region: 'Kyoto Prefecture' });
  });

  it('keeps genuinely different places with the same name', () => {
    const merged = mergeDuplicateDestinations([
      kyoto('a', 'Kyoto Prefecture'),
      { ...kyoto('c', 'Elsewhere', 10), lon: 20 },
    ]);
    expect(merged.map((d) => d.providerPlaceId)).toEqual(['a', 'c']);
  });

  it('keeps first-seen order and drops repeated place ids', () => {
    const paris = { ...kyoto('p', 'Ile-de-France', 48.85), name: 'Paris', countryCode: 'FR' };
    const merged = mergeDuplicateDestinations([paris, kyoto('a', null), paris]);
    expect(merged.map((d) => d.name)).toEqual(['Paris', 'Kyoto']);
  });
});
