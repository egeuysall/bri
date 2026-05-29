import { z } from 'zod';
import { isPublicResourcePath, isPublicUsernamePath } from '@/lib/user-handle';

export const AI_NOTE_MAX_QUESTION_LENGTH = 800;
export const AI_NOTE_MAX_CONTEXT_LENGTH = 24_000;
export const AI_NOTE_RATE_LIMIT = 8;
export const AI_NOTE_RATE_WINDOW_MS = 60_000;

type ParsedAiNoteRequest = {
  username: string;
  slug: string;
  question: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const aiNoteRequestSchema = z.object({
  username: z.string().min(1).max(64),
  slug: z.string().min(1).max(128),
  question: z.string().min(1).max(AI_NOTE_MAX_QUESTION_LENGTH),
});

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function parseAiNoteRequest(value: unknown): ParsedAiNoteRequest | null {
  const parsed = aiNoteRequestSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const username = parsed.data.username.trim().toLowerCase();
  const slug = parsed.data.slug.trim().toLowerCase();
  const question = parsed.data.question.trim();

  if (!isPublicUsernamePath(username) || !isPublicResourcePath(slug) || !question) {
    return null;
  }

  return { username, slug, question };
}

export function getAiOverlayClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const candidate = forwardedFor || realIp || 'unknown';

  if (candidate.length > 96 || !/^[A-Za-z0-9:._-]+$/.test(candidate)) {
    return 'unknown';
  }

  return candidate;
}

export function checkAiOverlayRateLimit(
  key: string,
  now = Date.now()
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + AI_NOTE_RATE_WINDOW_MS });
    cleanupExpiredRateLimitBuckets(now);
    return { allowed: true };
  }

  if (existing.count >= AI_NOTE_RATE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

export function truncateAiNoteContext(content: string): string {
  if (content.length <= AI_NOTE_MAX_CONTEXT_LENGTH) {
    return content;
  }

  return `${content.slice(0, AI_NOTE_MAX_CONTEXT_LENGTH)}\n\n[Context truncated]`;
}

export function buildAiNotePrompt(input: {
  title: string;
  username: string;
  slug: string;
  content: string;
  question: string;
}): string {
  return [
    `Note: ${input.title}`,
    `Path: /${input.username}/${input.slug}`,
    '',
    'Markdown content:',
    '```markdown',
    truncateAiNoteContext(input.content),
    '```',
    '',
    `Question: ${input.question}`,
  ].join('\n');
}

function cleanupExpiredRateLimitBuckets(now: number): void {
  if (rateLimitBuckets.size < 512) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}
