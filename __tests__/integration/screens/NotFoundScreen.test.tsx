import React from 'react';
import { render } from '@testing-library/react-native';
import NotFoundScreen from '@/app/+not-found';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
}));

describe('NotFoundScreen integration', () => {
  it('renders not found message', () => {
    const { getByText } = render(<NotFoundScreen />);

    expect(getByText('This screen does not exist.')).toBeTruthy();
    expect(getByText('Go to home screen!')).toBeTruthy();
  });
});
