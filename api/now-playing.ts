import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

let accessToken: string | null = null;
let tokenExpiry: number = 0;
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

async function getStoredRefreshToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return SPOTIFY_REFRESH_TOKEN || null;

  const { data } = await sb
    .from('tokens')
    .select('refresh_token')
    .eq('service', 'spotify')
    .single();

  return data?.refresh_token || SPOTIFY_REFRESH_TOKEN || null;
}

async function saveRefreshToken(token: string) {
  const sb = getSupabase();
  if (!sb) {
    console.warn('Supabase not configured, token not persisted');
    return;
  }

  const { error } = await sb
    .from('tokens')
    .upsert({ service: 'spotify', refresh_token: token }, { onConflict: 'service' });

  if (error) {
    console.error('Failed to save refresh token:', error);
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error(`Missing config: clientId=${!!SPOTIFY_CLIENT_ID}, clientSecret=${!!SPOTIFY_CLIENT_SECRET}`);
  }

  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
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
      refresh_token: refreshToken,
    }),
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error('Token refresh error:', response.status, responseText);
    throw new Error(`Token refresh failed: ${response.status} - ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Invalid JSON from Spotify');
  }

  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  if (data.refresh_token) {
    await saveRefreshToken(data.refresh_token);
  }

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

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error('Now playing error:', response.status, responseText);
    throw new Error(`API call failed: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    res.status(500).json({ error: message });
  }
}