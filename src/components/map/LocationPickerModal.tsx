import { Platform } from 'react-native';
import { LocationPickerModal as WebLocationPickerModal } from './LocationPickerModal.web';
import { LocationPickerModal as NativeLocationPickerModal } from './LocationPickerModal.native';

export const LocationPickerModal = Platform.OS === 'web' ? WebLocationPickerModal : NativeLocationPickerModal;
