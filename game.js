const staff = document.querySelector("#staff");
const piano = document.querySelector("#piano");
const pianoScroll = document.querySelector("#pianoScroll");
const message = document.querySelector("#message");
const resultBox = document.querySelector("#resultBox");
const promptText = document.querySelector("#promptText");
const questionChip = document.querySelector("#questionChip");
const progressLabel = document.querySelector("#progressLabel");
const progressText = document.querySelector("#progressText");
const timerLabel = document.querySelector("#timerLabel");
const timerText = document.querySelector("#timerText");
const correctText = document.querySelector("#correctText");
const accuracyText = document.querySelector("#accuracyText");
const questionLimit = document.querySelector("#questionLimit");
const timeLimit = document.querySelector("#timeLimit");
const groupStart = document.querySelector("#groupStart");
const groupEnd = document.querySelector("#groupEnd");
const questionField = document.querySelector("#questionField");
const timeField = document.querySelector("#timeField");
const autoNext = document.querySelector("#autoNext");
const selectedNote = document.querySelector("#selectedNote");
const startBtn = document.querySelector("#startBtn");
const resetBtn = document.querySelector("#resetBtn");
const playNoteBtn = document.querySelector("#playNote");
const showAnswerBtn = document.querySelector("#showAnswer");
const nextQuestionBtn = document.querySelector("#nextQuestion");
const historyList = document.querySelector("#historyList");
const clearHistory = document.querySelector("#clearHistory");
const resultModal = document.querySelector("#resultModal");
const modalGrade = document.querySelector("#modalGrade");
const modalTitle = document.querySelector("#modalTitle");
const modalComment = document.querySelector("#modalComment");
const modalCorrect = document.querySelector("#modalCorrect");
const modalWrong = document.querySelector("#modalWrong");
const modalPercent = document.querySelector("#modalPercent");
const modalDetailLabel = document.querySelector("#modalDetailLabel");
const modalDetail = document.querySelector("#modalDetail");
const closeModal = document.querySelector("#closeModal");

const HISTORY_KEY = "staff-note-practice-history";
const WHITE_W = 44;
const BLACK_W = 28;
const PIANO_WIDTH = 52 * WHITE_W;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SOLFEGE = {
  C: "Do", "C#": "升Do",
  D: "Re", "D#": "升Re",
  E: "Mi",
  F: "Fa", "F#": "升Fa",
  G: "Sol", "G#": "升Sol",
  A: "La", "A#": "升La",
  B: "Si"
};
const NATURAL_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const NOTES = buildNotes();

let current = null;
let selectedIndex = 0;
let answered = false;
let running = false;
let sessionEnded = false;
let questionNumber = 0;
let correct = 0;
let wrong = 0;
let timerId = null;
let secondsLeft = 0;
let elapsedSeconds = 0;
let autoNextId = null;
let audioContext = null;

function buildNotes() {
  const notes = [];
  let whiteIndex = 0;
  for (let midi = 21; midi <= 108; midi += 1) {
    const pitch = midi % 12;
    const name = NAMES[pitch];
    const natural = name[0];
    const octave = Math.floor(midi / 12) - 1;
    const isBlack = name.includes("#");
    const note = {
      midi,
      name,
      natural,
      accidental: isBlack ? "#" : "",
      octave,
      freq: 440 * 2 ** ((midi - 69) / 12),
      display: `${name}${octave}`,
      group: `第${octave}组`,
      solfege: SOLFEGE[name],
      clef: midi < 60 ? "bass" : "treble",
      step: midi < 60 ? bassStep(natural, octave) : trebleStep(natural, octave),
      isBlack
    };
    if (isBlack) {
      note.left = whiteIndex * WHITE_W - BLACK_W / 2;
    } else {
      note.left = whiteIndex * WHITE_W;
      whiteIndex += 1;
    }
    notes.push(note);
  }
  notes.whiteCount = whiteIndex;
  return notes;
}

function diatonicIndex(natural, octave) {
  return octave * 7 + NATURAL_INDEX[natural];
}

