export type DownscaleImageOptions = {
  maxWidth?: number;
  quality?: number;
};

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to decode image'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      type,
      quality,
    );
  });
}

export async function downscaleImage(
  file: File,
  options: DownscaleImageOptions = {},
): Promise<File> {
  const maxWidth = options.maxWidth ?? 1200;
  const quality = options.quality ?? 0.75;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const image = await loadImage(file);
  const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
  const usableWebpBlob =
    webpBlob && webpBlob.size > 0 && webpBlob.type === 'image/webp'
      ? webpBlob
      : null;
  const jpegBlob = usableWebpBlob
    ? null
    : await canvasToBlob(canvas, 'image/jpeg', quality);
  const selectedBlob =
    usableWebpBlob ??
    (jpegBlob && jpegBlob.size > 0 ? jpegBlob : null);

  if (!selectedBlob || selectedBlob.size === 0) {
    return file;
  }

  const extension = selectedBlob.type === 'image/webp' ? 'webp' : 'jpg';
  const basename = file.name.replace(/\.[^.]+$/, '') || 'pickup-pass';
  return new File(
    [selectedBlob],
    `${basename}.${extension}`,
    {
      type: selectedBlob.type,
      lastModified: Date.now(),
    },
  );
}
