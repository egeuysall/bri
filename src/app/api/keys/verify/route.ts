import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../../convex/_generated/api';
import { readBridgeApiKeyFromRequest } from '@/lib/request-security';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parsePrefix(apiKey: string) {
  const separatorIndex = apiKey.indexOf('.');
  return separatorIndex > 0 ? apiKey.slice(0, separatorIndex) : null;
}

export async function GET(request: Request) {
  const apiKey = readBridgeApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const prefix = parsePrefix(apiKey);
  if (!prefix) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const data = await fetchQuery(api.apiKeys.verifyHashed, {
    prefix,
    keyHash: sha256Hex(apiKey),
  });
  if (!data) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  return NextResponse.json({ data });
}
