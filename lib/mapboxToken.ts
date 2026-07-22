/**
 * Mapbox Access Token Configuration
 *
 * Retrieves the Mapbox access token from environment variables.
 * The token should be set in .env file as EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
 */

import Constants from 'expo-constants';

/**
 * Gets the Mapbox access token from environment variables
 * @returns The Mapbox access token or undefined if not set
 */
export function getMapboxAccessToken(): string | undefined {
  // Try to get from process.env first (for Expo)
  const envToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (envToken) return envToken;

  // Fall back to Constants.expoConfig.extra
  const extraToken = Constants.expoConfig?.extra?.mapboxAccessToken;
  if (extraToken) return extraToken;

  return undefined;
}

/**
 * Validates if a Mapbox access token is present and has the correct format
 * @param token The token to validate
 * @returns true if token is valid format, false otherwise
 */
export function isValidMapboxToken(token: string | undefined): boolean {
  if (!token) return false;
  // Mapbox tokens start with 'pk.' for public tokens or 'sk.' for secret tokens
  return token.startsWith('pk.') || token.startsWith('sk.');
}

/**
 * Gets and validates the Mapbox access token
 * @throws Error if token is not configured or invalid
 */
export function requireMapboxToken(): string {
  const token = getMapboxAccessToken();

  if (!token) {
    throw new Error(
      'Mapbox access token not found. Please set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env file.\n' +
      'Get your token from: https://account.mapbox.com/access-tokens/'
    );
  }

  if (!isValidMapboxToken(token)) {
    throw new Error(
      'Invalid Mapbox access token format. Token should start with "pk." or "sk."'
    );
  }

  return token;
}
