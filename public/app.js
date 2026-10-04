const menuButton = document.querySelector("#menuButton");
const siteNav = document.querySelector("#siteNav");
const siteHeader = document.querySelector("#siteHeader");
const characterWrap = document.querySelector("#characterWrap");
const jobInput = document.querySelector("#jobInput");
const runJob = document.querySelector("#runJob");
const randomJob = document.querySelector("#randomJob");
const shareJob = document.querySelector("#shareJob");
const jobResult = document.querySelector("#jobResult");
const copySite = document.querySelector("#copySite");
const copyHeroSite = document.querySelector("#copyHeroSite");
const toast = document.querySelector("#toast");
const solanaSoon = document.querySelector("#solanaSoon");

const jobs = [
  "Hold the chart",
  "Guard the green candle",
  "Carry one bag",
  "Press one button",
  "Watch the market",
  "Do not touch anything",
  "Post one meme",
  "Fix the Wi-Fi"
];

const outcomes = [
  "JOBBY finished the job. Unfortunately, it was the wrong job.",
  "Mission complete. The original mission is no longer recognizable.",
  "JOBBY followed every instruction — just not in the right order.",
  "The good news: JOBBY showed up. The bad news: JOBBY showed up.",
  "Result logged as: technically an attempt.",
  "JOBBY says everything went exactly according to a plan nobody approved."
];

let lastShareText = "";

function closeMenu() {
  if (!menuButton || !siteNav) return;
  menuButton.setAttribute("aria-expanded", "false");
  siteNav.classList.remove("open");
  document.body.classList.remove("menu-open");
}

if (menuButton && siteNav) {
  menuButton.addEventListener("click", function () {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    siteNav.classList.toggle("open", !open);
    document.body.classList.toggle("menu-open", !open);
  });
  siteNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () {
    toast.classList.remove("show");
  }, 1800);
}

function showSolanaSoon() {
  if (!solanaSoon) return;
  solanaSoon.classList.add("is-soon");
  clearTimeout(showSolanaSoon.timer);
  showSolanaSoon.timer = setTimeout(function () {
    solanaSoon.classList.remove("is-soon");
  }, 1600);
}

if (solanaSoon) {
  solanaSoon.addEventListener("click", showSolanaSoon);
  solanaSoon.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showSolanaSoon();
    }
  });
}


window.addEventListener("scroll", function () {
  if (siteHeader) siteHeader.classList.toggle("compact", window.scrollY > 40);
}, { passive: true });

if (characterWrap && window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.addEventListener("pointermove", function (event) {
    const x = (event.clientX / window.innerWidth - .5) * 10;
    const y = (event.clientY / window.innerHeight - .5) * 5;
    characterWrap.style.setProperty("--character-x", x + "px");
    characterWrap.style.setProperty("--character-y", y + "px");
  });
}

function renderResult(text) {
  if (!jobResult) return;
  const small = document.createElement("small");
  small.textContent = "SHIFT RESULT";
  const strong = document.createElement("strong");
  strong.textContent = text;
  jobResult.replaceChildren(small, strong);
}

function executeJob() {
  if (!jobInput || !jobResult) return;
  const job = jobInput.value.trim();
  if (!job) {
    renderResult("Give JOBBY one job first.");
    jobInput.focus();
    return;
  }

  jobResult.classList.add("running");
  renderResult("JOBBY is working. This is already concerning...");
  if (runJob) runJob.disabled = true;

  window.setTimeout(function () {
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    renderResult(outcome);
    jobResult.classList.remove("running");
    if (runJob) runJob.disabled = false;
    if (shareJob) shareJob.disabled = false;
    lastShareText = "I gave JOBBY one job: " + job + "\n\n" + outcome + "\n\n@JOBBYSOL #JOBBY\nhttps://jobby.lol";
  }, 700);
}

if (runJob) runJob.addEventListener("click", executeJob);
if (jobInput) {
  jobInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") executeJob();
  });
}
if (randomJob && jobInput) {
  randomJob.addEventListener("click", function () {
    jobInput.value = jobs[Math.floor(Math.random() * jobs.length)];
    jobInput.focus();
  });
}
if (shareJob) {
  shareJob.addEventListener("click", async function () {
    if (!lastShareText) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "JOBBY Shift Result", text: lastShareText });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(lastShareText);
      showToast("RESULT COPIED");
    } catch (error) {
      showToast("COPY FAILED");
    }
  });
}
const websiteCopyButtons = [copySite, copyHeroSite].filter(Boolean);
websiteCopyButtons.forEach(function (button) {
  button.addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText("https://jobby.lol");
      showToast("JOBBY.LOL COPIED");
    } catch (error) {
      showToast("JOBBY.LOL");
    }
  });
});

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .12 })
  : null;

document.querySelectorAll(".reveal").forEach(function (element) {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add("visible");
});

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());
