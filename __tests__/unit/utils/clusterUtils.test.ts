jest.mock('supercluster', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { getClusterCountText } from '@/utils/clusterUtils';

describe('clusterUtils.getClusterCountText', () => {
  it('returns exact, non-abbreviated counts', () => {
    expect(getClusterCountText(999)).toBe('999');
    expect(getClusterCountText(1000)).toBe('1000');
    expect(getClusterCountText(12500)).toBe('12500');
  });

  it('sanitizes invalid values', () => {
    expect(getClusterCountText(-10)).toBe('0');
    expect(getClusterCountText(Number.NaN)).toBe('0');
  });
});
