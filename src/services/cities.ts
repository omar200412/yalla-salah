import { City } from '../types';

/**
 * Bundled fallback city list, used when GPS is unavailable or the user picks a
 * city manually. Selecting a city also switches the calculation method to the
 * one commonly used in that region (the user can still override it).
 */
export const CITIES: City[] = [
  { id: 'cairo', name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, method: 'Egyptian' },
  { id: 'giza', name: 'Giza', country: 'Egypt', lat: 30.0131, lng: 31.2089, method: 'Egyptian' },
  { id: 'alexandria', name: 'Alexandria', country: 'Egypt', lat: 31.2001, lng: 29.9187, method: 'Egyptian' },
  { id: 'mansoura', name: 'Mansoura', country: 'Egypt', lat: 31.0409, lng: 31.3785, method: 'Egyptian' },
  { id: 'luxor', name: 'Luxor', country: 'Egypt', lat: 25.6872, lng: 32.6396, method: 'Egyptian' },
  { id: 'makkah', name: 'Makkah', country: 'Saudi Arabia', lat: 21.4225, lng: 39.8262, method: 'UmmAlQura' },
  { id: 'madinah', name: 'Madinah', country: 'Saudi Arabia', lat: 24.4686, lng: 39.6142, method: 'UmmAlQura' },
  { id: 'riyadh', name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, method: 'UmmAlQura' },
  { id: 'jeddah', name: 'Jeddah', country: 'Saudi Arabia', lat: 21.4858, lng: 39.1925, method: 'UmmAlQura' },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708, method: 'Dubai' },
  { id: 'abu-dhabi', name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4539, lng: 54.3773, method: 'Dubai' },
  { id: 'doha', name: 'Doha', country: 'Qatar', lat: 25.2854, lng: 51.531, method: 'Qatar' },
  { id: 'kuwait-city', name: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lng: 47.9774, method: 'Kuwait' },
  { id: 'manama', name: 'Manama', country: 'Bahrain', lat: 26.2285, lng: 50.586, method: 'Qatar' },
  { id: 'muscat', name: 'Muscat', country: 'Oman', lat: 23.588, lng: 58.3829, method: 'Dubai' },
  { id: 'amman', name: 'Amman', country: 'Jordan', lat: 31.9454, lng: 35.9284, method: 'MuslimWorldLeague' },
  { id: 'jerusalem', name: 'Jerusalem', country: 'Palestine', lat: 31.7683, lng: 35.2137, method: 'MuslimWorldLeague' },
  { id: 'gaza', name: 'Gaza', country: 'Palestine', lat: 31.5, lng: 34.4667, method: 'MuslimWorldLeague' },
  { id: 'beirut', name: 'Beirut', country: 'Lebanon', lat: 33.8938, lng: 35.5018, method: 'Egyptian' },
  { id: 'damascus', name: 'Damascus', country: 'Syria', lat: 33.5138, lng: 36.2765, method: 'Egyptian' },
  { id: 'baghdad', name: 'Baghdad', country: 'Iraq', lat: 33.3152, lng: 44.3661, method: 'Egyptian' },
  { id: 'istanbul', name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784, method: 'Turkey' },
  { id: 'ankara', name: 'Ankara', country: 'Turkey', lat: 39.9334, lng: 32.8597, method: 'Turkey' },
  { id: 'tehran', name: 'Tehran', country: 'Iran', lat: 35.6892, lng: 51.389, method: 'Tehran' },
  { id: 'khartoum', name: 'Khartoum', country: 'Sudan', lat: 15.5007, lng: 32.5599, method: 'Egyptian' },
  { id: 'casablanca', name: 'Casablanca', country: 'Morocco', lat: 33.5731, lng: -7.5898, method: 'MuslimWorldLeague' },
  { id: 'tunis', name: 'Tunis', country: 'Tunisia', lat: 36.8065, lng: 10.1815, method: 'MuslimWorldLeague' },
  { id: 'algiers', name: 'Algiers', country: 'Algeria', lat: 36.7538, lng: 3.0588, method: 'MuslimWorldLeague' },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, method: 'MuslimWorldLeague' },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219, method: 'MuslimWorldLeague' },
  { id: 'london', name: 'London', country: 'United Kingdom', lat: 51.5072, lng: -0.1276, method: 'MoonsightingCommittee' },
  { id: 'birmingham', name: 'Birmingham', country: 'United Kingdom', lat: 52.4862, lng: -1.8904, method: 'MoonsightingCommittee' },
  { id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, method: 'MuslimWorldLeague' },
  { id: 'berlin', name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, method: 'MuslimWorldLeague' },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, method: 'MuslimWorldLeague' },
  { id: 'stockholm', name: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686, method: 'MoonsightingCommittee' },
  { id: 'new-york', name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006, method: 'NorthAmerica' },
  { id: 'chicago', name: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298, method: 'NorthAmerica' },
  { id: 'houston', name: 'Houston', country: 'United States', lat: 29.7604, lng: -95.3698, method: 'NorthAmerica' },
  { id: 'los-angeles', name: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437, method: 'NorthAmerica' },
  { id: 'toronto', name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, method: 'NorthAmerica' },
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011, method: 'Karachi' },
  { id: 'lahore', name: 'Lahore', country: 'Pakistan', lat: 31.5204, lng: 74.3587, method: 'Karachi' },
  { id: 'islamabad', name: 'Islamabad', country: 'Pakistan', lat: 33.6844, lng: 73.0479, method: 'Karachi' },
  { id: 'dhaka', name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, method: 'Karachi' },
  { id: 'delhi', name: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209, method: 'Karachi' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, method: 'Karachi' },
  { id: 'hyderabad-in', name: 'Hyderabad', country: 'India', lat: 17.385, lng: 78.4867, method: 'Karachi' },
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869, method: 'Egyptian' },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, method: 'Singapore' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, method: 'Singapore' },
];

export const DEFAULT_CITY_ID = 'cairo';

export function findCity(id: string): City {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}
