'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReceiptUpload({ deliveryRequestId }: { deliveryRequestId: string }) {
  const router = useRouter();
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedSource, setSelectedSource] = useState<'library' | 'camera' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'library' | 'camera'
  ) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSelectedSource(source);
      setError(null);
      setSuccess(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('deliveryRequestId', deliveryRequestId);

    try {
      const response = await fetch('/api/receipt/verify', {
        method: 'POST',
        body: formData,
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || 'Something went wrong');
      }

      setSuccess(result.message || 'Receipt uploaded successfully!');
      setFile(null);
      setSelectedSource(null);
      if (libraryInputRef.current) libraryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      router.refresh();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Upload Receipt</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload a picture of your receipt for verification.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Receipt Image
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Choose photo
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Take photo
            </button>
            <input
              ref={libraryInputRef}
              id="receipt-upload-library"
              name="receipt-upload-library"
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, 'library')}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              id="receipt-upload-camera"
              name="receipt-upload-camera"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileChange(e, 'camera')}
              className="hidden"
            />
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {file
              ? `Selected: ${file.name}${selectedSource === 'camera' ? ' (camera)' : ''}`
              : 'No receipt selected yet.'}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUploading || !file}
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
    </div>
  );
}
