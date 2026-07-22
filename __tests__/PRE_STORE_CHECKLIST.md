# Pre-Store Submission Checklist

Use this checklist before submitting a new build to the App Store or Google Play.

## Automated Checks (CI/CD)

- [ ] **ESLint passes** - `npm run lint`
- [ ] **TypeScript compiles** - `npm run typecheck`
- [ ] **Unit tests pass** - `npm run test:unit`
- [ ] **Integration tests pass** - `npm run test:integration`
- [ ] **Coverage thresholds met** - `npm run test:coverage`

## E2E Tests

- [ ] **iOS E2E tests pass** - `npm run test:e2e:ios`
- [ ] **Android E2E tests pass** - `npm run test:e2e:android`

## Manual Testing Checklist

### Core Functionality

- [ ] App launches without crash
- [ ] Home screen displays regions correctly
- [ ] Region navigation works (active regions only)
- [ ] Location list loads and displays
- [ ] Search functionality works with debounce
- [ ] All filters work correctly (sport, facilities, cost)
- [ ] Pagination works for long location lists

### Favorites

- [ ] Can add location to favorites
- [ ] Can remove location from favorites
- [ ] Favorites persist after app restart
- [ ] Favorites screen displays correctly
- [ ] Search within favorites works
- [ ] Statistics display correctly

### Language

- [ ] Dutch is default language
- [ ] Can switch to English
- [ ] All UI elements translate correctly
- [ ] Content displays in selected language

### Forms

- [ ] Suggestion form opens correctly
- [ ] "Add Location" form validates input
- [ ] "Change Information" form validates input
- [ ] "Other Question" opens email client
- [ ] Form submission works
- [ ] Error messages display correctly

### Performance

- [ ] App loads in < 3 seconds
- [ ] Scrolling is smooth (60fps)
- [ ] No memory leaks during extended use
- [ ] Images load efficiently

### Platform-Specific

#### iOS
- [ ] Works on iPhone SE (smallest screen)
- [ ] Works on iPhone 15 Pro Max (largest screen)
- [ ] Works on iPad (if supported)
- [ ] Haptic feedback works
- [ ] Safe area insets respected
- [ ] Dark mode works

#### Android
- [ ] Works on small screens (320dp width)
- [ ] Works on tablets (if supported)
- [ ] Back button works correctly
- [ ] Status bar styling correct
- [ ] Dark mode works

### Security

- [ ] No sensitive data in logs
- [ ] API keys not exposed in code
- [ ] Rate limiting works on email API
- [ ] XSS prevention in email content

### Accessibility

- [ ] VoiceOver/TalkBack works
- [ ] Touch targets are 44pt minimum
- [ ] Color contrast meets WCAG AA
- [ ] Dynamic type supported

## Version & Build

- [ ] Version number incremented
- [ ] Build number incremented
- [ ] Changelog updated
- [ ] Release notes prepared

## App Store Specific

### iOS (App Store Connect)
- [ ] Screenshots updated (all device sizes)
- [ ] App preview video (optional)
- [ ] Description updated
- [ ] Keywords optimized
- [ ] Privacy policy URL valid
- [ ] Support URL valid
- [ ] App Review Information complete

### Android (Google Play Console)
- [ ] Screenshots updated (phone + tablet)
- [ ] Feature graphic updated
- [ ] Store listing updated
- [ ] Content rating questionnaire complete
- [ ] Privacy policy URL valid

## Final Steps

1. Run full validation: `npm run validate`
2. Build release: `eas build --platform all --profile production`
3. Test release build on physical devices
4. Submit to stores
5. Monitor crash reports after release

---

## Quick Commands

```bash
# Full validation before push
npm run validate

# Build for testing
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Test Coverage Requirements

| Category | Minimum Coverage |
|----------|-----------------|
| Hooks | 90% |
| Contexts | 90% |
| Services | 85% |
| Helpers | 90% |
| Screens | 75% |
| Components | 80% |
| Overall | 75% |