function trebleStep(natural, octave) {
  return diatonicIndex(natural, octave) - diatonicIndex("E", 4);
}

function bassStep(natural, octave) {
  return diatonicIndex(natural, octave) - diatonicIndex("G", 2);
}

function selectedAnswerMode() {
  return document.querySelector("input[name='answerMode']:checked").value;
}

function selectedPromptMode() {
  return document.querySelector("input[name='promptMode']:checked").value;
}

function getGroupRange() {
  const start = Number(groupStart.value);
  const end = Number(groupEnd.value);
  return start <= end ? { start, end } : { start: end, end: start };
}

function getGroupRangeLabel() {
  const { start, end } = getGroupRange();
  return `第${start}组-第${end}组`;
}

function getQuestionPool() {
  const { start, end } = getGroupRange();
  return NOTES.filter((note) => note.octave >= start && note.octave <= end);
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function yForStep(step) {
  return 410 - step * 10;
}

function drawStaff(note, showNote, emptyState = "sound") {
  staff.replaceChildren();
  staff.append(svg("rect", { x: 0, y: 0, width: 820, height: 680, rx: 18, fill: "#fffdf8" }));

  if (!showNote || !note) {
    const icon = svg("text", {
      x: 410, y: 292, "text-anchor": "middle",
      "font-size": 76, "font-weight": 800, fill: "#0f7a7a"
    });
    icon.textContent = emptyState === "idle" ? "Ready" : "♪";
    staff.append(icon);

    const text = svg("text", {
      x: 410, y: 356, "text-anchor": "middle",
      "font-size": 28, "font-weight": 800, fill: "#69707a"
    });
    text.textContent = emptyState === "idle" ? "选择设置后，点“开始练习”" : "听音后在 88 键钢琴上选择";
    staff.append(text);
    return;
  }

  [8, 6, 4, 2, 0].forEach((step) => {
    staff.append(svg("line", {
      x1: 88, y1: yForStep(step), x2: 724, y2: yForStep(step),
      stroke: "#202124", "stroke-width": 3, "stroke-linecap": "round"
    }));
  });

  drawClef(note.clef);

  const noteX = 462;
  const noteY = yForStep(note.step);
  drawLedgerLines(noteX, note.step);
  if (note.accidental) drawAccidental(noteX, noteY);
  drawNoteHead(noteX, noteY, note.step);
}

function drawClef(clefType) {
  const isBass = clefType === "bass";
  const clef = svg("text", {
    x: isBass ? 136 : 130,
    y: isBass ? yForStep(6) : yForStep(2),
    "font-size": isBass ? 108 : 132,
    "font-family": "Georgia, 'Times New Roman', serif",
    "dominant-baseline": "middle",
    "text-anchor": "middle",
    fill: "#202124"
  });
  clef.textContent = isBass ? "𝄢" : "𝄞";
  staff.append(clef);
}

function drawLedgerLines(noteX, step) {
  const ledgerSteps = [];
  for (let s = -2; s >= step; s -= 2) ledgerSteps.push(s);
  for (let s = 10; s <= step; s += 2) ledgerSteps.push(s);
  ledgerSteps.forEach((s) => {
    staff.append(svg("line", {
      x1: noteX - 46, y1: yForStep(s), x2: noteX + 46, y2: yForStep(s),
      stroke: "#202124", "stroke-width": 3, "stroke-linecap": "round"
    }));
  });
}

function drawAccidental(noteX, noteY) {
  const accidental = svg("text", {
    x: noteX - 62, y: noteY + 16,
    "font-size": 48, "font-family": "Georgia, serif", fill: "#202124"
  });
  accidental.textContent = "♯";
  staff.append(accidental);
}

function drawNoteHead(noteX, noteY, step) {
  staff.append(svg("ellipse", {
    cx: noteX, cy: noteY, rx: 22, ry: 15,
    transform: `rotate(-18 ${noteX} ${noteY})`,
    fill: "#202124"
  }));

  const stemUp = step < 5;
  const stemX = stemUp ? noteX + 18 : noteX - 18;
  const stemEnd = stemUp ? noteY - 84 : noteY + 84;
  staff.append(svg("line", {
    x1: stemX, y1: noteY, x2: stemX, y2: stemEnd,
    stroke: "#202124", "stroke-width": 5, "stroke-linecap": "round"
  }));
}

function populateSelects() {
  for (let count = 10; count <= 100; count += 10) {
    questionLimit.append(new Option(`${count} 题`, String(count)));
  }
  [10, 20, 30, 40, 50, 60, 90, 120, 150, 180, 240, 300].forEach((seconds) => {
    timeLimit.append(new Option(`${seconds} 秒`, String(seconds)));
  });
  for (let octave = 0; octave <= 8; octave += 1) {
    groupStart.append(new Option(`第${octave}组`, String(octave)));
    groupEnd.append(new Option(`第${octave}组`, String(octave)));
  }
  questionLimit.value = "10";
  timeLimit.value = "60";
  groupStart.value = "0";
  groupEnd.value = "8";
}

function buildPiano() {
  piano.replaceChildren();
  piano.style.width = `${PIANO_WIDTH}px`;
  NOTES.forEach((note, index) => {
    const key = document.createElement("button");
    key.className = `key ${note.isBlack ? "black" : "white"}`;
    key.type = "button";
    key.dataset.index = index;
    key.style.left = `${note.left}px`;
    key.innerHTML = `<strong>${note.display}</strong><em>${note.solfege}</em>`;
    key.addEventListener("pointerdown", (event) => handlePianoPointer(event, index));
    piano.append(key);
  });
  setSelectedIndex(0, false);
  resizePiano();
}

function handlePianoPointer(event, index) {
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  choosePianoKey(index);
}

function detectDeviceProfile() {
  const hasTouch = navigator.maxTouchPoints > 1;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const longSide = Math.max(window.screen.width, window.screen.height);
  const looksLikeIPad = hasTouch && (/iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && longSide >= 1000));
  const looksLikeAir = looksLikeIPad && shortSide >= 760 && shortSide <= 900 && longSide >= 1080 && longSide <= 1250;
  document.body.classList.toggle("ipad-device", looksLikeIPad);
  document.body.classList.toggle("ipad-air", looksLikeAir);
}

