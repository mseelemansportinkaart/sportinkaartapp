export type ClusterFeature = {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

function toFinite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeClusterFeature(feature: ClusterFeature): ClusterFeature {
  const properties = feature?.properties ?? {};
  const isCluster = Boolean(properties.cluster);
  const isVisible = properties.isVisible === true;

  const rawTotalCount = toFinite(properties.totalCount) ?? toFinite(properties.point_count) ?? (isCluster ? 0 : 1);
  const rawVisibleCount =
    toFinite(properties.visibleCount) ??
    (isCluster ? toFinite(properties.point_count) : isVisible ? 1 : 0) ??
    0;

  const totalPointCount = Math.max(0, Math.round(rawTotalCount));
  const visiblePointCount = Math.max(0, Math.round(rawVisibleCount));

  return {
    ...feature,
    properties: {
      ...properties,
      total_point_count: totalPointCount,
      visible_point_count: visiblePointCount,
    },
  };
}

export function shouldRenderClusterFeature(feature: ClusterFeature): boolean {
  const normalized = normalizeClusterFeature(feature);
  const properties = normalized.properties ?? {};

  if (Boolean(properties.cluster)) {
    return Number(properties.visible_point_count) > 0;
  }

  return properties.isVisible === true;
}

export function normalizeAndFilterClusterFeatures(features: ClusterFeature[]): ClusterFeature[] {
  return features.map(normalizeClusterFeature).filter(shouldRenderClusterFeature);
}
