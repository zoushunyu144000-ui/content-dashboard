export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'content-intel',
    time: new Date().toISOString(),
  });
}
