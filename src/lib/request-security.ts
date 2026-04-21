import { NextResponse } from 'next/server';

const API_KEY_PATTERN = /^bri_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function readBridgeApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;

  const normalized = token.trim();
  if (!normalized || normalized.length > 512) return null;
  if (!API_KEY_PATTERN.test(normalized)) return null;

  return normalized;
}

export function rejectCrossOriginMutation(request: Request): NextResponse | null {
  const targetOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  const hasBrowserOriginSignals = Boolean(originHeader || refererHeader);
  if (!hasBrowserOriginSignals) return null;

  try {
    if (originHeader && new URL(originHeader).origin !== targetOrigin) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }

    if (!originHeader && refererHeader && new URL(refererHeader).origin !== targetOrigin) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  return null;
}

export function clampAnalyticsDays(raw: string | null, fallback = 30): number {
  const parsed = Number(raw ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(90, Math.floor(parsed)));
}

export function normalizeResourceId(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 128) return null;
  if (!/^[A-Za-z0-9]+$/.test(value)) return null;
  return value;
}
