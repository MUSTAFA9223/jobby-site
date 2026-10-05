const menuButton = document.querySelector('#menuButton');
const siteNav = document.querySelector('#siteNav');
const siteHeader = document.querySelector('#siteHeader');
const heroArt = document.querySelector('#heroArt');
const solanaButton = document.querySelector('#solanaButton');
const toast = document.querySelector('#toast');
const moodChips = document.querySelector('#moodChips');
const sceneChips = document.querySelector('#sceneChips');
const customRow = document.querySelector('#customRow');
const customScene = document.querySelector('#customScene');
const generateMeme = document.querySelector('#generateMeme');
const memeOutput = document.querySelector('#memeOutput');
const copyCaption = document.querySelector('#copyCaption');
const copyPrompt = document.querySelector('#copyPrompt');
const randomizeMeme = document.querySelector('#randomizeMeme');
const copyStarterPrompt = document.querySelector('#copyStarterPrompt');

const moods = {
  smug: { label: 'smug', face: 'half-lidded eyes and a tiny knowing grin' },
  shocked: { label: 'shocked', face: 'wide eyes and an open mouth' },
  fomo: { label: 'FOMO-crazed', face: 'huge excited eyes and frantic energy' },
  confused: { label: 'confused', face: 'a tilted head and suspicious side-eye' },
  sleepy: { label: 'sleepy', face: 'heavy eyelids and zero urgency' }
};

const scenes = {
  'green candle': {
    idea: 'JOBBY sees one green candle and immediately acts like the bull market personally called him back.',
    caption: 'me after one green candle'
  },
  'buying the dip': {
    idea: 'JOBBY presses BUY with total confidence while the chart keeps falling behind him.',
    caption: 'buying the dip for the 14th time'
  },
  'group chat rumor': {
    idea: 'JOBBY reads one “trust me bro” message, nods like he finished a PhD, then opens the chart.',
    caption: 'the group chat said trust me bro'
  },
  'late to the trend': {
    idea: 'JOBBY finally arrives looking confident after everybody else already posted, pumped and moved on.',
    caption: 'me discovering the trend 6 hours late'
  }
};

let selectedMood = 'smug';
let selectedScene = 'green candle';
let lastCaption = scenes[selectedScene].caption;
let lastPrompt = '';

function closeMenu() {
  if (!menuButton || !siteNav) return;
  menuButton.setAttribute('aria-expanded', 'false');
  siteNav.classList.remove('open');
  document.body.classList.remove('menu-open');
}

if (menuButton && siteNav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    siteNav.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });
  siteNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
}

window.addEventListener('scroll', () => {
  if (siteHeader) siteHeader.classList.toggle('compact', window.scrollY > 60);
}, { passive: true });

if (heroArt && window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', event => {
    const x = (event.clientX / innerWidth - .5) * 12;
    const y = (event.clientY / innerHeight - .5) * 8;
    heroArt.style.setProperty('--mx', `${x}px`);
    heroArt.style.setProperty('--my', `${y}px`);
  }, { passive: true });
}

if (solanaButton) {
  const showSoon = () => {
    solanaButton.classList.add('is-soon');
    clearTimeout(showSoon.timer);
    showSoon.timer = setTimeout(() => solanaButton.classList.remove('is-soon'), 1500);
  };
  solanaButton.addEventListener('click', showSoon);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function selectChip(container, button, type) {
  if (!container || !button) return;
  container.querySelectorAll('button').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  if (type === 'mood') selectedMood = button.dataset.mood;
  if (type === 'scene') {
    selectedScene = button.dataset.scene;
    if (customRow) customRow.hidden = selectedScene !== 'custom';
    if (selectedScene === 'custom' && customScene) customScene.focus();
  }
}

if (moodChips) moodChips.addEventListener('click', event => {
  const button = event.target.closest('button[data-mood]');
  if (button) selectChip(moodChips, button, 'mood');
});
if (sceneChips) sceneChips.addEventListener('click', event => {
  const button = event.target.closest('button[data-scene]');
  if (button) selectChip(sceneChips, button, 'scene');
});

function buildMeme() {
  const mood = moods[selectedMood] || moods.smug;
  let sceneName = selectedScene;
  let data = scenes[selectedScene];
  if (selectedScene === 'custom') {
    const custom = (customScene?.value || '').trim().slice(0, 70);
    sceneName = custom || 'a completely unnecessary crypto situation';
    data = {
      idea: `JOBBY walks into “${sceneName}” with absolutely unjustified confidence and somehow becomes the reaction image.`,
      caption: `jobby when ${sceneName}`
    };
  }
  lastCaption = data.caption;
  lastPrompt = `Create a clean, highly shareable Crypto X meme image featuring JOBBY, the exact cream-colored creature with soft purple antenna tips, purple toe tips, black eyes and the same body proportions. Expression: ${mood.face}. Situation: ${sceneName}. Joke: ${data.idea} Keep JOBBY instantly recognizable. Do not add a crown. Do not force the tongue out; only use it if the expression naturally needs it. Simple composition, strong facial reaction, readable in one second, premium 3D cartoon render, no watermark.`;

  if (memeOutput) {
    memeOutput.replaceChildren();
    const small = document.createElement('small');
    small.textContent = `MEME IDEA · ${mood.label.toUpperCase()}`;
    const strong = document.createElement('strong');
    strong.textContent = data.idea;
    const p = document.createElement('p');
    p.textContent = `Caption: “${lastCaption}”`;
    memeOutput.append(small, strong, p);
  }
}

if (generateMeme) generateMeme.addEventListener('click', buildMeme);
if (customScene) customScene.addEventListener('keydown', event => { if (event.key === 'Enter') buildMeme(); });

async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(success);
  } catch {
    showToast('COPY FAILED');
  }
}

if (copyCaption) copyCaption.addEventListener('click', () => copyText(lastCaption, 'CAPTION COPIED'));
if (copyPrompt) copyPrompt.addEventListener('click', () => {
  if (!lastPrompt) buildMeme();
  copyText(lastPrompt, 'PROMPT COPIED');
});
if (copyStarterPrompt) copyStarterPrompt.addEventListener('click', () => {
  const prompt = 'Use the provided JOBBY mascot as the exact character reference. Keep the cream body, soft purple antenna tips and toes, black eyes, proportions and face identity unchanged. Put JOBBY into a new funny situation that is understandable in one second. Keep the composition simple and meme-ready. Do not add a crown. Do not keep the tongue out in every image; vary the mouth and expression naturally.';
  copyText(prompt, 'STARTER PROMPT COPIED');
});

if (randomizeMeme) randomizeMeme.addEventListener('click', () => {
  const moodButtons = [...(moodChips?.querySelectorAll('button[data-mood]') || [])];
  const sceneButtons = [...(sceneChips?.querySelectorAll('button[data-scene]:not([data-scene="custom"])') || [])];
  const m = moodButtons[Math.floor(Math.random() * moodButtons.length)];
  const s = sceneButtons[Math.floor(Math.random() * sceneButtons.length)];
  if (m) selectChip(moodChips, m, 'mood');
  if (s) selectChip(sceneChips, s, 'scene');
  buildMeme();
});

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .1 })
  : null;

document.querySelectorAll('.reveal').forEach(element => {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add('visible');
});

const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());
buildMeme();
