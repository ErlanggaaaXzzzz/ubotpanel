const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");

const DB_PATH = path.join(__dirname, "..", "db", "userbots.json");
const SESSION_DIR = path.join(__dirname, "..", "db", "userbots");
const WORKER_PATH = path.join(__dirname, "userbotWorker.js");

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

function loadAll() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveAll(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sessionFilePath(userId, phone) {
  const safePhone = phone.replace(/[^\d+]/g, "");
  return path.join(SESSION_DIR, `${userId}_${safePhone}.session`);
}

function keyOf(userId, phone) {
  return `${userId}:${phone.replace(/[^\d+]/g, "")}`;
}

// Map<`${userId}:${phone}`, ChildProcess>
const activeWorkers = new Map();

// Map<userId, { phone, worker, awaiting, key }>
const pendingLogin = new Map();

// rate limit percobaan .addubot: Map<userId, number[]> (timestamp tiap percobaan)
const attemptLog = new Map();
const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 menit

function checkRateLimit(userId) {
  const id = String(userId);
  const now = Date.now();
  const list = (attemptLog.get(id) || []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  attemptLog.set(id, list);
  if (list.length >= MAX_ATTEMPTS) {
    const oldestExpiresIn = ATTEMPT_WINDOW_MS - (now - list[0]);
    return { allowed: false, retryAfterMs: oldestExpiresIn };
  }
  return { allowed: true };
}

function recordAttempt(userId) {
  const id = String(userId);
  const list = attemptLog.get(id) || [];
  list.push(Date.now());
  attemptLog.set(id, list);
}

// ===== DB helpers =====

function listUserbots(userId) {
  const data = loadAll();
  return data[String(userId)] || [];
}

function saveUserbotEntry(userId, phone, extra = {}) {
  const data = loadAll();
  const id = String(userId);
  if (!data[id]) data[id] = [];
  const safePhone = phone.replace(/[^\d+]/g, "");
  const idx = data[id].findIndex((u) => u.phone === safePhone);
  const entry = {
    phone: safePhone,
    sessionFile: sessionFilePath(id, safePhone),
    addedAt: Date.now(),
    status: "connected",
    ...extra,
  };
  if (idx >= 0) data[id][idx] = { ...data[id][idx], ...entry };
  else data[id].push(entry);
  saveAll(data);
  return entry;
}

function removeUserbotEntry(userId, phone) {
  const data = loadAll();
  const id = String(userId);
  const safePhone = phone.replace(/[^\d+]/g, "");
  if (!data[id]) return false;
  const before = data[id].length;
  data[id] = data[id].filter((u) => u.phone !== safePhone);
  saveAll(data);
  return data[id].length < before;
}

function findUserbot(userId, phone) {
  const list = listUserbots(userId);
  const safePhone = phone.replace(/[^\d+]/g, "");
  return list.find((u) => u.phone === safePhone);
}

function killWorker(k) {
  const worker = activeWorkers.get(k);
  if (!worker) return;
  try {
    worker.send({ type: "shutdown" });
  } catch {}
  // paksa kill kalau tidak exit sendiri dalam 5 detik
  const t = setTimeout(() => {
    try {
      worker.kill("SIGKILL");
    } catch {}
  }, 5000);
  worker.once("exit", () => clearTimeout(t));
  activeWorkers.delete(k);
}


const LOGIN_TIMEOUT_MS = 2 * 60 * 1000;

async function startAddUbot(userId, phone, { onNeedCode, onNeedPassword }) {
  const id = String(userId);
  const safePhone = phone.replace(/[^\d+]/g, "");

  if (pendingLogin.has(id)) {
    return { ok: false, reason: "sudah_ada_proses_login" };
  }

  const existing = findUserbot(id, safePhone);
  if (existing) {
    return { ok: false, reason: "nomor_sudah_terdaftar" };
  }

  const rl = checkRateLimit(id);
  if (!rl.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterMs: rl.retryAfterMs };
  }
  recordAttempt(id);

  const sessFile = sessionFilePath(id, safePhone);
  const k = keyOf(id, safePhone);

  const worker = fork(WORKER_PATH, ["login", safePhone, sessFile], {
    // batasi memori child process supaya OOM di sini tidak mengganggu sistem/proses lain
    execArgv: ["--max-old-space-size=256"],
    silent: true,
  });

  activeWorkers.set(k, worker);

  const state = { phone: safePhone, worker, awaiting: null, key: k };
  pendingLogin.set(id, state);

  let settleResolve;
  const settledPromise = new Promise((resolve) => (settleResolve = resolve));
  let failed = false;
  let failReason = null;
  let settled = false;

  const timeoutHandle = setTimeout(() => {
    if (settled) return;
    settled = true;
    failed = true;
    failReason = "Waktu tunggu habis (timeout). Proses login dibatalkan.";
    killWorker(k);
    pendingLogin.delete(id);
    settleResolve();
  }, LOGIN_TIMEOUT_MS);

  worker.on("message", (msg) => {
    if (!msg || typeof msg !== "object" || settled) return;
    if (msg.type === "need_code") {
      state.awaiting = "code";
      onNeedCode && onNeedCode();
    } else if (msg.type === "need_password") {
      state.awaiting = "password";
      onNeedPassword && onNeedPassword();
    } else if (msg.type === "success") {
      settled = true;
      clearTimeout(timeoutHandle);
      saveUserbotEntry(id, safePhone, { status: "connected" });
      pendingLogin.delete(id);
      settleResolve();
    } else if (msg.type === "error") {
      settled = true;
      clearTimeout(timeoutHandle);
      failed = true;
      failReason = msg.message;
      killWorker(k);
      pendingLogin.delete(id);
      settleResolve();
    }
  });

  worker.on("exit", (exitCode) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutHandle);
    failed = true;
    failReason = `Proses login berhenti tak terduga (exit code ${exitCode}). Ini tidak memengaruhi bot utama.`;
    activeWorkers.delete(k);
    pendingLogin.delete(id);
    settleResolve();
  });

  return { ok: true, startPromise: settledPromise, getFailure: () => (failed ? failReason : null) };
}

