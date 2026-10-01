const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const scrollProgress = $("#scrollProgress");
const cursorLight = $("#cursorLight");
const menuBtn = $("#menuBtn");
const mobileMenu = $("#mobileMenu");
const toast = $("#toast");
const missionFeed = $("#missionFeed");
const copySite = $("#copySite");

const task = $("#task");
const result = $("#result");
const doJob = $("#doJob");
const randomJob = $("#randomJob");
const shareJob = $("#shareJob");

const fallbackMissions = [
  {
    id: "001",
    title: "HOLD THE CHART",
    status: "queued",
    summary: "JOBBY gets told to hold. The chart has other plans.",
    videoUrl: "",
    poster: ""
  },
  {
    id: "002",
    title: "DO NOT PRESS IT",
    status: "queued",
    summary: "One button. One instruction. Absolutely no reason to touch it.",
    videoUrl: "",
    poster: ""
  },
  {
    id: "003",
    title: "CARRY ONE BAG",
    status: "queued",
    summary: "A simple delivery job that should be impossible to mess up.",
    videoUrl: "",
    poster: ""
  }
];

const jobs = [
  "Hold the chart",
  "Guard the green candle",
  "Press one button",
  "Carry one bag",
  "Post one meme",
  "Watch the market for five minutes",
  "Do not touch anything",
  "Keep one chart green",
  "Take one bag upstairs",
  "Wait for the signal"
];

const outcomes = [
  "JOBBY finished the job. Unfortunately, it was the wrong job.",
  "Task accepted. The recovery team has been notified.",
  "JOBBY says everything went exactly according to a plan nobody approved.",
  "Mission complete. The original mission is no longer recognizable.",
  "JOBBY followed the instructions. Just not in the right order.",
  "The good news: JOBBY showed up. The bad news: JOBBY showed up.",
  "Result logged as: technically an attempt.",
  "JOBBY is requesting a second chance and a new instruction manual."
];

let activeFilter = "all";
let missions = [];
let lastJob = "";
let lastOutcome = "";

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function updateScrollProgress() {
  if (!scrollProgress) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  scrollProgress.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + "%";
}

window.addEventListener("scroll", updateScrollProgress, { passive: true });
updateScrollProgress();

if (cursorLight && window.matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", event => {
    cursorLight.style.left = event.clientX + "px";
    cursorLight.style.top = event.clientY + "px";
  });
}

function closeMenu() {
  if (!menuBtn || !mobileMenu) return;
  menuBtn.setAttribute("aria-expanded", "false");
  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
  document.body.classList.remove("menu-open");
}

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", () => {
    const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
    menuBtn.setAttribute("aria-expanded", String(!isOpen));
    mobileMenu.classList.toggle("open", !isOpen);
    mobileMenu.setAttribute("aria-hidden", String(isOpen));
    document.body.classList.toggle("menu-open", !isOpen);
  });

  $$("a", mobileMenu).forEach(link => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 680) closeMenu();
  });
}

if (copySite) {
  copySite.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("https://jobby.lol");
      showToast("JOBBY.LOL COPIED");
    } catch {
      showToast("JOBBY.LOL");
    }
  });
}

