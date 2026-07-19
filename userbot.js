require("./lib/function.js");
const fs = require("fs");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const rimraf = require("rimraf");
const { Api } = require("telegram");
const FormData = require("form-data")
const archiver = require("archiver");
const config = require("./config");
const path = require("path");
const blFile = "./db/bl.json";
const loadBL = () => JSON.parse(fs.readFileSync(blFile));
const saveBL = d => fs.writeFileSync(blFile, JSON.stringify(d, null, 2));
const { CustomFile } = require("telegram/client/uploads");

async function sendAlbum(client, msg, chatId, imageUrls, caption = "") {
  const media = [];
  const tempFiles = [];
  try {
    for (let i = 0; i < imageUrls.length; i++) {
      const res = await axios.get(imageUrls[i], { responseType: "arraybuffer" });
      const tmpPath = `./tmp/album_${Date.now()}_${i}.jpg`;
      fs.writeFileSync(tmpPath, res.data);
      tempFiles.push(tmpPath);
      const uploaded = await client.uploadFile({
        file: new CustomFile(path.basename(tmpPath), fs.statSync(tmpPath).size, tmpPath),
        workers: 1
      });
      media.push(new Api.InputMediaUploadedPhoto({
        file: uploaded,
        ...(i === 0 && caption ? { message: caption } : {})
      }));
    }
    return await client.sendFile(chatId, {
      file: media,
      caption: caption,
      replyTo: msg.id,
      parseMode: "markdownv2"
    });
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

function setTempData(data, type, ttl = 600000) {
  const cacheId = `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const cacheData = { ...data, type: type, timestamp: Date.now() };
  global.tempData[cacheId] = cacheData;
  console.log(`Cache set: ${cacheId}, type: ${type}, data keys:`, Object.keys(data));
  setTimeout(() => {
    if (global.tempData[cacheId]) {
      console.log(`Cache expired: ${cacheId}`);
      delete global.tempData[cacheId];
    }
  }, ttl);
  return cacheId;
}

async function sendInline(client, chatId, query) {
  const botEntity = await client.getInputEntity(config.botUsername);
  const peer = await client.getInputEntity(chatId);
  const results = await client.invoke(new Api.messages.GetInlineBotResults({ bot: botEntity, peer, query, offset: "" }));
  if (results.results.length) await client.invoke(new Api.messages.SendInlineBotResult({ peer, queryId: results.queryId, id: results.results[0].id, hideVia: true }));
}

module.exports = (client, bot) => {
  client.addEventHandler(async event => {
    const msg = event.message, body = msg.message || "";
    if (!body.startsWith(config.prefix)) return;
    const args = body.trim().split(/ +/).slice(1), text = args.join(" ");
    const prefix = config.prefix;
    const command = body.slice(config.prefix.length).trim().split(" ").shift().toLowerCase();
    const cmd = prefix + command;
    const chatId = msg.chatId, fromId = msg?.senderId || msg?.fromId?.userId || "";
    const me = await client.getMe();
    const isOwner = fromId.toString() === config.ownerId?.toString() || fromId.toString() === me.id.toString();
    if (global.selfMode && !isOwner) return;

    switch (command) {
      case "menu": case "p": case "start": {
        const cacheId = setTempData({}, 'menu');
        return sendInline(client, chatId, `${prefix}menu ${cacheId}`);
      }
      break;

      case "self": case "public": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        const status = command == "self" ? true : false;
        global.selfMode = status;
        return msg.reply({ message: `✅ Berhasil beralih ke mode ${status ? "Self" : "Public"}` });
      }
      break;

      case "proses": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return client.sendMessage(chatId, { message: `*Ex:* ${cmd} jasa install panel`, replyTo: msg.id, parseMode: "markdownv2" });
        const prosesCache = setTempData({ text }, 'proses');
        return sendInline(client, chatId, `${prefix}proses ${prosesCache}`);
      }

      case "payment": case "pay": {
        const paymentCache = setTempData({}, 'payment');
        return sendInline(client, chatId, `${prefix}payment ${paymentCache}`);
      }

      case "delpanel": case "delp": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        const delpanelCache = setTempData({}, 'delpanel');
        return sendInline(client, chatId, `${prefix}delpanel ${delpanelCache}`);
      }

      case "deladmin": case "dela": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        const deladminCache = setTempData({}, 'deladmin');
        return sendInline(client, chatId, `${prefix}deladmin ${deladminCache}`);
      }

      case "nsfw": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        let imagesUrl = [];
        const waitMsg = await msg.reply({ message: "👀 Mencari gambar..." });
        try {
          for (let i = 0; i < 5; i++) imagesUrl.push("https://api.skyzopedia.web.id/random/nsfw?apikey=skyy");
          const caption = "Random NSFW 💦";
          await waitMsg.delete();
          await sendAlbum(client, msg, chatId, imagesUrl, caption);
        } catch (err) {
          console.error(err);
          return msg.reply({ message: "❌ Gagal mengambil NSFW" });
        }
      }
      break;

      case "waifu": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        let imagesUrl = [];
        const waitMsg = await msg.reply({ message: "👀 Mencari gambar..." });
        try {
          for (let i = 0; i < 5; i++) imagesUrl.push("https://api.skyzopedia.web.id/random/waifu?apikey=skyy");
          const caption = "Random Waifu 💦";
          await waitMsg.delete();
          await sendAlbum(client, msg, chatId, imagesUrl, caption);
        } catch (err) {
          console.error(err);
          return msg.reply({ message: "❌ Gagal mengambil Waifu" });
        }
      }
      break;

      case "listpanel": case "listserver": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        try {
          const res = await fetch(`${config.domain}/api/application/servers`, {
            method: "GET",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` }
          });
          const data = await res.json();
          const servers = data.data || [];
          if (!servers.length) return msg.reply({ message: "⚠️ Tidak ada server panel!" });
          let teks = `📊 *Total Server Panel:* ${servers.length}\n`;
          for (const sObj of servers) {
            const s = sObj.attributes;
            const ram = s.limits.memory === 0 ? "Unlimited" : (s.limits.memory >= 1024 ? `${Math.floor(s.limits.memory / 1024)} GB` : `${s.limits.memory} MB`);
            const disk = s.limits.disk === 0 ? "Unlimited" : (s.limits.disk >= 1024 ? `${Math.floor(s.limits.disk / 1024)} GB` : `${s.limits.disk} MB`);
            const cpu = s.limits.cpu === 0 ? "Unlimited" : `${s.limits.cpu}%`;
            teks += `
*⌯ Server ID:* ${s.id}
*⌯ Nama:* ${s.name}
*⌯ RAM:* ${ram}
*⌯ Disk:* ${disk}
*⌯ CPU:* ${cpu}
*⌯ Dibuat:* ${s.created_at?.split("T")[0] || "-"}\n`;
          }
          const listpanelCache = setTempData({ teks }, 'listpanel');
          return sendInline(client, chatId, `${prefix}listpanel ${listpanelCache}`);
        } catch (err) {
          console.error("Error listpanel:", err);
          msg.reply({ message: "Error! terjadi kesalahan saat mengambil data server panel!" });
        }
        break;
      }

      case "listadmin": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        try {
          const res = await fetch(`${config.domain}/api/application/users`, {
            method: "GET",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` }
          });
          const data = await res.json();
          const users = data.data || [];
          const admins = users.filter(u => u.attributes.root_admin);
          if (!admins.length) return msg.reply({ message: "⚠️ Tidak ada admin panel!" });
          let teks = `📊 *Total Admin Panel:* ${admins.length}\n`;
          for (const a of admins) {
            const u = a.attributes;
            teks += `
*⌯ User ID:* ${u.id}
*⌯ Username:* ${u.username}
*⌯ Dibuat:* ${u.created_at?.split("T")[0] || "-"}\n`;
          }
          const listadminCache = setTempData({ teks }, 'listadmin');
          return sendInline(client, chatId, `${prefix}listadmin ${listadminCache}`);
        } catch (err) {
          console.error("Error listadmin:", err);
          await msg.reply({ message: "Error! terjadi kesalahan saat mengambil data server panel!" });
        }
        break;
      }

      case "tiktokmp3": case "ttmp3": case "tiktokdl": case "tt": case "tiktok": case "ttdl": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} https://vt.tiktok.com/xxxxxx`, parseMode: "markdownv2" });
        try {
          const waitMsg = await msg.reply({ message: "📥 Mengambil data TikTok..." });
          const apiUrl = `https://api.skyzopedia.web.id/download/tiktok?apikey=skyy&url=${encodeURIComponent(text)}`;
          const { data: res } = await axios.get(apiUrl);
          if (!res?.status || !res?.result) return waitMsg.edit({ text: "❌ Gagal mengambil data TikTok" });
          await waitMsg.delete();
          const d = res.result;
          const caption = d.caption || "";
          if (d.type === "photo" && Array.isArray(d.slide)) {
            await sendAlbum(client, msg, chatId, d.slide, caption);
            if (d.audio) {
              const audioCacheId = setTempData({ type: "audio", audioUrl: d.audio, cover: d.slide[0], title: caption || "TikTok Audio", caption: caption }, "tiktok-audio");
              setTimeout(async () => {
                await sendInline(client, chatId, `${prefix}tiktok-audio ${audioCacheId}`);
              }, 300);
            }
            return;
          }
          const videoCacheId = setTempData({ type: "video", videoUrl: d.video, watermarkUrl: d.watermark || null, cover: d.cover || d.video, title: caption || "TikTok Video", caption: caption }, "tiktok-video");
          await sendInline(client, chatId, `${prefix}tiktok-video ${videoCacheId}`);
          if (d.audio) {
            const audioCacheId = setTempData({ type: "audio", audioUrl: d.audio, cover: d.cover || d.video, title: caption || "TikTok Audio", caption: caption }, "tiktok-audio");
            setTimeout(async () => {
              await sendInline(client, chatId, `${prefix}tiktok-audio ${audioCacheId}`);
            }, 500);
          }
        } catch (e) {
          console.error("TikTok DL Error:", e);
          msg.reply({ message: "❌ Terjadi kesalahan saat memproses TikTok" });
        }
        break;
      }

      case "pinterest": case "pin": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} Boruto`, parseMode: "markdownv2" });
        try {
          const waitMsg = await msg.reply({ message: "🔎 Mencari gambar Pinterest..." });
          const apiUrl = `https://api.skyzopedia.web.id/search/pinterest?apikey=skyy&q=${encodeURIComponent(text)}`;
          const { data: res } = await axios.get(apiUrl);
          if (!res?.status || !Array.isArray(res.result) || res.result.length === 0) return waitMsg.edit({ text: "❌ Tidak ditemukan hasil Pinterest" });
          await waitMsg.delete();
          const images = res.result.slice(0, 5);
          const caption = `🔍 *Pinterest Search Query:* ${text}\n🖼️ *Result:* ${images.length}`;
          await sendAlbum(client, msg, chatId, images, caption);
        } catch (e) {
          console.error("Pinterest Error:", e);
          msg.reply({ message: "❌ Terjadi kesalahan saat mengambil Pinterest" });
        }
        break;
      }

      case "cleardns": {
        if (!text || !text.includes("|")) return msg.reply({ message: `*Ex:* ${cmd} apitoken|zoneid`, parseMode: "markdownv2" });
        const [apiToken, zoneId] = text.split("|").map(v => v.trim());
        if (!apiToken || !zoneId) return msg.reply({ message: "❌ API Token atau Zone ID tidak valid!" });
        try {
          const waitMsg = await msg.reply({ message: "📄 Mengambil DNS record..." });
          const { data } = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
            headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" }
          });
          const records = data?.result;
          if (!records || records.length === 0) return waitMsg.edit({ text: "✅ Tidak ada DNS record untuk dihapus." });
          await waitMsg.edit({ text: `🗑️ Menghapus ${records.length} DNS record...` });
          const deletePromises = records.map(r => axios.delete(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${r.id}`, {
            headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" }
          }));
          await Promise.all(deletePromises);
          await waitMsg.edit({ text: `✅ Berhasil menghapus *${records.length}* DNS record.`, parseMode: "markdownv2" });
        } catch (err) {
          console.error("ClearDNS error:", err.response?.data || err.message);
          await msg.reply({ text: `❌ Gagal menghapus DNS.\n\n${err.response?.data?.errors?.[0]?.message || err.message}`, parseMode: "markdownv2" });
        }
        break;
      }

      case "ai": case "gpt": case "ask": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} Halo siapa kamu?`, parseMode: "markdownv2" });
        try {
          const apiUrl = `https://api.skyzopedia.web.id/ai/gpt?apikey=skyy&question=${encodeURIComponent(text)}`;
          const { data: res } = await axios.get(apiUrl);
          if (!res?.status || !res?.result) return waitMsg.edit({ text: "❌ Gagal mendapatkan jawaban AI" });
          const aiText = res.result;
          const aiCacheId = setTempData({ type: "text", title: "AI Response", question: text, answer: aiText, caption: aiText }, "ai-response");
          await sendInline(client, chatId, `${prefix}ai-response ${aiCacheId}`);
        } catch (e) {
          console.error("AI Error:", e);
          msg.reply({ message: "❌ Terjadi kesalahan saat memproses AI" });
        }
        break;
      }

      case "spotify": case "spdl": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} https://open.spotify.com/track/xxxx`, parseMode: "markdownv2" });
        let audioUrl;
        try {
          const waitMsg = await msg.reply({ message: "🎧 Mengambil data Spotify..." });
          const apiUrl = `https://api.skyzopedia.web.id/download/spotify2?apikey=skyy&url=${encodeURIComponent(text)}`;
          const { data: res } = await axios.get(apiUrl);
          if (!res?.status || !res?.result?.url) return waitMsg.edit({ text: "❌ Gagal mengambil data Spotify" });
          await waitMsg.delete();
          audioUrl = res.result.url;
          const trackTitle = res.result.title || "Spotify Track";
          await client.sendFile(chatId, { file: audioUrl, caption: `🎵 ${trackTitle}`, replyTo: msg.id });
        } catch (err) {
          console.error("Spotify error:", err);
          await msg.reply({ message: `❌ Error: ${err.message || "Gagal memproses Spotify"}\n\n${audioUrl ? `Coba download manual:\n${audioUrl}` : `URL audio tidak tersedia`}`, parseMode: "markdownv2" });
        }
        break;
      }

      case "ytmp3": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} https://youtu.be/xxxx`, parseMode: "markdownv2" });
        let audioUrl;
        try {
          const waitMsg = await msg.reply({ message: "📥 Mendownload audio..." });
          const apiUrl = `https://api.skyzopedia.web.id/download/ytdl-mp3?apikey=skyy&url=${encodeURIComponent(text)}`;
          const { data: res } = await axios.get(apiUrl);
          if (!res?.status || !res?.result?.download) return waitMsg.edit({ text: "❌ Gagal mendapatkan audio!" });
          await waitMsg.delete();
          audioUrl = res.result.download;
          const title = res.result.title || "YouTube Audio";
          await client.sendFile(chatId, { file: audioUrl, caption: `🎵 ${title}`, replyTo: msg.id });
        } catch (err) {
          console.error("YTMP3 URL error:", err);
          await msg.reply({ message: `❌ Error: ${err.message || "Gagal memproses audio"}\n\n${audioUrl ? `Download manual:\n${audioUrl}` : `URL audio tidak tersedia`}`, parseMode: "markdownv2" });
        }
        break;
      }

      case "play": {
        if (!text) return msg.reply({ message: `*Ex* ${cmd} nama lagu`, parseMode: "markdownv2" });
        try {
          const processingMsg = await msg.reply({ message: "🔍 Mencari lagu..." });
          const yts = require("yt-search");
          const searchResults = await yts(text);
          if (!searchResults.videos || searchResults.videos.length === 0) {
            await processingMsg.edit({ text: "❌ Lagu tidak ditemukan!" });
            return;
          }
          const video = searchResults.videos[0];
          const videoId = video.videoId;
          const youtubeUrl = `https://youtu.be/${videoId}`;
          await processingMsg.edit({ text: "📥 Mendownload audio..." });
          const apiUrl = `https://api.skyzopedia.web.id/download/ytdl-mp3?apikey=skyy&url=${encodeURIComponent(youtubeUrl)}`;
          const response = await axios.get(apiUrl);
          if (!response.data.status || !response.data.result) {
            await processingMsg.edit({ text: "❌ Gagal mendapatkan link download!" });
            return;
          }
          const { title, download: audioUrl } = response.data.result;
          await processingMsg.delete();
          const playCache = setTempData({ youtubeUrl, audioUrl, title }, 'play-result');
          return sendInline(client, chatId, `${prefix}play-result ${playCache}`);
        } catch (error) {
          console.error("Play error:", error);
          await msg.reply({ message: `❌ Error: ${error.message || "Gagal memproses lagu"}` });
        }
        break;
      }

      case "backupsc": case "bck": case "backup": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        try {
          await msg.reply({ message: "Backup Processing..." });
          const bulanIndo = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
          const tgl = new Date();
          const tanggal = tgl.getDate().toString().padStart(2, "0");
          const bulan = bulanIndo[tgl.getMonth()];
          const name = `Ubot-${tanggal}-${bulan}-${tgl.getFullYear()}`;
          const exclude = ["node_modules","package-lock.json","yarn.lock",".npm",".cache"];
          const filesToZip = fs.readdirSync(".").filter((f) => !exclude.includes(f) && f !== "");
          if (!filesToZip.length) return msg.reply({ message: "Tidak ada file yang dapat di backup!" });
          const output = fs.createWriteStream(`./${name}.zip`);
          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(output);
          for (let file of filesToZip) {
            const stat = fs.statSync(file);
            if (stat.isDirectory()) archive.directory(file, file);
            else archive.file(file, { name: file });
          }
          await archive.finalize();
          output.on("close", async () => {
            try {
              await client.sendFile(config.ownerId, { file: `./${name}.zip`, caption: "✅ <b>Backup Script selesai!</b>", parseMode: "html" });
              fs.unlinkSync(`./${name}.zip`);
              if (msg.chatId.toString() !== config.ownerId?.toString()) {
                await client.sendMessage(msg.chatId, { message: "✅ <b>Backup script selesai!</b>\nFile telah dikirim ke chat pribadi.", replyTo: msg.id, parseMode: "html" });
              }
            } catch (err) {
              console.error("Gagal kirim file backup:", err);
              await msg.reply({ message: "Error! terjadi kesalahan saat mengirim file." });
            }
          });
        } catch (err) {
          console.error("Backup Error:", err);
          await msg.reply({ message: "Error! terjadi kesalahan saat proses backup." });
        }
        break;
      }

      case "ping": {
        const os = require("os");
        const nou = require("node-os-utils");
        const speed = require("performance-now");
        const start = speed();
        const cpu = nou.cpu;
        const drive = nou.drive;
        const mem = nou.mem;
        const netstat = nou.netstat;
        const [osName, driveInfo, memInfo, cpuUsage, netStats] = await Promise.all([
          nou.os.oos().catch(() => "Unknown"),
          drive.info().catch(() => ({ usedGb: "N/A", totalGb: "N/A" })),
          mem.info().catch(() => ({ totalMemMb: 0, usedMemMb: 0, freeMemMb: 0 })),
          cpu.usage().catch(() => 0),
          netstat.inOut().catch(() => ({ total: null }))
        ]);
        const totalGB = (memInfo.totalMemMb / 1024 || 0).toFixed(2);
        const usedGB = (memInfo.usedMemMb / 1024 || 0).toFixed(2);
        const freeGB = (memInfo.freeMemMb / 1024 || 0).toFixed(2);
        const cpuList = os.cpus() || [];
        const cpuModel = cpuList[0]?.model || "Unknown CPU";
        const cpuSpeed = cpuList[0]?.speed || "N/A";
        const cpuCores = cpuList.length || 0;
        const vpsUptime = runtime(os.uptime());
        const botUptime = runtime(process.uptime());
        const latency = (speed() - start).toFixed(2);
        const loadAvg = os.loadavg().map(n => n.toFixed(2)).join(" | ");
        const nodeVersion = process.version;
        const platform = os.platform();
        const hostname = os.hostname();
        const arch = os.arch();
        const network = netStats.total ? `${netStats.total.inputMb.toFixed(2)} MB ↓ / ${netStats.total.outputMb.toFixed(2)} MB ↑` : "N/A";
        const tt = `
<b>⚙️ SYSTEM STATUS</b>
<b>⌯ OS :</b> ${nou.os.type()} (${osName})
<b>⌯ Platform :</b> ${platform.toUpperCase()}
<b>⌯ Arch :</b> ${arch}
<b>⌯ Hostname :</b> ${hostname}

<b>💾 STORAGE</b>
<b>⌯ Disk :</b> ${driveInfo.usedGb}/${driveInfo.totalGb} GB
<b>⌯ RAM :</b> ${usedGB}/${totalGB} GB (Free: ${freeGB} GB)

<b>🧠 CPU INFO</b>
<b>⌯ Model :</b> ${cpuModel}
<b>⌯ Core(s) :</b> ${cpuCores}
<b>⌯ Speed :</b> ${cpuSpeed} MHz
<b>⌯ Usage :</b> ${cpuUsage.toFixed(2)}%
<b>⌯ Load Avg :</b> ${loadAvg}

<b>🤖 BOT STATUS</b>
<b>⌯ Response Time :</b> ${latency} sec
<b>⌯ Bot Uptime :</b> ${botUptime}
<b>⌯ VPS Uptime :</b> ${vpsUptime}
<b>⌯ Node.js :</b> ${nodeVersion}
`;
        const pingCache = setTempData({ tt }, 'ping');
        return sendInline(client, chatId, `${prefix}ping ${pingCache}`);
      }
      break;

      case "me": case "my": case "myid": case "cekid": {
        const sender = await client.getEntity(msg.senderId);
        const info = `
⌯ ID: <code>${sender.id}</code> (${msg.senderId.toString().length})
⌯ Nama: <b>${sender.firstName || ""} ${sender.lastName || ""}</b>
⌯ Username: @${sender.username || "-"}
⌯ Bot: ${sender.bot ? "Ya" : "Tidak"}
⌯ Premium: ${sender.premium ? "Ya" : "Tidak"}
`;
        const meCache = setTempData({ teks: info, username: sender.username || "" }, 'me');
        return sendInline(client, chatId, `${prefix}me ${meCache}`);
      }
      break;

      case "bcgc": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!msg.replyTo) return client.sendMessage(chatId, { message: `*Ex:* ${cmd} dengan reply pesan`, replyTo: msg.id, parseMode: "markdownv2" });
        const replied = await msg.getReplyMessage();
        const msgId = replied.id;
        const chat = replied.chat;
        if (!replied) return msg.reply({ message: "⚠️ Tidak dapat menemukan pesan yang dibalas." });
        const blacklist = await loadBL();
        const dialogs = await client.getDialogs();
        const peerFrom = replied.fwdFrom && replied.fwdFrom.fromId?.className == "PeerChannel" ? replied.fwdFrom.fromId : replied.chat;
        const peer = peerFrom;
        const targets = dialogs.filter(d => d.isGroup && !blacklist.includes(d.id.toString()));
        msg.reply({ message: `🔁 Broadcast pesan ke ${targets.length} grup` });
        global.statusBc = true;
        global.bcType = "Broadcast grup";
        let sukses = 0, gagal = 0;
        for (const d of targets) {
          if (!global.statusBc) break;
          try {
            await client.forwardMessages(d.id, { messages: [msgId], fromPeer: chat, dropAuthor: true });
            sukses++;
          } catch (e) {
            gagal++;
            console.log(`[•] Fwd ${d.name || d.title} Error: ${e}`);
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        const resultMsg = `✅ Broadcast selesai!\n\nSukses: ${sukses}\nGagal: ${gagal}\nBlacklist: ${blacklist.length}`;
        return msg.reply({ message: resultMsg });
        break;
      }

      case "cfd": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!msg.replyTo) return client.sendMessage(chatId, { message: `*Ex:* ${cmd} dengan reply pesan`, replyTo: msg.id, parseMode: "markdownv2" });
        const replied = await msg.getReplyMessage();
        const msgId = replied.id;
        const chat = replied.chat;
        if (!replied) return msg.reply({ message: "⚠️ Tidak dapat menemukan pesan yang dibalas." });
        const blacklist = await loadBL();
        const dialogs = await client.getDialogs();
        const peerFrom = replied.fwdFrom && replied.fwdFrom.fromId?.className == "PeerChannel" ? replied.fwdFrom.fromId : replied.chat;
        const peer = peerFrom;
        const targets = dialogs.filter(d => d.isGroup && !blacklist.includes(d.id.toString()));
        msg.reply({ message: `🔁 Forward pesan ke ${targets.length} grup` });
        global.statusBc = true;
        global.bcType = "Cfd grup";
        let sukses = 0, gagal = 0;
        for (const d of targets) {
          if (!global.statusBc) break;
          try {
            await client.forwardMessages(d.id, { messages: [msgId], fromPeer: chat, dropAuthor: false });
            sukses++;
          } catch (e) {
            gagal++;
            console.log(`[•] Fwd ${d.name || d.title} Error: ${e}`);
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        const resultMsg = `✅ Forward selesai!\n\nSukses: ${sukses}\nGagal: ${gagal}\nBlacklist: ${blacklist.length}`;
        return msg.reply({ message: resultMsg });
        break;
      }

      case "bcuser": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!msg.replyTo) return client.sendMessage(chatId, { message: `*Ex:* ${cmd} dengan reply pesan`, replyTo: msg.id, parseMode: "markdownv2" });
        const replied = await msg.getReplyMessage();
        if (!replied) return msg.reply({ message: "⚠️ Tidak dapat menemukan pesan yang dibalas." });
        const msgId = replied.id;
        const chat = replied.chat;
        const dialogs = await client.getDialogs();
        const targets = dialogs.filter(d => d.isUser && !d.isBot);
        global.statusBc = true;
        global.bcType = "Broadcast user";
        msg.reply({ message: `🔁 Broadcast ke ${targets.length} user` });
        let sukses = 0;
        let gagal = 0;
        for (const d of targets) {
          if (!global.statusBc) break;
          try {
            await client.forwardMessages(d.id, { messages: [msgId], fromPeer: chat, dropAuthor: true });
            sukses++;
          } catch (e) {
            gagal++;
            console.log(`[•] BC User ${d.name || d.id} Error: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 3000));
        }
        const resultMsg = `✅ Broadcast User selesai!\n\nSukses: ${sukses}\nGagal: ${gagal}`;
        return msg.reply({ message: resultMsg });
      }
      break;

      case "stopbc": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!global.statusBc) return msg.reply({ message: "⚠️ Tidak ada broadcast yang sedang berjalan." });
        global.statusBc = false;
        return msg.reply({ message: `✅ ${global.bcType} dihentikan!` });
      }
      break;

      case "bl": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!msg.isGroup) return msg.reply({ message: "❌ Harus di dalam grup!" });
        const bl = loadBL(), id = chatId.toString();
        if (bl.includes(id)) return msg.reply({ message: "⚠️ Grup sudah ada di blacklist." });
        bl.push(id); saveBL(bl);
        const blCache = setTempData({ id }, 'bl');
        return sendInline(client, chatId, `${prefix}bl ${blCache}`);
      }

      case "delbl": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!msg.isGroup) return msg.reply({ message: "❌ Harus di dalam grup!" });
        const bl = loadBL(), id = chatId.toString();
        if (!bl.includes(id)) return msg.reply({ message: "⚠️ Grup tidak ada di blacklist." });
        saveBL(bl.filter(x => x !== id));
        const delblCache = setTempData({ id }, 'delbl');
        return sendInline(client, chatId, `${prefix}delbl ${delblCache}`);
      }

      case "subdo": case "subdomain": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text.includes("|")) return client.sendMessage(chatId, { message: `*Ex:* ${cmd} hostname|ip`, replyTo: msg.id, parseMode: "markdownv2" });
        const obj = Object.keys(config.subdomain || {});
        if (obj.length < 1) return msg.reply({ message: "❌ Tidak ada domain tersedia." });
        const subdomainCache = setTempData({ text }, 'subdomain');
        return sendInline(client, chatId, `${prefix}subdomain ${subdomainCache}`);
      }

      case "1gb": case "2gb": case "3gb": case "4gb": case "5gb": case "6gb": case "7gb": case "8gb": case "9gb": case "10gb": case "unlimited": case "unli": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} username`, parseMode: "markdownv2" });
        const username = text.toLowerCase();
        const email = `${username}@gmail.com`;
        const name = `${global.capital ? global.capital(username) : username} Server`;
        const password = `${username}001`;
        const resourceMap = {
          "1gb": { ram: "1000", disk: "1000", cpu: "40" },
          "2gb": { ram: "2000", disk: "1000", cpu: "60" },
          "3gb": { ram: "3000", disk: "2000", cpu: "80" },
          "4gb": { ram: "4000", disk: "2000", cpu: "100" },
          "5gb": { ram: "5000", disk: "3000", cpu: "120" },
          "6gb": { ram: "6000", disk: "3000", cpu: "140" },
          "7gb": { ram: "7000", disk: "4000", cpu: "160" },
          "8gb": { ram: "8000", disk: "4000", cpu: "180" },
          "9gb": { ram: "9000", disk: "5000", cpu: "200" },
          "10gb": { ram: "10000", disk: "5000", cpu: "220" },
          "unlimited": { ram: "0", disk: "0", cpu: "0" },
          "unli": { ram: "0", disk: "0", cpu: "0" }
        };
        const { ram, disk, cpu } = resourceMap[command] || { ram: "0", disk: "0", cpu: "0" };
        try {
          const f = await fetch(`${config.domain}/api/application/users`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` },
            body: JSON.stringify({ email, username, first_name: name, last_name: "Server", language: "en", password })
          });
          const data = await f.json();
          if (data.errors) return msg.reply({ message: `❌ Error create user:\n${JSON.stringify(data.errors[0], null, 2)}` });
          const user = data.attributes;
          const f1 = await fetch(`${config.domain}/api/application/nests/${config.nestid}/eggs/${config.egg}`, {
            method: "GET",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` }
          });
          const data2 = await f1.json();
          const startup_cmd = data2.attributes?.startup || "npm start";
          const f2 = await fetch(`${config.domain}/api/application/servers`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` },
            body: JSON.stringify({
              name,
              description: global.tanggal ? global.tanggal(Date.now()) : new Date().toLocaleString(),
              user: user.id,
              egg: parseInt(config.egg),
              docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
              startup: startup_cmd,
              environment: { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start" },
              limits: { memory: ram, swap: 0, disk, io: 500, cpu },
              feature_limits: { databases: 5, backups: 5, allocations: 5 },
              deploy: { locations: [parseInt(config.loc)], dedicated_ip: false, port_range: [] }
            })
          });
          const result = await f2.json();
          if (result.errors) return msg.reply({ message: `❌ Error create server:\n${JSON.stringify(result.errors[0], null, 2)}` });
          const server = result.attributes;
          const domainClean = (config.domain || "").replace(/https?:\/\//g, "");
          const panelData = { username: user.username, password, serverId: server.id, ram, disk, cpu, domainClean };
          const panelCache = setTempData(panelData, 'cpanel-result');
          return sendInline(client, chatId, `${prefix}cpanel-result ${panelCache}`);
        } catch (err) {
          console.error(err);
          await msg.reply({ message: `❌ Gagal membuat panel:\n${err.message || err}` });
        }
        break;
      }

      case "cadmin": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} username`, parseMode: "markdownv2" });
        const username = text.toLowerCase();
        const email = `${username}@gmail.com`;
        const name = global.capital ? global.capital(username) : username;
        const password = `${username}001`;
        try {
          const res = await fetch(`${config.domain}/api/application/users`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${config.apikey}` },
            body: JSON.stringify({ email, username, first_name: name, last_name: "Admin", root_admin: true, language: "en", password })
          });
          const data = await res.json();
          if (data.errors) return msg.reply({ message: `❌ Error create admin:\n${JSON.stringify(data.errors[0], null, 2)}` });
          const user = data.attributes;
          const domainClean = (config.domain || "").replace(/https?:\/\//g, "");
          let id = user.id;
          const adminData = { id, username: user.username, password, domainClean };
          const adminCache = setTempData(adminData, 'cadmin-result');
          return sendInline(client, chatId, `${prefix}cadmin-result ${adminCache}`);
        } catch (err) {
          console.error(err);
          await msg.reply({ message: `❌ Gagal membuat admin:\n${err.message || err}` });
        }
        break;
      }

      case "encjs": case "enc": {
        const jsconfuser = require("js-confuser");
        const chatId = msg.chatId;
        if (!msg.replyTo) return client.sendMessage(chatId, { message: "Reply file `.js` untuk dienkripsi!", replyTo: msg.id });
        const repl = await msg.getReplyMessage();
        const file = repl.media;
        if (!file || !repl.media.document || !repl.media.document.attributes[0].fileName.endsWith(".js"))
          return client.sendMessage(chatId, { message: "Hanya bisa untuk file `.js`", replyTo: msg.id });
        await client.sendMessage(chatId, { message: `🔒 Sedang memproses encrypt ${repl.media.document.attributes[0].fileName}...`, replyTo: msg.id });
        try {
          const buffer = await client.downloadMedia(repl.media);
          if (!buffer) return client.sendMessage(chatId, { message: "Gagal download file!", replyTo: msg.id });
          const inputCode = buffer.toString();
          const encryptedCode = await jsconfuser.obfuscate(inputCode, {
            target: "node",
            preset: "high",
            stringEncoding: true,
            identifierGenerator: "zeroWidth",
          });
          const outPath = `./tmp/${repl.media.document.attributes[0].fileName}`;
          await fs.writeFileSync(outPath, encryptedCode.code);
          await client.sendFile(chatId, { file: outPath, caption: `✅ Berhasil encrypt file ${repl.media.document.attributes[0].fileName}`, replyTo: msg.id });
          fs.unlinkSync(outPath);
        } catch (err) {
          console.error(err);
          await client.sendMessage(chatId, { message: "❌ Gagal mengenkripsi file!", replyTo: msg.id });
        }
      }
      break;

      case "cleardb": case "uninstallpanel": case "uninstalpanel": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        let t = text.split("|");
        if (t.length < 2) return msg.reply({ message: `*Ex:* ${cmd} ipvps|pwvps`, parseMode: "markdownv2" });
        const { Client: SSHClient } = require("ssh2");
        const net = require("net");
        let [ipvps, passwd] = t;
        const connSettings = { host: ipvps, port: 22, username: "root", password: passwd };
        async function waitForSSH(host, port = 22, timeout = 300) {
          return new Promise((resolve, reject) => {
            let elapsed = 0;
            const interval = setInterval(() => {
              const socket = new net.Socket();
              socket.setTimeout(2000);
              socket.on("connect", () => { clearInterval(interval); socket.destroy(); resolve(true); });
              socket.on("error", () => socket.destroy());
              socket.on("timeout", () => socket.destroy());
              socket.connect(port, host);
              elapsed += 2;
              if (elapsed >= timeout) { clearInterval(interval); reject(new Error("VPS tidak merespon SSH setelah reboot")); }
            }, 2000);
          });
        }
        const ssh = new SSHClient();
        ssh.on("ready", async () => {
          try {
            await new Promise((res, rej) => {
              ssh.exec("sudo reboot", (err, stream) => {
                if (err) return rej(err);
                stream.on("close", () => res()).on("data", () => {}).stderr.on("data", () => {});
              });
            });
            ssh.end();
            client.sendMessage(msg.chatId, { message: "♻️ VPS direstart, menunggu aktif kembali...", replyTo: msg.id });
            await waitForSSH(ipvps);
            client.sendMessage(msg.chatId, { message: "✅ VPS sudah aktif kembali, menjalankan uninstall panel + cleardb...", replyTo: msg.id });
            const ssh2 = new SSHClient();
            ssh2.on("ready", () => {
              const uninstallCommand = `bash <(curl -s https://pterodactyl-installer.se)`;
              const cleardbCommand = `
  sudo dpkg --configure -a
  sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y mariadb-server mariadb-client mariadb-common mysql-common mysql-server-core-* mysql-client-core-*
  sudo apt-get autoremove -y
  sudo rm -rf /var/lib/mysql /etc/mysql
  echo "✅ Panel dan Database MySQL/MariaDB berhasil dibersihkan!"
  sudo reboot
  `.trim();
              ssh2.exec(uninstallCommand, { pty: true }, (err, stream) => {
                if (err) return client.sendMessage(msg.chatId, { message: "❌ Gagal menjalankan uninstall panel", replyTo: msg.id });
                stream.on('close', async () => {
                  ssh2.exec(cleardbCommand, { pty: true }, (err, stream2) => {
                    if (err) return client.sendMessage(msg.chatId, { message: "❌ Gagal menjalankan cleardb", replyTo: msg.id });
                    stream2.on("close", async (code) => {
                      await client.sendMessage(msg.chatId, { message: "✅ Uninstall panel + Cleardb selesai!", replyTo: msg.id });
                      ssh2.end();
                    }).on("data", data => console.log("OUTPUT:", data.toString()))
                      .stderr.on("data", data => console.log("STDERR:", data.toString()));
                  });
                }).on("data", (data) => {
                  console.log("OUTPUT uninstall:", data.toString());
                  if (data.toString().includes('Input 0-6')) stream.write("6\n");
                  if (data.toString().includes('(y/N)')) stream.write("y\n");
                  if (data.toString().includes('Choose the panel user')) stream.write("\n");
                  if (data.toString().includes('Choose the panel database')) stream.write("\n");
                }).stderr.on('data', (data) => {
                  console.log("STDERR uninstall:", data.toString());
                });
              });
            }).on("error", err => {
              client.sendMessage(msg.chatId, { message: `❌ Gagal SSH setelah reboot: ${err.message}`, replyTo: msg.id });
            }).connect(connSettings);
          } catch (e) {
            client.sendMessage(msg.chatId, { message: `❌ Error: ${e.message}`, replyTo: msg.id });
          }
        }).on("error", err => {
          client.sendMessage(msg.chatId, { message: `❌ Gagal terhubung ke VPS: ${err.message}`, replyTo: msg.id });
        }).connect(connSettings);
      }
      break;

      case "startwings": case "configurewings": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        let t = text.split("|");
        if (t.length < 3) return msg.reply({ message: `*Ex:* ${cmd} ipvps|pwvps|token`, parseMode: "markdownv2" });
        const { Client: SSHClient } = require("ssh2");
        let [ipvps, passwd, token] = t;
        const connSettings = { host: ipvps, port: 22, username: "root", password: passwd };
        const ssh = new SSHClient();
        ssh.on("ready", () => {
          ssh.exec(`${token} && systemctl start wings`, (err, stream) => {
            if (err) return client.sendMessage(msg.chatId, { message: "Gagal menjalankan perintah di VPS", replyTo: msg.id });
            stream.on("close", async () => {
              await client.sendMessage(msg.chatId, { message: "✅ Wings node Pterodactyl berhasil dijalankan!", replyTo: msg.id });
              ssh.end();
            }).on("data", data => stream.write("y\n\n"))
              .stderr.on("data", data => {
                console.log("STDERR:", data.toString());
                client.sendMessage(msg.chatId, { message: `Terjadi error saat eksekusi:\n${data.toString()}`, replyTo: msg.id });
              });
          });
        }).on("error", err => {
          console.log("Connection Error:", err.message);
          client.sendMessage(msg.chatId, { message: "Gagal terhubung ke VPS: IP atau password salah.", replyTo: msg.id });
        }).connect(connSettings);
      }
      break;

      case "installpanel": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return client.sendMessage(msg.chatId, { message: `*Ex:* ${cmd} ipvps|pwvps|panel.com|node.com|ram`, parseMode: "markdownv2", replyTo: msg.id });
        const vii = text.split("|");
        if (vii.length < 5) return client.sendMessage(msg.chatId, { message: `*Ex:* ${cmd} ipvps|pwvps|panel.com|node.com|ram`, parseMode: "markdownv2", replyTo: msg.id });
        const { Client: SSHClient } = require("ssh2");
        const ssh = new SSHClient();
        const ipVps = vii[0];
        const pwVps = vii[1];
        const domainpanel = vii[2];
        const domainnode = vii[3];
        const ramserver = vii[4];
        const chatId = msg.chatId;
        const passwordPanel = "admin001";
        const installer = "bash <(curl -s https://pterodactyl-installer.se)";
        const connSettings = {
          host: ipVps.includes("@") ? ipVps.split("@")[1] : ipVps,
          username: ipVps.includes("@") ? ipVps.split("@")[0] : "root",
          password: pwVps,
          port: 22
        };
        function installPanel() {
          ssh.exec(installer, (err, stream) => {
            if (err) return;
            stream.on("data", (data) => {
              const str = data.toString();
              console.log("PANEL:", str);
              if (str.includes("Input 0-6")) stream.write("0\n");
              if (str.includes("(y/N)")) stream.write("y\n");
              if (str.includes("(Y)es/(N)o")) stream.write("y\n");
              if (str.includes("Do you want to automatically configure HTTPS using Let's Encrypt? (y/N)")) stream.write("y\n");
              if (str.includes("Database name")) stream.write("\n");
              if (str.includes("Database username")) stream.write("admin\n");
              if (str.includes("Password (press enter")) stream.write("admin\n");
              if (str.includes("Select timezone")) stream.write("Asia/Jakarta\n");
              if (str.includes("Provide the email")) stream.write("admin@gmail.com\n");
              if (str.includes("Email address for the initial admin account")) stream.write("admin@gmail.com\n");
              if (str.includes("Username for the initial admin")) stream.write("admin\n");
              if (str.includes("First name")) stream.write("Admin\n");
              if (str.includes("Last name")) stream.write("Panel\n");
              if (str.includes("Password for the initial admin")) stream.write(`${passwordPanel}\n`);
              if (str.includes("Set the FQDN of this panel")) stream.write(`${domainpanel}\n`);
              if (str.includes("configure UFW")) stream.write("y\n");
              if (str.includes("configure HTTPS")) stream.write("y\n");
              if (str.includes("Select the appropriate number")) stream.write("1\n");
              if (str.includes("(A)gree/(C)ancel")) stream.write("A\n");
            });
            stream.on("close", () => installWings());
          });
        }
        function installWings() {
          ssh.exec(installer, (err, stream) => {
            if (err) return;
            stream.on("data", (data) => {
              const str = data.toString();
              console.log("WINGS:", str);
              if (str.includes("Input 0-6")) stream.write("1\n");
              if (str.includes("(y/N)")) stream.write("y\n");
              if (str.includes("Enter the panel address")) stream.write(`${domainpanel}\n`);
              if (str.includes("Database host username")) stream.write("admin\n");
              if (str.includes("Database host password")) stream.write("admin\n");
              if (str.includes("Set the FQDN")) stream.write(`${domainnode}\n`);
              if (str.includes("Enter email address")) stream.write("admin@gmail.com\n");
            });
            stream.on("close", () => installNode());
          });
        }
        function installNode() {
          ssh.exec("bash <(curl -s https://raw.githubusercontent.com/SkyzoOffc/Pterodactyl-Theme-Autoinstaller/main/createnode.sh)", (err, stream) => {
            if (err) return;
            stream.on("data", (data) => {
              const str = data.toString();
              console.log("NODE:", str);
              if (str.includes("Masukkan nama lokasi")) stream.write("Singapore\n");
              if (str.includes("Masukkan deskripsi lokasi")) stream.write("Node By Bot\n");
              if (str.includes("Masukkan domain")) stream.write(`${domainnode}\n`);
              if (str.includes("Masukkan nama node")) stream.write("Piantech\n");
              if (str.includes("Masukkan RAM")) stream.write(`${ramserver}\n`);
              if (str.includes("jumlah maksimum disk")) stream.write(`${ramserver}\n`);
              if (str.includes("Masukkan Locid")) stream.write("1\n");
            });
            stream.on("close", async () => {
              const panelData = { domainpanel, username: "admin", password: passwordPanel, ipVps, pwVps };
              const installCache = setTempData(panelData, "installpanel-result");
              await sendInline(client, chatId, `${prefix}installpanel-result ${installCache}`);
              ssh.end();
            });
          });
        }
        ssh.on("ready", async () => {
          await client.sendMessage(chatId, {
            message: "🛠️ Install panel dimulai...\n\n" + `IP VPS : ${ipVps}\n` + `Panel  : ${domainpanel}`,
            replyTo: msg.id
          });
          installPanel();
        });
        ssh.on("error", (err) => {
          client.sendMessage(chatId, { message: `❌ SSH Error: ${err.message}`, replyTo: msg.id });
        });
        ssh.connect(connSettings);
      }
      break;

