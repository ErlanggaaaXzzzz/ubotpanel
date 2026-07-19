
module.exports = {
  /**
   * ===== TELEGRAM API =====
   */
  apiId: 26313155, // api_id Telegram (didapat dari my.telegram.org)
  apiHash: "d9fa23bb1e455fadb5e015d91765007d", // api_hash Telegram
  sessionFile: "./session.txt", // File penyimpanan session Telegram (login user)

  /**
   * ===== BOT TELEGRAM =====
   */
  botToken: "8948972970:AAE7LzJ9z4PezHOVdLKKPSkwWNDTbV51XVc", // Token Bot Telegram
  botUsername: "UbotzyrennBot", // Username bot Telegram (tanpa @)

  /**
   * ===== TAMPILAN & UMUM =====
   */
  botName: "UbotZyrenn", 
  version: "1.0.0", 
  menuImage: "https://files.catbox.moe/y7yeip.jpg", 
  prefix: ".", // Prefix command bot (contoh: .menu)
  
  /**
   * ===== OWNER BOT =====
   */
  ownerName: "itsmezyrenn", // Nama owner
  ownerId: 7365526185, // User ID Telegram owner (hak penuh)

  /**
   * ===== LINK & SOSIAL =====
   */
  channelLink: "https://t.me/zyrennchannelupdate", // Link channel WhatsApp / info bot

  /**
   * ===== PAYMENT METHOD =====
   */
  payment: {
    qris: "https://files.catbox.moe/daywew.jpg", // QRIS (gambar)
    dana: "082313677395", // Nomor DANA
    ovo: "Tidak tersedia", // OVO belum tersedia
    gopay: "088905301692" // GoPay belum tersedia
  },

  /**
   * ===== SUBDOMAIN (CLOUDFLARE) =====
   * Digunakan untuk create / delete DNS record (subdomain)
   */
  subdomain: {
    "memek.my.id": {
      zone: "7bd2912d9329bc324668464fb415486a", // Zone ID Cloudflare
      apitoken: "CGCX9uVUK7xiUfXCY5hpGPjDhvhxSKbkZ7k68SBz" // API Token Cloudflare
    },

    "pterovip.my.id": {
      zone: "4b262004a90e37c8656accb7087c4150",
      apitoken: "nO2ibDMeLB6bKqjjTIvsOtp0A8E-epozNpIrN5_l"
    },

    "panelwebsite.biz.id": {
      zone: "2d6aab40136299392d66eed44a7b1122",
      apitoken: "SbRAPRzC34ccmf4cJs-0qZ939yHe3Ko6CpolxqW4"
    },

    "privatserver.my.id": {
      zone: "699bb9eb65046a886399c91daacb1968",
      apitoken: "SbRAPRzC34ccmf4cJs-0qZ939yHe3Ko6CpolxqW4"
    },

    "serverku.biz.id": {
      zone: "4e4feaba70b41ed78295d2dcc090dd3a",
      apitoken: "SbRAPRzC34ccmf4cJs-0qZ939yHe3Ko6CpolxqW4"
    },

    "vipserver.web.id": {
      zone: "e305b750127749c9b80f41a9cf4a3a53",
      apitoken: "SbRAPRzC34ccmf4cJs-0qZ939yHe3Ko6CpolxqW4"
    },

    "mypanelstore.web.id": {
      zone: "c61c442d70392500611499c5af816532",
      apitoken: "SbRAPRzC34ccmf4cJs-0qZ939yHe3Ko6CpolxqW4"
    }
  },

  /**
   * KONFIGURASI PTERODACTYL PANEL
   * ===============================
   */
  egg: "15",       // ID Egg (jenis server)
  nestid: "5",     // ID Nest
  loc: "1",        // ID Location
  domain: "https://memekpanelptero.memek.my.id", // URL panel Pterodactyl
  apikey: "-",   // API Key PTLA (Application API)
  capikey: "-"   // API Key PTLC (Client API)
};