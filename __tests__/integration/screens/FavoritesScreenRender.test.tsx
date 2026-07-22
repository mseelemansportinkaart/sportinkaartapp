import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../setup/test-utils';
import FavoritesScreen from '@/app/(tabs)/favorites';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

describe('FavoritesScreen render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);
  });

  it('renders the empty favorites state', async () => {
    const { getByText } = renderWithProviders(<FavoritesScreen />);

    await waitFor(() => getByText('Nog geen favorieten'));

    expect(getByText('Mijn favorieten')).toBeTruthy();
    expect(getByText('Nog geen favorieten')).toBeTruthy();
  });
});
