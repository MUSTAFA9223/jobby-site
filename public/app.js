const task = document.getElementById("task");
const result = document.getElementById("result");
const doJob = document.getElementById("doJob");
const randomJob = document.getElementById("randomJob");
const shareJob = document.getElementById("shareJob");
const terminalText = document.getElementById("terminalText");
const cursorGlow = document.getElementById("cursorGlow");

const jobs = [
  "Hold the chart",
  "Guard the green candle",
  "Press one button",
  "Carry one bag",
  "Post one meme",
  "Keep the floor clean",
  "Watch the market for five minutes",
  "Do not touch anything"
];

const outcomes = [
  "JOBBY finished the job. Unfortunately, it was the wrong job.",
  "Task accepted. JOBBY somehow made it a community event.",
  "JOBBY tried. The task now needs a recovery team.",
  "JOBBY says it was like that when he arrived.",
  "Mission complete. Nobody asked what happened next.",
  "JOBBY followed the instructions. Just not in the right order.",
  "The good news: JOBBY showed up. The bad news: JOBBY showed up."
];

let lastJob = "";
let lastOutcome = "";

function renderResult(label, message) {
  result.replaceChildren();
  const labelNode = document.createElement("span");
  labelNode.className = "result-label";
  labelNode.textContent = label;

  const messageNode = document.createElement("strong");
  messageNode.textContent = message;

  result.append(labelNode, messageNode);
}

function runJob() {
  const value = task.value.trim();
  if (!value) {
    renderResult("JOBBY STATUS", "Give him one job first.");
    task.focus();
    return;
  }

  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  lastJob = value;
  lastOutcome = outcome;

  renderResult("JOB: " + value.toUpperCase(), outcome);
  terminalText.textContent = "job complete // outcome questionable";
  shareJob.disabled = false;
}

doJob.addEventListener("click", runJob);

task.addEventListener("keydown", event => {
  if (event.key === "Enter") runJob();
});

randomJob.addEventListener("click", () => {
  task.value = jobs[Math.floor(Math.random() * jobs.length)];
  runJob();
});

shareJob.addEventListener("click", () => {
  if (!lastJob || !lastOutcome) return;
  const text = [
    "I gave JOBBY one job:",
    '"' + lastJob + '"',
    "",
    lastOutcome,
    "",
    "$JOBBY @JOBBYSOL"
  ].join("\n");
  const url = "https://x.com/intent/post?text=" + encodeURIComponent(text);
  window.open(url, "_blank", "noopener,noreferrer");
});

if (window.matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", event => {
    cursorGlow.style.left = event.clientX + "px";
    cursorGlow.style.top = event.clientY + "px";
  });
}

const terminalLines = [
  "waiting for next job...",
  "confidence module: 100%",
  "instruction manual: unopened",
  "community channel: online"
];

let lineIndex = 0;
setInterval(() => {
  lineIndex = (lineIndex + 1) % terminalLines.length;
  terminalText.textContent = terminalLines[lineIndex];
}, 2800);

const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealItems.forEach(item => observer.observe(item));

const heroVisual = document.getElementById("heroVisual");
if (heroVisual && window.matchMedia("(pointer:fine)").matches) {
  heroVisual.addEventListener("pointermove", event => {
    const box = heroVisual.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    heroVisual.style.transform = "perspective(1000px) rotateY(" + (x * 4) + "deg) rotateX(" + (-y * 3) + "deg)";
  });
  heroVisual.addEventListener("pointerleave", () => {
    heroVisual.style.transform = "";
  });
}

const scrollProgress = document.getElementById("scrollProgress");
const updateScrollProgress = () => {
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
  scrollProgress.style.width = pct + "%";
};
window.addEventListener("scroll", updateScrollProgress, { passive: true });
updateScrollProgress();

const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
if (menuToggle && mobileMenu) {
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
  };

  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    mobileMenu.classList.toggle("is-open", !open);
    mobileMenu.setAttribute("aria-hidden", String(open));
  });

  mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 640) closeMenu();
  });
}
