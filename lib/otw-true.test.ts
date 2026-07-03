import { describe, expect, it } from 'vitest';
import {
  buildOtwTrueJobSiteBusinessAddress,
  buildOtwTrueJobSiteBusinessValidationAddress,
} from './otw-true';

const jobSiteBusiness = {
  ownerUserId: 'owner_123',
  businessLegalName: "Broski's Kitchen LLC",
  validatedAddress:
    '3016, Ashcroft Drive, Anthony Wayne Village, Fort Wayne, Allen County, Indiana, 46806, United States',
  primaryBusinessStreetAddress: '3016 Ashcroft Drive',
  primaryBusinessCity: 'Fort Wayne',
  primaryBusinessStateProvince: 'Indiana',
  primaryBusinessPostalCode: '46806',
  primaryBusinessCountry: 'US',
};

describe('otw true job-site business address helpers', () => {
  it('uses the saved validated address for display labels', () => {
    expect(buildOtwTrueJobSiteBusinessAddress(jobSiteBusiness)).toBe(jobSiteBusiness.validatedAddress);
  });

  it('uses the structured business fields for validation lookups', () => {
    expect(buildOtwTrueJobSiteBusinessValidationAddress(jobSiteBusiness)).toBe(
      '3016 Ashcroft Drive, Fort Wayne Indiana 46806',
    );
  });
});
