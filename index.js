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

// ===== RSSチェック本体（あなたのコード）=====
async function checkWiki() {
  console.log("RSSチェック中...");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) return;

    const items = feed.items; // 新しい順

    if (!initialized) {
      const latest = items[0];
      lastKey = latest.link + (latest.pubDate || "");
      initialized = true;

      const channel = await client.channels.fetch(CHANNEL_ID);

      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      console.log("初期化完了（起動通知を送信）");
      return;
      }


    const newItems = [];
    for (const item of items) {
      const key = item.link + (item.pubDate || "");
      if (key === lastKey) break;
      newItems.push(item);
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    for (let i = newItems.length - 1; i >= 0; i--) {
      const item = newItems[i];
      const title = item.title;
      const link = item.link;
      const time = item.pubDate || item.content || item.description;

      let backupLink = "";
      try {
        const url = new URL(link);
        const pageName = url.search.slice(1);
        backupLink = `https://bloxd.wikiru.jp/?cmd=backup&page=${pageName}`;
      } catch {
        backupLink = "（履歴リンク生成失敗）";
      }

      await channel.send(
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${title}\n` +
        `時間： ${time}\n` +
        `ページURL： ${link}\n` +
        `　　　　　　 ${backupLink}`
      );
    }

    const newest = items[0];
    lastKey = newest.link + (newest.pubDate || "");

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
