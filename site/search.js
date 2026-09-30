'use strict';
(() => {
  const form = document.querySelector('#filters');
  if (!form) return;
  const q = document.querySelector('#search');
  const category = document.querySelector('#category');
  const status = document.querySelector('#status');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja');
  const params = new URLSearchParams(location.search);
  q.value = params.get('q') || '';
  category.value = params.get('category') || '';
  status.value = params.get('status') || '';
  const data = window.archiveSearch;
  const cards = [...document.querySelectorAll('[data-slug]')];
  function filter() {
    const words = normalize(q.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const item = data[card.dataset.slug];
      const match = (!category.value || item.tags.includes(category.value)) &&
        (!status.value || item.status === status.value) && words.every(word => normalize(item.text).includes(word));
      card.hidden = !match;
      if (match) count++;
    }
    document.querySelector('#result-count').textContent = `${count} 件 / 全 ${cards.length} 件`;
    document.querySelector('#empty').hidden = count !== 0;
    const next = new URLSearchParams();
    if (q.value.trim()) next.set('q', q.value.trim());
    if (category.value) next.set('category', category.value);
    if (status.value) next.set('status', status.value);
    history.replaceState(null, '', location.pathname + (next.size ? '?' + next : '') + location.hash);
  }
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  document.querySelector('#reset').addEventListener('click', () => { q.value = ''; category.value = ''; status.value = ''; filter(); q.focus(); });
  filter();
})();
