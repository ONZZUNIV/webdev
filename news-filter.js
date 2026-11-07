// JavaScriptが使えるときだけ分類ボタンを表示する。一覧自体はHTMLで読める。
(() => {
  const filters = document.querySelector('.news-filters');
  const count = document.querySelector('.news-count');
  const empty = document.querySelector('.news-archive-empty');
  if (!filters || !count || !empty) return;

  const buttons = [...filters.querySelectorAll('[data-news-filter]')];
  const items = [...document.querySelectorAll('.news-entry')];
  const emptyTitle = empty.querySelector('.news-empty-title');
  const emptyDescription = empty.querySelector('p + p');

  function apply(category) {
    let visible = 0;
    for (const item of items) {
      item.hidden = category !== 'all' && item.dataset.newsCategory !== category;
      if (!item.hidden) visible++;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.newsFilter === category));
    count.textContent = `${visible}件`;
    empty.hidden = visible > 0;
    emptyTitle.textContent = category === 'all' ? '現在、掲載はありません。' : `現在、${category.toUpperCase()}の掲載はありません。`;
    emptyDescription.textContent = category === 'all' ? 'お知らせや活動記録を、順次掲載していきます。' : 'ほかのカテゴリーもご確認いただけます。';
  }

  for (const button of buttons) button.addEventListener('click', () => apply(button.dataset.newsFilter));
  filters.hidden = false;
})();
