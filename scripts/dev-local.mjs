import {existsSync,readFileSync} from 'node:fs';
// Local development only. Production values are Sites runtime secrets.
if(existsSync('.env.local'))for(const line of readFileSync('.env.local','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i<1||line.startsWith('#'))continue;const key=line.slice(0,i).trim();if(!process.env[key])process.env[key]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
await import('./run-framework.mjs');
