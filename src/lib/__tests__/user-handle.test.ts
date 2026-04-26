import { describe, expect, test } from 'bun:test';
import { isPublicResourcePath, isPublicUsernamePath, normalizePathHandle } from '../user-handle';

describe('public username paths', () => {
  test('rejects static asset names before they reach dynamic username routes', () => {
    expect(isPublicUsernamePath('favicon.ico')).toBe(false);
    expect(isPublicUsernamePath('favicon.png')).toBe(false);
    expect(isPublicUsernamePath('robots.txt')).toBe(false);
    expect(isPublicUsernamePath('swagger-ui.html')).toBe(false);
  });

  test('accepts normalized user handles', () => {
    expect(isPublicUsernamePath('egeuysall')).toBe(true);
    expect(isPublicUsernamePath('ege_wrk-1')).toBe(true);
    expect(normalizePathHandle(' Ege Uysall ')).toBe('egeuysall');
  });
});

describe('public resource paths', () => {
  test('rejects static-looking slug segments before auth runs', () => {
    expect(isPublicResourcePath('index.html')).toBe(false);
    expect(isPublicResourcePath('swagger-ui.css')).toBe(false);
  });

  test('accepts normalized note slugs and quick-link keys', () => {
    expect(isPublicResourcePath('launch-notes')).toBe(true);
    expect(isPublicResourcePath('ql_key-1')).toBe(true);
  });
});
