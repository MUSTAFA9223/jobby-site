const task = document.getElementById("task");
const result = document.getElementById("result");
const doJob = document.getElementById("doJob");
const randomJob = document.getElementById("randomJob");

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

const fails = [
  "JOBBY finished the job. Unfortunately, it was the wrong job.",
  "Task accepted. JOBBY somehow made it a community event.",
  "JOBBY tried. The task now needs a recovery team.",
  "JOBBY says it was like that when he arrived.",
  "Mission complete. Nobody asked what happened next.",
  "JOBBY followed the instructions. Just not in the right order.",
  "The good news: JOBBY showed up. The bad news: JOBBY showed up."
];

function runJob() {
  const value = task.value.trim();
  if (!value) {
    result.innerHTML = '<span class="result-label">JOBBY STATUS</span><strong>Give him one job first.</strong>';
    task.focus();
    return;
  }
  const fail = fails[Math.floor(Math.random() * fails.length)];
  result.innerHTML = '<span class="result-label">JOB: ' + escapeHtml(value).toUpperCase() + '</span><strong>' + fail + '</strong>';
}

function escapeHtml(value) {
  const d = document.createElement("div");
  d.textContent = value;
  return d.innerHTML;
}

doJob.addEventListener("click", runJob);
task.addEventListener("keydown", e => {
  if (e.key === "Enter") runJob();
});
randomJob.addEventListener("click", () => {
  task.value = jobs[Math.floor(Math.random() * jobs.length)];
  runJob();
});
