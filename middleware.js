export const config = {
  matcher: ['/'],
};

export default function middleware(req) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  // Check query param first, then fall back to cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const hasAccessCookie = cookieHeader.split(';').some(
    c => c.trim().startsWith('dp_access=1')
  );

  if (key === process.env.ACCESS_KEY) {
    // Valid key — set a cookie so future requests don't need the key
    return new Response(null, {
      status: 200,
      headers: {
        'Set-Cookie': 'dp_access=1; Path=/; Max-Age=86400; SameSite=None; Secure',
        'x-middleware-next': '1',
      },
    });
  }

  if (hasAccessCookie) {
    return;
  }

  return new Response('Access denied', { status: 403 });
}
