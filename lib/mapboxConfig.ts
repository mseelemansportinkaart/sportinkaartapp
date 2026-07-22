/**
 * Mapbox Configuration
 *
 * Central configuration for all Mapbox map instances in the app.
 * Includes map styles, initial regions, clustering parameters, and marker settings.
 */

// Map Styles
export const MAPBOX_STYLES = {
  CUSTOM: 'mapbox://styles/mseeleman/cmlbgd677001201r0cgluhfi6',
  STREET: 'mapbox://styles/mapbox/streets-v12',
  LIGHT: 'mapbox://styles/mapbox/light-v11',
  DARK: 'mapbox://styles/mapbox/dark-v11',
  OUTDOORS: 'mapbox://styles/mapbox/outdoors-v12',
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

// Default map style for the app
export const DEFAULT_MAP_STYLE = MAPBOX_STYLES.CUSTOM;

// Netherlands center coordinates (fallback for region calculation)
export const NETHERLANDS_CENTER = {
  latitude: 52.1326,
  longitude: 5.2913,
  latitudeDelta: 2.5,
  longitudeDelta: 2.5,
};

// Clustering Configuration
export const CLUSTERING_CONFIG = {
  // Cluster radius in pixels
  RADIUS: 35,

  // Minimum zoom level to show clusters
  MIN_ZOOM: 0,

  // Maximum zoom level to show clusters (stops clustering at this zoom)
  MAX_ZOOM: 16,

  // Cluster size in pixels
  CLUSTER_SIZE: {
    HOME: 30,      // Homepage map
    FULL_MAP: 30,  // Full map screen
    REGION: 42,    // Region detail map
  },

  // Cluster color scheme
  COLORS: {
    BACKGROUND: '#04e1b2',  // Primary teal
    TEXT: '#0b2419',        // Dark text on teal
    BORDER: '#000000',      // Black border
  },

  // Scale factors for cluster size based on point count
  SCALE_FACTOR: {
    BASE: 1,
    MAX: 1.35,
    MULTIPLIER: 0.0035, // Scale increases by 0.35% per point
  },
};

// Marker Configuration
export const MARKER_CONFIG = {
  // Marker image paths
  IMAGES: {
    GREEN_PIN: require('../assets/images/pin_groen_60.png'),
    GRAY_PIN: require('../assets/images/pin_grijs_60.png'),
  },

  // Marker sizes
  SIZES: {
    SMALL: { width: 30, height: 30 },
    MEDIUM: { width: 40, height: 40 },
    LARGE: { width: 60, height: 60 },
  },

  // Location pin configuration (for region maps)
  LOCATION_PIN: {
    SIZE: 50,
    BORDER_WIDTH: 2,
    BORDER_COLOR: '#000000',
    BACKGROUND_COLOR: '#ffffff',
    SELECTED_BACKGROUND_COLOR: '#04e1b2',
    FAVORITE_BADGE_COLOR: '#ef4444',
  },
};

// Camera Animation Configuration
export const CAMERA_CONFIG = {
  // Animation duration in milliseconds
  DURATION: 800,

  // Camera padding (prevents markers at screen edges)
  EDGE_PADDING: {
    top: 50,
    left: 50,
    right: 50,
    bottom: 50,
  },

  // Zoom levels
  ZOOM: {
    CITY: 12,
    REGION: 8,
    COUNTRY: 5,
    LOCATION_DETAIL: 15,
  },

  // Delta threshold for showing emoji pins (when zoomed in enough)
  EMOJI_THRESHOLD: 0.05,
};

// Map Control Settings
export const MAP_CONTROLS = {
  // Show compass control
  SHOW_COMPASS: true,

  // Show scale bar
  SHOW_SCALE: true,

  // Enable rotation
  ROTATE_ENABLED: false,

  // Enable pitch/tilt
  PITCH_ENABLED: false,

  // Enable zoom
  ZOOM_ENABLED: true,

  // Enable scroll
  SCROLL_ENABLED: true,
};

// Map bounds calculation settings
export const BOUNDS_CONFIG = {
  // Padding multiplier for calculated bounds (1.5 = 150% of max distance)
  PADDING_MULTIPLIER: 1.5,

  // Minimum delta values to prevent over-zooming
  MIN_DELTA: {
    latitude: 0.01,
    longitude: 0.01,
  },

  // Maximum delta values to prevent under-zooming
  MAX_DELTA: {
    latitude: 10,
    longitude: 10,
  },
};

// Performance Settings
export const PERFORMANCE_CONFIG = {
  // Maximum markers to render before clustering is required
  MAX_MARKERS_WITHOUT_CLUSTERING: 100,

  // Debounce time for region change events (milliseconds)
  REGION_CHANGE_DEBOUNCE: 200,

  // Enable native rendering optimization
  NATIVE_RENDER: true,
};

// Type definitions for configuration
export type MapStyle = typeof MAPBOX_STYLES[keyof typeof MAPBOX_STYLES];
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
