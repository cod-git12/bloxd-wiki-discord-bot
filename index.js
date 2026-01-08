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

// ===== Express（Railway / Uptime）=====
app.get("/", (req, res) => {
  res.send("Botは動いています！");
});

app.listen(PORT, () => {
  console.log(`[EXPRESS] ポート ${PORT} で起動`);
});

// ===== JST文字列 → timestamp =====
function parseWikiTime(str) {
  if (!str) return NaN;
  const t = Date.parse(str.replace("JST", "+0900"));
  console.log(`[TIME PARSE] "${str}" → ${t}`);
  return t;
}

// ===== RSSチェック本体 =====
async function checkWiki() {
  console.log("\n==============================");
  console.log("[CHECK] RSSチェック開始");

  try {
    const feed = await parser.parseURL(RSS_URL);

    console.log(`[RSS] item数: ${feed.items?.length ?? 0}`);

    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] itemなし");
      return;
    }

    // 正規化
    const items = feed.items
      .map(item => {
        const timeStr = item.description;
        const time = parseWikiTime(timeStr);

        const obj = {
          title: item.title,
          link: item.link,
          timeStr,
          time,
          key: `${item.link}|${time}`,
        };

        console.log("[ITEM]", obj);
        return obj;
      })
      .filter(item => !isNaN(item.time))
      .sort((a, b) => b.time - a.time);

    console.log(`[SORT] 有効item数: ${items.length}`);

    if (items.length === 0) {
      console.log("[SORT] 有効itemなし");
      return;
    }

    // ===== 初期起動 =====
    if (!initialized) {
      lastKey = items[0].key;
      initialized = true;

      console.log("[INIT] 初期化");
      console.log("[INIT] lastKey =", lastKey);

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      return;
    }

    console.log("[STATE] lastKey =", lastKey);

    // ===== 差分抽出 =====
    const newItems = [];

    for (const item of items) {
      console.log(`[COMPARE] ${item.key}`);
      if (item.key === lastKey) {
        console.log("[MATCH] lastKey に到達 → break");
        break;
      }
      newItems.push(item);
    }

    console.log(`[DIFF] 新規 ${newItems.length} 件`);

    if (newItems.length === 0) {
      console.log("[RESULT] 変化なし");
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    // 古い → 新しい順で送信
    for (let i = newItems.length - 1; i >= 0; i--) {
      const item = newItems[i];

      console.log("[SEND]", item.title, item.timeStr);

      await channel.send(
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${item.title}\n` +
        `時間： ${item.timeStr}\n` +
        `ページURL： ${item.link}`
      );
    }

    // 最新を保存
    lastKey = items[0].key;
    console.log("[UPDATE] lastKey 更新 →", lastKey);

  } catch (err) {
    console.error("[ERROR] RSSエラー", err);
  }
}

// ===== Discord 起動 =====
client.once("ready", () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  checkWiki();
  setInterval(checkWiki, CHECK_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
