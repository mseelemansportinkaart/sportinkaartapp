# Sportinkaart Testing Suite

This directory contains comprehensive tests for the Sportinkaart mobile application.

## Test Structure

```
__tests__/
├── unit/                    # Unit tests for isolated functions and hooks
│   ├── hooks/               # Tests for custom React hooks
│   ├── contexts/            # Tests for React context providers
│   ├── services/            # Tests for services (email, supabase)
│   └── helpers/             # Tests for helper/utility functions
├── integration/             # Integration tests for component interactions
│   ├── screens/             # Screen-level integration tests
│   └── api/                 # API endpoint tests
├── components/              # Component tests with rendering
├── e2e/                     # End-to-end tests (Detox)
├── __mocks__/               # Mock files for external modules
└── setup/                   # Test setup and configuration
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run E2E tests (requires device/simulator)
npm run test:e2e
```

## Test Categories

### Unit Tests
- **Hooks**: `useDebounce`, `useRegionData`, `useThemeColor`
- **Contexts**: `FavoritesContext`, `LanguageContext`
- **Services**: `emailService`, `supabase client`
- **Helpers**: `transformLocationForLanguage`, `escapeHtml`, etc.

### Integration Tests
- Screen data fetching and rendering
- Form submission flows
- Navigation between screens
- Context interactions across components

### E2E Tests
- Complete user journeys
- Cross-platform behavior
- Performance under real conditions

## Coverage Goals

| Category | Target |
|----------|--------|
| Hooks | 90% |
| Contexts | 90% |
| Services | 85% |
| Screens | 75% |
| Components | 80% |

## Pre-Push Checklist

Before pushing to the store, ensure:
1. All unit tests pass
2. All integration tests pass
3. E2E tests pass on both iOS and Android
4. Coverage thresholds are met
5. No TypeScript errors
6. ESLint passes
