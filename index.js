const { Client, GatewayIntentBits } = require("discord.js")
const Parser = require("rss-parser")
const express = require("express")

/* ========= 設定 ========= */

// Discord
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const CHANNEL_ID = process.env.CHANNEL_ID

// Wiki RSS
const RSS_URL = "https://bloxd.wikiru.jp/?cmd=rss"

// 更新チェック間隔（ms）
const CHECK_INTERVAL = 60 * 1000 // 1分

/* ======================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

const parser = new Parser()
let lastGuid = null

/* ========= Webサーバー（Railway用） ========= */

const app = express()
const PORT = process.env.PORT || 3000

app.get("/", (req, res) => {
  res.send("Bot is running.")
})

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`)
})

/* ========= backupリンク生成 ========= */

function makeBackupLink(pageLink) {
  try {
    const url = new URL(pageLink)
    const pageName = url.search.slice(1) // ?以降
    return `https://bloxd.wikiru.jp/?cmd=backup&page=${pageName}`
  } catch {
    return null
  }
}

/* ========= RSSチェック ========= */

async function checkWiki() {
  try {
    const feed = await parser.parseURL(RSS_URL)
    if (!feed.items.length) return

    const item = feed.items[0]

    if (item.guid === lastGuid) return
    lastGuid = item.guid

    const title = item.title ?? "（タイトル不明）"
    const link = item.link
    const time = new Date(item.pubDate).toLocaleString("ja-JP")

    const backupLink = makeBackupLink(link)

    const channel = await client.channels.fetch(CHANNEL_ID)

    await channel.send(
      `📘 **Bloxd攻略 Wiki 更新通知**\n` +
      `ページ： **${title}**\n` +
      `更新時刻： ${time}\n` +
      `ページURL： ${link}\n` +
      (backupLink ? `　　　　${backupLink}` : "")
    )

    console.log("Wiki updated:", title)
  } catch (err) {
    console.error("RSS error:", err)
  }
}

/* ========= Discordログイン ========= */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`)
  checkWiki()
  setInterval(checkWiki, CHECK_INTERVAL)
})

client.login(DISCORD_TOKEN)
