import { describe, expect, it } from 'vitest';
import { DEFAULT_TRUST, trustSettingsSchema } from './trust-settings';

describe('Trustpilot settings', () => {
  it('starts at a rating of 4.4', () => expect(DEFAULT_TRUST.trustpilot_score).toBe(4.4));
  it('starts with 10 reviews', () => expect(DEFAULT_TRUST.trustpilot_reviews).toBe(10));
  it('accepts edited ratings and review counts', () => {
    expect(trustSettingsSchema.parse({ trustpilot_score: 4.5, trustpilot_reviews: 11 })).toEqual({ trustpilot_score: 4.5, trustpilot_reviews: 11 });
    expect(trustSettingsSchema.safeParse({ trustpilot_score: 5.1, trustpilot_reviews: 10 }).success).toBe(false);
    expect(trustSettingsSchema.safeParse({ trustpilot_score: 4.4, trustpilot_reviews: -1 }).success).toBe(false);
    expect(trustSettingsSchema.safeParse({ trustpilot_score: 4.4, trustpilot_reviews: 10.5 }).success).toBe(false);
  });
});