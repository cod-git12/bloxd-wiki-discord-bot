require("dotenv").config();

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

const CHANNEL_ID = "1456599233711968387";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const STATE_FILE = "./state.json";
const CHECK_INTERVAL_MS = 60 * 1000;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const parser = new Parser();

let state = { lastPubDate: null, sentBootMessage: false };

if (fs.existsSync(STATE_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    state.sentBootMessage = loaded.sentBootMessage || false;
    state.lastPubDate = loaded.lastPubDate || null;
    console.log("[STATE LOAD]", state);
  } catch (e) {
    console.error("[STATE LOAD ERROR]", e);
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log("[STATE SAVE]", state);
}

function getPubDate(item) {
  const raw = (item.pubDate || item.content || item.contentSnippet || "")
    .trim()
    .replace(/\bJST\b/, "+0900");
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

function formatJST(pubDate) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const jst = new Date(new Date(pubDate).getTime() + 9 * 60 * 60 * 1000);

  const yyyy = jst.getUTCFullYear();
  const mm   = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(jst.getUTCDate()).padStart(2, "0");
  const day  = days[jst.getUTCDay()];
  const hh   = String(jst.getUTCHours()).padStart(2, "0");
  const min  = String(jst.getUTCMinutes()).padStart(2, "0");
  const ss   = String(jst.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} (${day}) ${hh}:${min}:${ss} (JST - UTC+9)`;
}

async function checkWiki() {
  console.log("\n========== RSS CHECK ==========", new Date().toISOString());
  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!state.sentBootMessage) {
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botが起動しました**\nwikiの更新通知を開始します"
      );
      state.sentBootMessage = true;
      state.lastPubDate = (getPubDate(feed.items[0]) || new Date()).toISOString();
      saveState();
      console.log("[BOOT MESSAGE SENT]");
      return;
    }

    const lastDate = state.lastPubDate ? new Date(state.lastPubDate) : new Date(0);

    const newItems = feed.items
      .filter(item => {
        const d = getPubDate(item);
        return d && d > lastDate;
      })
      .reverse();

    if (newItems.length === 0) {
      console.log("[NO CHANGE]");
      return;
    }

    for (const item of newItems) {
      const title   = item.title;
      const link    = item.link;
      const timeStr = formatJST(getPubDate(item));

      await channel.send({
        embeds: [{
          title: "Wiki更新通知",
          description: "[Bloxd攻略Wiki](https://bloxd.wikiru.jp)で更新がありました",
          color: 0x00bfff,
          fields: [
            { name: "ページ名",     value: `\`${title}\``,        inline: true  },
            { name: "ページリンク", value: `[${title}](${link})`, inline: true  },
            { name: "更新時間",     value: timeStr,               inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
      console.log("[UPDATE SENT]", title);
    }

    state.lastPubDate = getPubDate(newItems[newItems.length - 1]).toISOString();
    saveState();

  } catch (err) {
    console.error("[RSS ERROR]", err);
  }
}

client.once("ready", async () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);
  await checkWiki();
  setInterval(checkWiki, CHECK_INTERVAL_MS);
  console.log(`[TIMER] ${CHECK_INTERVAL_MS / 1000}秒ごとにチェックを開始`);
});

client.on("error", console.error);

async function shutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} を受信。終了します...`);
  state.sentBootMessage = false;
  saveState();
  await client.destroy();
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

client.login(process.env.UPD_BOT_TOKEN)
  .then(() => console.log("[LOGIN] 接続中..."))
  .catch(err => {
    console.error("[LOGIN ERROR]", err);
    process.exit(1);
  });