case "toanime":
case "jadianime":
case "toanim": {
  let target;
  if (msg.replyToMsgId) {
    try { target = await msg.getReplyMessage(); } catch {}
  }
  if (!target?.media)
    return msg.reply({ message: "❌ Reply gambar untuk menggunakan Jadi Anime." });

  const waitMsg = await msg.reply({ message: "🖼️ Memproses anime style image..." });

  try {
    const raw = await target.downloadMedia({ downloadUrl: false });
    if (!raw) throw new Error("BUFFER_EMPTY");

    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    const form = new FormData();
    form.append("apikey", "skyy");
    form.append('file', buffer, 'image.jpg');

    const { data } = await axios.post(
      "https://api.skyzopedia.web.id/tools/jadianime",
      form,
      { headers: form.getHeaders() }
    );

    if (!data?.status || !data?.result) throw new Error("TOANIME_FAILED");

    const cache = setTempData({ before: null, after: data.result }, "jadianime");
    await waitMsg.delete();
    return sendInline(client, chatId, `${prefix}jadianime ${cache}`);

  } catch (e) {
    console.log(e);
    await waitMsg.delete();
    return msg.reply({ message: "❌ Gagal memproses To Anime." });
  }
}
break;


case "hd":
case "remini":
case "tohd": {
  let target;
  if (msg.replyToMsgId) {
    try { target = await msg.getReplyMessage(); } catch {}
  }
  if (!target?.media)
    return msg.reply({ message: "❌ Reply gambar untuk menggunakan Remini / HD." });

  const waitMsg = await msg.reply({ message: "🖼️ Memproses upscaler image..." });

  try {
    const buffer = await target.downloadMedia({ downloadUrl: false });
    if (!buffer) throw new Error("BUFFER_EMPTY");

    const form = new FormData();
    form.append('apikey', 'skyy');
    form.append('file', buffer, 'image.jpg');  // Simple, hanya 3 parameter

    const { data } = await axios.post(
      "https://api.skyzopedia.web.id/tools/upscale",
      form,
      {
        headers: {
          ...form.getHeaders()
        }
      }
    );

    if (!data?.status || !data?.result) throw new Error("UPSCALE_FAILED");

    const cache = setTempData({ before: null, after: data.result }, "remini");
    await waitMsg.delete();
    return sendInline(client, chatId, `${prefix}remini ${cache}`);

  } catch (e) {
    console.log("Error:", e.message, e.response?.data);
    await waitMsg.delete();
    return msg.reply({ message: "❌ Gagal memproses Remini / HD." });
  }
}
break;
      
      case "owner": case "dev": {
        const user = await client.getEntity(config.ownerId);
        const ownerUrl = `https://t.me/${user.username}`;
        const messageText = `||${ownerUrl}||`;
    
        return client.sendMessage(chatId, {
        message: messageText,
        parseMode: "markdownv2",
        replyTo: msg.id
        });
      }
      break;

      case "tourl": {
        let targetMessage;
        if (msg.replyToMsgId) {
          try {
            const replied = await msg.getReplyMessage();
            if (replied) targetMessage = replied;
          } catch (error) {
            console.error("Gagal mengambil pesan yang dibalas:", error.message);
          }
        }
        const msgMedia = targetMessage?.media;
        if (!msgMedia) return msg.reply({ message: `Reply media (foto, video, atau dokumen) untuk menggunakannya.` });
        let buffer;
        try {
          buffer = await targetMessage.downloadMedia({ downloadUrl: false });
        } catch (error) {
          console.error("Gagal mendownload media:", error.message);
          return msg.reply({ message: `❌ Gagal mendownload media.` });
        }
        if (!buffer) return msg.reply({ message: `❌ Gagal mendapatkan data buffer dari media.` });
        const { fromBuffer } = require("file-type");
        const fetchModule = await import("node-fetch");
        const fetch = fetchModule.default;
        async function uploadToCatbox(buf) {
          let { ext } = await fromBuffer(buf);
          let bodyForm = new FormData();
          bodyForm.append("fileToUpload", buf, "file." + ext);
          bodyForm.append("reqtype", "fileupload");
          let res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: bodyForm });
          return await res.text();
        }
        try {
          const url = await uploadToCatbox(buffer);
          const tourlCache = setTempData({ url }, 'tourl');
          return sendInline(client, chatId, `${prefix}tourl ${tourlCache}`);
        } catch (error) {
          console.error("Gagal upload ke Catbox:", error.message);
          await msg.reply({ message: `❌ Terjadi kesalahan saat mengupload media.` });
        }
      }
      break;

      case "tourl2": {
        let targetMessage;
        if (msg.replyToMsgId) {
          try {
            const replied = await msg.getReplyMessage();
            if (replied) targetMessage = replied;
          } catch {}
        }
        const msgMedia = targetMessage?.media;
        if (!msgMedia) return msg.reply({ message: "Reply gambar untuk menggunakan Pixhost." });
        let buffer;
        try {
          buffer = await targetMessage.downloadMedia({ downloadUrl: false });
        } catch {
          return msg.reply({ message: "❌ Gagal mendownload media." });
        }
        if (!buffer) return msg.reply({ message: "❌ Buffer media kosong." });
        const { ImageUploadService } = require("node-upload-images");
        async function uploadImageBuffer(buffer) {
          try {
            const service = new ImageUploadService("pixhost.to");
            const { directLink } = await service.uploadFromBinary(buffer, "image.png");
            return directLink || null;
          } catch {
            return null;
          }
        }
        try {
          const url = await uploadImageBuffer(buffer);
          if (!url) throw new Error();
          const tourl2Cache = setTempData({ url }, 'tourl2');
          return sendInline(client, chatId, `${prefix}tourl2 ${tourl2Cache}`);
        } catch {
          return msg.reply({ message: "❌ Gagal upload ke Pixhost (hanya support gambar)." });
        }
      }
      break;