function startSession() {
  stopTimers();
  running = true;
  sessionEnded = false;
  answered = false;
  questionNumber = 0;
  correct = 0;
  wrong = 0;
  elapsedSeconds = 0;
  resultBox.hidden = true;
  message.className = "message";
  startBtn.textContent = "练习中";
  startBtn.disabled = true;
  nextQuestionBtn.disabled = true;

  if (selectedAnswerMode() === "time") secondsLeft = Number(timeLimit.value);
  timerId = window.setInterval(() => {
    elapsedSeconds += 1;
    if (selectedAnswerMode() === "time") secondsLeft -= 1;
    updateStats();
    if (selectedAnswerMode() === "time" && secondsLeft <= 0) finishSession("时间到");
  }, 1000);

  nextQuestion();
  updateStats();
}

function resetSession() {
  stopTimers();
  running = false;
  sessionEnded = false;
  answered = false;
  current = null;
  questionNumber = 0;
  correct = 0;
  wrong = 0;
  elapsedSeconds = 0;
  secondsLeft = Number(timeLimit.value || 60);
  resultBox.hidden = true;
  startBtn.disabled = false;
  startBtn.textContent = "开始练习";
  nextQuestionBtn.disabled = true;
  message.className = "message";
  message.textContent = "选择设置后，点“开始练习”。";
  questionChip.textContent = "准备开始";
  drawStaff(null, false, "idle");
  clearActiveKeys();
  updateStats();
}

