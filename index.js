async function checkWiki() {
  console.log("RSSチェック中...");

  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) return;

    const items = feed.items; // 新しい順（RSSそのまま）

    // 初回起動：最新だけ記録して終了
    if (!initialized) {
      const latest = items[0];
      lastKey = latest.link + (latest.pubDate || "");
      initialized = true;
      console.log("初期化完了（通知なし）");
      return;
    }

    // 新しいものだけ抽出
    const newItems = [];
    for (const item of items) {
      const key = item.link + (item.pubDate || "");
      if (key === lastKey) break;
      newItems.push(item);
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    // 古い → 新しい順で送信
    for (let i = newItems.length - 1; i >= 0; i--) {
      const item = newItems[i];
      const title = item.title;
      const link = item.link;
      const time = item.pubDate || item.content || item.description;

      // ★ backupリンク生成
      let backupLink = "";
      try {
        const url = new URL(link);
        const pageName = url.search.slice(1); // ?以降
        backupLink = `https://bloxd.wikiru.jp/?cmd=backup&page=${pageName}`;
      } catch {
        backupLink = "（履歴リンク生成失敗）";
      }

      if (title.includes("コメント") || title === "メニューコメント！") {
        await channel.send(
          `**Bloxd攻略 Wiki に新着コメントがありました**\n` +
          `ページ名： ${title}\n` +
          `時間： ${time}\n` +
          `ページURL： ${link}\n` +
          `　　　　　　 ${backupLink}`
        );
      } else {
        await channel.send(
          `**Bloxd攻略 Wikiで更新がありました**\n` +
          `ページ名： ${title}\n` +
          `時間： ${time}\n` +
          `ページURL： ${link}\n` +
          `　　　　　　 ${backupLink}`
        );
      }
    }

    // 最新を保存
    const newest = items[0];
    lastKey = newest.link + (newest.pubDate || "");

  } catch (err) {
    console.error("RSSエラー:", err);
  }
}
