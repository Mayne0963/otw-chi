export type DecodedPolyline = [number, number][];

// Decodes an "encoded polyline" string (Google polyline algorithm), returning [lng, lat] coordinates.
// Precision is typically 5 (1e5) for most providers.
export const decodeEncodedPolyline = (encoded: string, precision = 5): DecodedPolyline => {
  if (!encoded) return [];
  const factor = Math.pow(10, precision);

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: DecodedPolyline = [];

  const decodeChunk = () => {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      if (index >= encoded.length) {
        throw new Error("Unexpected end of encoded polyline");
      }
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const delta = result & 1 ? ~(result >> 1) : result >> 1;
    return delta;
  };

  while (index < encoded.length) {
    lat += decodeChunk();
    lng += decodeChunk();
    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
};

