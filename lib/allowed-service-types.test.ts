import { describe, expect, it } from 'vitest';

import { OTW_ORDERABLE_SERVICE_TYPES } from './allowed-service-types';

describe('OTW_ORDERABLE_SERVICE_TYPES', () => {
  it('includes ride requests in the default orderable set', () => {
    expect(OTW_ORDERABLE_SERVICE_TYPES).toContain('RIDE');
  });
});
