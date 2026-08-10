const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  bootPanel: $("#boot-panel"), bootLog: $("#boot-log"), start: $("#start-button"),
  workspace: $("#workspace"), sectors: $("#sector-list"), monthGrid: $("#month-grid"),
  diagnostic: $("#diagnostic"), sectorTitle: $("#sector-title"), sectorAddress: $("#sector-address"),
  count: $("#sector-count"), health: $("#health"), faults: $("#fault-count"), session: $("#session-status"),
  eventLog: $("#event-log"), dialog: $("#repair-dialog"), puzzleHost: $("#puzzle-host"),
  repairTitle: $("#repair-title"), attempt: $("#attempt-counter"), hint: $("#hint-button"), bypass: $("#bypass-button"),
};

const state = {
  data: null, months: [], selected: 0, repaired: new Set(), bypassed: new Set(),
  attempts: 1, activePuzzle: null, sound: false,
};

const monthName = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const storageKey = "dumbly-smart:timeline-debug:v2";
const instantBoot = new URLSearchParams(location.search).has("instant");

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function shuffled(list, seed) {
  const copy = [...list];
  let value = seed || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function beep(frequency = 540, duration = .035) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = beep.context ||= new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + duration);
}

function log(message) {
  const line = document.createElement("p");
  line.className = "fresh";
  line.textContent = `> ${message}`;
  ui.eventLog.prepend(line);
  [...ui.eventLog.children].slice(6).forEach((item) => item.remove());
  setTimeout(() => line.classList.remove("fresh"), 1200);
}

function normalizeData(raw) {
  const days = raw.days?.length ? raw.days : makeFallbackDays(raw);
  return { ...raw, days };
}

function makeFallbackDays(raw) {
  const end = new Date(`${raw.period?.to || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = [];
  for (let i = 370; i >= 0; i--) {
    const date = new Date(end); date.setUTCDate(end.getUTCDate() - i);
    days.push({ date: date.toISOString().slice(0, 10), contributionCount: 0, weekday: date.getUTCDay() });
  }
  return days;
}

function groupMonths(days) {
  const grouped = new Map();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(day);
  }
  return [...grouped.entries()].map(([key, entries], index) => {
    const active = entries.filter((day) => day.contributionCount > 0);
    const total = entries.reduce((sum, day) => sum + day.contributionCount, 0);
    return {
      key, index, days: entries, active, total,
      peak: Math.max(0, ...entries.map((day) => day.contributionCount)),
      puzzle: ["route", "memory", "logs"][hash(key) % 3],
    };
  });
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.period !== state.data.period.to) return;
    state.repaired = new Set(saved.repaired || []);
    state.bypassed = new Set(saved.bypassed || []);
  } catch { /* A disabled localStorage should not block the game. */ }
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      period: state.data.period.to, repaired: [...state.repaired], bypassed: [...state.bypassed],
    }));
  } catch { /* Progress remains available for this session. */ }
}

function updateStats() {
  const complete = state.repaired.size + state.bypassed.size;
  const health = Math.round((complete / state.months.length) * 100) || 0;
  ui.count.textContent = `${String(complete).padStart(2, "0")}/${state.months.length}`;
  ui.health.textContent = `${String(health).padStart(2, "0")}%`;
  ui.faults.textContent = String(state.months.length - complete).padStart(2, "0");
  if (complete === state.months.length) {
    ui.session.textContent = "TIMELINE RESTORED";
    ui.session.style.color = "var(--phosphor)";
  }
}

function renderSectors() {
  ui.sectors.innerHTML = "";
  state.months.forEach((month, index) => {
    const repaired = state.repaired.has(month.key);
    const bypassed = state.bypassed.has(month.key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sector-button${index === state.selected ? " active" : ""}${repaired || bypassed ? " repaired" : ""}`;
    button.innerHTML = `<span class="sector-index">${String(index).padStart(2, "0")}</span><span>${monthName.format(new Date(`${month.key}-15T00:00:00Z`)).toUpperCase()}</span><span class="sector-state">${repaired ? "OK" : bypassed ? "SKIP" : "ERR"}</span>`;
    button.addEventListener("click", () => selectSector(index));
    ui.sectors.append(button);
  });
}

function selectSector(index) {
  state.selected = (index + state.months.length) % state.months.length;
  const month = state.months[state.selected];
  renderSectors(); renderMonth(month); renderDiagnostic(month);
  beep(420 + state.selected * 12);
}

