/* =========================================================
   Helpers
========================================================= */
function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function fetchJson(path) {
  const res = await fetch(path);
  const text = await res.text();

  // If server returned HTML (404 page, etc.)
  const preview = text.slice(0, 100).toLowerCase();
  if (!res.ok || preview.startsWith("<!doctype") || preview.startsWith("<html")) {
    throw new Error(`Expected JSON but got HTML for ${path}`);
  }

  // Remove UTF-8 BOM if present
  const cleaned = text.replace(/^\uFEFF/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${path}. File must start with [ and contain valid JSON only.`
    );
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

/* =========================================================
   Image renderers
========================================================= */
function renderQuestionImages(item) {
  if (Array.isArray(item.qImages)) {
    return `
      <div class="question-image">
        ${item.qImages.map(src => `<img src="${src}" alt="">`).join("")}
      </div>`;
  }
  if (item.qImage) {
    return `
      <div class="question-image">
        <img src="${item.qImage}" alt="">
      </div>`;
  }
  return "";
}

function renderExplanationImages(item) {
  if (Array.isArray(item.expImages)) {
    return `
      <div class="question-image">
        ${item.expImages.map(src => `<img src="${src}" alt="">`).join("")}
      </div>`;
  }
  if (item.expImage) {
    return `
      <div class="question-image">
        <img src="${item.expImage}" alt="">
      </div>`;
  }
  return "";
}

function renderExplanationText(text) {
  return text
    .split("\n\n")
    .map(p => `<p class="muted">${escapeHtml(p)}</p>`)
    .join("");
}

/* =========================================================
   SUBJECTS PAGE
========================================================= */
async function initSubjectsPage() {
  const box = document.getElementById("subjectsList");
  if (!box) return;

  box.innerHTML = `<p class="muted">Loading...</p>`;
  const data = await fetchJson("data/index.json");

  box.innerHTML = "";
  data.subjects.forEach(sub => {
    const card = document.createElement("section");
    card.className = "mcq-card";

    card.innerHTML = `<h2>${sub.name}</h2>`;
    const list = document.createElement("div");
    list.className = "topic-list";

    sub.topics.forEach(tp => {
      const a = document.createElement("a");
      a.className = "topic-link";
      a.href =
        `practice.html?file=${encodeURIComponent(tp.file)}` +
        `&subject=${encodeURIComponent(sub.name)}` +
        `&chapter=${encodeURIComponent(tp.name)}`;
      a.textContent = tp.name;
      list.appendChild(a);
    });

    card.appendChild(list);
    box.appendChild(card);
  });
}

/* =========================================================
   PRACTICE PAGE
========================================================= */
let MCQS = [];
let CURRENT = 0;
let ANSWERS = {};
let RESULT = null;
let SHOW_SCORE_BOX = false;

function computeResult() {
  let score = 0;
  let attempted = 0;

  MCQS.forEach((q, i) => {
    if (ANSWERS[i] !== undefined) attempted++;
    if (ANSWERS[i] === q.answerIndex) score++;
  });

  return { score, attempted, total: MCQS.length };
}

function renderScoreBox(root) {
  if (!SHOW_SCORE_BOX || !RESULT) return;

  root.insertAdjacentHTML("beforeend", `
    <div class="result-box">
      <h2>Result</h2>
      <p><strong>Score:</strong> ${RESULT.score} / ${RESULT.total}</p>
      <p><strong>Attempted:</strong> ${RESULT.attempted} / ${RESULT.total}</p>
    </div>
  `);
}

function renderFeedback(root) {
  const item = MCQS[CURRENT];
  const selected = ANSWERS[CURRENT];
  if (selected === undefined) return;

  const correct = item.answerIndex;
  const isCorrect = selected === correct;

  root.insertAdjacentHTML("beforeend", `
    <div class="feedback ${isCorrect ? "ok" : "bad"}">
      <p><strong>${isCorrect ? "✅ Correct" : "❌ Incorrect"}</strong></p>
      <p><strong>Your answer:</strong> ${escapeHtml(item.options[selected])}</p>
      <p><strong>Correct answer:</strong> ${escapeHtml(item.options[correct])}</p>
      <div class="explanation">
        <strong>Explanation:</strong>
        ${renderExplanationText(item.explanation || "")}
      </div>
      ${renderExplanationImages(item)}
    </div>
  `);
}

function renderSingleQuestion() {
  const root = document.getElementById("mcqList");
  root.innerHTML = "";

  renderScoreBox(root);

  const item = MCQS[CURRENT];
  const card = document.createElement("section");
  card.className = "mcq-card";

  card.innerHTML = `
    <p class="mcq-q"><strong>Q${CURRENT + 1}.</strong> ${escapeHtml(item.q)}</p>
    ${renderQuestionImages(item)}
  `;

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "options-wrap";

  item.options.forEach((opt, i) => {
    optionsWrap.insertAdjacentHTML("beforeend", `
      <label class="opt">
        <input type="radio" name="q_${CURRENT}" ${ANSWERS[CURRENT] === i ? "checked" : ""}>
        <span>${escapeHtml(opt)}</span>
      </label>
    `);
  });

  optionsWrap.querySelectorAll("input").forEach((inp, idx) => {
    inp.addEventListener("change", () => {
      ANSWERS[CURRENT] = idx;
      renderSingleQuestion();
    });
  });

  card.appendChild(optionsWrap);
  root.appendChild(card);

  renderFeedback(root);

  const nav = document.createElement("div");
  nav.className = "nav-row";

  nav.innerHTML = `
    <button class="btn" ${CURRENT === 0 ? "disabled" : ""}>Previous</button>
    <button class="btn btn-primary">${CURRENT === MCQS.length - 1 ? "Submit Test" : "Next"}</button>
  `;

  const [prevBtn, nextBtn] = nav.querySelectorAll("button");

  prevBtn.onclick = () => {
    if (CURRENT > 0) {
      CURRENT--;
      renderSingleQuestion();
    }
  };

  nextBtn.onclick = () => {
    if (CURRENT === MCQS.length - 1) {
      RESULT = computeResult();
      SHOW_SCORE_BOX = true;
      renderSingleQuestion();
    } else {
      CURRENT++;
      renderSingleQuestion();
    }
  };

  root.appendChild(nav);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initPracticePage() {
  const file = qs("file");
  if (!file) return;

  MCQS = await fetchJson(file);

  CURRENT = 0;
  ANSWERS = {};
  RESULT = null;
  SHOW_SCORE_BOX = false;

  renderSingleQuestion();
}

/* =========================================================
   BOOTSTRAP
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("subjectsList")) {
    initSubjectsPage().catch(e => {
      document.getElementById("subjectsList").innerText = e.message;
    });
  }

  if (document.getElementById("mcqList")) {
    initPracticePage().catch(e => {
      document.getElementById("mcqList").innerText = e.message;
    });
  }
});
