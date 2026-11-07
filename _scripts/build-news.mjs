import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, eventStatuses, registrationStatuses, readPublishedNews } from './news-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = '<!-- NEWS 自動生成ファイル。変更は _content/news の原稿に行う。 -->';
const start = '        <!-- NEWS 自動生成開始 -->';
const end = '        <!-- NEWS 自動生成終了 -->';
const timeZone = 'Asia/Tokyo';
const dateFormat = new Intl.DateTimeFormat('ja-JP', { timeZone, dateStyle: 'long', timeStyle: 'short' });
const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const date = value => `<time datetime="${html(value)}">${html(value.replaceAll('-', '.'))}</time>`;
const dateTime = value => `<time datetime="${html(value)}">${dateFormat.format(new Date(value))}</time>`;
const badge = category => `<span class="news-category news-category--${category}">${category.toUpperCase()}</span>`;

function paragraphs(value) {
  return value.trim().split(/\r?\n\s*\r?\n/).map(part => `<p>${html(part).replace(/\r?\n/g, '<br>')}</p>`).join('\n');
}

function photo(image, prefix = '') {
  return `<img src="${prefix}${html(image.src)}" alt="${html(image.alt)}" loading="lazy" decoding="async">`;
}

function destination(item) {
  if (item.category === 'blog') return { url: item.blog.url, label: 'note' };
  if (item.category === 'event' && item.event.detailUrl) return { url: item.event.detailUrl, label: '外部サイト' };
  return { url: `news/${item.slug}.html` };
}

function titleLink(item) {
  const target = destination(item);
  const suffix = target.label ? ` <span class="news-destination">${target.label} <span aria-hidden="true">↗</span></span>` : '';
  return `<a href="${html(target.url)}">${html(item.title)}${suffix}</a>`;
}

function homeNews(items) {
  const rows = items.slice(0, 4).map(item => `          <li class="news-item">${badge(item.category)}<span class="news-date">${date(item.publishedOn)}</span><p>${titleLink(item)}</p><img class="news-rule" src="assets/news-rule.svg" alt="" width="1102" height="2"></li>`);
  const content = rows.length ? `        <ul class="news-list">\n${rows.join('\n')}\n        </ul>` : `        <div class="news-empty">
          <p class="news-empty-title">現在、掲載はありません。</p>
          <p class="body-copy">お知らせや活動記録を、順次掲載していきます。</p>
          <img class="news-rule" src="assets/news-rule.svg" alt="" width="1102" height="2">
        </div>`;
  return `${start}\n${content}\n        <a class="text-link news-more" href="news.html" aria-label="NEWS一覧を見る">View More <span aria-hidden="true">→</span></a>\n${end}`;
}

function page({ title, description, main, prefix = '', filter = false }) {
  return `<!doctype html>
${generated}
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(title)} | サークルサイト</title>
  <meta name="description" content="${html(description)}">
  <link rel="stylesheet" href="${prefix}styles.css">
  <link rel="stylesheet" href="${prefix}details.css">
  <link rel="stylesheet" href="${prefix}site.css">
  <link rel="stylesheet" href="${prefix}news.css">
${filter ? '  <script src="news-filter.js" defer></script>\n' : ''}</head>
<body class="detail-page news-page" id="top">
<a class="site-skip" href="#main">本文へ移動</a>
<header class="site-header">
  <a class="site-home" href="${prefix}index.html">HOME</a>
  <nav class="site-nav" aria-label="メインナビゲーション"><a href="${prefix}about.html">About</a><a href="${prefix}activity.html">Activity</a><a href="${prefix}index.html#connect">Connect</a></nav>
</header>
<main id="main">
${main}
</main>
<footer class="site-footer"><nav aria-label="フッターナビゲーション"><a href="${prefix}index.html">HOME</a><a href="${prefix}about.html">About</a><a href="${prefix}activity.html">Activity</a><a href="${prefix}index.html#connect">Connect</a></nav><a href="#top">ページ上部へ <span aria-hidden="true">↑</span></a></footer>
</body>
</html>
`;
}

