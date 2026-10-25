import { describe, expect, it } from 'bun:test';
import { parseIBXFileMention } from './ibx-file-mention';

describe('IBX file mentions', () => {
  it('matches a query and stops at spaces', () => {
    expect(parseIBXFileMention('use @songs')).toEqual({ query: 'songs', markerOffset: 4 });
    expect(parseIBXFileMention('use @songs new')).toBeNull();
  });

  it('does not treat email addresses as file mentions', () => {
    expect(parseIBXFileMention('name@example.com')).toBeNull();
  });
});
