// Platform bridge: Metro-safe lazy require pattern.
// Direct static imports of .native.tsx/.web.tsx in a shared .tsx file cause
// Metro to bundle BOTH platforms for web builds, crashing on react-native-maps.
// Using require() inside Platform.select prevents eager bundling of native code.

import { Platform } from 'react-native';

// Re-export shared types from web file (types are stripped at runtime, safe on all platforms)
export type { DisplayRider, RideMapProps } from './RideMap.web';

export const RideMap: React.ComponentType<any> = Platform.OS === 'web'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('./RideMap.web').RideMap
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('./RideMap.native').RideMap;

import React from 'react';
