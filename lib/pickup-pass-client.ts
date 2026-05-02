export function isPickupPassDataUrl(value: string): boolean {
  return value.startsWith('data:');
}

export async function toPickupPassPreviewUrl(params: {
  rawUrl: string;
  revokeExisting?: () => void;
  setObjectUrl?: (value: string | null) => void;
}): Promise<string> {
  const { rawUrl, revokeExisting, setObjectUrl } = params;

  if (!isPickupPassDataUrl(rawUrl)) {
    return rawUrl;
  }

  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error('Pickup pass is unavailable for this request.');
  }

  const blob = await response.blob();
  revokeExisting?.();
  const objectUrl = URL.createObjectURL(blob);
  setObjectUrl?.(objectUrl);
  return objectUrl;
}