function submitCode(userId, code) {
  const id = String(userId);
  const pending = pendingLogin.get(id);
  if (!pending || pending.awaiting !== "code") return false;
  pending.worker.send({ type: "submit_code", code: String(code).replace(/\s+/g, "") });
  pending.awaiting = null;
  return true;
}

function submitPassword(userId, password) {
  const id = String(userId);
  const pending = pendingLogin.get(id);
  if (!pending || pending.awaiting !== "password") return false;
  pending.worker.send({ type: "submit_password", password: String(password) });
  pending.awaiting = null;
  return true;
}

function hasPendingLogin(userId) {
  return pendingLogin.has(String(userId));
}

function getAwaiting(userId) {
  return pendingLogin.get(String(userId))?.awaiting || null;
}

function abortAddUbot(userId) {
  const id = String(userId);
  const pending = pendingLogin.get(id);
  if (pending) killWorker(pending.key);
  pendingLogin.delete(id);
}

// ===== KELOLA USERBOT YANG SUDAH TERDAFTAR =====

async function delUbot(userId, phone) {
  const id = String(userId);
  const entry = findUserbot(id, phone);
  if (!entry) return { ok: false, reason: "tidak_ditemukan" };

  const k = keyOf(id, entry.phone);
  killWorker(k);

  try {
    if (fs.existsSync(entry.sessionFile)) fs.unlinkSync(entry.sessionFile);
  } catch {}

  removeUserbotEntry(id, entry.phone);
  return { ok: true };
}

async function restartUbot(userId, phone) {
  const id = String(userId);
  const entry = findUserbot(id, phone);
  if (!entry) return { ok: false, reason: "tidak_ditemukan" };

  const k = keyOf(id, entry.phone);
  killWorker(k);

  if (!fs.existsSync(entry.sessionFile)) {
    return { ok: false, reason: "session_hilang" };
  }

  const sessionStr = fs.readFileSync(entry.sessionFile, "utf8");
  const worker = fork(WORKER_PATH, ["reconnect", entry.phone, entry.sessionFile, sessionStr], {
    execArgv: ["--max-old-space-size=256"],
    silent: true,
  });
  activeWorkers.set(k, worker);

  return new Promise((resolve) => {
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      killWorker(k);
      resolve({ ok: false, reason: "gagal_connect", detail: "timeout" });
    }, 30000);

    worker.on("message", (msg) => {
      if (settled) return;
      if (msg.type === "success") {
        settled = true;
        clearTimeout(timeoutHandle);
        saveUserbotEntry(id, entry.phone, { status: "connected" });
        resolve({ ok: true });
      } else if (msg.type === "error") {
        settled = true;
        clearTimeout(timeoutHandle);
        activeWorkers.delete(k);
        resolve({ ok: false, reason: "gagal_connect", detail: msg.message });
      }
    });

    worker.on("exit", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      activeWorkers.delete(k);
      resolve({ ok: false, reason: "gagal_connect", detail: `worker exit ${exitCode}` });
    });
  });
}

function getActiveWorker(userId, phone) {
  return activeWorkers.get(keyOf(userId, phone));
}

module.exports = {
  listUserbots,
  findUserbot,
  startAddUbot,
  submitCode,
  submitPassword,
  hasPendingLogin,
  getAwaiting,
  abortAddUbot,
  delUbot,
  restartUbot,
  getActiveWorker,
};
