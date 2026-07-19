
// Protokol komunikasi: process.send({ type, ... }) <-> process.on("message", ...)

const fs = require("fs");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const config = require("../config");

const mode = process.argv[2]; // "login" | "reconnect"
const phone = process.argv[3];
const sessionFile = process.argv[4];
const existingSession = process.argv[5] || ""; // hanya untuk mode reconnect

function send(msg) {
  if (process.send) process.send(msg);
}

let client = null;
let codeResolve = null;
let passwordResolve = null;
let codeAttempted = false;
let passwordAttempted = false;

async function runLogin() {
  const stringSession = new StringSession("");
  client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 3,
  });
  client.setLogLevel("none");

  try {
    await client.start({
      phoneNumber: async () => phone,
      phoneCode: async () => {
        if (codeAttempted) throw new Error("Kode OTP salah.");
        codeAttempted = true;
        send({ type: "need_code" });
        return new Promise((resolve) => (codeResolve = resolve));
      },
      password: async () => {
        if (passwordAttempted) throw new Error("Password 2FA salah.");
        passwordAttempted = true;
        send({ type: "need_password" });
        return new Promise((resolve) => (passwordResolve = resolve));
      },
      onError: (err) => {
        send({ type: "error", message: err?.message || String(err) });
      },
    });

    fs.writeFileSync(sessionFile, client.session.save());
    send({ type: "success" });
  } catch (err) {
    send({ type: "error", message: err?.message || String(err) });
  }
}

async function runReconnect() {
  const stringSession = new StringSession(existingSession);
  client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 3,
  });
  client.setLogLevel("none");

  try {
    await client.connect();
    send({ type: "success" });
  } catch (err) {
    send({ type: "error", message: err?.message || String(err) });
  }
}

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "submit_code" && codeResolve) {
    const resolve = codeResolve;
    codeResolve = null;
    resolve(String(msg.code || "").replace(/\s+/g, ""));
  } else if (msg.type === "submit_password" && passwordResolve) {
    const resolve = passwordResolve;
    passwordResolve = null;
    resolve(String(msg.password || ""));
  } else if (msg.type === "shutdown") {
    (async () => {
      try {
        if (client) await client.disconnect();
      } catch {}
      process.exit(0);
    })();
  }
});

process.on("uncaughtException", (err) => {
  send({ type: "error", message: "uncaughtException: " + (err?.message || String(err)) });
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  send({ type: "error", message: "unhandledRejection: " + (err?.message || String(err)) });
  process.exit(1);
});

if (mode === "login") {
  runLogin();
} else if (mode === "reconnect") {
  runReconnect();
} else {
  send({ type: "error", message: "mode worker tidak dikenal: " + mode });
  process.exit(1);
}
