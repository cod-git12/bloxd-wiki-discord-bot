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

// ==================== JST 時刻パース ====================
function parseWikiTime(str) {
  if (!str) return null;

  console.log("[PARSE INPUT]", str);

  const m = str.match(
    /(\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2})/
  );
  if (!m) {
    console.log("[PARSE FAIL]");
    return null;
  }

  const [, dd, mon, yyyy, hh, mm, ss] = m;

  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3,
    May: 4, Jun: 5, Jul: 6, Aug: 7,
    Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const time = Date.UTC(
    Number(yyyy),
    months[mon],
    Number(dd),
    Number(hh) - 9,
    Number(mm),
    Number(ss)
  );

  console.log("[PARSE OK]", time);
  return time;
}

// ==================== RSS チェック本体 ====================
async function checkWiki() {

  console.log("\n========== RSS CHECK START ==========");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    console.log(`[RSS] items count = ${feed.items.length}`);

    // ===== items 正規化 =====
    const items = feed.items.map((item, idx) => {
      const timeStr = item.content || item.contentSnippet || "";
      const time = parseWikiTime(timeStr);

      const key = `${item.title}|${item.link}|${timeStr}`;

      /*
      
      console.log(`[ITEM ${idx}]`, {
        title: item.title,
        link: item.link,
        timeStr,
        time,
        key,
      });
      
      */

      return {
        title: item.title,
        link: item.link,
        timeStr,
        time,
        key,
      };
    });

    // ===== 初期起動 =====
    if (!initialized) {
      lastKey = items[0].key;
      initialized = true;

      console.log("[INIT] lastKey =", lastKey);

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botが起動しました**\n" +
        "wikiの更新通知を開始します"
      );

      return;
    }

    console.log("[COMPARE] lastKey =", lastKey);

    // ===== 新規アイテム抽出 =====
    const newItems = [];

    for (const item of items) {
      //console.log("[COMPARE]", item.key);

      if (item.key === lastKey) {
        console.log("[MATCH] ここで停止");
        break;
      }

      console.log("[DIFF] 新規検出");
      newItems.push(item);
    }

    if (newItems.length === 0) {
      console.log("[RESULT] 変化なし");
      return;
    }

    // ===== 古い → 新しい順 =====
    newItems.reverse();

    const channel = await client.channels.fetch(CHANNEL_ID);

    for (const item of newItems) {
      //console.log("[SEND]", item.title, item.timeStr);

      await channel.send(
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${item.title}\n` +
        `時間： ${item.timeStr}\n` +
        `ページURL： ${item.link}`
      );
    }

    // ===== 最新を保存 =====
    lastKey = items[0].key;
    console.log("[UPDATE] lastKey 更新 =", lastKey);

  } catch (err) {
    console.error("[RSS ERROR]", err);
  }

  console.log("========== RSS CHECK END ==========\n");
}

// ==================== Discord 起動 ====================
client.once("ready", () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  checkWiki();
  setInterval(checkWiki, CHECK_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
