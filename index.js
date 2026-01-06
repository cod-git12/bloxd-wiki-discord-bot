const express = require("express");
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_ID = process.env.CHANNEL_ID;
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const CHECK_INTERVAL = 60 * 1000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const parser = new Parser();

let lastKey = null;
let initialized = false;

// ===== Express（Uptime / Railway用）=====
app.get("/", (req, res) => {
  res.send("Botは動いています！");
});

app.listen(PORT, () => {
  console.log(`Expressサーバーがポート${PORT}で起動`);
});

// ===== RSSチェック本体 =====
async function checkWiki() {
  console.log("RSSチェック中...");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) return;

    // ★ 一番上（最新のみ）
    const item = feed.items[0];

    const title = item.title;
    const link = item.link;
    const time = item.description;

    const key = `${title}|${time}`;

    // ===== 初期起動 =====
    if (!initialized) {
      lastKey = key;
      initialized = true;

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      console.log("初期化完了（起動通知送信）");
      return;
    }

    // ===== 変化なし =====
    if (key === lastKey) {
      console.log("変化なし");
      return;
    }

    // ===== 更新あり =====
    const channel = await client.channels.fetch(CHANNEL_ID);

    await channel.send(
      `**Bloxd攻略 Wikiで更新がありました**\n` +
      `ページ名： ${title}\n` +
      `時間： ${time}\n` +
      `ページURL： ${link}`
    );

    // ★ 通知後に保存
    lastKey = key;

    console.log("更新通知送信完了");

  } catch (err) {
    console.error("RSSエラー:", err);
  }
}


// ===== Discord 起動 =====
client.once("ready", () => {
  console.log(`ログイン成功: ${client.user.tag}`);
  checkWiki();
  setInterval(checkWiki, CHECK_INTERVAL);
});



client.login(process.env.DISCORD_TOKEN);
