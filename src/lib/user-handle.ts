type Claims = Record<string, unknown> | null | undefined;
type UserLike = {
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }> | null;
  externalAccounts?: Array<{
    provider?: string | null;
    username?: string | null;
  }> | null;
} | null | undefined;

function sanitizeHandle(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function emailLocalPart(email: string): string | null {
  const [localPart] = email.split('@');
  return localPart ? localPart.trim() : null;
}

function firstMatching<T>(
  values: readonly T[] | null | undefined,
  matcher: (value: T) => string | null
): string | null {
  if (!values || values.length === 0) return null;
  for (const value of values) {
    const result = matcher(value);
    if (result) return result;
  }
  return null;
}

export function resolveUserHandle(claims: Claims): string | null {
  const usernameClaim =
    readString(claims?.username) ??
    readString(claims?.preferred_username) ??
    readString(claims?.nickname) ??
    readString(claims?.handle) ??
    readString(claims?.user_handle);

  if (!usernameClaim) return null;
  const normalized = sanitizeHandle(usernameClaim);
  return normalized.length > 0 ? normalized : null;
}

export function resolveUserHandleFromUser(user: UserLike): string | null {
  const username =
    readString(user?.username) ??
    firstMatching(user?.externalAccounts, account => {
      const provider = readString(account?.provider);
      if (provider === 'oauth_github') {
        return readString(account?.username);
      }
      return null;
    }) ??
    firstMatching(user?.externalAccounts, account => readString(account?.username));

  if (username) {
    const normalizedUsername = sanitizeHandle(username);
    if (normalizedUsername.length > 0) return normalizedUsername;
  }

  const email =
    readString(user?.primaryEmailAddress?.emailAddress) ??
    firstMatching(user?.emailAddresses, address => readString(address?.emailAddress));

  if (!email) return null;
  const localPart = emailLocalPart(email);
  if (!localPart) return null;

  const normalized = sanitizeHandle(localPart);
  return normalized.length > 0 ? normalized : null;
}

export function normalizePathHandle(value: string): string {
  return sanitizeHandle(value);
}
