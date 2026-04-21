import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, codeVerifier, refreshToken } = req.body;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    let body;

    if (refreshToken) {
      body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
    } else if (code && codeVerifier) {
      body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });
    } else {
      res.status(400).json({ error: 'Missing code or refresh token' });
      return;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Spotify token error:', errorData);
      res.status(response.status).json({ error: 'Token exchange failed' });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}