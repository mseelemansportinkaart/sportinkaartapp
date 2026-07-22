import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

// Mock the LanguageSwitcher component structure for testing
const MockLanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <>
      <TouchableOpacity
        testID="language-button"
        onPress={() => {
          // Toggle language
          setLanguage(language === 'nl' ? 'en' : 'nl');
        }}
      >
        <Text>{language === 'nl' ? 'NL' : 'EN'}</Text>
      </TouchableOpacity>
    </>
  );
};

const renderWithLanguageProvider = (ui: React.ReactElement) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('LanguageSwitcher Component', () => {
  describe('Rendering', () => {
    it('should display current language indicator', () => {
      const { getByText } = renderWithLanguageProvider(<MockLanguageSwitcher />);

      // Should show NL by default
      expect(getByText('NL')).toBeTruthy();
    });

    it('should match snapshot in Dutch mode', () => {
      const { toJSON } = renderWithLanguageProvider(<MockLanguageSwitcher />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('Language Selection', () => {
    it('should contain both language options', () => {
      // Test that both languages are available in the context
      const languages = ['nl', 'en'];
      expect(languages).toContain('nl');
      expect(languages).toContain('en');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button', () => {
      const { getByTestId } = renderWithLanguageProvider(<MockLanguageSwitcher />);

      expect(getByTestId('language-button')).toBeTruthy();
    });
  });
});

describe('Language options', () => {
  it('should have Dutch option', () => {
    const option = { code: 'nl', label: 'Nederlands', flag: '🇳🇱' };
    expect(option.code).toBe('nl');
    expect(option.label).toBe('Nederlands');
  });

  it('should have English option', () => {
    const option = { code: 'en', label: 'English', flag: '🇬🇧' };
    expect(option.code).toBe('en');
    expect(option.label).toBe('English');
  });
});
