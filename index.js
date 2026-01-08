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

    // items は「新しい → 古い」
    const items = feed.items;

    // ===== 初期起動 =====
    if (!lastKey) {
      const latest = items[0];
      const initTime = Date.parse(latest.description);

      lastKey = {
        time: initTime,
        title: latest.title
      };

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      console.log("初期化完了");
      return;
    }

    // ===== 新規更新を全部拾う =====
    const newItems = [];

    for (const item of items) {
      const time = Date.parse(item.description);
      if (isNaN(time)) continue;

      if (
        time > lastKey.time ||
        (time === lastKey.time && item.title !== lastKey.title)
      ) {
        newItems.push({
          title: item.title,
          link: item.link,
          time
        });
      }
    }

    if (newItems.length === 0) {
      console.log("変化なし");
      return;
    }

    // ===== 古い → 新しい順 =====
    newItems.reverse();

    const channel = await client.channels.fetch(CHANNEL_ID);

    for (const item of newItems) {
      await channel.send(
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${item.title}\n` +
        `時間： ${new Date(item.time).toLocaleString("ja-JP")}\n` +
        `ページURL： ${item.link}`
      );
    }

    // ===== lastKey 更新 =====
    const last = newItems[newItems.length - 1];
    lastKey = {
      time: last.time,
      title: last.title
    };

    console.log(`${newItems.length}件の更新を送信`);

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
