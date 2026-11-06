// Platform bridge: Metro-safe lazy require pattern.
// Static imports of .native.tsx in a shared .tsx crashes web builds.
import { Platform } from 'react-native';

export const LocationPickerModal: React.ComponentType<any> = Platform.OS === 'web'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('./LocationPickerModal.web').LocationPickerModal
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('./LocationPickerModal.native').LocationPickerModal;

import React from 'react';
