'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  let challenge = { id: 'JOBBY-MEME-2026-10' };
  document.querySelectorAll('[data-submit-challenge]').forEach(button => button.addEventListener('click', () => {
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
    $('#hall-of-fame').hidden = gallery.children.length === 0;
  }
  fetch('/community.json?v=20261010-contest-r2', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Community content unavailable');
    return response.json();
  }).then(data => {
    const current = data.challenge;
    if (current && typeof current.id === 'string' && typeof current.title === 'string' && typeof current.description === 'string') {
      challenge = current;
      $('#challenge-description').textContent = current.description;
    }
    if (Array.isArray(data.featured)) renderGallery(data.featured);
  }).catch(() => { /* Keep the current contest text and a hidden empty gallery. */ });
})();
