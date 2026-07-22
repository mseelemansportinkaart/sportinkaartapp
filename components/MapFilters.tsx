import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type MapFiltersProps = {
  toggleLabel: string;
  resetLabel: string;
  activeCount: number;
  onToggle: () => void;
  onReset: () => void;
};

export function MapFilters({
  toggleLabel,
  resetLabel,
  activeCount,
  onToggle,
  onReset,
}: MapFiltersProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <Text style={styles.toggleText}>{toggleLabel}</Text>
        {activeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      {activeCount > 0 && (
        <TouchableOpacity style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetText}>{resetLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5, 15, 8, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#04e1b2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#0b2419',
    fontSize: 10,
    fontWeight: '700',
  },
  resetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  resetText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