function createMissionMedia(mission) {
  const media = document.createElement("div");
  media.className = "mission-media";

  if (mission.videoUrl) {
    if (/youtube\.com|youtu\.be/i.test(mission.videoUrl)) {
      const iframe = document.createElement("iframe");
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;

      let id = "";
      try {
        const url = new URL(mission.videoUrl);
        id = url.hostname.includes("youtu.be")
          ? url.pathname.replace("/", "")
          : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      } catch {}
      iframe.src = id ? "https://www.youtube.com/embed/" + encodeURIComponent(id) : mission.videoUrl;
      iframe.title = "JOBBY job #" + mission.id;
      media.appendChild(iframe);
      return media;
    }

    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    if (mission.poster) video.poster = mission.poster;

    const source = document.createElement("source");
    source.src = mission.videoUrl;
    source.type = mission.videoUrl.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
    video.appendChild(source);
    media.appendChild(video);
    return media;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "clip-placeholder";

  const badge = document.createElement("div");
  badge.className = "clip-badge";

  const small = document.createElement("small");
  small.textContent = mission.status === "released" ? "VIDEO UNAVAILABLE" : "VIDEO SLOT";

  const strong = document.createElement("strong");
  strong.textContent = mission.status === "released" ? "CHECK BACK" : "CLIP COMING SOON";

  badge.append(small, strong);
  placeholder.appendChild(badge);
  media.appendChild(placeholder);
  return media;
}

function renderMissions() {
  if (!missionFeed) return;

  missionFeed.replaceChildren();
  const visible = missions.filter(m => activeFilter === "all" || m.status === activeFilter);

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "mission-card";
    empty.style.padding = "28px";
    empty.textContent = "No jobs in this view yet.";
    missionFeed.appendChild(empty);
    return;
  }

  visible.forEach(mission => {
    const card = document.createElement("article");
    card.className = "mission-card";
    card.dataset.status = mission.status;

    const id = document.createElement("div");
    id.className = "mission-id";
    const idLabel = document.createElement("span");
    idLabel.textContent = "JOB NUMBER";
    const idValue = document.createElement("strong");
    idValue.textContent = "#" + mission.id;
    id.append(idLabel, idValue);

    const copy = document.createElement("div");
    copy.className = "mission-copy";

    const status = document.createElement("span");
    status.className = "mission-status " + mission.status;
    status.textContent = mission.status === "released" ? "RELEASED" : "QUEUED";

    const title = document.createElement("h3");
    title.textContent = mission.title;

    const summary = document.createElement("p");
    summary.textContent = mission.summary;

    copy.append(status, title, summary);
    card.append(id, copy, createMissionMedia(mission));
    missionFeed.appendChild(card);
  });
}

async function loadMissions() {
  try {
    const response = await fetch("/missions.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Mission file unavailable");
    const data = await response.json();
    missions = Array.isArray(data) && data.length ? data : fallbackMissions;
  } catch {
    missions = fallbackMissions;
  }
  renderMissions();
}

$$(".filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    $$(".filter").forEach(item => item.classList.toggle("active", item === button));
    renderMissions();
  });
});

function renderResult(label, message) {
  if (!result) return;
  result.replaceChildren();

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const messageNode = document.createElement("strong");
  messageNode.textContent = message;

  result.append(labelNode, messageNode);
}

function runJob() {
  if (!task) return;
  const value = task.value.trim();

  if (!value) {
    renderResult("JOBBY STATUS", "Give him one job first.");
    task.focus();
    return;
  }

  lastJob = value;
  lastOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];

  renderResult("JOB: " + value.toUpperCase(), lastOutcome);
  if (shareJob) shareJob.disabled = false;
}

if (doJob) doJob.addEventListener("click", runJob);
if (task) {
  task.addEventListener("keydown", event => {
    if (event.key === "Enter") runJob();
  });
}

if (randomJob) {
  randomJob.addEventListener("click", () => {
    if (!task) return;
    task.value = jobs[Math.floor(Math.random() * jobs.length)];
    runJob();
  });
}

if (shareJob) {
  shareJob.addEventListener("click", () => {
    if (!lastJob || !lastOutcome) return;

    const text = [
      "I gave JOBBY one job:",
      '"' + lastJob + '"',
      "",
      lastOutcome,
      "",
      "$JOBBY @JOBBYSOL",
      "jobby.lol"
    ].join("\n");

    window.open("https://x.com/intent/post?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  });
}

const revealItems = $$(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealItems.forEach(item => observer.observe(item));
} else {
  revealItems.forEach(item => item.classList.add("is-visible"));
}

loadMissions();