function nextQuestion() {
  if (!running || sessionEnded) return;
  window.clearTimeout(autoNextId);

  if (selectedAnswerMode() === "count" && questionNumber >= Number(questionLimit.value)) {
    finishSession("题目完成");
    return;
  }

  const pool = getQuestionPool();
  const next = pool[Math.floor(Math.random() * pool.length)];
  current = next === current ? pool[(pool.indexOf(next) + 17) % pool.length] : next;
  answered = false;
  questionNumber += 1;

  const promptMode = selectedPromptMode();
  drawStaff(promptMode === "sound" ? null : current, promptMode !== "sound");
  questionChip.textContent = promptMode === "sound"
    ? `听音题 · 第 ${questionNumber} 题`
    : `${current.clef === "bass" ? "低音谱号" : "高音谱号"} · 第 ${questionNumber} 题`;
  message.className = "message";
  message.textContent = promptMode === "sound" ? "听音后，在 88 键钢琴上选择答案。" : "看谱后，在 88 键钢琴上选择答案。";
  nextQuestionBtn.disabled = true;
  clearActiveKeys();
  updateStats();

  if (promptMode !== "staff") {
    window.setTimeout(() => playFrequency(current.freq), 120);
  }
}

function choosePianoKey(index) {
  setSelectedIndex(index, true);
  const note = NOTES[index];
  playFrequency(note.freq);
  flashKey(index);
  if (!running || answered || !current) return;
  finishAnswer(note.midi === current.midi, note);
}

function finishAnswer(ok, chosenNote) {
  answered = true;
  if (ok) correct += 1;
  else wrong += 1;

  message.className = `message ${ok ? "good" : "bad"}`;
  message.textContent = ok
    ? `答对了：${current.display} · ${current.solfege}`
    : `答错了：你选了 ${chosenNote.display}，正确答案是 ${current.display} · ${current.solfege}`;
  markAnswerKeys(ok, chosenNote);
  nextQuestionBtn.disabled = autoNext.checked;
  updateStats();

  if (selectedAnswerMode() === "count" && questionNumber >= Number(questionLimit.value)) {
    window.setTimeout(() => finishSession("题目完成"), autoNext.checked ? 750 : 0);
    return;
  }

  if (autoNext.checked) {
    autoNextId = window.setTimeout(nextQuestion, 950);
  }
}

function showCurrentAnswer() {
  if (!running || answered || !current) return;
  message.className = "message good";
  message.textContent = `答案是：${current.display} · ${current.solfege}`;
  markAnswerKeys(true, current);
  setSelectedIndex(NOTES.indexOf(current), true);
  playFrequency(current.freq);
}

function finishSession(reason) {
  if (sessionEnded) return;
  sessionEnded = true;
  running = false;
  stopTimers();
  startBtn.disabled = false;
  startBtn.textContent = "开始练习";
  nextQuestionBtn.disabled = true;
  const total = correct + wrong;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const isCount = selectedAnswerMode() === "count";
  const modeLabel = isCount ? `${questionLimit.value}题` : `${timeLimit.value}秒`;
  const detailLabel = isCount ? `耗时 ${formatSeconds(elapsedSeconds)}` : `答题 ${total} 题`;
  const promptLabel = document.querySelector("input[name='promptMode']:checked").nextElementSibling.textContent;
  const rangeLabel = getGroupRangeLabel();

  message.className = "message good";
  message.textContent = `${reason}，本轮结束。`;
  resultBox.hidden = false;
  resultBox.innerHTML = `
    <div><span>答对</span><strong>${correct}</strong></div>
    <div><span>答错</span><strong>${wrong}</strong></div>
    <div><span>正确率</span><strong>${percent}%</strong></div>
  `;

  saveHistory({ date: new Date().toLocaleString(), correct, wrong, percent, modeLabel, detailLabel, promptLabel, rangeLabel });
  renderHistory();
  updateStats();
  showResultModal({ correct, wrong, percent, detailLabel, isCount });
}

function getGrade(percent) {
  if (percent === 100) {
    return {
      title: "Perfect Pitch · 完美小乐手",
      comment: "全部答对！你的耳朵和眼睛都很厉害。",
      tone: "perfect"
    };
  }
  if (percent >= 90) {
    return {
      title: "Excellent · 优秀",
      comment: "非常棒，只差一点点就满分啦。",
      tone: "excellent"
    };
  }
  if (percent >= 75) {
    return {
      title: "Great Job · 表现很棒",
      comment: "已经很稳了，再练几轮会更快更准。",
      tone: "great"
    };
  }
  if (percent >= 60) {
    return {
      title: "Keep Going · 继续加油",
      comment: "基础正在建立，多看谱、多听音，会越来越熟。",
      tone: "keep"
    };
  }
  return {
    title: "Try Again · 再试一次",
    comment: "别着急，先从小范围组别开始练，会更容易进步。",
    tone: "try"
  };
}

