/**
 * Mapbox-compatible ClusterMarker Component
 *
 * Renders a cluster of markers with count display
 * Compatible with @rnmapbox/maps MarkerView component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CLUSTERING_CONFIG } from '@/lib/mapboxConfig';
import { calculateClusterSize, getClusterCountText } from '@/utils/clusterUtils';

export interface MapboxClusterMarkerProps {
  count: number;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const MapboxClusterMarker: React.FC<MapboxClusterMarkerProps> = ({
  count,
  size = 'medium',
}) => {
  // Get base size based on screen context
  const baseSize = 
    size === 'small' 
      ? CLUSTERING_CONFIG.CLUSTER_SIZE.HOME 
      : size === 'large'
      ? CLUSTERING_CONFIG.CLUSTER_SIZE.REGION
      : CLUSTERING_CONFIG.CLUSTER_SIZE.FULL_MAP;

  // Calculate dynamic size based on count
  const computedSize = calculateClusterSize(count, baseSize);
  const clusterSize = Number.isFinite(computedSize) && computedSize > 0 ? Math.round(computedSize) : baseSize;
  const label = getClusterCountText(count);

  // Scale font size based on cluster size
  const fontSize = Math.max(12, Math.min(24, clusterSize * 0.28));

  return (
    <View
      style={[
        styles.container,
        {
          width: clusterSize,
          height: clusterSize,
          borderRadius: clusterSize / 2,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={[styles.text, { fontSize }]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: CLUSTERING_CONFIG.COLORS.BACKGROUND,
    borderWidth: 2,
    borderColor: CLUSTERING_CONFIG.COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    color: CLUSTERING_CONFIG.COLORS.TEXT,
    fontWeight: '800',
    textAlign: 'center',
  },
});
