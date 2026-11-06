// Platform bridge: Metro-safe lazy require pattern.
// Static imports of .native.tsx in a shared .tsx crashes web builds.
import { Platform } from 'react-native';

export const RoutePreviewMap: React.ComponentType<any> = Platform.OS === 'web'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('./RoutePreviewMap.web').RoutePreviewMap
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('./RoutePreviewMap.native').RoutePreviewMap;

import React from 'react';
