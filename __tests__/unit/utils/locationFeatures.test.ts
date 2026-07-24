import {
  buildLocationFeatureCollection,
  collectEmojiIcons,
  getEmojiIconKey,
} from '@/utils/locationFeatures';

const football = {
  id: 'loc-1',
  latitude: 52.37,
  longitude: 5.22,
  sports: ['Voetbal'],
  sport: 'Voetbal',
};

const tennis = {
  id: 'loc-2',
  latitude: 52.35,
  longitude: 5.25,
  sports: ['Tennis'],
  sport: 'Tennis',
};

describe('getEmojiIconKey', () => {
  it('produces a stable ascii key per emoji', () => {
    expect(getEmojiIconKey('⚽️')).toBe('sport-emoji-26bd-fe0f');
    expect(getEmojiIconKey('🎾')).toBe('sport-emoji-1f3be');
  });

  it('produces distinct keys for distinct emoji', () => {
    expect(getEmojiIconKey('⚽️')).not.toBe(getEmojiIconKey('🎾'));
  });
});

describe('buildLocationFeatureCollection', () => {
  it('maps locations to point features with the properties the layers need', () => {
    const collection = buildLocationFeatureCollection([football], () => true);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(1);

    const feature = collection.features[0];
    expect(feature.geometry.coordinates).toEqual([5.22, 52.37]);
    expect(feature.properties).toEqual({
      id: 'loc-1',
      emoji: '⚽️',
      emojiIcon: 'sport-emoji-26bd-fe0f',
      isFavorite: true,
    });
  });

  it('flags favorites per location', () => {
    const collection = buildLocationFeatureCollection(
      [football, tennis],
      (location) => location.id === 'loc-2'
    );

    expect(collection.features.map((f) => f.properties.isFavorite)).toEqual([
      false,
      true,
    ]);
  });

  it('drops locations without finite coordinates', () => {
    const broken = { ...football, id: 'loc-3', latitude: Number.NaN };
    const collection = buildLocationFeatureCollection([football, broken], () => false);

    expect(collection.features.map((f) => f.properties.id)).toEqual(['loc-1']);
  });
});

describe('collectEmojiIcons', () => {
  it('returns each emoji once', () => {
    const icons = collectEmojiIcons([football, { ...football, id: 'x' }, tennis]);

    expect(icons).toEqual([
      { key: 'sport-emoji-26bd-fe0f', emoji: '⚽️' },
      { key: 'sport-emoji-1f3be', emoji: '🎾' },
    ]);
  });

  it('falls back to the trophy emoji for unknown sports', () => {
    const icons = collectEmojiIcons([
      { id: 'y', latitude: 1, longitude: 1, sports: ['Onbekend'] },
    ]);

    expect(icons).toEqual([{ key: getEmojiIconKey('🏆'), emoji: '🏆' }]);
  });
});
