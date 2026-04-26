import { describe, expect, test } from 'bun:test';
import { selectPublicProfile } from '../../../convex/userProfilesModel';

const olderProfile = {
  username: 'egeuysall',
  displayName: 'Old Name',
  email: 'old@example.com',
  createdAt: 100,
  updatedAt: 200,
};

const newerProfile = {
  username: 'egeuysall',
  displayName: 'New Name',
  email: 'new@example.com',
  createdAt: 300,
  updatedAt: 400,
};

describe('selectPublicProfile', () => {
  test('returns null when no profiles exist', () => {
    expect(selectPublicProfile([])).toBe(null);
  });

  test('selects the newest profile instead of throwing on duplicate usernames', () => {
    expect(selectPublicProfile([olderProfile, newerProfile])).toEqual(newerProfile);
  });
});