case "telanjang":
case "bugil":
case "tobugil": {
  let target;
  if (msg.replyToMsgId) {
    try { target = await msg.getReplyMessage(); } catch {}
  }

  if (!target?.media)
    return msg.reply({ message: "❌ Reply gambar untuk menggunakan fitur tobugil." });

  const waitMsg = await msg.reply({ message: "🔄 Memproses gambar..." });

  try {
    const buffer = await target.downloadMedia({ downloadUrl: false });
    if (!buffer) throw new Error("BUFFER_EMPTY");

    const form = new FormData();
    form.append("apikey", "skyy");
    form.append("prompt", text || "Best quality, hot bikini");
    form.append("image", buffer, "image.jpg");

    const { data } = await axios.post(
      "https://skyzopedia-api2.vercel.app/tools/removeclothes",
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 60_000
      }
    );

    if (!data?.status || !data?.result)
      throw new Error("REMOVE_CLOTHES_FAILED");

    await waitMsg.delete();

    return client.sendFile(
      chatId,
      {
        file: data.result,
        caption: "✅ Clothes Remover Success",
        replyTo: msg.id,
        forceDocument: false
      }
    );

  } catch (e) {
    console.log("Error:", e.message, e.response?.data);
    await waitMsg.delete();
    return msg.reply({ message: "❌ Gagal memproses gambar." });
  }
}
break;

      case "npmdl": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} @whiskeysockets/baileys`, parseMode: "markdownv2" });
        try {
          const axios = require("axios");
          const fs = require("fs");
          const path = require("path");
          const tar = require("tar");
          const archiver = require("archiver");
          const pkgName = text.trim();
          await msg.reply({ message: `📦 Mengambil data package *${pkgName}*...`, parseMode: "markdownv2" });
          const info = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`);
          const version = info.data["dist-tags"].latest;
          const meta = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/${version}`);
          const tarballUrl = meta.data?.dist?.tarball;
          if (!tarballUrl) return msg.reply({ message: "❌ Tarball tidak ditemukan." });
          const tmpDir = path.join(process.cwd(), "tmp");
          const safeName = pkgName.replace(/[\/@]/g, "_");
          const tarPath = path.join(tmpDir, `${safeName}-${version}.tgz`);
          const extractPath = path.join(tmpDir, `${safeName}-${version}`);
          const zipPath = path.join(tmpDir, `${safeName}-${version}.zip`);
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });
          const res = await axios.get(tarballUrl, { responseType: "arraybuffer" });
          fs.writeFileSync(tarPath, res.data);
          await tar.x({ file: tarPath, cwd: extractPath, strip: 1 });
          const output = fs.createWriteStream(zipPath);
          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(output);
          archive.directory(extractPath, false);
          archive.finalize();
          await new Promise((resolve, reject) => {
            output.on("close", resolve);
            archive.on("error", reject);
          });
          await client.sendFile(msg.chatId, { file: zipPath, caption: `✅ <b>${pkgName}@${version}</b> berhasil diunduh`, parseMode: "html", replyTo: msg.id });
          try { fs.unlinkSync(tarPath); } catch {}
          try { fs.rmSync(extractPath, { recursive: true, force: true }); fs.unlinkSync(zipPath); rimraf.sync(extractPath); } catch (e) { console.error("CLEANUP ERROR:", e); }
        } catch (err) {
          console.error("NPMDL ERROR:", err);
          await msg.reply({ message: `❌ Gagal mengunduh package.\nPastikan nama package benar.\n\n${err.message}` });
        }
      }
      break;

      case "mediafire": case "mf": {
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} https://www.mediafire.com/file/xxxxx/file.zip`, parseMode: "markdownv2" });
        try {
          const axios = require("axios");
          const fs = require("fs");
          const path = require("path");
          await msg.reply({ message: "📥 Mengambil file MediaFire..." });
          const { data } = await axios.get(`https://api.skyzopedia.web.id/download/mediafire?apikey=skyy&url=${encodeURIComponent(text)}`);
          if (!data?.status || !data?.result?.url) return msg.reply({ message: "❌ Gagal mengambil file MediaFire." });
          const { fileName, fileSize, url: downloadUrl } = data.result;
          const tmpDir = path.join(process.cwd(), "tmp");
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          const filePath = path.join(tmpDir, fileName);
          const res = await axios.get(downloadUrl, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
          fs.writeFileSync(filePath, res.data);
          await client.sendFile(msg.chatId, { file: filePath, caption: `✅ <b>MediaFire Downloader</b>`, parseMode: "html", replyTo: msg.id });
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("MEDIAFIRE ERROR:", err);
          msg.reply({ message: `❌ Gagal download MediaFire.\n\n${err.message}` });
        }
      }
      break;

      case "gitclone": {
        if (!isOwner) return msg.reply({ message: "❌ Owner only!" });
        if (!text) return msg.reply({ message: `*Ex:* ${cmd} https://github.com/Piantech/Baileys`, parseMode: "markdownv2" });
        try {
          const axios = require("axios");
          const fs = require("fs");
          const path = require("path");
          const archiver = require("archiver");
          const { exec } = require("child_process");
          const repoUrl = text.trim().replace(/\.git$/, "");
          await msg.reply({ message: `📦 Mengambil repository...`, parseMode: "markdownv2" });
          const api = await axios.get(`https://api.skyzopedia.web.id/download/github?apikey=skyy&url=${encodeURIComponent(repoUrl)}`);
          if (!api.data?.status || !api.data?.result) return msg.reply({ message: "❌ Repository tidak valid / tidak ditemukan." });
          const repoName = repoUrl.split("/").pop();
          const owner = repoUrl.split("/").slice(-2, -1)[0];
          const safeName = `${owner}-${repoName}`;
          const tmpDir = path.join(process.cwd(), "tmp");
          const clonePath = path.join(tmpDir, safeName);
          const zipPath = path.join(tmpDir, `${safeName}.zip`);
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          await new Promise((resolve, reject) => {
            exec(`git clone --depth=1 ${repoUrl} "${clonePath}"`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          const output = fs.createWriteStream(zipPath);
          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(output);
          archive.directory(clonePath, false);
          archive.finalize();
          await new Promise((resolve, reject) => {
            output.on("close", resolve);
            archive.on("error", reject);
          });
          await client.sendFile(msg.chatId, { file: zipPath, caption: `✅ <b>${owner}/${repoName}</b>\nBerhasil di-clone`, parseMode: "html", replyTo: msg.id });
          try { fs.rmSync(clonePath, { recursive: true, force: true }); fs.unlinkSync(zipPath); } catch {}
        } catch (err) {
          console.error("GITCLONE ERROR:", err);
          await msg.reply({ message: `❌ Gagal clone repository.\nPastikan URL GitHub valid.\n\n${err.message}` });
        }
      }
      break;

      case "eval": case "ev": {
        if (!isOwner) return;
        if (!text) return msg.reply({ message: `Masukan kode untuk di evaluasi.` });
        try {
          let result = await eval(`(async () => { ${text} })()`);
          if (typeof result !== "string") result = require("util").inspect(result, { depth: 1 });
          if (result.length > 4000) {
            const fs = require("fs");
            const filePath = "./eval_result.txt";
            fs.writeFileSync(filePath, result);
            await client.sendFile(msg.chatId, { file: filePath, caption: "✅ Eval berhasil (hasil dikirim sebagai file" });
            fs.unlinkSync(filePath);
          } else {
            const evalCache = setTempData({ result }, 'eval');
            return sendInline(client, chatId, `${prefix}eval ${evalCache}`);
          }
        } catch (err) {
          const evalErrorCache = setTempData({ error: err.toString() }, 'eval-error');
          return sendInline(client, chatId, `${prefix}eval-error ${evalErrorCache}`);
        }
      }
      break;

      default:
        break;
    }
  }, new NewMessage({}));
};

let file = require.resolve(__filename);
fs.watchFile(file, () => { fs.unwatchFile(file); delete require.cache[file]; require(file); });