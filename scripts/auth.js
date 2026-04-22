import crypto from 'crypto';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5173/callback';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const scopes = ['user-read-currently-playing', 'user-read-recently-played'];

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function getToken(code, codeVerifier) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

async function main() {
  if (!clientId || !clientSecret) {
    console.error('\n❌ Error: Missing required environment variables\n');
    console.log('Set these first:');
    console.log('  export SPOTIFY_CLIENT_ID=your_client_id');
    console.log('  export SPOTIFY_CLIENT_SECRET=your_client_secret');
    console.log('  export SPOTIFY_REDIRECT_URI=https://your-app.vercel.app/ (optional)\n');
    process.exit(1);
  }

  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(16);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('show_dialog', 'true');

  console.log('\n🔐 Spotify Authorization\n');
  console.log('1. Visit this URL:\n');
  console.log(authUrl.toString());
  console.log('\n2. Authorize the app in your browser');
  console.log('\n3. After authorization, paste the full redirect URL here:');
  console.log('   (e.g., http://localhost:5173/callback?code=abc123&state=xyz)\n');

  const inputUrl = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  try {
    const redirectedUrl = new URL(inputUrl);
    const code = redirectedUrl.searchParams.get('code');
    const returnedState = redirectedUrl.searchParams.get('state');

    if (!code) {
      throw new Error('No code found in URL');
    }

    if (returnedState !== state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    console.log('\n⏳ Exchanging code for tokens...\n');
    const tokens = await getToken(code, codeVerifier);

    const newRefreshToken = tokens.refresh_token;
    console.log('\n✅ Success! Add these to Vercel Environment Variables:\n');
    console.log('─'.repeat(50));
    console.log(`SPOTIFY_CLIENT_ID=${clientId}`);
    console.log(`SPOTIFY_CLIENT_SECRET=${clientSecret}`);
    console.log(`SPOTIFY_REFRESH_TOKEN=${newRefreshToken}`);
    console.log(`SPOTIFY_REDIRECT_URI=${redirectUri}`);
    console.log('─'.repeat(50));
    console.log('\n⚠️  Keep SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN secret!\n');

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      console.log('Or insert directly into Supabase:\n');
      console.log(`INSERT INTO tokens (service, refresh_token) VALUES ('spotify', '${newRefreshToken}')`);
      console.log(`ON CONFLICT (service) DO UPDATE SET refresh_token = '${newRefreshToken}';\n`);
      console.log(`Don't forget to add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel!\n`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();