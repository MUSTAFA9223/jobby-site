'use strict';
(() => {
  document.querySelectorAll('[data-starter]').forEach(button => button.addEventListener('click', () => {
    const preset = document.querySelector('[data-preset="' + button.dataset.starter + '"]');
    if (preset) { preset.click(); document.querySelector('#lab').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); document.querySelector('#top-caption').focus({ preventScroll: true }); }
  }));
  function render(items, listId, emptyId, type) {
    const list = document.getElementById(listId); if (!list || !Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item.title !== 'string' || typeof item.description !== 'string') continue;
      const article = document.createElement('article'); article.className = 'hub-card';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      const description = document.createElement('p'); description.textContent = item.description;
      article.append(heading, description);
      if (type === 'archive' && typeof item.id === 'string') { const label = document.createElement('span'); label.className = 'eyebrow'; label.textContent = item.id; article.prepend(label); }
      if (typeof item.image === 'string' && /^\/community\/[-a-zA-Z0-9_/.]+\.(png|jpe?g|webp)$/.test(item.image) && !item.image.includes('..')) { const image = document.createElement('img'); image.src = item.image; image.alt = item.title; image.loading = 'lazy'; image.style.cssText = 'width:100%;height:auto;border-radius:8px'; article.prepend(image); }
      list.append(article);
    }
    const empty = document.getElementById(emptyId); if (empty) empty.hidden = list.children.length > 0;
  }
  fetch('/community.json?v=20261009-community-r6', { cache: 'no-cache' }).then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); }).then(data => {
    render(data.contributors, 'contributors-list', 'contributors-empty', 'contributors');
    render(data.archive, 'archive-list', 'archive-empty', 'archive');
  }).catch(() => {});
})();
