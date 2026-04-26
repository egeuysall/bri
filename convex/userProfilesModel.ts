export type PublicProfile = {
  username: string;
  displayName: string | null;
  email: string | null;
  createdAt: number;
  updatedAt: number;
};

export function selectPublicProfile<T extends PublicProfile>(profiles: readonly T[]): T | null {
  if (profiles.length === 0) return null;
  return [...profiles].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}
