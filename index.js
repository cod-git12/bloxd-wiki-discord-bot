const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

const CHANNEL_ID = "1456599233711968387";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const STATE_FILE = "./state.json";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const parser = new Parser();

let state = { lastKey: null, sentBootMessage: false };

if (fs.existsSync(STATE_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    console.log("[STATE LOAD]", state);
  } catch (e) {
    console.error("[STATE LOAD ERROR]", e);
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log("[STATE SAVE]", state);
}

async function checkWiki() {
  console.log("\n========== RSS CHECK ==========");
  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    const item = feed.items[0];
    const title = item.title;
    const link = item.link;
    const timeStr = item.content || item.contentSnippet || "";
    const key = `${title}|${link}|${timeStr}`;
    console.log("[LATEST KEY]", key);

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!state.sentBootMessage) {
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\nwikiの更新通知を再開します"
      );
      state.sentBootMessage = true;
      state.lastKey = key;
      saveState();
      console.log("[BOOT MESSAGE SENT]");
      return;
    }

    if (key === state.lastKey) {
      console.log("[NO CHANGE]");
      return;
    }

    await channel.send({
      embeds: [{
        title: "Wiki更新通知",
        description: "[Bloxd攻略Wiki](https://bloxd.wikiru.jp)で更新がありました",
        color: 0x00bfff,
        fields: [
          { name: "ページ名", value: `\`${title}\``, inline: true },
          { name: "ページリンク", value: `[${title}](${link})`, inline: true },
          { name: "更新時間", value: `${timeStr}`, inline: false },
        ],
        timestamp: new Date().toISOString()
      }]
    });

    state.lastKey = key;
    saveState();
    console.log("[UPDATE SENT]");
  } catch (err) {
    console.error("[RSS ERROR]", err);
  }
}

client.once("ready", async () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  await checkWiki();
  process.exit(0);
});

client.on("error", console.error);

client.login(process.env.UPD_BOT_TOKEN)
  .then(() => console.log("LOGIN SUCCESS"))
  .catch(err => {
    console.error("LOGIN ERROR", err);
    process.exit(1);
  });