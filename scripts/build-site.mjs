import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadArchive, readInput, catalogMarkdown, nonPublic, relatedCases} from './archive.mjs';

const root = path.resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const out = path.join(root, '_site');
const archive = loadArchive(root);
const allowed = new Set(archive.cases.map(c=>c.slug));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = f => readInput(root, f);
function href(raw) {
  if (/^https?:\/\//.test(raw)) return esc(raw);
  const m = raw.match(/^([a-z0-9-]+)\.md$/);
  if (m && allowed.has(m[1])) return m[1]+'.html';
  throw new Error('Non-public link in article: '+raw);
}
function inline(text) {
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\[(\d+)(?::([^\]\n]+))?\]/g;
  let result = '', end = 0;
  for (const m of text.matchAll(pattern)) {
    result += esc(text.slice(end, m.index));
    if (m[1]) result += `<a href="${href(m[2])}"${/^https?:/.test(m[2]) ? ' rel="noreferrer"' : ''}>${esc(m[1])}</a>`;
    else if (m[3]) result += `<strong>${esc(m[3])}</strong>`;
    else if (m[4]) result += `<code>${esc(m[4])}</code>`;
    else result += `<a class="citation" href="#source-${m[5]}" aria-label="出典 ${m[5]}">[${m[5]}${m[6] ? ': '+esc(m[6].trim()) : ''}]</a>`;
    end = m.index + m[0].length;
  }
  return result + esc(text.slice(end));
}
function render(markdown) {
  const blocks = markdown.trim().split(/\n\s*\n/);
  const toc = []; let sourceSection = false;
  const html = blocks.map(block => {
    if (/^## /.test(block)) {
      const title = block.slice(3).trim();
      const id = 'section-'+(toc.length+1);
      sourceSection = title === '出典（Sources）';
      const label = title.replace(/（[A-Za-z ]+）$/, '');
      toc.push({id,label});
      return `<h2 id="${id}">${esc(label)}</h2>`;
    }
    if (/^> /.test(block)) return `<blockquote><p>${inline(block.replace(/^> ?/gm,'').replaceAll('\n',' '))}</p></blockquote>`;
    if (/^- /.test(block)) return '<ul>'+block.split(/\n(?=- )/).map(l=>`<li>${inline(l.replace(/^- /,'').replaceAll('\n',' '))}</li>`).join('')+'</ul>';
    if (/^\d+\. /.test(block)) return '<ol>'+block.split(/\n(?=\d+\. )/).map(l=>{
      const m=l.match(/^(\d+)\. ([\s\S]*)$/);
      return `<li${sourceSection ? ` id="source-${m[1]}"` : ''} value="${m[1]}">${inline(m[2].replaceAll('\n',' '))}</li>`;
    }).join('')+'</ol>';
    if (/^(?:#|\||```)/.test(block)) throw new Error('Unsupported public Markdown block: '+block.slice(0,50));
    return '<p>'+inline(block.replaceAll('\n',' '))+'</p>';
  }).join('\n');
  return {html,toc};
}
const plain = s => s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`>]/g,'');
const cases = archive.cases.map(c => ({...c,summary:plain(c.sections['概要（Overview）']).replace(/\[\d+\]/g,''),...render(c.body)}));
const title = '科学的誤認アーカイブ';
function page(name,content,prefix='',scripts='') {
  return `<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="科学的誤認・疑似科学・境界領域と、危険認識や安全対策の問題を出典からたどる日本語の資料集。"><title>${esc(name)} | ${title}</title><link rel="stylesheet" href="${prefix}style.css"></head><body><a class="skip" href="#main">本文へ移動</a><header class="masthead"><a class="brand" href="${prefix}index.html">科学的誤認アーカイブ<small>SCIENCE, CLAIMS &amp; EVIDENCE</small></a><nav aria-label="メイン"><a href="${prefix}index.html">事例を探す</a><a href="${prefix}about.html">この資料集</a></nav></header>${content}<footer class="site-footer"><p>科学的誤認・疑似科学・境界領域事件アーカイブ</p><p>主張・検証・確認限界を分けて読む。本文のライセンスは未決定です。</p><a href="${prefix}about.html">読み方と利用について</a></footer>${scripts}</body></html>\n`;
}
const badge = c => `<span class="badge${c.meta['検証状態']==='未検証候補'?' candidate':''}">${esc(c.meta['検証状態'])}</span>`;
const tags = c => '<div class="tags">'+c.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')+'</div>';
const allTags = [...new Set(cases.flatMap(c=>c.tags))].sort((a,b)=>a.localeCompare(b,'ja'));
const cards = cases.map(c=>`<article class="card" data-slug="${c.slug}">${badge(c)}<span class="kind">${esc(c.meta['事例区分']??'主張と検証の記録')}</span><h3><a href="cases/${c.slug}.html">${esc(c.title)}</a></h3><div class="meta">${esc(c.meta['年代'])} · ${esc(c.meta['分野'])}</div><p>${esc(c.summary.slice(0,135))}${c.summary.length>135?'…':''}</p>${tags(c)}</article>`).join('\n');
const index = page('事例を探す',`<main id="main" class="wrap"><section class="hero"><div><p class="eyebrow">AN ARCHIVE OF SCIENTIFIC THINKING</p><h1>なぜ信じられ、<br>どう確かめられたのか。</h1><p>観測の誤り、変わりゆく学説、科学と疑似科学の境界。<br>危険の認識と安全対策も含め、当時の知識と検証を出典からたどります。</p></div><div class="count"><strong>${cases.length}</strong><span>件の記録<br>出典確認済み ${cases.filter(c=>c.meta['検証状態']==='出典確認済み').length} / 未検証候補 ${cases.filter(c=>c.meta['検証状態']==='未検証候補').length}</span></div></section><form id="filters" class="filters" role="search"><div class="fields"><label for="search">キーワード<input id="search" type="search" placeholder="例：リセンコ、四体液、観測" autocomplete="off"></label><label for="category">分類<select id="category"><option value="">すべての分類</option>${allTags.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><label for="status">確認状態<select id="status"><option value="">すべての状態</option><option>出典確認済み</option><option>未検証候補</option></select></label></div><div class="filter-bottom"><p>本文も検索します。空白で区切ると、すべての語を含む記事に絞ります。</p><button type="button" id="reset">条件をクリア</button></div></form><noscript><p>JavaScriptが無効のため、全件を表示しています。記事と出典はそのまま読めます。</p></noscript><section aria-labelledby="list-title"><div class="results-head"><h2 id="list-title">事例を読む</h2><span id="result-count" role="status" aria-live="polite">${cases.length} 件 / 全 ${cases.length} 件</span></div><p id="empty" class="empty" hidden>条件に合う記事がありません。語句や絞り込みを変えてみてください。</p><div class="cards">${cards}</div></section></main>`,'','<script src="search-data.js" defer></script><script src="search.js" defer></script>');
const outputs = new Map([['index.html',index],['catalog.md',catalogMarkdown(archive)],['style.css',read('site/style.css')],['search.js',read('site/search.js')],['.nojekyll','']]);
for(const c of cases) {
  const suggestions=relatedCases(c,cases);
  if(suggestions.length)c.html+=`<section class="related-suggestions"><h2>同じ分類から読む</h2><p>分類が共通する記事です。同じ原因や結論を示すとは限りません。</p><ul>${suggestions.map(other=>`<li><a href="${other.slug}.html">${esc(other.title)}</a> ${badge(other)}</li>`).join('')}</ul></section>`;
  const toc='<aside class="toc" aria-label="記事の目次"><strong>この記事の内容</strong>'+c.toc.map(h=>`<a href="#${h.id}">${esc(h.label)}</a>`).join('')+'</aside>';
  outputs.set('cases/'+c.slug+'.html',page(c.title,`<main id="main" class="wrap"><header class="article-header"><div class="breadcrumb"><a href="../index.html">事例一覧</a> / 記録</div>${badge(c)}<span class="kind">${esc(c.meta['事例区分']??'主張と検証の記録')}</span><h1>${esc(c.title)}</h1><div class="article-meta"><span>${esc(c.meta['年代'])}</span><span>${esc(c.meta['分野'])}</span><span>最終確認 ${esc(c.meta['最終確認日'])}</span></div>${tags(c)}</header><div class="reading-layout"><article class="prose">${c.html}<p class="back"><a href="../index.html">← 事例一覧へ戻る</a></p></article>${toc}</div></main>`,'../'));
}
const about=read('site/about.md');
outputs.set('about.html',page('この資料集について',`<main id="main" class="wrap"><article class="about prose"><h1>この資料集について</h1>${render(about.replace(/^# .+\n/,'')).html}</article></main>`));
const data=Object.fromEntries(cases.map(c=>[c.slug,{tags:c.tags,status:c.meta['検証状態'],text:plain(c.title+'\n'+Object.values(c.meta).join(' ')+'\n'+c.body)}]));
outputs.set('search-data.js','window.archiveSearch = '+JSON.stringify(data).replaceAll('<','\\u003c')+';\n');
// Only this fixed output map is publishable. Never copy the repository recursively.
for(const [file,text] of outputs) {
  if (nonPublic.test(text)) throw new Error('Non-public content in output: '+file);
}
if(path.resolve(out)!==path.resolve(root,'_site')||!out.startsWith(root+path.sep)||fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink()) throw new Error('Unsafe output path');
fs.rmSync(out,{recursive:true,force:true});
for(const [file,text] of outputs){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
console.log(`Built ${cases.length} public articles; ${outputs.size} allowlisted output files. Internal documents excluded.`);
