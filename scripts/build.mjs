#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const scripts=fileURLToPath(new URL('.',import.meta.url));
const root=path.resolve(process.argv[2]??path.join(scripts,'..'));
for(const script of ['build-site.mjs','check-site.mjs']){
  const result=spawnSync(process.execPath,[path.join(scripts,script),root],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