function archive(items) {
  const description = 'イベントの開催案内、活動記録、noteの記事をお届けします。';
  const buttons = ['all', ...categories].map(category => `      <button type="button" data-news-filter="${category}" aria-pressed="${category === 'all'}">${category === 'all' ? 'すべて' : category.toUpperCase()}</button>`);
  const rows = items.map(item => `    <li class="news-entry${item.thumbnail ? ' news-entry--with-image' : ''}" data-news-category="${item.category}">
      <div class="news-entry-meta">${badge(item.category)}<span class="news-publication">公開日 ${date(item.publishedOn)}</span>${item.category === 'blog' && item.blog.notePublishedOn !== item.publishedOn ? `<span class="news-publication">note公開日 ${date(item.blog.notePublishedOn)}</span>` : ''}</div>
      <div class="news-entry-copy"><h2>${titleLink(item)}</h2><p>${html(item.summary)}</p></div>${item.thumbnail ? `\n      <div class="news-entry-image">${photo(item.thumbnail)}</div>` : ''}
    </li>`);
  return page({ title: 'News', description, filter: true, main: `<section class="news-hero" aria-labelledby="news-title">
  <p class="detail-eyebrow">NEWS / UPDATES</p>
  <h1 id="news-title">News</h1>
  <p>${description}</p>
</section>
<section class="news-archive" aria-label="NEWS一覧">
  <div class="news-archive-toolbar">
    <div class="news-filters" role="group" aria-label="カテゴリーで絞り込む" hidden>
${buttons.join('\n')}
    </div>
    <p class="news-count" role="status">${items.length}件</p>
  </div>
  <ul class="news-entries" aria-label="公開日が新しい順">
${rows.join('\n')}
  </ul>
  <div class="news-archive-empty"${items.length ? ' hidden' : ''}><p class="news-empty-title">現在、掲載はありません。</p><p>お知らせや活動記録を、順次掲載していきます。</p></div>
</section>` });
}

function reportBody(report) {
  const photos = (report.photos ?? []).map(image => `      <figure>${photo(image, '../')}${image.caption ? `<figcaption>${html(image.caption)}</figcaption>` : ''}</figure>`);
  const links = (report.links ?? []).map(link => `<li><a href="${html(link.url)}">${html(link.label)} <span class="news-destination">外部サイト ↗</span></a></li>`);
  return `<dl class="detail-facts news-article-facts"><div><dt>活動実施日</dt><dd>${date(report.heldOn)}</dd></div></dl>
    <section class="news-article-section"><h2>活動内容</h2>${paragraphs(report.body)}</section>${report.notes ? `
    <section class="news-article-section"><h2>活動メモ</h2>${paragraphs(report.notes)}</section>` : ''}${photos.length ? `
    <section class="news-article-section"><h2>活動写真</h2><div class="news-photos">\n${photos.join('\n')}\n    </div></section>` : ''}${links.length ? `
    <section class="news-article-section"><h2>関連リンク</h2><ul class="news-related">${links.join('')}</ul></section>` : ''}`;
}

function eventBody(event) {
  const registration = event.registrationUrl ? `<a class="detail-inline-link" href="${html(event.registrationUrl)}">${event.registrationStatus === 'open' && event.status === 'scheduled' ? '申込先を開く' : '申込・開催情報を確認する'} <span class="news-destination">外部サイト ↗</span></a>` : '';
  return `<dl class="detail-facts news-article-facts">
      <div><dt>開催日時</dt><dd>${dateTime(event.startsAt)}${event.endsAt ? ` 〜 ${dateTime(event.endsAt)}` : ''}（日本時間）</dd></div>
      <div><dt>場所</dt><dd>${html(event.location)}</dd></div>
      <div><dt>開催状況</dt><dd>${eventStatuses[event.status]}</dd></div>
      <div><dt>受付状況</dt><dd>${registrationStatuses[event.registrationStatus]}</dd></div>
    </dl>
    <section class="news-article-section"><h2>イベント概要</h2>${paragraphs(event.description)}${registration}</section>`;
}

