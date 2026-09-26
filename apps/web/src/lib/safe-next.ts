// Where to go after signing in, from a `?next=` parameter. Only same-site paths are allowed:
// otherwise "/login?next=https://evil.example" would turn our login page into a redirect to a
// phishing site (an "open redirect").
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
