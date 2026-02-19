import { useState } from 'react';

const reasonCodeMessages: { [key: string]: string } = {
  DUPLICATE_RECEIPT: 'Looks like this receipt was already uploaded.',
  INVALID_TOTAL: 'We couldn’t find a valid total. Try a clearer photo.',
  STALE_RECEIPT: 'Receipt must be from the last 24 hours.',
  TOTAL_MISMATCH: 'Total doesn’t match the order amount—review needed.',
  MERCHANT_MISMATCH: 'Merchant name doesn’t match the pickup location.',
  LOW_CONFIDENCE: 'Receipt is hard to read—review needed.',
  VERYFI_ERROR: 'We’re reviewing this manually due to a verification delay.',
};

export function ReceiptUpload({ deliveryRequestId }: { deliveryRequestId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reasonCodes, setReasonCodes] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deliveryRequestId', deliveryRequestId);

    try {
      const response = await fetch('/api/receipt/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      setStatus(data.status);
      setReasonCodes(data.reasonCodes);
      setExtractedData(data.extracted);
    } catch (error) {
      console.error('Receipt upload error:', error);
      setStatus('ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleSubmit} disabled={!file || isLoading}>
        {isLoading ? 'Uploading...' : 'Upload Receipt'}
      </button>

      {status && (
        <div>
          <h3>Verification Status: {status}</h3>
          {reasonCodes.length > 0 && (
            <ul>
              {reasonCodes.map((code) => (
                <li key={code}>{reasonCodeMessages[code] || code}</li>
              ))}
            </ul>
          )}
          {extractedData && (
            <div>
              <h4>Extracted Data:</h4>
              <pre>{JSON.stringify(extractedData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
