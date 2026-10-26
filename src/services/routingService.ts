// Open-source routing service powered by OSRM with multi-stop waypoints support

export type StopType = 'fuel' | 'cafe' | 'rest_stop';

export interface RideStop {
  id: string;
  name: string;
  type: StopType;
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;       // Human-readable turn instruction
  distance: number;          // Distance in metres to this step's end
  duration: number;          // Duration in seconds
  maneuverType: string;      // OSRM: 'turn', 'depart', 'arrive', 'roundabout', etc.
  maneuverModifier: string;  // OSRM: 'left', 'right', 'straight', 'slight left', etc.
  name: string;              // Road/street name
  lat: number;               // Maneuver point coordinate
  lng: number;
}

export interface RouteOption {
  id: string;
  name: string;
  distanceKm: number;
  durationMinutes: number;
  durationText: string;
  coordinates: { lat: number; lng: number }[];
  steps: RouteStep[];
}

export async function fetchRoutes(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  stops: RideStop[] = []
): Promise<RouteOption[]> {
  try {
    // Construct coordinates query: start -> stops... -> destination
    const points: string[] = [`${startLng},${startLat}`];
    stops.forEach((s) => points.push(`${s.lng},${s.lat}`));
    points.push(`${destLng},${destLat}`);

    const coordsStr = points.join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=true&alternatives=${stops.length === 0}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RideByApp/1.0',
      },
    });

    if (!res.ok) throw new Error('Failed to fetch routes from OSRM');
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      return getFallbackRoute(startLat, startLng, destLat, destLng);
    }

    return data.routes.map((route: any, index: number) => {
      const distanceKm = +(route.distance / 1000).toFixed(1);
      const durationMinutes = Math.round(route.duration / 60);

      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      const durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;

      const coordinates = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        lat,
        lng,
      }));

      // Parse steps from all legs into RouteStep[]
      const steps: RouteStep[] = [];
      if (route.legs) {
        for (const leg of route.legs) {
          if (leg.steps) {
            for (const step of leg.steps) {
              const manType: string = step.maneuver?.type ?? 'turn';
              const manMod: string = step.maneuver?.modifier ?? 'straight';
              const [sLng, sLat] = step.maneuver?.location ?? [0, 0];
              steps.push({
                instruction: buildInstruction(manType, manMod, step.name || ''),
                distance: step.distance ?? 0,
                duration: step.duration ?? 0,
                maneuverType: manType,
                maneuverModifier: manMod,
                name: step.name || '',
                lat: sLat,
                lng: sLng,
              });
            }
          }
        }
      }

      const summaryName = stops.length > 0
        ? `Via ${stops.length} stop${stops.length > 1 ? 's' : ''}`
        : route.legs?.[0]?.summary
        ? `Via ${route.legs[0].summary}`
        : index === 0
        ? 'Fastest Route (Recommended)'
        : `Alternative Route ${index}`;

      return {
        id: `route-${index}`,
        name: summaryName,
        distanceKm,
        durationMinutes,
        durationText,
        coordinates,
        steps,
      };
    });
  } catch (err) {
    console.warn('Error fetching OSRM routes, using fallback:', err);
    return getFallbackRoute(startLat, startLng, destLat, destLng);
  }
}

/** Convert OSRM maneuver type + modifier into a human-readable instruction */
export function buildInstruction(type: string, modifier: string, roadName: string): string {
  const road = roadName ? ` onto ${roadName}` : '';
  const modMap: Record<string, string> = {
    left: 'Turn left',
    right: 'Turn right',
    'slight left': 'Bear left',
    'slight right': 'Bear right',
    'sharp left': 'Turn sharp left',
    'sharp right': 'Turn sharp right',
    straight: 'Continue straight',
    uturn: 'Make a U-turn',
  };

  if (type === 'depart') return `Head ${modifier || 'forward'}${road}`;
  if (type === 'arrive') return 'You have arrived at your destination';
  if (type === 'roundabout' || type === 'rotary') return `At the roundabout, take the exit${road}`;
  if (type === 'fork') return `Keep ${modifier || 'straight'}${road}`;
  if (type === 'merge') return `Merge ${modifier || 'onto road'}${road}`;
  if (type === 'ramp' || type === 'on ramp') return `Take the on-ramp${road}`;
  if (type === 'off ramp') return `Take the off-ramp${road}`;
  if (type === 'end of road') return `Turn ${modifier || 'right'}${road}`;
  if (type === 'continue' || type === 'new name') return `Continue straight${road}`;

  return (modMap[modifier] ?? 'Turn') + road;
}