function detail(item) {
  const body = item.category === 'report' ? reportBody(item.report) : eventBody(item.event);
  return page({ title: item.title, description: item.summary, prefix: '../', main: `<article class="news-article">
  <nav class="news-article-nav" aria-label="現在の位置"><a href="../news.html">News一覧</a><span aria-hidden="true">/</span><span>${item.category.toUpperCase()}</span></nav>
  <header class="news-article-header">
    <div class="news-entry-meta">${badge(item.category)}<span class="news-publication">公開日 ${date(item.publishedOn)}</span>${item.updatedOn ? `<span class="news-publication">更新日 ${date(item.updatedOn)}</span>` : ''}</div>
    <h1>${html(item.title)}</h1>
    <p class="news-article-summary">${html(item.summary)}</p>
  </header>
  <div class="news-article-body">${item.thumbnail ? `<figure class="news-article-cover">${photo(item.thumbnail, '../')}</figure>\n    ` : ''}${body}</div>
  <a class="detail-inline-link" href="../news.html"><span aria-hidden="true">←</span> News一覧へ戻る</a>
</article>` });
}

async function build() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('使い方: node _scripts/build-news.mjs [--check]');
  const check = args.includes('--check');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone }).format(new Date());
  const items = await readPublishedNews(root, today);
  const home = await readFile(join(root, 'index.html'), 'utf8');
  const begin = home.indexOf(start);
  const finish = home.indexOf(end);
  if (begin < 0 || finish <= begin || home.lastIndexOf(start) !== begin || home.lastIndexOf(end) !== finish) {
    throw new Error('index.html のNEWS生成範囲を確認してください。');
  }
  const eol = home.includes('\r\n') ? '\r\n' : '\n';
  const outputs = new Map([
    ['index.html', home.slice(0, begin) + homeNews(items).replaceAll('\n', eol) + home.slice(finish + end.length)],
    ['news.html', archive(items)],
  ]);
  for (const item of items) if (!destination(item).label) outputs.set(`news/${item.slug}.html`, detail(item));

  const directory = join(root, 'news');
  const files = await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return [];
  });
  const stale = [];
  for (const file of files.filter(file => file.isFile() && file.name.endsWith('.html'))) {
    const relative = `news/${file.name}`;
    const previous = await readFile(join(root, relative), 'utf8');
    if (previous.startsWith(`<!doctype html>\n${generated}`) || previous.startsWith(`<!doctype html>\r\n${generated}`)) {
      if (!outputs.has(relative)) stale.push(relative);
    } else if (outputs.has(relative)) throw new Error(`生成対象と既存ファイルが重複しています。 ${relative}`);
  }
  const changed = [];
  for (const [file, value] of outputs) {
    const previous = await readFile(join(root, file), 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    });
    if (previous.replaceAll('\r\n', '\n') !== value.replaceAll('\r\n', '\n')) changed.push(file);
  }
  if (check && (changed.length || stale.length)) throw new Error(`NEWSの再生成が必要です。 ${[...changed, ...stale].join(', ')}`);
  if (!check) {
    // 原稿と出力先をすべて確認してから生成する。下書きに戻した記事の生成済み詳細は取り除く。
    if (changed.some(file => file.startsWith('news/'))) await mkdir(directory, { recursive: true });
    for (const file of changed) await writeFile(join(root, file), outputs.get(file));
    for (const file of stale) await unlink(join(root, file));
  }
  console.log(`公開対象 ${items.length}件。${check ? '生成済みファイルと一致しました。' : 'NEWSを生成しました。'}`);
}

build().catch(error => { console.error(error.message); process.exitCode = 1; });
