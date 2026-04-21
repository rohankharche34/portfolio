const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const SCOPES = ['user-read-currently-playing', 'user-read-recently-played'];
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const API_BASE = 'https://api.spotify.com/v1';

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

async function getAuthUrl() {
  if (!CLIENT_ID || CLIENT_ID === 'your_spotify_client_id_here') {
    return null;
  }
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(16);

  sessionStorage.setItem('spotify_code_verifier', codeVerifier);
  sessionStorage.setItem('spotify_auth_state', state);

  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

function getStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('state');
}

async function exchangeCodeForToken(code, codeVerifier) {
  const response = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

function saveTokens(data) {
  sessionStorage.setItem('spotify_access_token', data.access_token);
  sessionStorage.setItem('spotify_refresh_token', data.refresh_token);
  sessionStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);
}

function getAccessToken() {
  return sessionStorage.getItem('spotify_access_token');
}

async function ensureValidToken() {
  const expiry = sessionStorage.getItem('spotify_token_expiry');
  if (expiry && Date.now() < parseInt(expiry) - 60000) {
    return getAccessToken();
  }

  const refreshToken = sessionStorage.getItem('spotify_refresh_token');
  if (refreshToken) {
    return refreshAccessToken(refreshToken);
  }

  return null;
}

async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      sessionStorage.clear();
      return null;
    }

    const data = await response.json();
    saveTokens(data);
    return data.access_token;
  } catch (error) {
    sessionStorage.clear();
    return null;
  }
}

async function handleCallback() {
  const code = getCodeFromUrl();
  const state = getStateFromUrl();
  const savedState = sessionStorage.getItem('spotify_auth_state');

  if (state !== savedState) {
    console.error('State mismatch');
    return;
  }

  if (code) {
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
    try {
      const data = await exchangeCodeForToken(code, codeVerifier);
      saveTokens(data);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Token exchange error:', error);
    }
  }
}

async function fetchCurrentlyPlaying() {
  const token = await ensureValidToken();
  if (!token) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 204 || !response.ok) {
      displayRecentlyPlayed(token);
      return;
    }

    const data = await response.json();
    displayCurrentlyPlaying(data);
  } catch (error) {
    console.error('Error fetching currently playing:', error);
    displayRecentlyPlayed(token);
  }
}

async function displayRecentlyPlayed(token) {
  try {
    const response = await fetch(`${API_BASE}/me/player/recently-played?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch recently played');

    const data = await response.json();
    const container = document.getElementById('spotify-content');

    let html = '<h3>Recently Played</h3><ul class="track-list">';
    data.items.forEach((item) => {
      html += `
        <li class="track-item">
          <img src="${item.track.album.images[2]?.url}" alt="Album art">
          <div class="track-info">
            <span class="track-name">${item.track.name}</span>
            <span class="artist-name">${item.track.artists.map((a) => a.name).join(', ')}</span>
          </div>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayCurrentlyPlaying(data) {
  const container = document.getElementById('spotify-content');
  const track = data.item;

  container.innerHTML = `
    <div class="now-playing">
      <img src="${track.album.images[1]?.url}" alt="Album art" class="album-art">
      <div class="track-details">
        <span class="playing-label">Now Playing</span>
        <span class="track-name">${track.name}</span>
        <span class="artist-name">${track.artists.map((a) => a.name).join(', ')}</span>
        <a href="${data.context?.external_urls?.spotify || track.external_urls.spotify}" target="_blank" class="spotify-link">Open in Spotify</a>
      </div>
    </div>
  `;
}

function showLoginButton(authUrl) {
  const container = document.getElementById('spotify-content');
  container.innerHTML = `
    <button onclick="window.location.href='${authUrl}'" class="spotify-login-btn">
      Connect Spotify
    </button>
  `;
}

function showNotConfigured() {
  const container = document.getElementById('spotify-content');
  container.innerHTML = '<p>Spotify not configured. Add credentials to .env</p>';
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.search.includes('code=')) {
    await handleCallback();
  }

  const token = getAccessToken();
  if (token) {
    fetchCurrentlyPlaying();
    return;
  }

  const authUrl = await getAuthUrl();
  if (!authUrl) {
    showNotConfigured();
    return;
  }

  showLoginButton(authUrl);
});