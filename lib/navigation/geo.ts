export type LngLat = [number, number];

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineMeters = (a: LngLat, b: LngLat): number => {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const buildCumulativeDistances = (coords: LngLat[]): number[] => {
  const distances: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    const segment = haversineMeters(coords[i - 1], coords[i]);
    distances.push(distances[i - 1] + segment);
  }
  return distances;
};

const projectToMeters = (coord: LngLat, origin: LngLat): [number, number] => {
  const latRad = toRad(origin[1]);
  const x = toRad(coord[0] - origin[0]) * Math.cos(latRad) * 6371000;
  const y = toRad(coord[1] - origin[1]) * 6371000;
  return [x, y];
};

export const distancePointToSegment = (point: LngLat, a: LngLat, b: LngLat): number => {
  const origin = a;
  const [px, py] = projectToMeters(point, origin);
  const [ax, ay] = projectToMeters(a, origin);
  const [bx, by] = projectToMeters(b, origin);

  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
};

export const findClosestPointIndex = (coords: LngLat[], point: LngLat): number => {
  if (coords.length === 0) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i += 1) {
    const distance = haversineMeters(coords[i], point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
};

export const distanceToPolyline = (coords: LngLat[], point: LngLat): number => {
  if (coords.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < coords.length; i += 1) {
    const d = distancePointToSegment(point, coords[i - 1], coords[i]);
    if (d < best) best = d;
  }
  return best;
};

export const pointAtDistanceFromIndex = (
  coords: LngLat[],
  cumulative: number[],
  targetDistance: number
): LngLat | null => {
  if (coords.length === 0) return null;
  if (targetDistance <= 0) return coords[0];
  const total = cumulative[cumulative.length - 1];
  if (targetDistance >= total) return coords[coords.length - 1];

  for (let i = 1; i < cumulative.length; i += 1) {
    if (cumulative[i] >= targetDistance) {
      const prevDistance = cumulative[i - 1];
      const segmentDistance = cumulative[i] - prevDistance;
      if (segmentDistance === 0) return coords[i];
      const ratio = (targetDistance - prevDistance) / segmentDistance;
      const lng = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * ratio;
      const lat = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * ratio;
      return [lng, lat];
    }
  }

  return coords[coords.length - 1];
};