function showResultModal(result) {
  const grade = getGrade(result.percent);
  modalGrade.textContent = grade.title;
  modalGrade.className = `grade-badge ${grade.tone}`;
  modalTitle.textContent = "本轮成绩";
  modalComment.textContent = grade.comment;
  modalCorrect.textContent = result.correct;
  modalWrong.textContent = result.wrong;
  modalPercent.textContent = `${result.percent}%`;
  modalDetailLabel.textContent = result.isCount ? "耗时" : "答题数";
  modalDetail.textContent = result.detailLabel.replace(/^耗时 |^答题 /, "");
  resultModal.hidden = false;
}

function stopTimers() {
  window.clearInterval(timerId);
  window.clearTimeout(autoNextId);
  timerId = null;
  autoNextId = null;
}

function updateStats() {
  const isCount = selectedAnswerMode() === "count";
  const total = correct + wrong;
  progressLabel.textContent = isCount ? "进度" : "答题数";
  progressText.textContent = isCount
    ? `${Math.min(questionNumber, Number(questionLimit.value))}/${questionLimit.value}`
    : `${total}题`;
  timerLabel.textContent = isCount ? "耗时" : "倒计时";
  timerText.textContent = isCount ? formatSeconds(elapsedSeconds) : `${Math.max(secondsLeft, 0)}秒`;
  correctText.textContent = correct;
  accuracyText.textContent = total ? `${Math.round((correct / total) * 100)}%` : "0%";
}

