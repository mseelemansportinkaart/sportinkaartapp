import { Stack } from 'expo-router';
import React from 'react';
import { FiltersProvider } from '@/contexts/FiltersContext';

export default function RegionLayout() {
  return (
    <FiltersProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </FiltersProvider>
  );
}
