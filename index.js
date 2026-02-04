// ==================== import ====================
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const Parser = require("rss-parser");

// ==================== 基本設定 ====================
const CHANNEL_ID = "1456599233711968387";
const ROLE_ID = "1460203778111443130";
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss";

// テスト用 Embed 送信先（今は未使用）
const TEST_EMBED_CHANNEL_ID = "1456515260134723646";

// last.json のパス
const LAST_FILE = path.join(__dirname, "last.json");

// ==================== Discord ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ==================== RSS ====================
const parser = new Parser();

// ==================== lastKey 読み込み ====================
function loadLastKey() {
  if (!fs.existsSync(LAST_FILE)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(LAST_FILE, "utf8"));
    return data.lastKey ?? null;
  } catch (e) {
    console.error("[LAST] 読み込み失敗", e);
    return null;
  }
}

// ==================== lastKey 保存 ====================
function saveLastKey(key) {
  fs.writeFileSync(
    LAST_FILE,
    JSON.stringify({ lastKey: key }, null, 2),
    "utf8"
  );
  console.log("[LAST] 保存完了");
}

// ==================== RSS チェック ====================
async function checkWiki() {
  console.log("========== RSS CHECK ==========");

  const lastKey = loadLastKey();
  console.log("[LAST KEY]", lastKey);

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("[RSS] items が空");
      return;
    }

    // 最新1件のみ
    const item = feed.items[0];

    const title = item.title;
    const link = item.link;
    const timeStr = item.content || item.contentSnippet || "";

    const currentKey = `${title}|${link}|${timeStr}`;
    console.log("[CURRENT KEY]", currentKey);

    // ===== 初回 or 変化なし =====
    if (!lastKey || lastKey === currentKey) {
      console.log("[NO CHANGE or INIT]");
      saveLastKey(currentKey);
      return;
    }

    // ==================== 通常通知 ====================
    const channel = await client.channels.fetch(CHANNEL_ID);

    await channel.send({
      content:
        `<@&${ROLE_ID}>\n` +
        `**Bloxd攻略 Wikiで更新がありました**\n` +
        `ページ名： ${title}\n` +
        `時間： ${timeStr}\n` +
        `ページリンク： ${link}`,
      allowedMentions: { roles: [ROLE_ID] },
    });

    console.log("[SEND] 通知送信完了");

    // ==================== テスト用 Embed（試験中） ====================
    /*
    const embedChannel = await client.channels.fetch(TEST_EMBED_CHANNEL_ID);
    await embedChannel.send({
      embeds: [
        {
          title: "Wiki更新通知【埋め込み表示】",
          color: 0x00bfff,
          fields: [
            { name: "ページ名", value: title, inline: true },
            { name: "更新時間", value: timeStr || "不明", inline: true },
            { name: "リンク", value: link },
          ],
          timestamp: new Date().toISOString(),
        }
      ]
    });
    */

    // ===== 保存 =====
    saveLastKey(currentKey);

  } catch (err) {
    console.error("[RSS ERROR]", err);
  }
}

// ==================== Discord 起動 ====================
client.once("clientReady", async () => {
  console.log(`[DISCORD] ログイン成功: ${client.user.tag}`);

  await checkWiki();

  // GitHub Actions なので即終了
  client.destroy();
});

// ==================== login ====================
client.login(process.env.UPD_DISCORD_TOKEN);
