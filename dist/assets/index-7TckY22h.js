(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))a(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&a(s)}).observe(document,{childList:!0,subtree:!0});function o(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerPolicy&&(n.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?n.credentials="include":t.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function a(t){if(t.ep)return;t.ep=!0;const n=o(t);fetch(t.href,n)}})();const u="test_client_id",p="https://rohankharche34.github.io/portfolio/",d=["user-read-currently-playing","user-read-recently-played"],f="https://accounts.spotify.com/authorize";function y(){const r=new URLSearchParams({client_id:u,response_type:"token",redirect_uri:p,scope:d.join(" "),show_dialog:"true"});return`${f}?${r.toString()}`}function c(){const r=window.location.hash,o=new URLSearchParams(r.substring(1)).get("access_token");return o&&(sessionStorage.setItem("spotify_token",o),window.location.hash=""),sessionStorage.getItem("spotify_token")}async function m(){const r=c();if(!r){g();return}try{const e=await fetch("https://api.spotify.com/v1/me/player/currently-playing",{headers:{Authorization:`Bearer ${r}`}});if(e.status===204||!e.ok){i();return}const o=await e.json();h(o)}catch(e){console.error("Error fetching currently playing:",e),i()}}async function i(){const r=c();if(r)try{const e=await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=5",{headers:{Authorization:`Bearer ${r}`}});if(!e.ok)throw new Error("Failed to fetch recently played");const o=await e.json(),a=document.getElementById("spotify-content");let t='<h3>Recently Played</h3><ul class="track-list">';o.items.forEach(n=>{var s;t+=`
        <li class="track-item">
          <img src="${(s=n.track.album.images[2])==null?void 0:s.url}" alt="Album art">
          <div class="track-info">
            <span class="track-name">${n.track.name}</span>
            <span class="artist-name">${n.track.artists.map(l=>l.name).join(", ")}</span>
          </div>
        </li>
      `}),t+="</ul>",a.innerHTML=t}catch(e){console.error("Error:",e)}}function h(r){var a,t,n;const e=document.getElementById("spotify-content"),o=r.item;e.innerHTML=`
    <div class="now-playing">
      <img src="${(a=o.album.images[1])==null?void 0:a.url}" alt="Album art" class="album-art">
      <div class="track-details">
        <span class="playing-label">Now Playing</span>
        <span class="track-name">${o.name}</span>
        <span class="artist-name">${o.artists.map(s=>s.name).join(", ")}</span>
        <a href="${((n=(t=r.context)==null?void 0:t.external_urls)==null?void 0:n.spotify)||o.external_urls.spotify}" target="_blank" class="spotify-link">Open in Spotify</a>
      </div>
    </div>
  `}function g(){const r=document.getElementById("spotify-content"),e=y();if(!e){r.innerHTML="<p>Spotify not configured. Add credentials to .env</p>";return}r.innerHTML=`
    <button onclick="window.location.href='${e}'" class="spotify-login-btn">
      Connect Spotify
    </button>
  `}document.addEventListener("DOMContentLoaded",m);
