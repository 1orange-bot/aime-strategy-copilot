import test from 'node:test';
import assert from 'node:assert/strict';
import {initialStrategy} from '../lib/strategy/schema.ts';
import {mockSnapshot} from '../lib/finance/mock.ts';
import {compareStocks,screen} from '../lib/strategy/engine.ts';

const setup=()=>{const strategy={...initialStrategy(),universe:'sample' as const};return {strategy,snapshot:mockSnapshot(strategy.report)};};

test('stock comparison keeps selection order and current strategy statuses without mutating the snapshot',()=>{
 const {strategy,snapshot}=setup(),before=structuredClone(snapshot),codes=[snapshot.stocks[2].code,snapshot.stocks[0].code,snapshot.stocks[1].code];
 const result=compareStocks(strategy,snapshot,codes),results=screen(strategy,snapshot);
 assert.equal(result.snapshotId,snapshot.id);assert.equal(result.fields.length,5);
 assert.deepEqual(result.rows.map(row=>row.code),codes);
 assert.deepEqual(result.rows.map(row=>row.status),codes.map(code=>results.find(row=>row.code===code)!.status));
 assert.deepEqual(snapshot,before);
});

test('stock comparison enforces 2 to 3 distinct stocks in the current snapshot',()=>{
 const {strategy,snapshot}=setup(),codes=snapshot.stocks.slice(0,4).map(row=>row.code);
 for(const selected of [[],codes.slice(0,1),codes,[codes[0],codes[0]],[codes[0],'NOT-IN-SNAPSHOT']])assert.throws(()=>compareStocks(strategy,snapshot,selected));
 assert.doesNotThrow(()=>compareStocks(strategy,snapshot,codes.slice(0,2)));
});

test('unrequested, missing and invalid metrics stay distinct with their original evidence',()=>{
 const {strategy,snapshot}=setup();delete snapshot.stocks[0].metrics.pb_mrq;
 snapshot.stocks[0].metrics.revenue_yoy!.quality='missing';snapshot.stocks[0].metrics.revenue_yoy!.value=null;
 snapshot.stocks[1].metrics.pb_mrq!.quality='invalid';snapshot.stocks[1].metrics.pb_mrq!.value=null;
 const result=compareStocks(strategy,snapshot,snapshot.stocks.slice(0,2).map(row=>row.code));
 assert.equal(result.rows[0].metrics.pb_mrq,undefined);
 assert.equal(result.rows[0].metrics.revenue_yoy!.quality,'missing');assert.equal(result.rows[0].metrics.revenue_yoy!.value,null);
 assert.equal(result.rows[1].metrics.pb_mrq!.quality,'invalid');
 assert.deepEqual(result.rows[0].metrics.pe_ttm,snapshot.stocks[0].metrics.pe_ttm);
});

test('comparison blocks stale fields, changed report or universe until a matching snapshot is acquired',()=>{
 const {strategy,snapshot}=setup(),codes=snapshot.stocks.slice(0,2).map(row=>row.code);
 delete snapshot.stocks[0].metrics.pb_mrq;
 const changed={...strategy,conditions:[...strategy.conditions,{id:'pb',concept:'估值核验',field:'pb_mrq' as const,operator:'<' as const,value:3,assumption:false}]};
 assert.throws(()=>compareStocks(changed,snapshot,codes),/重新获取/);
 assert.throws(()=>compareStocks({...strategy,report:'2020-1'},snapshot,codes),/报告期/);
 assert.throws(()=>compareStocks({...strategy,universe:'csi300'},snapshot,codes),/股票池/);
});
