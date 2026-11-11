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


// ============================================================
// Fetch real POIs (Fuel, Cafe, Rest Stops) using OpenStreetMap
// Uses Nominatim and Overpass mirrors along the route corridor
// ============================================================
export async function fetchSuggestedStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): Promise<RideStop[]> {
  const PADDING = 0.35; // ~40km margin around route bbox
  const south = Math.min(startLat, destLat) - PADDING;
  const west  = Math.min(startLng, destLng) - PADDING;
  const north = Math.max(startLat, destLat) + PADDING;
  const east  = Math.max(startLng, destLng) + PADDING;

  // 1. Primary Source: OpenStreetMap Nominatim Viewbox Search (Fast & Reliable)
  try {
    let amenityParam = 'fuel';
    if (type === 'cafe') {
      amenityParam = 'cafe';
    } else if (type === 'rest_stop') {
      amenityParam = 'restaurant';
    }

    // Nominatim viewbox format: <left>,<top>,<right>,<bottom>
    const viewbox = `${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)},${south.toFixed(4)}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=${amenityParam}&viewbox=${viewbox}&bounded=1&limit=10`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'RideByApp/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 6).map((item: any, i: number) => {
          const rawName = item.name?.trim();
          const cleanName =
            rawName ||
            item.display_name?.split(',')[0]?.trim() ||
            (type === 'fuel' ? `Petrol Station ${i + 1}` : type === 'cafe' ? `Cafe ${i + 1}` : `Highway Rest ${i + 1}`);

          return {
            id: `${type}-osm-${item.place_id || item.osm_id || i}`,
            name: cleanName,
            type,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          } as RideStop;
        });
      }
    }
  } catch (err) {
    console.warn('[POI] Nominatim search error:', err);
  }

  // 2. Secondary Source: Overpass API with multi-mirror fallback
  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  let overpassFilter = '';
  let label = '';
  if (type === 'fuel') {
    overpassFilter = `node["amenity"="fuel"](${south},${west},${north},${east});`;
    label = 'Fuel Station';
  } else if (type === 'cafe') {
    overpassFilter = `(
      node["amenity"="cafe"](${south},${west},${north},${east});
      node["amenity"="restaurant"](${south},${west},${north},${east});
    );`;
    label = 'Cafe';
  } else {
    overpassFilter = `(
      node["highway"="rest_area"](${south},${west},${north},${east});
      node["amenity"="restaurant"](${south},${west},${north},${east});
      node["amenity"="fast_food"](${south},${west},${north},${east});
    );`;
    label = 'Rest Stop';
  }

  const query = `[out:json][timeout:15];${overpassFilter}out 10;`;

  for (const mirror of mirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const elements: any[] = data?.elements ?? [];

      if (elements.length > 0) {
        return elements.slice(0, 6).map((el: any, i: number) => {
          const tags = el.tags ?? {};
          const name = tags.name || tags.brand || tags.operator || `${label} ${i + 1}`;
          return {
            id: `${type}-overpass-${el.id ?? i}`,
            name,
            type,
            lat: el.lat,
            lng: el.lon,
          } as RideStop;
        });
      }
    } catch (_) {
      // try next mirror
    }
  }

  // 3. Fallback: Interpolated positions with clear stop indicators
  return getFallbackInterpolatedStops(startLat, startLng, destLat, destLng, type);
}

// ============================================================
// Fallback: designated waypoint stops along route line
// Only used if external geocoders time out
// ============================================================
function getFallbackInterpolatedStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): RideStop[] {
  const typeLabel =
    type === 'fuel' ? 'Highway Fuel' : type === 'cafe' ? 'Highway Cafe' : 'Highway Rest';

  return [0.3, 0.5, 0.7].map((t, i) => ({
    id: `${type}-fallback-${i}`,
    name: `${typeLabel} Point ${i + 1}`,
    type,
    lat: +(startLat + (destLat - startLat) * t).toFixed(5),
    lng: +(startLng + (destLng - startLng) * t).toFixed(5),
  }));
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
