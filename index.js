const fs = require("fs");
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

// ==================== 設定 ====================
const CHANNEL_ID = "1456599233711968387";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const ROLE_ID = "1460203778111443130";
const STATE_FILE = "./state.json";

// ==================== Discord ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ==================== RSS ====================
const parser = new Parser();

// ==================== 状態ロード ====================
let state = {
  lastKey: null,
  sentBootMessage: false,
};

if (fs.existsSync(STATE_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    console.log("[STATE LOAD]", state);
  } catch (e) {
    console.error("[STATE LOAD ERROR]", e);
  }
}

// ==================== 状態保存 ====================
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log("[STATE SAVE]", state);
}

// ==================== RSS チェック ====================
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

    // ===== Botアップデート通知（1回だけ）=====
    if (!state.sentBootMessage) {
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      state.sentBootMessage = true;
      state.lastKey = key; // 初回は保存だけ
      saveState();

      console.log("[BOOT MESSAGE SENT]");
      return;
    }

    // ===== 変化なし =====
    if (key === state.lastKey) {
      console.log("[NO CHANGE]");
      return;
    }

    // ===== 更新通知 =====
    await channel.send({
      content:
        `<@&${ROLE_ID}>\n` +
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${title}\n` +
        `時間： ${timeStr}\n` +
        `ページリンク： ${link}`,
      allowedMentions: { roles: [ROLE_ID] },
    });

    state.lastKey = key;
    saveState();

    console.log("[UPDATE SENT]");

  } catch (err) {
    console.error("[RSS ERROR]", err);
  }
}

// ==================== Discord 起動 ====================
client.once("ready", async () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  await checkWiki();
  await client.destroy(); // ← Actionsなので終わったら即終了
});

client.login(process.env.BOT_TOKEN);
