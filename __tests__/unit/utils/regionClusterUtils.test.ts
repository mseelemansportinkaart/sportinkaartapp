import {
  normalizeAndFilterClusterFeatures,
  normalizeClusterFeature,
  shouldRenderClusterFeature,
  type ClusterFeature,
} from '@/utils/regionClusterUtils';

function pointFeature(properties: Record<string, any>): ClusterFeature {
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Point',
      coordinates: [4.9, 52.37],
    },
  };
}

describe('regionClusterUtils', () => {
  it('normalizes cluster counts and keeps mixed-visibility clusters', () => {
    const feature = pointFeature({
      cluster: true,
      cluster_id: 42,
      totalCount: 12,
      visibleCount: 5,
      point_count: 12,
    });

    const normalized = normalizeClusterFeature(feature);

    expect(normalized.properties.total_point_count).toBe(12);
    expect(normalized.properties.visible_point_count).toBe(5);
    expect(normalized.properties.total_point_count).toBeGreaterThan(
      normalized.properties.visible_point_count
    );
    expect(shouldRenderClusterFeature(normalized)).toBe(true);
  });

  it('filters out fully hidden clusters and hidden leaves', () => {
    const features: ClusterFeature[] = [
      pointFeature({
        cluster: true,
        cluster_id: 1,
        totalCount: 10,
        visibleCount: 0,
        point_count: 10,
      }),
      pointFeature({
        cluster: true,
        cluster_id: 2,
        totalCount: 9,
        visibleCount: 2,
        point_count: 9,
      }),
      pointFeature({
        id: 'visible-leaf',
        cluster: false,
        isVisible: true,
        totalCount: 1,
        visibleCount: 1,
      }),
      pointFeature({
        id: 'hidden-leaf',
        cluster: false,
        isVisible: false,
        totalCount: 1,
        visibleCount: 0,
      }),
    ];

    const normalized = normalizeAndFilterClusterFeatures(features);
    const ids = normalized.map((item) => item.properties.cluster_id ?? item.properties.id);

    expect(ids).toContain(2);
    expect(ids).toContain('visible-leaf');
    expect(ids).not.toContain(1);
    expect(ids).not.toContain('hidden-leaf');
  });
});
