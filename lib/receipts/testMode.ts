export function isTestMode(): boolean {
  return process.env.TEST_MODE === 'true';
}

export function getTestModeResult(filename: string): {
  status: 'APPROVED' | 'FLAGGED' | 'REJECTED';
  proofScore: number;
  message: string;
} | null {
  if (!isTestMode()) return null;
  
  const upperFilename = filename.toUpperCase();
  
  if (upperFilename.includes('GOOD')) {
    return {
      status: 'APPROVED',
      proofScore: 95,
      message: 'TEST_MODE: Auto-approved (GOOD filename)'
    };
  } else if (upperFilename.includes('FLAG')) {
    return {
      status: 'FLAGGED',
      proofScore: 70,
      message: 'TEST_MODE: Auto-flagged (FLAG filename)'
    };
  } else if (upperFilename.includes('BAD')) {
    return {
      status: 'REJECTED',
      proofScore: 30,
      message: 'TEST_MODE: Auto-rejected (BAD filename)'
    };
  }
  
  return null;
}