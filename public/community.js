'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  let challenge = { id: 'JOBBY-W01', endsAt: '2026-10-16T23:59:00+03:00' };
  let timer;
  function updateCountdown() {
    const remaining = new Date(challenge.endsAt).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const closed = remaining <= 0;
    $('#challenge-status').textContent = closed ? 'ROUND CLOSED · REVIEWING ENTRIES' : `${challenge.id} · OPEN`;
    $('#challenge-countdown').textContent = closed ? 'Entries are closed. Highlights follow after review.' : `${Math.floor(remaining / 86400000)}d ${Math.floor(remaining / 3600000) % 24}h ${Math.floor(remaining / 60000) % 60}m remaining`;
    document.querySelectorAll('[data-submit-challenge]').forEach(button => { button.textContent = closed ? 'View the community ↗' : (button.closest('#lab') ? 'Enter this meme in the challenge ↗' : 'Participate now ↗'); });
    if (closed) clearInterval(timer);
  }
  document.querySelectorAll('[data-submit-challenge]').forEach(button => button.addEventListener('click', () => {
    const closed = Date.now() >= new Date(challenge.endsAt).getTime();
    if (closed) { window.open('https://t.me/JOBBYChat', '_blank', 'noopener,noreferrer'); return; }
    window.dispatchEvent(new CustomEvent('jobby-challenge-entry', { detail: { id: challenge.id } }));
  }));
  function safeImage(path) { return typeof path === 'string' && /^\/community\/[-a-zA-Z0-9_/.]+\.(png|jpe?g|webp)$/.test(path) && !path.includes('..'); }
  function renderGallery(entries) {
    const gallery = $('#featured-gallery');
    gallery.replaceChildren();
    for (const entry of entries) {
      if (!entry || typeof entry.creator !== 'string' || typeof entry.title !== 'string') continue;
      const article = document.createElement('article'); article.className = 'featured-entry';
      if (safeImage(entry.image)) {
        const image = document.createElement('img'); image.src = entry.image; image.alt = entry.title; image.loading = 'lazy'; image.width = image.height = 1080; article.append(image);
        const download = document.createElement('a'); download.href = entry.image; download.download = 'jobby-community-meme'; download.className = 'button button-secondary'; download.textContent = 'Download meme ↓'; article.append(download);
      }
      const title = document.createElement('h3'); title.textContent = entry.title; article.append(title);
      const creator = document.createElement('p'); creator.textContent = `Created by ${entry.creator}`; article.append(creator);
      if (typeof entry.idea === 'string') { const idea = document.createElement('p'); idea.textContent = entry.idea; article.append(idea); }
      const share = document.createElement('a'); share.href = 'https://x.com/intent/post?text=' + encodeURIComponent(`${entry.title} — by ${entry.creator}\nhttps://jobby.lol/#hall-of-fame`); share.target = '_blank'; share.rel = 'noopener noreferrer'; share.className = 'button button-secondary'; share.textContent = 'Share on X ↗'; article.append(share);
      gallery.append(article);
    }
    $('#gallery-empty').hidden = gallery.children.length > 0;
  }
  updateCountdown();
  timer = setInterval(updateCountdown, 60000);
  fetch('/community.json?v=20261009-compact-r1', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Community content unavailable'); return response.json();
  }).then(data => {
    const current = data.challenge;
    if (current && typeof current.id === 'string' && typeof current.title === 'string' && typeof current.description === 'string' && Number.isFinite(Date.parse(current.endsAt))) {
      challenge = current;
      $('#challenge-title').textContent = current.title;
      $('#challenge-description').textContent = current.description;
      $('#challenge-deadline').dateTime = current.endsAt;
      $('#challenge-deadline').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Aden', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(current.endsAt)) + ' (UTC+3)';
      $('#challenge-limit').textContent = String(Number.isInteger(current.maxFeatured) && current.maxFeatured > 0 ? current.maxFeatured : 10);
      updateCountdown();
    }
    if (Array.isArray(data.featured)) renderGallery(data.featured);
  }).catch(() => { /* The initial challenge and honest empty state remain usable offline. */ });
})();
