module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/__tests__/**/*.spec.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/setup/',
    '/__tests__/__mocks__/',
    '/__tests__/e2e/',
  ],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*|@supabase/.*|@shopify/.*)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'hooks/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx,js}',
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Ratchet, not a target: set just below actual coverage (measured 2026-07-23 at
  // branches 31.03 / functions 34.98 / lines 46.47 / statements 44.97) so CI catches
  // regressions. Raise these as coverage improves.
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 45,
      statements: 40,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  reporters: ['default', '<rootDir>/__tests__/reporters/jestFailuresReporter.js'],
  testEnvironment: 'jsdom',
  // Integration tests mount full screens (Mapbox/Supabase mocks + providers) and
  // can exceed Jest's 5s default when workers run in parallel under --ci.
  testTimeout: 15000,
  globals: {
    __DEV__: true,
  },
};
