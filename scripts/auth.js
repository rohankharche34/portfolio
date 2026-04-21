import crypto from 'crypto';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5173/callback';
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

async function main() {
  if (!clientId) {
    console.error('Error: SPOTIFY_CLIENT_ID not set');
    console.log('\nSet it first:');
    console.log('  export SPOTIFY_CLIENT_ID=your_client_id');
    console.log('  export SPOTIFY_REDIRECT_URI=your_redirect_uri (optional, defaults to localhost)');
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

  console.log('\n🔐 Spotify Authorization\n');
  console.log('1. Visit this URL:\n');
  console.log(authUrl.toString());
  console.log('\n2. Authorize the app');
  console.log('\n3. Copy the "code" parameter from the redirect URL');
  console.log('   (it will look like: http://localhost:5173/callback?code=...&state=...)\n');

  const code = await new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question('Enter the code from the URL: ', (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('\n❌ Failed to get tokens:', error);
    process.exit(1);
  }

  const tokens = await tokenResponse.json();

  console.log('\n✅ Success! Add these to your Vercel environment variables:\n');
  console.log(`SPOTIFY_CLIENT_ID=${clientId}`);
  console.log(`SPOTIFY_CLIENT_SECRET=${process.env.SPOTIFY_CLIENT_SECRET}`);
  console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('\n⚠️  Your client secret is in the token response - keep it secret!\n');
}

main();