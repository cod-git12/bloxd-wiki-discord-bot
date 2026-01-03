// index.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require("fs");

app.get("/", async (req, res) => {
  res.send("Botは動いています！");

  // ここで RSS チェックを呼ぶ
  await checkWiki();
  console.log("UptimeRobot ping による RSS チェック実行");
});

app.listen(PORT, () => console.log(`Expressサーバーがポート${PORT}で起動`));

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

const CHANNEL_ID = "1456599233711968387";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const CHECK_INTERVAL = 60 * 1000; // 60秒ごと

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const parser = new Parser();

// 永続化用 JSON ファイル
const DATA_FILE = "lastKeys.json";
let lastKeys = [];

function loadLastKeys() {
  if (fs.existsSync(DATA_FILE)) {
    lastKeys = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.log("通知履歴読み込み済み:", lastKeys);
  }
}

function saveLastKeys() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(lastKeys));
}

// RSSチェック関数
async function checkWiki() {
  console.log("RSSチェック中...");
  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("RSSが空");
      return;
    }

    // 新しい順にチェック
    for (const item of feed.items) {
      const title = item.title;
      const link = item.link;
      const time = item.pubDate || item.content || item.description;
      if (!link) continue;

      const key = `${link}|${time}`;

      // 既に送信済みならスキップ
      if (lastKeys.includes(key)) continue;

      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (title.includes("コメント") || title === "メニューコメント！") {
          await channel.send(
            `Bloxd攻略 Wikiで新着コメントがありました\n` +
              `ページ名： ${title}\n` +
              `時間： ${time}\n` +
              `リンク： ${link}`
          );
          console.log("コメント通知:", title);
        } else {
          await channel.send(
            `Bloxd攻略 Wikiで更新がありました\n` +
              `ページ名： ${title}\n` +
              `時間： ${time}\n` +
              `リンク： ${link}`
          );
          console.log("更新通知:", title);
        }

        // 送信済み履歴に追加（新しい順）
        lastKeys.unshift(key);
        if (lastKeys.length > 100) lastKeys.pop(); // 直近100件だけ保持
        saveLastKeys();

      } catch (err) {
        console.error("チャンネル送信エラー:", err);
      }
    }

  } catch (err) {
    console.error("RSSエラー:", err);
  }
}

client.once("ready", () => {
  console.log(`ログイン成功: ${client.user.tag}`);
  loadLastKeys();

  // 起動時は UptimeRobot ping を想定してまとめ送信
  checkWiki();

  // 自動チェック（60秒ごと）
  setInterval(checkWiki, CHECK_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
