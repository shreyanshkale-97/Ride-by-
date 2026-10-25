import { Platform } from 'react-native';
import { RoutePreviewMap as WebRoutePreviewMap } from './RoutePreviewMap.web';
import { RoutePreviewMap as NativeRoutePreviewMap } from './RoutePreviewMap.native';

export const RoutePreviewMap = Platform.OS === 'web' ? WebRoutePreviewMap : NativeRoutePreviewMap;
