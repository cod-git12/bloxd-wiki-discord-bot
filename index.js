const express = require("express");
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

// ==================== 基本設定 ====================
const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_ID = "1456599233711968387";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";
const CHECK_INTERVAL = 60 * 1000;
const ROLE_ID = "1460203778111443130";

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
// テスト用Embed送信先
const TEST_EMBED_CHANNEL_ID = "1456515260134723646";

// ==================== RSS チェック本体 ====================
async function checkWiki() {
  console.log("\n========== RSS CHECK ==========");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    // 最新1件
    const item = feed.items[0];

    const title = item.title;
    const link = item.link;
    const timeStr = item.content || item.contentSnippet || "";

    const key = `${title}|${link}|${timeStr}`;
    console.log("[LATEST KEY]", key);

    // ===== 初回起動 =====
    if (!initialized) {
      lastKey = key;
      initialized = true;

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(
        "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\n" +
        "wikiの更新通知を再開します"
      );

      console.log("[INIT] 初期化完了");
      return;
    }

    // 変化なし
    if (key === lastKey) {
      console.log("[NO CHANGE]");
      return;
    }

    // ==================== 通常通知 ====================
    const normalChannel = await client.channels.fetch(CHANNEL_ID);

    await normalChannel.send({
      content:
        `<@&${ROLE_ID}>\n` +
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        //`ページ名： \`${title}\`\n` +
        `ページ名： ${title}\n` +
        `時間： ${timeStr}\n` +
        `ページリンク： ${link}`,
      allowedMentions: { roles: [ROLE_ID] }
    });

    // ==================== テスト用 Embed ====================
    /*
    const embedChannel = await client.channels.fetch(TEST_EMBED_CHANNEL_ID);

    await embedChannel.send({
      embeds: [
        {
          title: "Wiki更新通知【埋め込み表示】",
          description: "**Bloxd攻略 Wikiで更新がありました**",
          color: 0x00bfff,
          fields: [
            { name: "ページ名", value: `\`${title}\``, inline: true },
            { name: "ページリンク", value: `[${title}](${link})`, inline: true },
            { name: "更新時間", value: timeStr || "不明" },
          ],
          // url: link,
          footer: {
            text: "Wiki更新通知 (スナップ版) by 5kaideta_yuuto"
          },
          timestamp: new Date().toISOString()
        }
      ]
    });
    */

    lastKey = key;
    console.log("[SEND] 通常＋Embed 通知送信");

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

client.login(process.env.UPD_DISCORD_TOKEN);
