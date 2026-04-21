import type { VercelRequest, VercelResponse } from '@vercel/node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    throw new Error('Missing Spotify configuration');
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return accessToken;
}

async function fetchNowPlaying() {
  const token = await getAccessToken();

  const response = await fetch(`${API_URL}/me/player/currently-playing`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    console.error('Now playing error:', error);
    throw new Error('Failed to fetch now playing');
  }

  return response.json();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const nowPlaying = await fetchNowPlaying();
    res.json(nowPlaying);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch now playing' });
  }
}