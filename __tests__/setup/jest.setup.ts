import '@testing-library/react-native/extend-expect';

// `lib/mapboxRuntime` treats a missing access token as "map unavailable" and the
// screens then render their fallback instead of a map, so the suites that assert
// on markers need a token present. Any non-empty value works — @rnmapbox/maps is
// mocked below, so the token is never sent anywhere.
process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.test-token-not-a-real-credential';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:8081',
    },
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn().mockResolvedValue(true),
  createURL: jest.fn((path) => `sportinkaart://${path}`),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
    GestureHandlerRootView: View,
  };
});

// Mock FlashList
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FlashList: ({ data = [], renderItem, keyExtractor }: any) =>
      React.createElement(
        View,
        { testID: 'flash-list' },
        data.map((item: any, index: number) => {
          const key = keyExtractor ? keyExtractor(item, index) : item.id ?? index;
          return React.createElement(View, { key }, renderItem({ item, index }));
        })
      ),
  };
});

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 3,
  },
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 52.37, longitude: 4.9 },
  }),
}));

jest.mock('expo-linking', () => ({
  openSettings: jest.fn(),
}));

// Mock react-native-maps
const mockAnimateToRegion = jest.fn();
const mockPointForCoordinate = jest.fn().mockResolvedValue({ x: 100, y: 100 });

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: mockAnimateToRegion,
      pointForCoordinate: mockPointForCoordinate,
      getCamera: jest.fn().mockResolvedValue({
        center: { latitude: 52.37, longitude: 4.9 },
        heading: 0,
        pitch: 0,
        zoom: 10,
        altitude: 1000,
      }),
      setCamera: jest.fn(),
      fitToCoordinates: jest.fn(),
    }));

    return React.createElement(View, {
      testID: props.testID || 'map-view',
      ...props,
    }, props.children);
  });

  MockMapView.displayName = 'MapView';

  const MockMarker = (props: any) => {
    return React.createElement(View, {
      testID: props.testID || `marker-${props.identifier || 'default'}`,
      ...props,
    }, props.children);
  };

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: null,
    // Export mock functions for test assertions
    __mockAnimateToRegion: mockAnimateToRegion,
    __mockPointForCoordinate: mockPointForCoordinate,
  };
}, { virtual: true });

jest.mock('supercluster', () => {
  return jest.fn().mockImplementation(() => {
    let points: any[] = [];

    return {
      load: (loadedPoints: any[]) => {
        points = Array.isArray(loadedPoints) ? loadedPoints : [];
      },
      getClusters: () => points,
      getClusterExpansionZoom: () => 14,
      getLeaves: (_clusterId: number, limit: number = Infinity) => points.slice(0, limit),
    };
  });
});

jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mockMapboxSetCamera = jest.fn();
  const mockMapboxFitBounds = jest.fn();

  const MockMapView = ({ children, ...props }: any) =>
    React.createElement(
      View,
      {
        testID: props.testID || 'mapbox-map-view',
        ...props,
      },
      children
    );

  const MockCamera = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      setCamera: mockMapboxSetCamera,
      fitBounds: mockMapboxFitBounds,
    }));

    return React.createElement(View, {
      testID: props.testID || 'mapbox-camera',
      ...props,
    });
  });

  MockCamera.displayName = 'MapboxCamera';

  const MockPointAnnotation = ({ children, ...props }: any) =>
    React.createElement(
      View,
      {
        testID: props.testID || `mapbox-point-${props.id || 'default'}`,
        ...props,
      },
      children
    );

  const MockMarkerView = ({ children, ...props }: any) =>
    React.createElement(
      View,
      {
        testID: props.testID || `marker-${props.id || 'default'}`,
        ...props,
      },
      children
    );

  const MockUserLocation = (props: any) =>
    React.createElement(View, {
      testID: props.testID || 'mapbox-user-location',
      ...props,
    });

  const mockModule = {
    MapView: MockMapView,
    Camera: MockCamera,
    PointAnnotation: MockPointAnnotation,
    MarkerView: MockMarkerView,
    UserLocation: MockUserLocation,
    setAccessToken: jest.fn().mockResolvedValue(null),
    __mockSetCamera: mockMapboxSetCamera,
    __mockFitBounds: mockMapboxFitBounds,
    StyleURL: {
      Street: 'mapbox://styles/mapbox/streets-v11',
    },
  };

  return {
    __esModule: true,
    ...mockModule,
    default: mockModule,
  };
});

// Silence console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Animated:') ||
        args[0].includes('componentWillReceiveProps') ||
        args[0].includes('componentWillMount'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') ||
        args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test utilities
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