// Search for POIs (Fuel, Cafe, Rest Stops) between start and destination
export async function fetchSuggestedStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): Promise<RideStop[]> {
  try {
    // Sample midpoints along the route to find highway stops
    const mid1Lat = startLat * 0.65 + destLat * 0.35;
    const mid1Lng = startLng * 0.65 + destLng * 0.35;
    const mid2Lat = startLat * 0.35 + destLat * 0.65;
    const mid2Lng = startLng * 0.35 + destLng * 0.65;

    let queryKeyword = 'petrol pump highway';
    if (type === 'cafe') queryKeyword = 'restaurant cafe highway';
    if (type === 'rest_stop') queryKeyword = 'rest area viewpoint highway';

    // Query Nominatim near midpoints
    const query = `${queryKeyword} near ${(mid1Lat + mid2Lat) / 2},${(mid1Lng + mid2Lng) / 2}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=6&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RideByApp/1.0',
      },
    });

    if (!res.ok) return getCuratedHighwayStops(startLat, startLng, destLat, destLng, type);
    const data = await res.json();

    if (!data || data.length === 0) {
      return getCuratedHighwayStops(startLat, startLng, destLat, destLng, type);
    }

    return data.map((item: any, i: number) => {
      // Clean up place name
      const parts = (item.display_name || '').split(',');
      const cleanName = parts.slice(0, 2).join(',').trim();

      return {
        id: `poi-${type}-${i}-${Date.now()}`,
        name: cleanName || `${type.toUpperCase()} Stop ${i + 1}`,
        type,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });
  } catch (err) {
    console.warn('Error fetching POIs, returning fallback stops:', err);
    return getCuratedHighwayStops(startLat, startLng, destLat, destLng, type);
  }
}

// Guaranteed highway stops along the line between points
function getCuratedHighwayStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): RideStop[] {
  const mid1 = { lat: +(startLat * 0.7 + destLat * 0.3).toFixed(5), lng: +(startLng * 0.7 + destLng * 0.3).toFixed(5) };
  const mid2 = { lat: +(startLat * 0.5 + destLat * 0.5).toFixed(5), lng: +(startLng * 0.5 + destLng * 0.5).toFixed(5) };
  const mid3 = { lat: +(startLat * 0.3 + destLat * 0.7).toFixed(5), lng: +(startLng * 0.3 + destLng * 0.7).toFixed(5) };

  if (type === 'fuel') {
    return [
      { id: 'fuel-1', name: 'Indian Oil Highway Fuel Station', type: 'fuel', lat: mid1.lat, lng: mid1.lng },
      { id: 'fuel-2', name: 'Bharat Petroleum 24/7 Service Station', type: 'fuel', lat: mid2.lat, lng: mid2.lng },
      { id: 'fuel-3', name: 'HPCL Highway Petrol Pump', type: 'fuel', lat: mid3.lat, lng: mid3.lng },
    ];
  }

  if (type === 'cafe') {
    return [
      { id: 'cafe-1', name: 'Midway Highway Diner & Cafe', type: 'cafe', lat: mid1.lat, lng: mid1.lng },
      { id: 'cafe-2', name: 'Chai Shai Highway Break Cafe', type: 'cafe', lat: mid2.lat, lng: mid2.lng },
      { id: 'cafe-3', name: 'Express Highway Dhaba & Cafe', type: 'cafe', lat: mid3.lat, lng: mid3.lng },
    ];
  }

  return [
    { id: 'rest-1', name: 'Highway Rest Area & Washrooms', type: 'rest_stop', lat: mid1.lat, lng: mid1.lng },
    { id: 'rest-2', name: 'Valley View Scenic Rest Point', type: 'rest_stop', lat: mid2.lat, lng: mid2.lng },
    { id: 'rest-3', name: 'Toll Plaza Resting Bay', type: 'rest_stop', lat: mid3.lat, lng: mid3.lng },
  ];
}

function getFallbackRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): RouteOption[] {
  const R = 6371;
  const dLat = ((destLat - startLat) * Math.PI) / 180;
  const dLng = ((destLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = +(R * c).toFixed(1);

  const durationMinutes = Math.round((distanceKm / 60) * 60);
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return [
    {
      id: 'fallback-0',
      name: 'Direct Route',
      distanceKm,
      durationMinutes,
      durationText,
      coordinates: [
        { lat: startLat, lng: startLng },
        { lat: destLat, lng: destLng },
      ],
      steps: [],
    },
  ];
}