function formatSeconds(value) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}秒`;
}

function playFrequency(freq, duration = 0.42) {
  audioContext ||= new AudioContext();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration + 0.04);
}

function flashKey(index) {
  const key = piano.querySelector(`[data-index="${index}"]`);
  if (!key) return;
  key.classList.add("active");
  window.setTimeout(() => key.classList.remove("active"), 180);
}

function markAnswerKeys(ok, chosenNote) {
  document.querySelectorAll(".key.correct-key, .key.wrong-key").forEach((key) => {
    key.classList.remove("correct-key", "wrong-key");
  });
  const chosenIndex = NOTES.indexOf(chosenNote);
  const correctIndex = NOTES.indexOf(current);
  if (ok) {
    piano.querySelector(`[data-index="${correctIndex}"]`)?.classList.add("correct-key");
  } else {
    piano.querySelector(`[data-index="${chosenIndex}"]`)?.classList.add("wrong-key");
    piano.querySelector(`[data-index="${correctIndex}"]`)?.classList.add("correct-key");
  }
}

function setSelectedIndex(index, shouldScroll) {
  selectedIndex = Math.max(0, Math.min(NOTES.length - 1, index));
  document.querySelectorAll(".key.selected").forEach((key) => key.classList.remove("selected"));
  const key = piano.querySelector(`[data-index="${selectedIndex}"]`);
  key?.classList.add("selected");
  const note = NOTES[selectedIndex];
  selectedNote.textContent = `当前选择：${note.display} · ${note.solfege}`;
  if (shouldScroll && key && getPianoScale() >= 0.92) {
    key.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

function getPianoScale() {
  const availableWidth = pianoScroll.clientWidth - 8;
  return Math.min(1, Math.max(0.34, availableWidth / PIANO_WIDTH));
}

function resizePiano() {
  const scale = getPianoScale();
  piano.style.transform = `scale(${scale})`;
  pianoScroll.style.height = `${Math.ceil(128 * scale) + 8}px`;
  piano.classList.toggle("scaled", scale < 0.72);
}

function clearActiveKeys() {
  document.querySelectorAll(".key").forEach((key) => key.classList.remove("active", "correct-key", "wrong-key"));
}

function saveHistory(item) {
  const history = loadHistory();
  history.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = loadHistory();
  if (!history.length) {
    historyList.innerHTML = `<div class="empty-history">还没有历史结果。</div>`;
    return;
  }
  historyList.innerHTML = history.map((item) => `
    <div class="history-item">
      <strong>${item.percent}%</strong>
      <span>${item.correct} 对 / ${item.wrong} 错</span>
      <span>${item.modeLabel} · ${item.detailLabel || ""}</span>
      <span>${item.rangeLabel || "全组别"}</span>
      <span>${item.promptLabel}</span>
      <time>${item.date}</time>
    </div>
  `).join("");
}

function updateAnswerModeFields() {
  const isCount = selectedAnswerMode() === "count";
  questionField.hidden = !isCount;
  timeField.hidden = isCount;
  questionLimit.disabled = !isCount;
  timeLimit.disabled = isCount;
  secondsLeft = Number(timeLimit.value || 60);
  updateStats();
}

function syncGroupRange(changed) {
  const start = Number(groupStart.value);
  const end = Number(groupEnd.value);
  if (changed === "start" && start > end) groupEnd.value = groupStart.value;
  if (changed === "end" && end < start) groupStart.value = groupEnd.value;
  if (running && current && !answered) {
    message.className = "message";
    message.textContent = `组别范围已改为 ${getGroupRangeLabel()}，下一题开始生效。`;
  }
}

document.querySelectorAll("input[name='answerMode']").forEach((input) => {
  input.addEventListener("change", updateAnswerModeFields);
});

document.querySelectorAll("input[name='promptMode']").forEach((input) => {
  input.addEventListener("change", () => {
    const promptMode = selectedPromptMode();
    promptText.textContent = promptMode === "sound"
      ? "听音，弹出正确的钢琴键。"
      : "看谱、听音，弹出正确的钢琴键。";
    if (running && current) {
      drawStaff(promptMode === "sound" ? null : current, promptMode !== "sound");
      questionChip.textContent = promptMode === "sound"
        ? `听音题 · 第 ${questionNumber} 题`
        : `${current.clef === "bass" ? "低音谱号" : "高音谱号"} · 第 ${questionNumber} 题`;
      if (promptMode !== "staff") playFrequency(current.freq);
    }
  });
});

questionLimit.addEventListener("change", updateStats);
timeLimit.addEventListener("change", updateAnswerModeFields);
groupStart.addEventListener("change", () => syncGroupRange("start"));
groupEnd.addEventListener("change", () => syncGroupRange("end"));
autoNext.addEventListener("change", () => {
  if (running && answered && !sessionEnded) {
    nextQuestionBtn.disabled = autoNext.checked;
    if (autoNext.checked) autoNextId = window.setTimeout(nextQuestion, 950);
    else window.clearTimeout(autoNextId);
  }
});
startBtn.addEventListener("click", startSession);
resetBtn.addEventListener("click", resetSession);
nextQuestionBtn.addEventListener("click", nextQuestion);
playNoteBtn.addEventListener("click", () => current && playFrequency(current.freq));
showAnswerBtn.addEventListener("click", showCurrentAnswer);
clearHistory.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});
closeModal.addEventListener("click", () => {
  resultModal.hidden = true;
});
resultModal.addEventListener("click", (event) => {
  if (event.target === resultModal) resultModal.hidden = true;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !resultModal.hidden) {
    resultModal.hidden = true;
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setSelectedIndex(selectedIndex - 1, true);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    setSelectedIndex(selectedIndex + 1, true);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    choosePianoKey(selectedIndex);
  }
});
window.addEventListener("resize", () => {
  detectDeviceProfile();
  resizePiano();
});
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    detectDeviceProfile();
    resizePiano();
  }, 180);
});

try {
  detectDeviceProfile();
  populateSelects();
  buildPiano();
  updateAnswerModeFields();
  renderHistory();
  resetSession();
} catch (error) {
  message.className = "message bad";
  message.textContent = "页面绘制出错，请刷新后再试。";
  console.error(error);
}
