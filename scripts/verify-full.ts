import {fetchBatch,universe} from '../lib/finance/provider.ts';
import {initialStrategy} from '../lib/strategy/schema.ts';
import type {Snapshot} from '../lib/strategy/schema.ts';
import {screen,compareStrategies} from '../lib/strategy/engine.ts';
import {mkdir,writeFile} from 'node:fs/promises';
const start=Date.now(),strategy=initialStrategy(),pool=await universe('csi300');
const stocks:Snapshot['stocks']=[];for(let i=0;i<pool.stocks.length;i+=12){stocks.push(...await fetchBatch(pool.stocks.slice(i,i+12).map(s=>s.code),['pe_ttm','net_profit_yoy','volatility_60d'],strategy.report));console.log(JSON.stringify({progress:stocks.length,total:pool.stocks.length}));}
const snapshot:Snapshot={id:crypto.randomUUID(),mode:'real',createdAt:new Date().toISOString(),universe:'沪深300',universeCount:pool.stocks.length,stocks,report:strategy.report,warnings:['API未提供财务公告日，不支持历史回测。'],universeEvidence:{observedAt:pool.timestamp,requestId:pool.requestId}};
const rows=screen(strategy,snapshot),counts={pass:rows.filter(s=>s.status==='pass').length,fail:rows.filter(s=>s.status==='fail').length,unknown:rows.filter(s=>s.status==='unknown').length};
const delta=compareStrategies(strategy,{...strategy,conditions:strategy.conditions.map(c=>c.field==='pe_ttm'?{...c,value:35}:c)},snapshot);
const summary={performedAt:new Date(start).toISOString(),durationMs:Date.now()-start,snapshotId:snapshot.id,universeCount:pool.stocks.length,report:strategy.report,counts,qualityCounts:Object.fromEntries(['valid','missing','invalid','stale','error'].map(q=>[q,stocks.flatMap(s=>Object.values(s.metrics)).filter(e=>e.quality===q).length])),pe30To35:{before:delta.before,after:delta.after,added:delta.added.length,removed:delta.removed.length,retained:delta.retained.length},distinctCodes:new Set(stocks.map(s=>s.code)).size};
await mkdir('work',{recursive:true});await writeFile('work/full-snapshot.json',JSON.stringify(snapshot));await writeFile('work/full-verification.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
