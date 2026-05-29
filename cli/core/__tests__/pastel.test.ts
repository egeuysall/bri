import { describe, expect, test } from 'bun:test';
import { shouldRenderSpinner } from '../pastel';

describe('RunCommand spinner rendering', () => {
  test('hides the spinner for streaming stdout commands', () => {
    expect(shouldRenderSpinner({ streaming: true })).toBe(false);
  });

  test('renders the spinner for normal interactive commands', () => {
    expect(shouldRenderSpinner({})).toBe(true);
  });
});
