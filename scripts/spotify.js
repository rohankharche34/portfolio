async function fetchNowPlaying() {
  try {
    const response = await fetch('/api/now-playing');

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const data = await response.json();

    if (!data || !data.item) {
      displayNotPlaying();
      return;
    }

    displayNowPlaying(data);
  } catch (error) {
    console.error('Error fetching now playing:', error);
    displayError();
  }
}

function displayNowPlaying(data) {
  const container = document.getElementById('spotify-content');
  const track = data.item;

  container.innerHTML = `
    <div class="now-playing">
      <img src="${track.album.images[1]?.url}" alt="Album art" class="album-art">
      <div class="track-details">
        <span class="playing-label">Now Playing</span>
        <span class="track-name">${escapeHtml(track.name)}</span>
        <span class="artist-name">${track.artists.map((a) => a.name).join(', ')}</span>
        <a href="${data.context?.external_urls?.spotify || track.external_urls.spotify}" target="_blank" class="spotify-link">Open in Spotify</a>
      </div>
    </div>
  `;
}

function displayNotPlaying() {
  const container = document.getElementById('spotify-content');
  container.innerHTML = '<p>Nothing playing right now</p>';
}

function displayError() {
  const container = document.getElementById('spotify-content');
  container.innerHTML = '<p>Unable to fetch track</p>';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', fetchNowPlaying);