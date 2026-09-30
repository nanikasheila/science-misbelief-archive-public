import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadArchive, catalogMarkdown, nonPublic, links} from './archive.mjs';
const root=path.resolve(process.argv[2]??fileURLToPath(new URL('..',import.meta.url)));
const out=path.join(root,'_site');
const archive=loadArchive(root);
const slugs=archive.cases.map(c=>c.slug);
const expected=['.nojekyll','index.html','catalog.md','about.html','style.css','search.js','search-data.js',...slugs.map(s=>'cases/'+s+'.html')].sort();
function walk(dir){return fs.readdirSync(path.join(out,dir),{withFileTypes:true}).flatMap(e=>{assert(!e.isSymbolicLink(),'No output symlinks');const p=path.posix.join(dir,e.name);return e.isDirectory()?walk(p):[p];});}
assert.deepEqual(walk('').sort(),expected,'Only allowlisted output files may be published');
let checkedLinks=0;
for(const file of expected){
 const text=fs.readFileSync(path.join(out,file),'utf8');
 assert(!nonPublic.test(text),'No internal data: '+file);
 if(!file.endsWith('.html'))continue;
 assert(text.includes('<html lang="ja">')&&text.includes('name="viewport"'),file+' language and viewport');
 assert.equal((text.match(/<h1[ >]/g)||[]).length,1,file+' single H1');
 const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,file+' unique IDs');
 for(const m of text.matchAll(/(?:href|src)="([^"]+)"/g)){
   const url=m[1].replaceAll('&amp;','&');
   if(/^https?:\/\//.test(url))continue;
   assert(!/^(?:[a-z]+:|\/\/)/i.test(url),'Unexpected URL scheme');
   const [relative,fragment]=url.split('#');
   const target=relative?path.resolve(out,path.dirname(file),relative):path.resolve(out,file);
   assert(target.startsWith(out+path.sep)&&fs.existsSync(target),file+' broken link '+url);
   if(fragment)assert(fs.readFileSync(target,'utf8').includes(`id="${fragment}"`),file+' missing anchor '+url);
   checkedLinks++;
 }
}
const index=fs.readFileSync(path.join(out,'index.html'),'utf8');
assert.equal((index.match(/data-slug=/g)||[]).length,slugs.length);
const data=JSON.parse(fs.readFileSync(path.join(out,'search-data.js'),'utf8').replace(/^window\.archiveSearch = /,'').replace(/;\s*$/,''));
assert.deepEqual(Object.keys(data).sort(),[...slugs].sort());
for(const c of archive.cases){
 assert(data[c.slug].text&&data[c.slug].status===c.meta['検証状態'],c.slug+' searchable metadata');
 assert.deepEqual(data[c.slug].tags,c.tags,c.slug+' current categories');
}
const catalog=fs.readFileSync(path.join(out,'catalog.md'),'utf8');
assert.equal(catalog,catalogMarkdown(archive),'Catalog is generated from the same article source');
for(const dest of links(catalog))assert(fs.existsSync(path.join(out,dest)),'Catalog link: '+dest);
console.log(`OK: ${slugs.length} articles, ${expected.length} public files, ${checkedLinks} local links and anchors; generated catalog, output allowlist and search coverage valid.`);
