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
// Fetch real POIs (Fuel, Cafe, Rest Stops) using Overpass API
// Searches OpenStreetMap data within a bounding box along the route
// ============================================================
export async function fetchSuggestedStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): Promise<RideStop[]> {
  // Build a padded bounding box that covers the route with margin
  const PADDING = 0.5; // ~55km padding around route bbox
  const south = Math.min(startLat, destLat) - PADDING;
  const west  = Math.min(startLng, destLng) - PADDING;
  const north = Math.max(startLat, destLat) + PADDING;
  const east  = Math.max(startLng, destLng) + PADDING;

  // Overpass QL query based on POI type
  let overpassFilter = '';
  let label = '';

  if (type === 'fuel') {
    overpassFilter = `node["amenity"="fuel"](${south},${west},${north},${east});`;
    label = 'Fuel Station';
  } else if (type === 'cafe') {
    overpassFilter = `(
      node["amenity"="cafe"](${south},${west},${north},${east});
      node["amenity"="restaurant"](${south},${west},${north},${east});
      node["amenity"="fast_food"](${south},${west},${north},${east});
    );`;
    label = 'Cafe / Restaurant';
  } else {
    // rest_stop
    overpassFilter = `(
      node["highway"="rest_area"](${south},${west},${north},${east});
      node["amenity"="rest_area"](${south},${west},${north},${east});
      node["tourism"="picnic_site"](${south},${west},${north},${east});
      node["amenity"="toilets"](${south},${west},${north},${east});
    );`;
    label = 'Rest Stop';
  }

  const query = `[out:json][timeout:20];${overpassFilter}out 15;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RideByApp/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn(`[Overpass] HTTP ${res.status} — falling back to interpolated stops`);
      return getFallbackInterpolatedStops(startLat, startLng, destLat, destLng, type);
    }

    const data = await res.json();
    const elements: any[] = data?.elements ?? [];

    if (elements.length === 0) {
      console.warn(`[Overpass] No ${type} POIs found in bbox — using interpolated fallback`);
      return getFallbackInterpolatedStops(startLat, startLng, destLat, destLng, type);
    }

    // Filter to only nodes that are roughly along the route (not just corners)
    const routeMidLat = (startLat + destLat) / 2;
    const routeMidLng = (startLng + destLng) / 2;
    const routeLenDeg = Math.sqrt(
      Math.pow(destLat - startLat, 2) + Math.pow(destLng - startLng, 2)
    );

    // Sort by proximity to the route centerline and pick best 6
    const scored = elements.map((el: any) => {
      const dFromMid = Math.sqrt(
        Math.pow(el.lat - routeMidLat, 2) + Math.pow(el.lon - routeMidLng, 2)
      );
      return { el, score: dFromMid };
    });
    scored.sort((a, b) => a.score - b.score);
    const best = scored.slice(0, 6);

    return best.map((item, i) => {
      const tags = item.el.tags ?? {};
      // Prefer official name → brand → cuisine → generic label
      const name =
        tags.name ||
        tags.brand ||
        tags['name:en'] ||
        tags.operator ||
        `${label} ${i + 1}`;

      return {
        id: `${type}-overpass-${item.el.id ?? i}`,
        name,
        type,
        lat: item.el.lat,
        lng: item.el.lon,
      } as RideStop;
    });
  } catch (err) {
    console.warn('[Overpass] Fetch error — using interpolated fallback:', err);
    return getFallbackInterpolatedStops(startLat, startLng, destLat, destLng, type);
  }
}

// ============================================================
// Last-resort fallback: interpolated points along route line
// Only used when Overpass API is completely unavailable
// These are NOT named fake stations — just position markers
// ============================================================
function getFallbackInterpolatedStops(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  type: StopType
): RideStop[] {
  const typeLabel =
    type === 'fuel' ? 'Fuel Stop' : type === 'cafe' ? 'Cafe Stop' : 'Rest Stop';

  // 3 evenly spaced points along route
  return [0.3, 0.5, 0.7].map((t, i) => ({
    id: `${type}-fallback-${i}`,
    name: `${typeLabel} ${i + 1} (approx.)`,
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
