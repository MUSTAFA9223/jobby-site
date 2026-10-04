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
  { job: "Hold the chart", match: /chart|candle|market|hold|bag|سوق|شارت|شمعة/i, outcome: "He held the monitor. The chart kept falling.", challenge: "Make a meme or a 5–10 second clip of JOBBY physically holding a falling red chart." },
  { job: "Post one meme", match: /post|meme|tweet|social|ميم|تغريد|منشور/i, outcome: "He posted the screenshot. The caption still says: write something funny here.", challenge: "Give JOBBY your worst unfinished caption. Turn it into a meme." },
  { job: "Mute the meeting", match: /mute|meeting|call|zoom|اجتماع|مكالمة/i, outcome: "He muted everyone except himself. The whole meeting heard him chewing.", challenge: "Make a two-panel meme: the meeting instruction, then JOBBY eating with his mic on." },
  { job: "Save the file", match: /save|file|folder|document|حفظ|ملف/i, outcome: "Saved as final_FINAL_v27_ACTUALLY_FINAL. He still sent v2.", challenge: "Create JOBBY's desktop with the most ridiculous collection of final files." },
  { job: "Bring one coffee", match: /coffee|drink|قهوة/i, outcome: "He brought one coffee. In a plate. He says it cools faster.", challenge: "Show JOBBY serving coffee in the worst possible container." },
  { job: "Fix the Wi-Fi", match: /wi.?fi|internet|router|network|واي|انترنت|إنترنت/i, outcome: "He unplugged the router to save electricity. The Wi-Fi problem is now permanent.", challenge: "Make a before-and-after meme of JOBBY proudly unplugging the router." },
  { job: "Deliver the package", match: /deliver|package|parcel|box|طرد|توصيل/i, outcome: "He delivered the empty box. The package looked too heavy.", challenge: "Draw or film JOBBY handing over an empty box like employee of the month." },
  { job: "Do not touch anything", match: /touch|button|press|لمس|زر/i, outcome: "He pressed the only red button. It looked like it needed attention.", challenge: "Put JOBBY beside one huge red button. Give the button a disastrous label." }
];

function pickScenario(job) {
  return jobs.find(function (entry) { return entry.match.test(job); }) || {
    job: job,
    outcome: 'The brief: "' + job + '". JOBBY spent the entire shift making an EMPLOYEE OF THE MONTH badge for himself.',
    challenge: "Make a two-panel meme: your exact instruction, then JOBBY proudly showing his badge while the job stays undone."
  };
}

let lastShareText = "";
let lastMemePrompt = "";

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

function renderResult(text, challenge) {
  if (!jobResult) return;
  const small = document.createElement("small");
  small.textContent = "SHIFT RESULT";
  const strong = document.createElement("strong");
  strong.textContent = text;
  jobResult.replaceChildren(small, strong);
  if (challenge) {
    const prompt = document.createElement("p");
    prompt.className = "meme-challenge";
    prompt.textContent = "YOUR MEME CHALLENGE: " + challenge;
    jobResult.append(prompt);
  }
}

function executeJob() {
  if (!jobInput || !jobResult || (runJob && runJob.disabled)) return;
  const job = jobInput.value.trim().slice(0, 80);
  if (!job) {
    renderResult("Give JOBBY one job first.");
    jobInput.focus();
    return;
  }

  lastShareText = "";
  lastMemePrompt = "";
  if (shareJob) shareJob.disabled = true;
  const copyPrompt = document.querySelector("#copyMemePrompt");
  if (copyPrompt) copyPrompt.disabled = true;
  jobResult.classList.add("running");
  renderResult("Writing JOBBY’s next workplace disaster...");
  if (runJob) runJob.disabled = true;

  window.setTimeout(function () {
    const scenario = pickScenario(job);
    const outcome = scenario.outcome;
    renderResult(outcome, scenario.challenge);
    jobResult.classList.remove("running");
    if (runJob) runJob.disabled = false;
    if (shareJob) shareJob.disabled = false;
    lastShareText = "I gave JOBBY one job: " + job + "\n\n" + outcome + "\n\nYour turn: " + scenario.challenge + "\n\n@JOBBYSOL #JOBBY\nhttps://jobby.lol";
    lastMemePrompt = "Create a meme featuring JOBBY, the cream-colored mascot with a black hoodie, sunglasses and a gold crown.\nInstruction: " + job + "\nPunchline: " + outcome + "\nScene: " + scenario.challenge + "\nKeep JOBBY recognizable. This is a fictional comedy scene.";
    if (copyPrompt) copyPrompt.disabled = false;
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
    jobInput.value = jobs[Math.floor(Math.random() * jobs.length)].job;
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
document.querySelectorAll("[data-job]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (!jobInput || (runJob && runJob.disabled)) return;
    jobInput.value = button.dataset.job;
    executeJob();
  });
});
const copyMemePrompt = document.querySelector("#copyMemePrompt");
if (copyMemePrompt) copyMemePrompt.addEventListener("click", async function () {
  if (!lastMemePrompt) return;
  try {
    await navigator.clipboard.writeText(lastMemePrompt);
    showToast("MEME PROMPT COPIED");
  } catch (error) {
    showToast("COPY FAILED");
  }
});

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