function renderMonth(month) {
  ui.sectorTitle.textContent = monthName.format(new Date(`${month.key}-15T00:00:00Z`)).toUpperCase();
  ui.sectorAddress.textContent = `0x${hash(month.key).toString(16).slice(0, 4).toUpperCase()}`;
  ui.monthGrid.innerHTML = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => `<span class="weekday">${day}</span>`).join("");
  const first = new Date(`${month.key}-01T00:00:00Z`).getUTCDay();
  for (let i = 0; i < first; i++) ui.monthGrid.insertAdjacentHTML("beforeend", '<span class="day-cell empty"></span>');
  const peak = state.data.peakDay || 1;
  month.days.forEach((day) => {
    const level = day.contributionCount ? Math.max(1, Math.min(4, Math.ceil(day.contributionCount / peak * 4))) : 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-cell level-${level}${state.repaired.has(month.key) ? " sector-fixed" : ""}`;
    button.title = `${dayLabel.format(new Date(`${day.date}T00:00:00Z`))}: ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}`;
    button.innerHTML = `<span class="day-number">${Number(day.date.slice(-2))}</span><span class="day-count">${day.contributionCount || "."}</span>`;
    button.addEventListener("click", () => log(`${day.date} => ${day.contributionCount} contributions`));
    ui.monthGrid.append(button);
  });
}

function renderDiagnostic(month) {
  const repaired = state.repaired.has(month.key);
  const bypassed = state.bypassed.has(month.key);
  const status = repaired ? "SECTOR HEALTHY" : bypassed ? "FAULT BYPASSED" : "CORRUPTION DETECTED";
  ui.diagnostic.innerHTML = `
    <h2>${status}</h2>
    <p>${repaired ? "All addresses respond normally." : bypassed ? "Sector mounted read-only. Repair was skipped." : `Diagnostic ${month.puzzle.toUpperCase()} queued. Manual intervention required.`}</p>
    <div class="diagnostic-grid">
      <div><small>ACTIVITY</small><strong>${month.total}</strong></div>
      <div><small>ACTIVE DAYS</small><strong>${month.active.length}</strong></div>
      <div><small>PEAK SIGNAL</small><strong>${month.peak}</strong></div>
    </div>
    ${repaired || bypassed ? '<button class="secondary" id="rerun-repair" type="button">RERUN DIAGNOSTIC</button>' : '<button class="primary" id="begin-repair" type="button">[ F5 ] REPAIR SECTOR</button>'}`;
  $(repaired || bypassed ? "#rerun-repair" : "#begin-repair")?.addEventListener("click", () => openPuzzle(month));
}

function openPuzzle(month) {
  state.attempts = 1; state.activePuzzle = month;
  ui.attempt.textContent = "ATTEMPT 1";
  ui.hint.classList.add("hidden"); ui.bypass.classList.add("hidden");
  ui.repairTitle.textContent = `${month.key} / ${month.puzzle.toUpperCase()} REPAIR`;
  if (month.puzzle === "route") buildRoute(month);
  if (month.puzzle === "memory") buildMemory(month);
  if (month.puzzle === "logs") buildLogs(month);
  ui.dialog.showModal(); beep(760, .06);
}

function buildRoute(month) {
  ui.puzzleHost.replaceChildren($("#route-template").content.cloneNode(true));
  const board = $(".route-board", ui.puzzleHost);
  const seed = hash(month.key);
  // A guaranteed 5x5 continuous snake. IN enters the upper-left relay and
  // OUT leaves the lower-right relay; row-end elbows move the signal down.
  const solution = [
    ["straight", 1], ["straight", 1], ["straight", 1], ["straight", 1], ["elbow", 2],
    ["elbow", 1], ["straight", 1], ["straight", 1], ["straight", 1], ["elbow", 3],
    ["elbow", 0], ["straight", 1], ["straight", 1], ["straight", 1], ["elbow", 2],
    ["elbow", 1], ["straight", 1], ["straight", 1], ["straight", 1], ["elbow", 3],
    ["elbow", 0], ["straight", 1], ["straight", 1], ["straight", 1], ["straight", 1],
  ];
  solution.forEach(([shape, target], index) => {
    const tile = document.createElement("button");
    tile.type = "button"; tile.setAttribute("aria-label", `Rotate relay ${index + 1}`);
    tile.className = `route-tile ${shape}`;
    tile.dataset.target = target;
    tile.dataset.rotation = shape === "straight"
      ? 0
      : (target + 1 + ((seed >>> (index % 16)) % 3)) % 4;
    tile.style.setProperty("--rotation", tile.dataset.rotation);
    tile.addEventListener("click", () => {
      tile.dataset.rotation = (Number(tile.dataset.rotation) + 1) % 4;
      tile.style.setProperty("--rotation", tile.dataset.rotation); beep(380);
    });
    board.append(tile);
  });
  $(".verify-button", ui.puzzleHost).addEventListener("click", () => {
    const solved = $$(".route-tile", board).every((tile) => tile.classList.contains("straight")
      ? Number(tile.dataset.rotation) % 2 === Number(tile.dataset.target) % 2
      : tile.dataset.rotation === tile.dataset.target);
    solved ? completeRepair() : failPuzzle("SIGNAL STILL TERMINATES AT A BAD RELAY");
  });
}

function buildMemory(month) {
  ui.puzzleHost.replaceChildren($("#memory-template").content.cloneNode(true));
  const board = $(".memory-board", ui.puzzleHost);
  const seed = hash(month.key);
  const target = Array.from({ length: 25 }, (_, i) => ((seed >>> (i % 28)) + i + month.total) % 3 === 0);
  target.forEach((on, index) => {
    const byte = document.createElement("button");
    byte.type = "button"; byte.className = `memory-byte preview${on ? " on" : ""}`;
    byte.dataset.target = on ? "1" : "0"; byte.dataset.on = "0";
    byte.setAttribute("aria-label", `Memory byte ${index + 1}`);
    byte.addEventListener("click", () => {
      byte.dataset.on = byte.dataset.on === "1" ? "0" : "1";
      byte.classList.toggle("on", byte.dataset.on === "1"); beep(460);
    });
    board.append(byte);
  });
  let remaining = 2;
  const timer = setInterval(() => {
    if (!board.isConnected) { clearInterval(timer); return; }
    remaining -= 1;
    $(".memory-countdown span", ui.puzzleHost).textContent = remaining;
    if (remaining > 0) return;
    clearInterval(timer);
    $$(".memory-byte", board).forEach((byte) => byte.classList.remove("on", "preview"));
    $(".memory-countdown", ui.puzzleHost).textContent = "WRITE MODE ENABLED";
    const verify = $(".verify-button", ui.puzzleHost); verify.classList.remove("hidden");
    verify.addEventListener("click", () => {
      const solved = $$(".memory-byte", board).every((byte) => byte.dataset.on === byte.dataset.target);
      solved ? completeRepair() : failPuzzle("CHECKSUM DOES NOT MATCH CAPTURED MEMORY");
    });
  }, 800);
}

function buildLogs(month) {
  ui.puzzleHost.replaceChildren($("#logs-template").content.cloneNode(true));
  const board = $(".log-board", ui.puzzleHost); const sequence = $(".log-sequence", ui.puzzleHost);
  const available = month.active.length >= 6 ? month.active : month.days.filter((_, i) => i % Math.max(1, Math.floor(month.days.length / 7)) === 0);
  const records = shuffled(available, hash(month.key)).slice(0, 6).sort((a, b) => a.date.localeCompare(b.date));
  const selected = [];
  shuffled(records, hash(month.key + "logs")).forEach((record) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "log-record"; button.dataset.date = record.date;
    button.innerHTML = `<span>REC_${hash(record.date).toString(16).slice(0, 6).toUpperCase()}</span><span>${record.date} · ${record.contributionCount} hit${record.contributionCount === 1 ? "" : "s"}</span>`;
    button.addEventListener("click", () => { selected.push(record.date); button.classList.add("selected"); sequence.textContent = selected.join(" → "); beep(500); });
    board.append(button);
  });
  $(".clear-log-button", ui.puzzleHost).addEventListener("click", () => { selected.length = 0; sequence.textContent = ""; $$(".log-record", board).forEach((item) => item.classList.remove("selected")); });
  $(".verify-button", ui.puzzleHost).addEventListener("click", () => {
    const solved = selected.length === records.length && selected.every((date, i) => date === records[i].date);
    solved ? completeRepair() : failPuzzle("INDEX ORDER INVALID; OLDEST RECORD MUST LOAD FIRST");
  });
}

function failPuzzle(message) {
  state.attempts += 1; ui.attempt.textContent = `ATTEMPT ${state.attempts}`;
  ui.puzzleHost.classList.add("shake"); setTimeout(() => ui.puzzleHost.classList.remove("shake"), 500);
  log(message); beep(120, .12);
  if (state.attempts >= 4) ui.hint.classList.remove("hidden");
  if (state.attempts >= 7) ui.bypass.classList.remove("hidden");
}

function showHint() {
  const month = state.activePuzzle;
  if (!month) return;
  if (month.puzzle === "route") $$(".route-tile", ui.puzzleHost).forEach((tile) => {
    const aligned = tile.classList.contains("straight")
      ? Number(tile.dataset.rotation) % 2 === Number(tile.dataset.target) % 2
      : tile.dataset.rotation === tile.dataset.target;
    tile.style.borderColor = aligned ? "var(--amber)" : "var(--red)";
  });
  if (month.puzzle === "memory") $$(".memory-byte", ui.puzzleHost).forEach((byte) => { if (byte.dataset.target === "1") byte.style.outline = "1px dashed var(--amber)"; });
  if (month.puzzle === "logs") log("COMPARE THE YYYY-MM-DD FIELDS FROM LEFT TO RIGHT");
  ui.hint.classList.add("hidden");
}

function completeRepair(bypassed = false) {
  const month = state.activePuzzle;
  if (bypassed) { state.bypassed.add(month.key); state.repaired.delete(month.key); }
  else { state.repaired.add(month.key); state.bypassed.delete(month.key); }
  saveProgress(); updateStats(); renderSectors(); renderMonth(month); renderDiagnostic(month);
  ui.puzzleHost.innerHTML = `<div class="puzzle-success"><strong>${bypassed ? "FAULT BYPASSED" : "SECTOR RESTORED"}</strong><span>${month.key} mounted ${bypassed ? "read-only" : "with no errors"}.</span><br><br><button class="primary" id="continue-button" type="button">CONTINUE</button></div>`;
  ui.hint.classList.add("hidden"); ui.bypass.classList.add("hidden");
  $("#continue-button").addEventListener("click", () => { ui.dialog.close(); if (state.repaired.size + state.bypassed.size < state.months.length) selectSector(state.selected + 1); });
  log(`${month.key} ${bypassed ? "bypassed" : "repaired"}`); beep(bypassed ? 260 : 880, .12);
}

async function boot() {
  const lines = [
    "GNU bash, version 5.3.3(1)-release (x86_64-pc-linux-gnu)",
    "dumbly-smart@github:~$ ./debug-timeline --scan",
    "Loading contribution address table ......",
  ];
  for (const line of lines) { ui.bootLog.textContent += `${line}\n`; await new Promise((resolve) => setTimeout(resolve, instantBoot ? 0 : 220)); }
  try {
    const response = await fetch("./activity.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = normalizeData(await response.json());
  } catch (error) {
    state.data = normalizeData({ login: "dumbly-smart", period: { from: "UNKNOWN", to: new Date().toISOString().slice(0, 10) }, days: [], totalContributions: 0 });
    ui.bootLog.textContent += `WARN: live table unavailable (${error.message}); mounting empty timeline\n`;
  }
  state.months = groupMonths(state.data.days);
  ui.bootLog.textContent += `Mapped ${state.data.days.length} daily addresses ........... OK\nDetected ${state.data.totalContributions || 0} contribution signals ...... OK\n\nFATAL: ${state.months.length} timeline sectors report index corruption.\nAUTOMATIC REPAIR DISABLED. OPERATOR INPUT REQUIRED.\n`;
  ui.start.classList.remove("hidden"); ui.start.focus();
  if (instantBoot) initialize();
}

function initialize() {
  loadProgress();
  ui.bootPanel.classList.add("hidden"); ui.workspace.classList.remove("hidden");
  $("#watch-user").textContent = state.data.login || "dumbly-smart";
  $("#watch-period").textContent = `${state.data.period.from} / ${state.data.period.to}`;
  $("#watch-total").textContent = state.data.totalContributions || 0;
  $("#watch-commits").textContent = state.data.publicCommits || 0;
  $("#watch-streak").textContent = `${state.data.currentStreak || 0} DAYS`;
  $("#watch-peak").textContent = state.data.peakDay || 0;
  updateStats(); selectSector(0); log("Manual debugger initialized");
}

ui.start.addEventListener("click", initialize);
$("#close-dialog").addEventListener("click", () => ui.dialog.close());
ui.hint.addEventListener("click", showHint);
ui.bypass.addEventListener("click", () => completeRepair(true));
$("#reset-button").addEventListener("click", () => {
  if (!confirm("Erase repaired-sector progress for this browser?")) return;
  state.repaired.clear(); state.bypassed.clear(); saveProgress(); updateStats(); selectSector(state.selected); log("Session progress erased");
});
$("#sound-toggle").addEventListener("click", (event) => { state.sound = !state.sound; event.currentTarget.textContent = `SOUND: ${state.sound ? "ON" : "OFF"}`; event.currentTarget.setAttribute("aria-pressed", state.sound); beep(640); });
document.addEventListener("keydown", (event) => {
  if (!ui.workspace.classList.contains("hidden") && !ui.dialog.open) {
    if (event.key === "ArrowUp") { event.preventDefault(); selectSector(state.selected - 1); }
    if (event.key === "ArrowDown") { event.preventDefault(); selectSector(state.selected + 1); }
    if (event.key === "Enter" || event.key === "F5") { event.preventDefault(); openPuzzle(state.months[state.selected]); }
  }
  if (event.key === "Escape" && ui.dialog.open) ui.dialog.close();
});
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("en-GB", { hour12: false }); }, 1000);

boot();
