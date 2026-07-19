require("./lib/function.js");
const fs = require("fs");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const { Telegraf } = require("telegraf");
const config = require("./config");

global.tempData = {}; 

const session = fs.existsSync(config.sessionFile)
  ? fs.readFileSync(config.sessionFile, "utf8")
  : "";
const stringSession = new StringSession(session);

(async () => {
  const client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 5,
  });
  client.setLogLevel("none");

  await client.start({
    phoneNumber: async () => await input.text("Number: \n"),
    password: async () => await input.text("Password (if any): \n"),
    phoneCode: async () => await input.text("Code: \n"),
    onError: (err) => console.log(err),
  });

  fs.writeFileSync(config.sessionFile, client.session.save());  
  console.log("• Userbot Connected");
  
  // Anti error entity ID User
  setTimeout(async() => {
    await global.StartTelegram(client, Api);
  }, 20000);
  
  const bot = new Telegraf(config.botToken);

  try {
    await client.getDialogs();
  } catch (err) {}

  require("./userbot")(client, bot);
  require("./bot")(bot);  

  bot.launch();
  console.log("• Inlinebot Connected");
})();
