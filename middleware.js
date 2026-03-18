export const config = {
  matcher: ['/'],
};

export default function middleware(req) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (key !== process.env.ACCESS_KEY) {
    return new Response('Access denied', { status: 403 });
  }
}
