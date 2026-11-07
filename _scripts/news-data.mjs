import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { imageSizeFromFile } from 'image-size/fromFile';

export const categories = ['event', 'report', 'blog'];
export const eventStatuses = { scheduled: '開催予定', postponed: '延期', cancelled: '中止', completed: '開催終了' };
export const registrationStatuses = { 'not-open': '受付開始前', open: '受付中', closed: '受付終了', 'not-required': '申込不要' };

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    isDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} を入力してください。`);
}

function url(value, field, noteOnly = false) {
  requiredText(value, field);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${field} にURLを入力してください。`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (noteOnly && parsed.hostname !== 'note.com')) {
    throw new Error(`${field} には${noteOnly ? 'note.com の' : ''} HTTPS URLを指定してください。`);
  }
}

async function image(root, value, field) {
  if (!object(value)) throw new Error(`${field} は画像の情報を指定してください。`);
  if (typeof value.src !== 'string' || !/^assets\/news\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.(avif|gif|jpe?g|png|webp)$/i.test(value.src)) {
    throw new Error(`${field}.src は assets/news/ 内の画像パスを指定してください。`);
  }
  if (typeof value.alt !== 'string') throw new Error(`${field}.alt を指定してください。`);
  if (value.caption !== undefined) requiredText(value.caption, `${field}.caption`);
  const info = await stat(join(root, value.src)).catch(() => null);
  if (!info?.isFile()) throw new Error(`画像が見つかりません。 ${value.src}`);
  const dimensions = await imageSizeFromFile(join(root, value.src)).catch(() => null);
  const rotated = dimensions?.orientation >= 5 && dimensions.orientation <= 8;
  value.width = rotated ? dimensions.height : dimensions?.width;
  value.height = rotated ? dimensions.width : dimensions?.height;
  value.bytes = info.size;
}

async function validatePublished(root, item) {
  requiredText(item.title, 'title');
  requiredText(item.summary, 'summary');
  if (!isDate(item.publishedOn)) throw new Error('publishedOn は YYYY-MM-DD で指定してください。');
  if (item.updatedOn !== undefined && (!isDate(item.updatedOn) || item.updatedOn < item.publishedOn)) {
    throw new Error('updatedOn は公開日以降の日付を指定してください。');
  }
  if (item.thumbnail !== undefined) await image(root, item.thumbnail, 'thumbnail');

  if (item.category === 'event') {
    const event = item.event;
    if (!object(event)) throw new Error('event を入力してください。');
    if (!isDateTime(event.startsAt)) throw new Error('event.startsAt は時差付きの日時を指定してください。');
    if (event.endsAt !== undefined && (!isDateTime(event.endsAt) || Date.parse(event.endsAt) < Date.parse(event.startsAt))) {
      throw new Error('event.endsAt は開始時刻以降の時差付き日時を指定してください。');
    }
    requiredText(event.location, 'event.location');
    requiredText(event.description, 'event.description');
    if (!Object.hasOwn(eventStatuses, event.status)) throw new Error('event.status が無効です。');
    if (!Object.hasOwn(registrationStatuses, event.registrationStatus)) throw new Error('event.registrationStatus が無効です。');
    if (event.detailUrl !== undefined) url(event.detailUrl, 'event.detailUrl');
    if (event.registrationUrl !== undefined) url(event.registrationUrl, 'event.registrationUrl');
    if (event.source !== undefined) {
      if (!object(event.source)) throw new Error('event.source はシステム名とIDを指定してください。');
      requiredText(event.source.system, 'event.source.system');
      requiredText(event.source.eventId, 'event.source.eventId');
    }
  }

  if (item.category === 'report') {
    const report = item.report;
    if (!object(report)) throw new Error('report を入力してください。');
    if (!isDate(report.heldOn)) throw new Error('report.heldOn は YYYY-MM-DD で指定してください。');
    requiredText(report.body, 'report.body');
    if (report.notes !== undefined) requiredText(report.notes, 'report.notes');
    if (report.photos !== undefined && !Array.isArray(report.photos)) throw new Error('report.photos は配列です。');
    for (const photo of report.photos ?? []) await image(root, photo, 'report.photos');
    if (report.links !== undefined && !Array.isArray(report.links)) throw new Error('report.links は配列です。');
    for (const link of report.links ?? []) {
      if (!object(link)) throw new Error('report.links はリンクの情報を指定してください。');
      requiredText(link.label, 'report.links.label');
      url(link.url, 'report.links.url');
    }
  }

  if (item.category === 'blog') {
    const blog = item.blog;
    if (!object(blog)) throw new Error('blog を入力してください。');
    url(blog.url, 'blog.url', true);
    if (!isDate(blog.notePublishedOn)) throw new Error('blog.notePublishedOn は YYYY-MM-DD で指定してください。');
    if (blog.sourceId !== undefined) requiredText(blog.sourceId, 'blog.sourceId');
  }
}

export async function readPublishedNews(root, today) {
  const published = [];
  const seen = new Set();
  for (const category of categories) {
    const directory = join(root, '_content', 'news', category);
    const files = await readdir(directory, { withFileTypes: true });
    for (const file of files.filter(file => file.isFile() && file.name.endsWith('.json'))) {
      const relative = `_content/news/${category}/${file.name}`;
      try {
        const item = JSON.parse((await readFile(join(directory, file.name), 'utf8')).replace(/^\uFEFF/, ''));
        if (!object(item)) throw new Error('原稿はJSONオブジェクトで指定してください。');
        // CMSで作成した原稿はフォルダー名と固定のファイル名から分類・slugを決める。
        if (item.category === undefined) item.category = category;
        if (item.slug === undefined) item.slug = file.name.slice(0, -'.json'.length);
        if (item.category !== category) throw new Error('category はフォルダー名と一致させてください。');
        if (typeof item.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || file.name !== `${item.slug}.json`) {
          throw new Error('slug は半角英小文字・数字・ハイフンで指定し、ファイル名と一致させてください。');
        }
        if (seen.has(item.slug)) throw new Error('slug が重複しています。');
        seen.add(item.slug);
        if (item.status === 'draft') continue;
        if (item.status !== 'published') throw new Error('status は draft または published を指定してください。');
        await validatePublished(root, item);
        if (item.publishedOn <= today) published.push(item);
      } catch (error) {
        throw new Error(`${relative} ${error.message}`);
      }
    }
  }
  return published.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.slug.localeCompare(b.slug));
}
