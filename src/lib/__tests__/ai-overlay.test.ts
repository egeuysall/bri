import { describe, expect, test } from 'bun:test';
import {
  AI_NOTE_MAX_QUESTION_LENGTH,
  checkAiOverlayRateLimit,
  parseAiNoteRequest,
} from '../ai-overlay';

describe('AI note request parsing', () => {
  test('accepts normalized note question input', () => {
    expect(
      parseAiNoteRequest({
        username: ' Ege_Uysal ',
        slug: ' launch-notes ',
        question: '  What changed?  ',
      })
    ).toEqual({
      username: 'ege_uysal',
      slug: 'launch-notes',
      question: 'What changed?',
    });
  });

  test('rejects invalid path segments and oversized questions', () => {
    expect(parseAiNoteRequest({ username: 'favicon.ico', slug: 'note', question: 'ok' })).toBeNull();
    expect(parseAiNoteRequest({ username: 'ege', slug: 'index.html', question: 'ok' })).toBeNull();
    expect(
      parseAiNoteRequest({
        username: 'ege',
        slug: 'note',
        question: 'x'.repeat(AI_NOTE_MAX_QUESTION_LENGTH + 1),
      })
    ).toBeNull();
  });
});

describe('AI overlay rate limit', () => {
  test('allows requests up to the window limit then reports retry time', () => {
    const now = 1_000;
    const key = '203.0.113.12:/ege/note';

    for (let index = 0; index < 8; index += 1) {
      expect(checkAiOverlayRateLimit(key, now)).toEqual({ allowed: true });
    }

    const limited = checkAiOverlayRateLimit(key, now + 1);
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBe(60);
  });

  test('resets the bucket after the window expires', () => {
    const key = '198.51.100.8:/ege/note';
    for (let index = 0; index < 8; index += 1) {
      checkAiOverlayRateLimit(key, 10_000);
    }

    expect(checkAiOverlayRateLimit(key, 70_001)).toEqual({ allowed: true });
  });
});
