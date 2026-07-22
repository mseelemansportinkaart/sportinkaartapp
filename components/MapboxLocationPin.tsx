/**
 * Mapbox-compatible LocationPin Component
 *
 * Custom map marker showing sport emoji, favorite badge, and location dot
 * Compatible with @rnmapbox/maps MarkerView component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MARKER_CONFIG } from '@/lib/mapboxConfig';

export interface MapboxLocationPinProps {
  sportEmoji: string;
  isFavorite: boolean;
  showEmoji: boolean;
  isSelected: boolean;
}

export const MapboxLocationPin: React.FC<MapboxLocationPinProps> = ({
  sportEmoji,
  isFavorite,
  showEmoji,
  isSelected,
}) => {
  return (
    <View style={styles.container}>
      {/* Favorite heart badge - positioned top-left of the tooltip */}
      {isFavorite && showEmoji && (
        <View style={styles.heartBadge}>
          <Text style={styles.heartIcon}>♥</Text>
        </View>
      )}

      {showEmoji && (
        <View style={[styles.tooltip, isSelected && styles.tooltipSelected]}>
          <Text style={styles.emoji}>{sportEmoji}</Text>
          <View style={[styles.tooltipPointer, isSelected && styles.tooltipPointerSelected]} />
        </View>
      )}

      {/* Small blue dot at the bottom (the actual location point) */}
      <View style={styles.blueDot} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heartBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: MARKER_CONFIG.LOCATION_PIN.FAVORITE_BADGE_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  heartIcon: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -1,
  },
  tooltip: {
    backgroundColor: '#f7f4ec',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 19,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 4,
  },
  tooltipSelected: {
    backgroundColor: MARKER_CONFIG.LOCATION_PIN.SELECTED_BACKGROUND_COLOR,
  },
  emoji: {
    fontSize: 10,
  },
  tooltipPointer: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#f7f4ec',
  },
  tooltipPointerSelected: {
    borderTopColor: MARKER_CONFIG.LOCATION_PIN.SELECTED_BACKGROUND_COLOR,
  },
  blueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: MARKER_CONFIG.LOCATION_PIN.SELECTED_BACKGROUND_COLOR,
    borderWidth: MARKER_CONFIG.LOCATION_PIN.BORDER_WIDTH,
    borderColor: MARKER_CONFIG.LOCATION_PIN.BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
});
