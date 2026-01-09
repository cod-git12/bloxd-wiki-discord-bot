const express = require("express");
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

// ==================== 基本設定 ====================
const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_ID = process.env.CHANNEL_ID;
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const CHECK_INTERVAL = 60 * 1000;

// ==================== Discord ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ==================== RSS ====================
const parser = new Parser();

// ==================== 状態保持 ====================
let lastKey = null;
let initialized = false;

// ==================== Express（Railway用） ====================
app.get("/", (req, res) => {
  res.send("Botは動いています！");
});

app.listen(PORT, () => {
  console.log(`[EXPRESS] ポート ${PORT} で起動`);
});

// ==================== RSS チェック本体 ====================
async function checkWiki() {
  console.log("\n========== RSS CHECK ==========");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    // ★ 最新1件のみ
    const item = feed.items[0];

    const title = item.title;
    const link = item.link;
    const timeStr = item.content || item.contentSnippet || "";

    const key = `${title}|${link}|${timeStr}`;

    console.log("[LATEST KEY]", key);

    // ===== 初回起動：保存のみ（通知しない）=====
    if (!initialized) {
      lastKey = key;
      initialized = true;
      console.log("[INIT] 初期化完了（通知なし）");
      return;
    }

    // ===== 変化なし =====
    if (key === lastKey) {
      console.log("[NO CHANGE]");
      return;
    }

    // ===== 更新あり =====
    const channel = await client.channels.fetch(CHANNEL_ID);

    await channel.send(
      `**Bloxd攻略 Wikiで更新がありました**\n` +
      `ページ名： ${title}\n` +
      `時間： ${timeStr}\n` +
      `ページリンク： ${link}`
    );

    lastKey = key;
    console.log("[SEND] 更新通知送信");

  } catch (err) {
    console.error("[RSS ERROR]", err);
  }
}

// ==================== Discord 起動 ====================
client.once("ready", () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  checkWiki();
  setInterval(checkWiki, CHECK_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
