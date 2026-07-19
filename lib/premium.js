const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "db", "premium.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
  }
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

// durasi contoh: "7d", "30d", "1y", "12h"
function parseDuration(str) {
  const m = String(str).trim().match(/^(\d+)\s*([hdwmy])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  }[unit];
  if (!ms) return null;
  return n * ms;
}

function addPrem(userId, durationStr) {
  const durMs = parseDuration(durationStr);
  if (!durMs) return { ok: false, reason: "durasi_invalid" };

  const data = loadAll();
  const id = String(userId);
  const now = Date.now();
  const base = data[id] && data[id].expireAt > now ? data[id].expireAt : now;
  const expireAt = base + durMs;

  data[id] = { userId: id, expireAt, addedAt: data[id]?.addedAt || now };
  saveAll(data);
  return { ok: true, expireAt };
}

function delPrem(userId) {
  const data = loadAll();
  const id = String(userId);
  if (!data[id]) return { ok: false, reason: "not_found" };
  delete data[id];
  saveAll(data);
  return { ok: true };
}

function isPremium(userId) {
  const data = loadAll();
  const entry = data[String(userId)];
  if (!entry) return false;
  if (entry.expireAt < Date.now()) {
    // auto-expire dan bersihkan entry basi
    delete data[String(userId)];
    saveAll(data);
    return false;
  }
  return true;
}

function getPremium(userId) {
  const data = loadAll();
  const entry = data[String(userId)];
  if (!entry) return null;
  if (entry.expireAt < Date.now()) return null;
  return entry;
}

function listPremium() {
  const data = loadAll();
  const now = Date.now();
  const active = [];
  let changed = false;
  for (const id of Object.keys(data)) {
    if (data[id].expireAt < now) {
      delete data[id];
      changed = true;
    } else {
      active.push(data[id]);
    }
  }
  if (changed) saveAll(data);
  return active.sort((a, b) => a.expireAt - b.expireAt);
}

module.exports = {
  addPrem,
  delPrem,
  isPremium,
  getPremium,
  listPremium,
  parseDuration,
};
