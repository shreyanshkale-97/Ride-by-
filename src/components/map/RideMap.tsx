import { Platform } from 'react-native';
import { RideMap as WebRideMap } from './RideMap.web';
import { RideMap as NativeRideMap } from './RideMap.native';

export { DisplayRider, RideMapProps } from './RideMap.web';
export const RideMap = Platform.OS === 'web' ? WebRideMap : NativeRideMap;
