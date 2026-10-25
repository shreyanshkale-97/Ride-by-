// OpenStreetMap Nominatim Geocoding (Free, open source)

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&limit=5&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RideByApp/1.0',
      },
    });

    if (!res.ok) return [];
    const data = await res.json();

    return data.map((item: any) => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.warn('Geocoding search error:', err);
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RideByApp/1.0',
      },
    });

    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
