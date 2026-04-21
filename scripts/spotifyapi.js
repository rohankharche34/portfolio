const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const SCOPES = ['user-read-currently-playing', 'user-read-recently-played'];
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

function getAuthUrl() {
  if (!CLIENT_ID || CLIENT_ID === 'your_spotify_client_id_here') {
    console.warn('Spotify Client ID not configured. Add it to .env file.');
    return null;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    show_dialog: 'true'
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function getAccessToken() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  
  if (token) {
    sessionStorage.setItem('spotify_token', token);
    window.location.hash = '';
  }
  
  return sessionStorage.getItem('spotify_token');
}

async function fetchCurrentlyPlaying() {
  const token = getAccessToken();
  if (!token) {
    showLoginButton();
    return;
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 204 || !response.ok) {
      displayRecentlyPlayed();
      return;
    }

    const data = await response.json();
    displayCurrentlyPlaying(data);
  } catch (error) {
    console.error('Error fetching currently playing:', error);
    displayRecentlyPlayed();
  }
}

async function displayRecentlyPlayed() {
  const token = getAccessToken();
  if (!token) return;

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch recently played');

    const data = await response.json();
    const container = document.getElementById('spotify-content');
    
    let html = '<h3>Recently Played</h3><ul class="track-list">';
    data.items.forEach(item => {
      html += `
        <li class="track-item">
          <img src="${item.track.album.images[2]?.url}" alt="Album art">
          <div class="track-info">
            <span class="track-name">${item.track.name}</span>
            <span class="artist-name">${item.track.artists.map(a => a.name).join(', ')}</span>
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
        <span class="artist-name">${track.artists.map(a => a.name).join(', ')}</span>
        <a href="${data.context?.external_urls?.spotify || track.external_urls.spotify}" target="_blank" class="spotify-link">Open in Spotify</a>
      </div>
    </div>
  `;
}

function showLoginButton() {
  const container = document.getElementById('spotify-content');
  const authUrl = getAuthUrl();
  
  if (!authUrl) {
    container.innerHTML = '<p>Spotify not configured. Add credentials to .env</p>';
    return;
  }
  
  container.innerHTML = `
    <button onclick="window.location.href='${authUrl}'" class="spotify-login-btn">
      Connect Spotify
    </button>
  `;
}

document.addEventListener('DOMContentLoaded', fetchCurrentlyPlaying);