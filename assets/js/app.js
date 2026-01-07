function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* =========================================================
   SUBJECTS PAGE: Subject -> Topic list (from data/index.json)
========================================================= */
async function initSubjectsPage() {
  const box = document.getElementById("subjectsList");
  if (!box) return;

  const data = await fetchJson("data/index.json");
  box.innerHTML = "";

  data.subjects.forEach(sub => {
    const card = document.createElement("section");
    card.className = "mcq-card";

    const title = document.createElement("h2");
    title.textContent = sub.name;
    card.appendChild(title);

    const list = document.createElement("div");
    list.className = "topic-list";

    sub.topics.forEach(tp => {
      const a = document.createElement("a");
      a.className = "topic-link";
      a.href = `practice.html?file=${encodeURIComponent(tp.file)}&subject=${encodeURIComponent(sub.name)}&chapter=${encodeURIComponent(tp.name)}`;
      a.textContent = tp.name;
      list.appendChild(a);
    });

    card.appendChild(list);
    box.appendChild(card);
  });
}

/* =========================================================
   PRACTICE PAGE: One question per page + Review after submit
========================================================= */
let MCQS = [];
let CURRENT = 0;
let ANSWERS = {};         // { index: selectedOptionIndex }
let REVIEW_MODE = false;  // false=test, true=review after submit
let RESULT = null;        // {score, attempted, total}

function computeResult() {
  let score = 0;
  let attempted = 0;

  MCQS.forEach((item, i) => {
    if (ANSWERS[i] !== undefined) attempted += 1;
    if (ANSWERS[i] === item.answerIndex) score += 1;
  });

  return { score, attempted, total: MCQS.length };
}

function renderSummary(root) {
  if (!REVIEW_MODE || !RESULT) return;

  const box = document.createElement("div");
  box.className = "result-box";
  box.innerHTML = `
    <h2>Result</h2>
    <p><strong>Score:</strong> ${RESULT.score} / ${RESULT.total}</p>
    <p><strong>Attempted:</strong> ${RESULT.attempted} / ${RESULT.total}</p>
    <p class="muted">Review mode: use Next/Previous to review each question.</p>
  `;
  root.appendChild(box);
}

function renderProgress(root) {
  const total = MCQS.length;
  const prog = document.createElement("div");
  prog.className = "result-box";
  prog.innerHTML = `<p><strong>Question:</strong> ${CURRENT + 1} / ${total}</p>`;
  root.appendChild(prog);
}

function renderFeedback(root) {
  // Show feedback only in review mode (after submit)
  if (!REVIEW_MODE) return;

  const item = MCQS[CURRENT];
  const selected = (ANSWERS[CURRENT] === undefined) ? null : ANSWERS[CURRENT];
  const correct = item.answerIndex;
  const isCorrect = selected === correct;

  const yourText = selected === null ? "Not attempted" : item.options[selected];
  const correctText = item.options[correct];

  const fb = document.createElement("div");
  fb.className = "feedback";
  fb.classList.toggle("ok", isCorrect);
  fb.classList.toggle("bad", !isCorrect);

  fb.innerHTML =
    `<p><strong>${isCorrect ? "✅ Correct" : "❌ Incorrect"}</strong></p>` +
    `<p><strong>Your answer:</strong> ${escapeHtml(yourText)}</p>` +
    `<p><strong>Correct answer:</strong> ${escapeHtml(correctText)}</p>` +
    (item.explanation
      ? `<p class="muted"><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</p>`
      : `<p class="muted"><strong>Explanation:</strong> (Add later)</p>`);

  root.appendChild(fb);
}

function renderSingleQuestion() {
  const root = document.getElementById("mcqList");
  root.innerHTML = "";

  // If in review mode, show result summary at the top
  renderSummary(root);

  // Always show question progress
  renderProgress(root);

  const item = MCQS[CURRENT];

  // Question card
  const card = document.createElement("section");
  card.className = "mcq-card";

  const q = document.createElement("p");
  q.className = "mcq-q";
  q.innerHTML = `<strong>Q${CURRENT + 1}.</strong> ${escapeHtml(item.q)}`;
  card.appendChild(q);

  // Options
  const optionsWrap = document.createElement("div");
  optionsWrap.className = "options-wrap";

  const groupName = `q_${CURRENT}`;

  item.options.forEach((opt, optIdx) => {
    const label = document.createElement("label");
    label.className = "opt";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupName;
    input.value = String(optIdx);

    // restore selection
    if (ANSWERS[CURRENT] === optIdx) input.checked = true;

    // In review mode: lock selection
    if (REVIEW_MODE) input.disabled = true;

    input.addEventListener("change", () => {
      if (!REVIEW_MODE) {
        ANSWERS[CURRENT] = optIdx;
      }
    });

    const span = document.createElement("span");
    span.textContent = opt;

    label.appendChild(input);
    label.appendChild(span);
    optionsWrap.appendChild(label);
  });

  card.appendChild(optionsWrap);
  root.appendChild(card);

  // Feedback under the SAME question page in review mode
  renderFeedback(root);

  // Navigation
  const total = MCQS.length;
  const nav = document.createElement("div");
  nav.className = "nav-row";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn";
  prevBtn.textContent = "Previous";
  prevBtn.disabled = (CURRENT === 0);

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-primary";

  // Button label logic
  if (!REVIEW_MODE) {
    nextBtn.textContent = (CURRENT === total - 1) ? "Submit Test" : "Next";
  } else {
    nextBtn.textContent = (CURRENT === total - 1) ? "Back to Subjects" : "Next";
  }

  prevBtn.addEventListener("click", () => {
    if (CURRENT > 0) {
      CURRENT -= 1;
      renderSingleQuestion();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (!REVIEW_MODE) {
      // TEST MODE
      if (CURRENT === total - 1) {
        // Submit -> switch to review mode
        REVIEW_MODE = true;
        RESULT = computeResult();
        CURRENT = 0; // start review from Q1
        renderSingleQuestion();
      } else {
        CURRENT += 1;
        renderSingleQuestion();
      }
    } else {
      // REVIEW MODE
      if (CURRENT === total - 1) {
        window.location.href = "subjects.html";
      } else {
        CURRENT += 1;
        renderSingleQuestion();
      }
    }
  });

  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  root.appendChild(nav);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initPracticePage() {
  const file = qs("file");
  const subject = qs("subject") || "Subject";
  const chapter = qs("chapter") || "Topic";

  document.getElementById("pageTitle").textContent = chapter;
  document.getElementById("pageMeta").textContent = subject;

  const crumbs = document.getElementById("crumbs");
  crumbs.innerHTML =
    `<a href="index.html">Home</a> / ` +
    `<a href="subjects.html">Subjects</a> / ` +
    `<span>${escapeHtml(subject)}</span> / ` +
    `<span>${escapeHtml(chapter)}</span>`;

  if (!file) {
    document.getElementById("mcqList").innerHTML = `<p class="muted">No topic file provided.</p>`;
    return;
  }

  MCQS = await fetchJson(file);
  CURRENT = 0;
  ANSWERS = {};
  REVIEW_MODE = false;
  RESULT = null;

  renderSingleQuestion();
}

/* =========================================================
   BOOTSTRAP
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("subjectsList")) {
    initSubjectsPage().catch(err => {
      document.getElementById("subjectsList").innerHTML =
        `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
    });
  }

  if (document.getElementById("mcqList")) {
    initPracticePage().catch(err => {
      document.getElementById("mcqList").innerHTML =
        `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
    });
  }
});
