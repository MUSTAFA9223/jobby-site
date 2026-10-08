'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const communityUrl = 'https://t.me/JOBBYChat';
  const storageKey = 'jobby-community-missions-v1';
  const missionKeys = ['community', 'create', 'conversation'];
  const presets = {
    chaos: ['THE TIMELINE IS PANICKING', 'JOBBY: ACT NATURAL.'],
    late: ['NOBODY SENT HIM THE INVITE', 'HE SHOWED UP ANYWAY.'],
    confidence: ['NO CONTEXT. NO EXPLANATION.', 'STILL THE MAIN CHARACTER.']
  };
  const scenes = {
    calm: 'Calm in the chaos.',
    mystery: 'Nobody knows. Everybody asks.',
    chaos: 'The timeline is his now.'
  };
  let selectedLook = 'spotlight';
  let toastTimer;
  let dialogTrigger;
  let missions = {};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const key of missionKeys) missions[key] = saved?.[key] === true;
  } catch {
    for (const key of missionKeys) missions[key] = false;
  }

  function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
  }

  async function copyText(text, message) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.top = '-1000px';
      document.body.appendChild(temp);
      temp.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual fallback below. */ }
      temp.remove();
      if (copied) notify(message);
      else {
        openDialog('COPY TEXT', 'Select and copy.', `<p>Automatic copying is unavailable in this browser. You can copy the text below.</p>`, []);
        const field = document.createElement('textarea');
        field.value = text;
        field.readOnly = true;
        field.style.cssText = 'width:100%;min-height:110px;margin-top:12px;padding:12px;background:#0d0a10;color:#eee;border:1px solid #655075;border-radius:6px;font:inherit';
        $('#dialog-content').appendChild(field);
        field.focus();
        field.select();
      }
    }
  }

  function setActive(buttons, active) {
    buttons.forEach(button => {
      const isActive = button === active;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  $$('.scene-button').forEach(button => button.addEventListener('click', () => {
    $('#character-stage').dataset.scene = button.dataset.scene;
    $('#scene-caption').textContent = scenes[button.dataset.scene];
    setActive($$('.scene-button'), button);
  }));

  function captionText() {
    return [$('#top-caption').value.trim(), $('#bottom-caption').value.trim(), 'JOBBY', communityUrl].filter(Boolean).join('\n\n');
  }

  function updateMeme() {
    const top = $('#top-caption').value;
    const bottom = $('#bottom-caption').value;
    $('#preview-top').textContent = top;
    $('#preview-bottom').textContent = bottom;
    $('#top-count').textContent = `${top.length}/64`;
    $('#bottom-count').textContent = `${bottom.length}/64`;
    $('#x-draft').href = 'https://x.com/intent/post?text=' + encodeURIComponent(captionText());
  }

  $$('.preset').forEach(button => button.addEventListener('click', () => {
    const [top, bottom] = presets[button.dataset.preset];
    $('#top-caption').value = top;
    $('#bottom-caption').value = bottom;
    setActive($$('.preset'), button);
    updateMeme();
  }));

  ['#top-caption', '#bottom-caption'].forEach(selector => $(selector).addEventListener('input', () => {
    $(selector).value = $(selector).value.slice(0, 64);
    setActive($$('.preset'), null);
    updateMeme();
  }));

  $$('.look-button').forEach(button => button.addEventListener('click', () => {
    selectedLook = button.dataset.look;
    $('#meme-preview').dataset.look = selectedLook;
    setActive($$('.look-button'), button);
  }));

  $('#copy-caption').addEventListener('click', () => copyText(captionText(), 'Caption copied.'));
  $('#copy-invite').addEventListener('click', () => copyText(communityUrl, 'Community invite copied.'));

  function wrapText(ctx, text, width) {
    const lines = [];
    let line = '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      // Break long unspaced captions too, so nothing runs past the canvas.
      const parts = [];
      let part = '';
      for (const char of word) {
        if (ctx.measureText(part + char).width > width && part) { parts.push(part); part = char; }
        else part += char;
      }
      if (part) parts.push(part);
      for (const piece of parts) {
        const attempt = line ? `${line} ${piece}` : piece;
        if (ctx.measureText(attempt).width > width && line) { lines.push(line); line = piece; }
        else line = attempt;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function paintCaption(ctx, text, centerY, color) {
    let fontSize = 58;
    let lines;
    do {
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      lines = wrapText(ctx, text, 950);
      if (lines.length <= 2) break;
      fontSize -= 2;
    } while (fontSize > 30);
    const spacing = fontSize * 1.1;
    const y = centerY - (lines.length - 1) * spacing / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#09090b';
    ctx.fillStyle = color;
    lines.forEach((line, i) => { ctx.strokeText(line, 540, y + i * spacing); ctx.fillText(line, 540, y + i * spacing); });
  }

  $('#download-meme').addEventListener('click', async () => {
    const button = $('#download-meme');
    button.disabled = true;
    button.textContent = 'Preparing image…';
    $('#download-error').hidden = true;
    try {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('The character image could not load.'));
      });
      image.src = '/jobby-official-20261005.png';
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image export is unavailable in this browser.');
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 1080, 1080);
      if (selectedLook === 'spotlight') {
        const glow = ctx.createRadialGradient(540, 550, 30, 540, 580, 570);
        glow.addColorStop(0, '#533866');
        glow.addColorStop(.48, '#19111f');
        glow.addColorStop(1, '#09090b');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 1080, 1080);
      }
      const imageHeight = 720;
      const imageWidth = image.naturalWidth / image.naturalHeight * imageHeight;
      ctx.drawImage(image, (1080 - imageWidth) / 2, 180, imageWidth, imageHeight);
      paintCaption(ctx, $('#top-caption').value, 85, '#f4f0e9');
      paintCaption(ctx, $('#bottom-caption').value, 972, '#d9befd');
      ctx.font = '700 15px Arial, sans-serif';
      ctx.fillStyle = '#9b86b0';
      ctx.fillText('JOBBY', 540, 1052);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Image export did not complete. Please try again.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'jobby-meme.png';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify('Your 1080 × 1080 meme is ready.');
    } catch (error) {
      $('#download-error').textContent = error.message || 'Image export failed. Please try again.';
      $('#download-error').hidden = false;
    } finally {
      button.disabled = false;
      button.innerHTML = 'Download PNG <span aria-hidden="true">↓</span>';
    }
  });

  function updateMissions(persist = false) {
    const count = missionKeys.filter(key => missions[key]).length;
    $('#progress-label').textContent = `${count} of 3 explored`;
    $('#progress-track').setAttribute('aria-valuenow', String(count));
    $('#progress-fill').style.width = `${count / 3 * 100}%`;
    $$('[data-check]').forEach(input => { input.checked = missions[input.dataset.check]; });
    $$('[data-mission]').forEach(row => { row.classList.toggle('complete', missions[row.dataset.mission]); });
    if (persist) {
      try { localStorage.setItem(storageKey, JSON.stringify(missions)); }
      catch { notify('Checklist updated. This browser cannot save it between visits.'); }
    }
  }

  $$('[data-check]').forEach(input => input.addEventListener('change', () => {
    missions[input.dataset.check] = input.checked;
    updateMissions(true);
  }));

  function openDialog(eyebrow, title, content, actions) {
    dialogTrigger = document.activeElement;
    $('#dialog-eyebrow').textContent = eyebrow;
    $('#dialog-title').textContent = title;
    $('#dialog-content').innerHTML = content;
    $('#dialog-actions').replaceChildren();
    actions.forEach(action => {
      const element = document.createElement(action.href ? 'a' : 'button');
      element.className = 'button ' + (action.primary ? 'button-primary' : 'button-secondary');
      element.textContent = action.label;
      if (action.href) {
        element.href = action.href;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      } else element.addEventListener('click', action.run);
      $('#dialog-actions').appendChild(element);
    });
    if (!$('#story-dialog').open) $('#story-dialog').showModal();
    $('.dialog-close').focus();
  }

  function openMemeLab() {
    const lab = $('#lab');
    const fold = lab.closest('details');
    if (fold) fold.open = true;
    lab.scrollIntoView({ behavior: 'smooth' });
  }

  function closeDialog() { $('#story-dialog').close(); }
  window.addEventListener('jobby-challenge-entry', event => {
    const entryId = String(event.detail?.id || 'JOBBY-W01').replace(/[^a-zA-Z0-9-]/g, '');
    openDialog('WEEKLY CHALLENGE', 'Share it with the community.', '<p>Download your PNG from the meme lab, or write an original idea. Open JOBBYChat and attach your image yourself.</p><ol><li>Include #JOBBYChallenge and your public display name.</li><li>Use the current official JOBBY character and your own joke.</li><li>Submit before the deadline shown in the weekly challenge.</li></ol><p>Selected contributions may appear on the site and official channels with your public name. No image is sent automatically.</p>', [
      {label:'Open JOBBYChat ↗',href:communityUrl,primary:true},
      {label:'Copy entry caption',run:()=>copyText('#JOBBYChallenge · ' + entryId + '\n\n' + captionText(), 'Entry caption copied. Attach your PNG in JOBBYChat.')},
      {label:'Create a meme ↓',run:()=>{closeDialog();openMemeLab();}}
    ]);
  });
  $('.dialog-close').addEventListener('click', closeDialog);
  $('#story-dialog').addEventListener('close', () => dialogTrigger?.focus());
  $('#story-dialog').addEventListener('click', event => {
    if (event.target !== $('#story-dialog')) return;
    const bounds = $('#story-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
  });

  $('#meet-button').addEventListener('click', () => openDialog('THE CHARACTER', 'He showed up anyway.', '<img src="/jobby-official-20261005.png" alt="Official JOBBY"><p>JOBBY is the unexpected face in a familiar situation. Calm when everyone panics. Confident without an explanation.</p><p>The character is the starting point. The community turns the moments into memes.</p>', [
    { label: 'Try the meme lab ↓', primary: true, run: () => { closeDialog(); openMemeLab(); } },
    { label: 'Meet the community ↗', href: communityUrl }
  ]));

  const missionDetails = {
    community: ['CONNECT', 'Find your people.', '<p>Join JOBBYChat to meet the community, explore original memes, and share your own ideas. The official channel keeps announcements in one place.</p>', [
      {label:'Open community ↗',href:communityUrl,primary:true},
      {label:'Official updates ↗',href:'https://t.me/JOBBYSOL'}
    ]],
    create: ['CREATE', 'Make your first JOBBY meme.', '<p>Pick a familiar situation in the meme lab, write your own setup and response, then download the image. Keep the original character and make the joke yours.</p>', [
      {label:'Go to meme lab ↓',primary:true,run:()=>{closeDialog();openMemeLab();$('#top-caption').focus({preventScroll:true});}}
    ]],
    conversation: ['CONTRIBUTE', 'Bring your own perspective.', '<p>Follow @JOBBYSOL and explore the conversation. A thoughtful reply, a new idea, or an original meme is a good way to participate.</p><p>The checklist is yours to mark after you’ve explored. It doesn’t verify external actions.</p>', [
      {label:'Explore JOBBY on X ↗',href:'https://x.com/JOBBYSOL',primary:true},
      {label:'Open your meme draft ↗',href:()=>$('#x-draft').href}
    ]]
  };
  $$('[data-open-mission]').forEach(button => button.addEventListener('click', () => {
    const [eyebrow, title, content, actions] = missionDetails[button.dataset.openMission];
    openDialog(eyebrow, title, content, actions.map(action => ({...action, href: typeof action.href === 'function' ? action.href() : action.href})));
  }));

  $('#reset-progress').addEventListener('click', () => openDialog('YOUR CHECKLIST', 'Start fresh?', '<p>This will clear the three explored items saved on this device.</p>', [
    {label:'Reset checklist',primary:true,run:()=>{for(const key of missionKeys)missions[key]=false;updateMissions(true);closeDialog();notify('Checklist reset.');}},
    {label:'Keep progress',run:closeDialog}
  ]));

  function closeMenu() {
    $('#mobile-nav').hidden = true;
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    $('#menu-toggle').setAttribute('aria-label', 'Open menu');
  }
  $('#menu-toggle').addEventListener('click', () => {
    const expanded = $('#menu-toggle').getAttribute('aria-expanded') === 'true';
    $('#mobile-nav').hidden = expanded;
    $('#menu-toggle').setAttribute('aria-expanded', String(!expanded));
    $('#menu-toggle').setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
  });
  $$('#mobile-nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); });
  updateMeme();
  updateMissions();
})();
