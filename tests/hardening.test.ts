import test from 'node:test';
import assert from 'node:assert/strict';
import {availableReports,defaultReport,initialStrategy,StrategySchema} from '../lib/strategy/schema.ts';
import {POST} from '../app/api/data/route.ts';
import {mockSnapshot} from '../lib/finance/mock.ts';
import {compareStrategies,conditionImpact,missingSnapshotFields,screen} from '../lib/strategy/engine.ts';

test('available reports exclude future and unfinished disclosure periods, with a compatible default',()=>{
 const october=new Date('2026-10-06T00:00:00+08:00'),reports=availableReports(october);
 assert.deepEqual(reports.slice(0,6),['2026-2','2026-1','2025-4','2025-3','2025-2','2025-1']);
 assert.ok(!reports.includes('2026-3')&&!reports.includes('2026-4'));
 for(let month=1;month<=12;month++){
  const date=new Date(Date.UTC(2026,month-1,15));
  assert.equal(defaultReport(date),availableReports(date)[0]);
 }
 assert.equal(StrategySchema.safeParse({...initialStrategy(),report:'2027-4'}).success,true,'saved schema v1 still accepts the original format');
});
test('Beijing disclosure-month boundaries include annual reports without using the host timezone',()=>{
 assert.equal(defaultReport(new Date('2026-04-30T15:59:59Z')),'2025-3');
 assert.equal(defaultReport(new Date('2026-04-30T16:00:00Z')),'2026-1');
 assert.ok(availableReports(new Date('2026-04-30T16:00:00Z')).includes('2025-4'));
 assert.equal(defaultReport(new Date('2026-08-31T16:00:00Z')),'2026-2');
 assert.equal(defaultReport(new Date('2026-10-31T16:00:00Z')),'2026-3');
 assert.equal(defaultReport(new Date('2026-12-31T16:00:00Z')),'2026-3');
});
test('data route refuses unavailable report periods before calling any provider',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw new Error('must not request future data');};
  const response=await POST(new Request('https://test.local/api/data',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'report-test'},body:JSON.stringify({codes:['600519.SH'],fields:['pe_ttm'],report:'2099-4'})}));
  assert.equal(response.status,422);assert.equal((await response.json() as {code:string}).code,'REPORT_UNAVAILABLE');assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});

test('a newly unrequested field blocks comparison and impact, without changing confirmed results',()=>{
 const before={...initialStrategy(),universe:'sample' as const},snapshot=mockSnapshot(before.report);
 const confirmed=screen(before,snapshot);
 for(const stock of snapshot.stocks)delete stock.metrics.pb_mrq;
 const after={...before,conditions:[...before.conditions,{id:'pb',concept:'估值核验',field:'pb_mrq' as const,operator:'<' as const,value:3,assumption:false}]};
 assert.deepEqual(missingSnapshotFields(after,snapshot),['pb_mrq']);
 assert.throws(()=>compareStrategies(before,after,snapshot),/重新获取/);
 assert.throws(()=>conditionImpact(after,snapshot),/重新获取/);
 assert.deepEqual(screen(before,snapshot).map(r=>r.status),confirmed.map(r=>r.status));
 snapshot.stocks[0].metrics.pb_mrq={...snapshot.stocks[0].metrics.pe_ttm!,field:'pb_mrq',value:2};
 assert.deepEqual(missingSnapshotFields(after,snapshot),['pb_mrq'],'even one missing field in the pool prevents final comparison');
 for(const stock of snapshot.stocks)stock.metrics.pb_mrq={...stock.metrics.pe_ttm!,field:'pb_mrq',value:2,quality:'valid'};
 assert.deepEqual(missingSnapshotFields(after,snapshot),[]);
 assert.doesNotThrow(()=>compareStrategies(before,after,snapshot));
 assert.doesNotThrow(()=>conditionImpact(after,snapshot));
});
test('requested but unavailable evidence remains UNKNOWN and never counts as removed',()=>{
 const base={...initialStrategy(),universe:'sample' as const},snapshot=mockSnapshot(base.report);
 snapshot.stocks=snapshot.stocks.slice(0,1);snapshot.universeCount=1;
 const before={...base,conditions:base.conditions.filter(c=>c.field==='pe_ttm')};
 const after={...before,conditions:[...before.conditions,{id:'pb',concept:'估值核验',field:'pb_mrq' as const,operator:'<' as const,value:3,assumption:false}]};
 snapshot.stocks[0].metrics.pb_mrq!.quality='missing';snapshot.stocks[0].metrics.pb_mrq!.value=null;
 assert.deepEqual(missingSnapshotFields(after,snapshot),[]);
 const result=compareStrategies(before,after,snapshot);
 assert.equal(result.before,1);assert.equal(result.after,0);assert.deepEqual(result.removed,[]);assert.deepEqual(result.pending,[snapshot.stocks[0].code]);
});
