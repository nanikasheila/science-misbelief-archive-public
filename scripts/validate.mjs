#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadArchive} from './archive.mjs';
try {
  const root=path.resolve(process.argv[2]??fileURLToPath(new URL('..',import.meta.url)));
  const {cases}=loadArchive(root);
  const confirmed=cases.filter(c=>c.meta['検証状態']==='出典確認済み').length;
  console.log(`OK: ${cases.length} cases; 出典確認済み ${confirmed}; 未検証候補 ${cases.length-confirmed}; metadata, sections, citations and public article links valid. Facts require source review.`);
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
