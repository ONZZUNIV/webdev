import { fileURLToPath } from 'node:url';
import { imageSizeFromFile } from 'image-size/fromFile';
import site from '../_content/site.json' with { type: 'json' };

const base = new URL(site.baseUrl);
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) {
  throw new Error('_content/site.json の baseUrl には、末尾が / の公開 HTTPS URL を指定してください。');
}

export const siteName = site.name.trim();
export const pages = site.pages;
export const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const publicUrl = path => new URL(path, base).href;
const seoStart = '  <!-- SEO 自動生成開始 -->';
const seoEnd = '  <!-- SEO 自動生成終了 -->';
const defaultImage = site.shareImage && {
  ...site.shareImage,
  ...await imageSizeFromFile(fileURLToPath(new URL(`../${site.shareImage.src}`, import.meta.url))),
};

function shareable(image) {
  return image && image.alt.trim() && /\.(?:jpe?g|png|webp)$/i.test(image.src)
    && image.width >= 300 && image.height >= 157 && image.bytes < 5_000_000
    && image.width / image.height >= 1.5 && image.width / image.height <= 2.5;
}

export function pageMetadata({ path, title, description, type = 'website', image }) {
  const pageTitle = siteName ? `${title} | ${siteName}` : title;
  const canonical = publicUrl(path);
  const shareImage = shareable(image) ? image : defaultImage;
  const openGraph = {
    title: pageTitle,
    description,
    type,
    url: canonical,
    locale: 'ja_JP',
    site_name: siteName,
    ...(shareImage && {
      image: publicUrl(shareImage.src),
      'image:alt': shareImage.alt,
      'image:width': shareImage.width,
      'image:height': shareImage.height,
    }),
  };
  return [
    seoStart,
    `  <title>${html(pageTitle)}</title>`,
    `  <meta name="description" content="${html(description)}">`,
    `  <link rel="canonical" href="${html(canonical)}">`,
    ...Object.entries(openGraph)
      .filter(([, value]) => value)
      .map(([key, value]) => `  <meta property="og:${key}" content="${html(value)}">`),
    `  <meta name="twitter:card" content="${shareImage ? 'summary_large_image' : 'summary'}">`,
    seoEnd,
  ].join('\n');
}

export function applyPageMetadata(document, file) {
  const start = document.indexOf(seoStart);
  const end = document.indexOf(seoEnd);
  if (start < 0 || end <= start || document.lastIndexOf(seoStart) !== start || document.lastIndexOf(seoEnd) !== end) {
    throw new Error(`${file} のSEO生成範囲を確認してください。`);
  }
  const eol = document.includes('\r\n') ? '\r\n' : '\n';
  return (document.slice(0, start) + pageMetadata(pages[file]).replaceAll('\n', eol) + document.slice(end + seoEnd.length))
    .replace(/(<(?:span|dd) data-site-name="([^"]+)">)[^<]*(<\/(?:span|dd)>)/g,
      (_, opening, fallback, closing) => opening + (siteName ? html(siteName) : fallback) + closing);
}

export function sitemap(articlePaths) {
  const paths = [...Object.values(pages).map(page => page.path), ...articlePaths];
  const entries = paths.map(path => `  <url><loc>${html(publicUrl(path))}</loc></url>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...entries, '</urlset>', ''].join('\n');
}
