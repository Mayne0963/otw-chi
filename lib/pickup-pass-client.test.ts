import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isPickupPassDataUrl, toPickupPassPreviewUrl } from './pickup-pass-client';

describe('pickup-pass-client', () => {
  const originalCreateObjectUrl = URL.createObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
  });

  it('keeps signed or remote URLs unchanged', async () => {
    await expect(
      toPickupPassPreviewUrl({
        rawUrl: 'https://example.com/pickup-pass.png',
      }),
    ).resolves.toBe('https://example.com/pickup-pass.png');
  });

  it('converts data URLs into blob object URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['pickup-pass'], { type: 'image/png' })),
    });
    const revokeExisting = vi.fn();
    const setObjectUrl = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:pickup-pass-preview');

    await expect(
      toPickupPassPreviewUrl({
        rawUrl: 'data:image/png;base64,abc123',
        revokeExisting,
        setObjectUrl,
      }),
    ).resolves.toBe('blob:pickup-pass-preview');

    expect(fetchMock).toHaveBeenCalledWith('data:image/png;base64,abc123');
    expect(revokeExisting).toHaveBeenCalledTimes(1);
    expect(setObjectUrl).toHaveBeenCalledWith('blob:pickup-pass-preview');
  });

  it('detects data URLs', () => {
    expect(isPickupPassDataUrl('data:image/png;base64,abc123')).toBe(true);
    expect(isPickupPassDataUrl('https://example.com/image.png')).toBe(false);
  });
});
