import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('allows paths on this site', () => {
    expect(safeNextPath('/oauth/consent?grant=abc')).toBe('/oauth/consent?grant=abc');
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back to / for %p (open redirect protection)', (next) => {
    expect(safeNextPath(next)).toBe('/');
  });
});
