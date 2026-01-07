const ENCODING_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DECODING_TABLE: Record<string, number> = {};

for (let i = 0; i < ENCODING_TABLE.length; i += 1) {
  DECODING_TABLE[ENCODING_TABLE[i]] = i;
}

type DecodeResult = {
  value: number;
  index: number;
};

const decodeUnsignedVarint = (encoded: string, startIndex: number): DecodeResult => {
  let value = 0;
  let shift = 0;
  let index = startIndex;

  while (index < encoded.length) {
    const char = encoded[index];
    const decoded = DECODING_TABLE[char];
    if (decoded === undefined) {
      throw new Error("Invalid flexible polyline character");
    }

    value |= (decoded & 0x1f) << shift;
    shift += 5;
    index += 1;

    if ((decoded & 0x20) === 0) {
      return { value, index };
    }
  }

  throw new Error("Unexpected end of flexible polyline");
};

const decodeSignedVarint = (encoded: string, startIndex: number): DecodeResult => {
  const { value, index } = decodeUnsignedVarint(encoded, startIndex);
  const signed = (value & 1) ? ~(value >> 1) : value >> 1;
  return { value: signed, index };
};

export type DecodedPolyline = [number, number][];

export const decodeFlexiblePolyline = (encoded: string): DecodedPolyline => {
  if (!encoded) return [];

  const header = decodeUnsignedVarint(encoded, 0);
  const precision = header.value & 15;
  const thirdDim = (header.value >> 4) & 7;
  const thirdDimPrecision = (header.value >> 7) & 15;
  const factor = Math.pow(10, precision);
  const zFactor = Math.pow(10, thirdDimPrecision);

  let index = header.index;
  let lat = 0;
  let lng = 0;
  let z = 0;
  const coordinates: DecodedPolyline = [];

  while (index < encoded.length) {
    const latResult = decodeSignedVarint(encoded, index);
    lat += latResult.value;
    index = latResult.index;

    const lngResult = decodeSignedVarint(encoded, index);
    lng += lngResult.value;
    index = lngResult.index;

    if (thirdDim !== 0) {
      const zResult = decodeSignedVarint(encoded, index);
      z += zResult.value;
      index = zResult.index;
    }

    const latitude = lat / factor;
    const longitude = lng / factor;
    coordinates.push([longitude, latitude]);
  }

  return coordinates;
};
