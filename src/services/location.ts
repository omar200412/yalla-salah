import * as Location from 'expo-location';

import { Coords } from '../types';

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error' };

/**
 * Ask for foreground location permission and return the device coordinates.
 * Tries the (instant) last-known position first, then a fresh low-accuracy fix.
 */
export async function detectCoords(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    const position =
      lastKnown ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      }));

    if (!position) {
      return { ok: false, reason: 'unavailable' };
    }

    return {
      ok: true,
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
