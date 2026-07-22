import { render } from '@testing-library/react-native';
import React from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// Mock useThemeColor hook
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn((props, colorName) => {
    // Return light mode colors by default
    const lightColors: Record<string, string> = {
      text: '#11181C',
      background: '#fff',
    };
    return lightColors[colorName] || '#000';
  }),
}));

describe('ThemedText', () => {
  it('should render correctly with default props', () => {
    const { toJSON } = render(<ThemedText>Test Text</ThemedText>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render correctly with title type', () => {
    const { toJSON } = render(<ThemedText type="title">Title Text</ThemedText>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render correctly with subtitle type', () => {
    const { toJSON } = render(<ThemedText type="subtitle">Subtitle Text</ThemedText>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render correctly with defaultSemiBold type', () => {
    const { toJSON } = render(
      <ThemedText type="defaultSemiBold">SemiBold Text</ThemedText>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render correctly with link type', () => {
    const { toJSON } = render(<ThemedText type="link">Link Text</ThemedText>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should apply custom style', () => {
    const { toJSON } = render(
      <ThemedText style={{ fontSize: 20 }}>Custom Style Text</ThemedText>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render with lightColor and darkColor props', () => {
    const { toJSON } = render(
      <ThemedText lightColor="#000" darkColor="#fff">
        Themed Text
      </ThemedText>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

describe('ThemedView', () => {
  it('should render correctly with default props', () => {
    const { toJSON } = render(<ThemedView />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render children correctly', () => {
    const { toJSON } = render(
      <ThemedView>
        <ThemedText>Child Text</ThemedText>
      </ThemedView>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('should apply custom style', () => {
    const { toJSON } = render(
      <ThemedView style={{ padding: 20, margin: 10 }} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('should render with lightColor and darkColor props', () => {
    const { toJSON } = render(
      <ThemedView lightColor="#f0f0f0" darkColor="#1a1a1a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
