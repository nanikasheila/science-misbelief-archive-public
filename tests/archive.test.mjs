import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadArchive,requiredSections} from '../scripts/archive.mjs';

const repo=fileURLToPath(new URL('..',import.meta.url));
const temp=fs.realpathSync(os.tmpdir());
function article(name,tag='分類A',status='出典確認済み',related='なし') {
  const sections=[...requiredSections.slice(0,4),'社会的影響（Impact）','現在の評価（Current Assessment）',...requiredSections.slice(4)];
  return `# テスト用記録 ${name}\n\n- 年代: 1900年\n- 分野: 検査用の架空資料\n- カテゴリ: ${tag}\n- 事例区分: テスト用\n- 検証状態: ${status}\n- 最終確認日: 2026-09-30\n\n${status==='未検証候補'?'> 未検証候補。検査用の架空記録です。\n\n':''}`+
    sections.map(s=>`## ${s}\n\n${s==='出典（Sources）'?'1. [検査用URL](https://example.invalid/source)。外部アクセスはしない。':s==='関連事件（Related Cases）'?related:'これは自動テスト専用の文章。[1]'}`).join('\n\n')+'\n';
}
function fixture(t) {
  const root=fs.mkdtempSync(path.join(temp,'science-archive-test-'));
  t.after(()=>{
    // Delete only the exact temporary directory created by this test.
    assert.equal(path.dirname(root),temp);
    assert(path.basename(root).startsWith('science-archive-test-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  fs.mkdirSync(path.join(root,'cases'));
  fs.cpSync(path.join(repo,'site'),path.join(root,'site'),{recursive:true});
  fs.writeFileSync(path.join(root,'taxonomy.md'),'# 分類\n\n## 1. 分類A（Category A）\n\n## 2. 分類B（Category B）\n');
  fs.writeFileSync(path.join(root,'cases/alpha.md'),article('alpha'));
  fs.writeFileSync(path.join(root,'cases/beta.md'),article('beta'));
  return root;
}
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const write=(root,file,text)=>fs.writeFileSync(path.join(root,file),text);
function run(root,script='build.mjs') {
  const result=spawnSync(process.execPath,[path.join(repo,'scripts',script),root],{encoding:'utf8'});
  if(result.error)throw result.error;
  return result;
}
function build(root){const result=run(root);assert.equal(result.status,0,result.stdout+result.stderr);}
function search(root){return JSON.parse(read(root,'_site/search-data.js').replace(/^window\.archiveSearch = /,'').replace(/;\s*$/,''));}

test('adding and deleting one Markdown updates pages, catalog, search and related suggestions',t=>{
  const root=fixture(t);build(root);
  assert(!fs.existsSync(path.join(root,'index.md')),'no hand-maintained index input');
  assert(!fs.existsSync(path.join(root,'site/public-content.json')),'no article allowlist input');
  write(root,'cases/gamma.md',article('gamma'));
  build(root);
  assert(read(root,'_site/index.html').includes('data-slug="gamma"'));
  assert(read(root,'_site/catalog.md').includes('全3件'));
  assert(search(root).gamma);
  assert(read(root,'_site/cases/alpha.html').includes('href="gamma.html"'));
  assert(fs.existsSync(path.join(root,'_site/cases/gamma.html')));
  fs.unlinkSync(path.join(root,'cases/gamma.md'));
  build(root);
  assert(!read(root,'_site/index.html').includes('data-slug="gamma"'));
  assert(!read(root,'_site/catalog.md').includes('gamma'));
  assert(!search(root).gamma);
  assert(!read(root,'_site/cases/alpha.html').includes('href="gamma.html"'));
  assert(!fs.existsSync(path.join(root,'_site/cases/gamma.html')),'stale page removed');
});

test('category and status changes update filters, grouped catalog, search and related suggestions',t=>{
  const root=fixture(t);build(root);
  assert(read(root,'_site/cases/alpha.html').includes('href="beta.html"'));
  write(root,'cases/beta.md',article('beta','分類B','未検証候補'));
  build(root);
  const catalog=read(root,'_site/catalog.md');
  assert(!catalog.split('### 1. 分類A')[1].split('### 2. 分類B')[0].includes('beta'));
  assert(catalog.split('### 2. 分類B')[1].includes('beta'));
  assert.deepEqual(search(root).beta.tags,['分類B']);
  assert.equal(search(root).beta.status,'未検証候補');
  assert(read(root,'_site/index.html').includes('<option>分類B</option>'));
  assert(!read(root,'_site/cases/alpha.html').includes('href="beta.html"'));
});

test('explicit related links are preserved and dangling links block deletion',t=>{
  const root=fixture(t);
  write(root,'cases/alpha.md',article('alpha','分類A','出典確認済み','- [比較対象](beta.md): 人が記した関連理由。'));
  build(root);
  assert.equal((read(root,'_site/cases/alpha.html').match(/href="beta.html"/g)||[]).length,1,'automatic list does not duplicate explicit relation');
  fs.unlinkSync(path.join(root,'cases/beta.md'));
  assert.throws(()=>loadArchive(root),/invalid public article link/);
  assert.notEqual(run(root).status,0,'one-command build propagates failure');
});

test('only cases Markdown and fixed public assets are published; stale output is removed',t=>{
  const root=fixture(t);
  fs.mkdirSync(path.join(root,'docs'));
  write(root,'docs/private.md','PRIVATE_DO_NOT_PUBLISH');
  write(root,'cases/private.csv','PRIVATE_DO_NOT_PUBLISH');
  write(root,'site/unapproved.txt','PRIVATE_DO_NOT_PUBLISH');
  build(root);
  assert(!fs.existsSync(path.join(root,'_site/docs')));
  assert(!read(root,'_site/search-data.js').includes('PRIVATE_DO_NOT_PUBLISH'));
  write(root,'_site/leak.txt','PRIVATE_DO_NOT_PUBLISH');
  assert.notEqual(run(root,'check-site.mjs').status,0,'extra output file rejected');
  build(root);assert(!fs.existsSync(path.join(root,'_site/leak.txt')));
});

const invalid=[
  ['empty title',s=>s.replace('# テスト用記録 alpha','#   '),/non-empty title/],
  ['missing metadata',s=>s.replace(/^- 年代:.*\n/m,''),/invalid metadata: 年代/],
  ['duplicate metadata',s=>s.replace('- 年代: 1900年','- 年代: 1900年\n- 年代: 1901年'),/invalid metadata: 年代/],
  ['invalid state',s=>s.replace('検証状態: 出典確認済み','検証状態: 多分正しい'),/unknown status/],
  ['invalid date',s=>s.replace('2026-09-30','2026-02-30'),/invalid review date/],
  ['unknown category',s=>s.replace('カテゴリ: 分類A','カテゴリ: 未定義'),/undefined category/],
  ['duplicate category',s=>s.replace('カテゴリ: 分類A','カテゴリ: 分類A, 分類A'),/duplicate category/],
  ['missing required section',s=>s.replace('## 概要（Overview）','## 別見出し'),/required section/],
  ['empty section',s=>s.replace('## 現在の評価（Current Assessment）\n\nこれは自動テスト専用の文章。[1]','## 現在の評価（Current Assessment）'),/empty section/],
  ['duplicate section',s=>s+'\n## 出典（Sources）\n\n重複。\n',/duplicate section/],
  ['missing source with page citation',s=>s.replace('[1]','[99: p.2]'),/missing source \[99\]/],
  ['source without URL',s=>s.replace('[検査用URL](https://example.invalid/source)','リンクのない資料'),/source needs an external link/],
  ['duplicate source ID',s=>s.replace('## 留保・未確認事項','1. [重複](https://example.invalid/other)\n\n## 留保・未確認事項'),/duplicate source number/],
  ['unwarned candidate',s=>s.replace('検証状態: 出典確認済み','検証状態: 未検証候補'),/candidate warning required/],
  ['broken internal link',s=>s+'\n[存在しない記事](missing.md)\n',/invalid public article link/],
  ['private document link',s=>s+'\n[非公開](../docs/private.md)\n',/non-public data/],
  ['unsafe URL scheme',s=>s+'\n[不正なリンク](javascript:alert)\n',/invalid public article link/],
  ['credentials in URL',s=>s+'\n[不正なURL](https://user:password@example.invalid/)\n',/credentials in source URL/],
  ['local machine path',s=>s+'\nC:\\Users\\private.txt\n',/non-public data/],
];
for(const[name,mutate,error]of invalid)test('rejects '+name,t=>{
  const root=fixture(t);write(root,'cases/alpha.md',mutate(read(root,'cases/alpha.md')));
  assert.throws(()=>loadArchive(root),error);
});

test('nonconforming filenames and nested cases are rejected rather than silently omitted',t=>{
  const root=fixture(t);write(root,'cases/Bad Name.md',article('invalid'));
  assert.throws(()=>loadArchive(root),/filename must use/);
  fs.unlinkSync(path.join(root,'cases/Bad Name.md'));
  write(root,'cases/upper.MD',article('invalid'));
  assert.throws(()=>loadArchive(root),/filename must use/);
  fs.unlinkSync(path.join(root,'cases/upper.MD'));
  fs.mkdirSync(path.join(root,'cases/drafts'));
  assert.throws(()=>loadArchive(root),/keep drafts outside cases/);
});

test('rendering escapes raw HTML and remains deterministic',t=>{
  const root=fixture(t);write(root,'cases/alpha.md',read(root,'cases/alpha.md')+'\n<script>alert(1)</script>\n');
  build(root);
  const first=read(root,'_site/cases/alpha.html');
  assert(!first.includes('<script>alert(1)</script>'));
  assert(first.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  build(root);assert.equal(read(root,'_site/cases/alpha.html'),first);
});

test('article template and real archive are compatible with the shared schema',()=>{
  const template=read(repo,'templates/case.md');
  for(const section of requiredSections)assert(template.includes('## '+section));
  assert(loadArchive(repo).cases.length>0);
});
