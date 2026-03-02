import { NextResponse } from 'next/server';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { shareToken: string } }) {
  const shareToken = params.shareToken?.trim();

  if (!shareToken) {
    return NextResponse.json({ message: 'shareToken is required.' }, { status: 400 });
  }

  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const requestUrl = new URL(`/s/${shareToken}`, apiBaseUrl);

  const response = await fetch(requestUrl.toString(), {
    cache: 'no-store',
    redirect: 'manual'
  });

  const location = response.headers.get('location');
  if (!location) {
    return NextResponse.json({ message: 'Unable to refresh share link.' }, { status: 502 });
  }

  return NextResponse.json({ location });
}
