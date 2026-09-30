// Shared article discovery, validation and catalog generation. No package dependencies.
import fs from 'node:fs';
import path from 'node:path';

export const requiredSections = [
  '概要（Overview）', '当時信じられていた主張（Claims）',
  '誤認の原因構造（Cause Analysis）', '反証と終息（Refutation）',
  '教訓（Lessons）', '関連事件（Related Cases）', '出典（Sources）',
  '留保・未確認事項（Limitations）',
];
export const nonPublic = /(?:YoutubeMetadata|\b[A-Z]:[\\/]|file:\/\/|\.\.\/docs\/|editorial-audit|reference-data\.md|\.git\/|source\/repos)/i;
export function readInput(root, relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Input outside repository: '+relative);
  let current = root;
  for (const part of path.relative(root, absolute).split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink input is not allowed: '+relative);
  }
  return fs.readFileSync(absolute, 'utf8').replaceAll('\r\n', '\n').replace(/^\uFEFF/, '');
}
export const links = text => [...text.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)].map(m=>m[1]);
export function loadArchive(root) {
  root = path.resolve(root);
  const errors = [];
  const fail = (file, message) => errors.push(`${file}: ${message}`);
  const taxonomy = readInput(root, 'taxonomy.md');
  const categories = [...taxonomy.matchAll(/^## (\d+)\. (.+?)（/gm)].map(m=>({number:Number(m[1]),name:m[2]}));
  const tags = new Set(categories.map(c=>c.name));
  if (!tags.size || tags.size!==categories.length || new Set(categories.map(c=>c.number)).size!==categories.length) fail('taxonomy.md','invalid category definitions');
  const directory = path.join(root, 'cases');
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Symlink cases directory is not allowed');
  const files = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    if (entry.isSymbolicLink()) fail('cases/'+entry.name,'symlink is not allowed');
    else if (entry.isDirectory()) fail('cases/'+entry.name,'put articles directly in cases; keep drafts outside cases');
    else if (/\.md$/i.test(entry.name)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(entry.name)) fail('cases/'+entry.name,'filename must use lowercase letters, digits and hyphens');
      else files.push(entry.name);
    }
  }
  files.sort();
  if (!files.length) fail('cases','no articles');
  const slugs = new Set(files.map(f=>f.slice(0,-3)));
  const cases = files.map(file => {
    const relative = 'cases/'+file;
    const text = readInput(root, relative);
    const titles = [...text.matchAll(/^# (.+)$/gm)];
    if (titles.length!==1 || !titles[0]?.[1].trim()) fail(relative,'exactly one non-empty title required');
    if (nonPublic.test(text)) fail(relative,'non-public data or internal-document reference');
    if (/\[\[[^\]]+\]\]/.test(text)) fail(relative,'wiki link remains');
    const firstSection = text.search(/^## /m);
    const header = text.slice(0, firstSection<0 ? text.length : firstSection);
    const meta = {};
    for (const key of ['年代','分野','カテゴリ','検証状態','最終確認日','事例区分']) {
      const values = [...header.matchAll(new RegExp(`^- ${key}:(.*)$`,'gm'))];
      if (values.length>1 || values.length===1&&!values[0][1].trim() || !values.length&&key!=='事例区分') fail(relative,'invalid metadata: '+key);
      if (values.length) meta[key]=values[0][1].trim();
    }
    const caseTags = (meta['カテゴリ']??'').split(/[,、]/).map(t=>t.trim());
    if (new Set(caseTags).size!==caseTags.length) fail(relative,'duplicate category');
    for (const tag of caseTags) if (!tags.has(tag)) fail(relative,'undefined category: '+tag);
    if (!['出典確認済み','未検証候補'].includes(meta['検証状態'])) fail(relative,'unknown status: '+meta['検証状態']);
    const date=meta['最終確認日'];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date??'') || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) fail(relative,'invalid review date');
    const headings=[...text.matchAll(/^## (.+)$/gm)];
    const sections={};
    for (let i=0;i<headings.length;i++) {
      const h=headings[i], name=h[1].trim();
      if (Object.hasOwn(sections,name)) fail(relative,'duplicate section: '+name);
      sections[name]=text.slice(h.index+h[0].length,headings[i+1]?.index??text.length).trim();
      if (!sections[name]) fail(relative,'empty section: '+name);
    }
    // Backward-compatible with the first edition; the expanded template has ten sections.
    const required=meta['事例区分'] ? [...requiredSections,'社会的影響（Impact）','現在の評価（Current Assessment）'] : requiredSections;
    for (const section of required) if (!Object.hasOwn(sections,section)) fail(relative,'required section: '+section);
    for (const dest of links(text)) {
      if (/^https?:\/\//.test(dest)) {
        try { const url=new URL(dest); if(url.username||url.password) fail(relative,'credentials in source URL'); } catch {fail(relative,'invalid external URL: '+dest);}
        continue;
      }
      const target=dest.match(/^([a-z0-9-]+)\.md$/)?.[1];
      if (!target || !slugs.has(target)) fail(relative,'invalid public article link: '+dest);
    }
    const related=sections['関連事件（Related Cases）']??'';
    for (const dest of links(related)) if (!slugs.has(dest.replace(/\.md$/,''))||dest===file) fail(relative,'invalid related case: '+dest);
    if (!links(related).length&&related!=='なし') fail(relative,'related cases need article links or なし');
    const sources=sections['出典（Sources）']??'';
    const entries=[...sources.matchAll(/^(\d+)\. /gm)];
    const ids=entries.map(m=>m[1]);
    if (ids.length!==new Set(ids).size) fail(relative,'duplicate source number');
    for (let i=0;i<entries.length;i++) {
      const entry=sources.slice(entries[i].index,entries[i+1]?.index??sources.length);
      if (!links(entry).some(link=>/^https?:\/\//.test(link))) fail(relative,'source needs an external link: '+ids[i]);
    }
    const citations=[...text.replace(sources,'').matchAll(/\[(\d+)(?::[^\]\n]+)?\](?!\()/g)].map(m=>m[1]);
    for (const id of citations) if (!ids.includes(id)) fail(relative,'missing source ['+id+']');
    if (meta['検証状態']==='出典確認済み'&&(!ids.length||!citations.length)) fail(relative,'confirmed case requires numbered sources and inline citation');
    if (meta['検証状態']==='未検証候補'&&!/^> .*候補/m.test(text)) fail(relative,'candidate warning required');
    const body=text.split('\n').filter(l=>!/^# /.test(l)&&!(/^- (年代|分野|カテゴリ|事例区分|検証状態|最終確認日):/.test(l))).join('\n').trim();
    return {slug:file.slice(0,-3),file:relative,title:titles[0]?.[1]??'',meta,tags:caseTags,sections,body,text};
  });
  if (errors.length) throw new Error(errors.join('\n'));
  return {cases,categories};
}

export function catalogMarkdown({cases,categories}) {
  const cell=s=>String(s).replaceAll('|','\\|');
  const link=c=>`[${cell(c.title)}](cases/${c.slug}.html)`;
  let text='# 事例索引\n\n<!-- Generated from cases/*.md. Do not edit. -->\n\n';
  const confirmed=cases.filter(c=>c.meta['検証状態']==='出典確認済み').length;
  text+=`全${cases.length}件。出典確認済み${confirmed}件、未検証候補${cases.length-confirmed}件。確認状態は全論点の確定を意味しません。各記事の出典と留保を参照してください。\n\n`;
  text+='| 事例 | 年代 | 分野 | 区分 | 状態 |\n| --- | --- | --- | --- | --- |\n';
  text+=cases.map(c=>`| ${link(c)} | ${cell(c.meta['年代'])} | ${cell(c.meta['分野'])} | ${cell(c.meta['事例区分']??'主張と検証の記録')} | ${c.meta['検証状態']} |`).join('\n')+'\n\n## 分類から探す\n';
  for(const tag of categories) {
    text+=`\n### ${tag.number}. ${tag.name}\n\n`;
    const selected=cases.filter(c=>c.tags.includes(tag.name));
    text+=selected.length ? selected.map(c=>`- ${link(c)}${c.meta['検証状態']==='未検証候補'?' — 仮分類':''}${c.meta['事例区分']?.startsWith('対照例')?' — 対照例':''}`).join('\n')+'\n' : '現収録では付与なし。\n';
  }
  return text;
}

export function relatedCases(article, cases, limit=3) {
  const explicit=new Set(links(article.sections['関連事件（Related Cases）']??'').map(l=>l.replace(/\.md$/,'')));
  return cases.filter(c=>c.slug!==article.slug&&!explicit.has(c.slug))
    .map(c=>({c,score:c.tags.filter(t=>article.tags.includes(t)).length}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score || Number(b.c.meta['検証状態']===article.meta['検証状態'])-Number(a.c.meta['検証状態']===article.meta['検証状態']) || a.c.slug.localeCompare(b.c.slug))
    .slice(0,limit).map(x=>x.c);
}
