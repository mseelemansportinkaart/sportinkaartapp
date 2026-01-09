import { QueryClientProvider } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { queryClient } from '@/lib/queryClient';

export default function TabLayout() {

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <FavoritesProvider>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#04e1b2',
            tabBarInactiveTintColor: '#7a9d92',
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              display: 'none',
            },
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="lelystad"
            options={{
              title: 'Lelystad',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="favorites"
            options={{
              title: 'Favorieten',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} />,
            }}
          />
        </Tabs>
        </FavoritesProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}