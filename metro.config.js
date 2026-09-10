// Metro configuration for Expo.
//
// The two tweaks below are REQUIRED for the Firebase JS SDK (v11) to work with
// Expo SDK 54 / React Native 0.81 + Hermes. Without them you get runtime errors
// such as "Component auth has not been registered yet".
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Firebase ships some `.cjs` entry points that Metro must be told to resolve.
config.resolver.sourceExts.push('cjs');

// Firebase's `package.json` "exports" map trips up Metro's resolver; disabling
// the experimental package-exports resolution restores the classic behaviour.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
