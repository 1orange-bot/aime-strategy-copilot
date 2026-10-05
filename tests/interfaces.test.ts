import test from 'node:test';
import assert from 'node:assert/strict';
import {fuyao,fetchBatch,universe} from '../lib/finance/provider.ts';
import {body,protect,ServiceError} from '../lib/server/runtime.ts';
const originalFetch=globalThis.fetch;
process.env.FUYAO_API_KEY='fake-unit-test-key-not-valid';
function respond(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});}
test('HTTP200 business error, authentication failure and malformed JSON never return success',async()=>{
 try{for(const code of [2001,2003,9001]){globalThis.fetch=async()=>respond({code,data:{}});await assert.rejects(fuyao(`/test/error-${code}`),e=>e instanceof ServiceError&&e.code===`FUYAO_${code}`);}
 globalThis.fetch=async()=>new Response('not json');await assert.rejects(fuyao('/test/bad-json'),e=>e instanceof ServiceError&&e.code==='DATA_RESPONSE_INVALID');
 globalThis.fetch=async()=>respond({code:0});await assert.rejects(fuyao('/test/no-data'));
 globalThis.fetch=async()=>{throw new Error('simulated socket failure');};await assert.rejects(fuyao('/test/timeout'),e=>e instanceof ServiceError&&e.code==='DATA_TIMEOUT');
 }finally{globalThis.fetch=originalFetch;}
});
test('upstream HTTP429 retries once and stops clearly',async()=>{let calls=0;try{globalThis.fetch=async()=>{calls++;return respond({},429);};await assert.rejects(fuyao('/test/429'),e=>e instanceof ServiceError&&e.code==='DATA_RATE_LIMITED');assert.equal(calls,2);}finally{globalThis.fetch=originalFetch;}});
test('financial adapter follows real field identifiers and preserves missing evidence',async()=>{
 try{globalThis.fetch=async()=>respond({code:0,request_id:'fixture-request',data:{thscode:'000001.SZ',report:'2026-2',abilities:[{ability:'growth',indicators:[{index_id:'calculate_parent_holder_net_profit_yoy_growth_ratio',value:'18.2'}]}]}});
 const [row]=await fetchBatch(['000001.SZ'],['net_profit_yoy','revenue_yoy'],'2026-2');assert.equal(row.metrics.net_profit_yoy!.value,.182);assert.equal(row.metrics.net_profit_yoy!.quality,'valid');assert.equal(row.metrics.net_profit_yoy!.rawField,'calculate_parent_holder_net_profit_yoy_growth_ratio');assert.equal(row.metrics.net_profit_yoy!.requestId,'fixture-request');assert.equal(row.metrics.revenue_yoy!.quality,'missing');assert.equal(row.metrics.revenue_yoy!.value,null);assert.equal(row.metrics.net_profit_yoy!.publishedAt,null);
 }finally{globalThis.fetch=originalFetch;}
});
test('empty stock universe cannot become a normal zero-result screen',async()=>{try{globalThis.fetch=async()=>respond({code:0,data:{item:[]}});await assert.rejects(universe('csi300'),e=>e instanceof ServiceError&&e.code==='UNIVERSE_INVALID');}finally{globalThis.fetch=originalFetch;}});
test('malformed request, oversized content, wrong origin and repeated calls are rejected',async()=>{
 const request=(text:string)=>new Request('https://test.local/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:text});
 await assert.rejects(body(request('{bad')));await assert.rejects(body(request('x'.repeat(16001))),e=>e instanceof ServiceError&&e.status===413);
 assert.throws(()=>protect(new Request('https://test.local/api/test',{headers:{origin:'https://attacker.local'}})),e=>e instanceof ServiceError&&e.status===403);
 const r=new Request('https://test.local/api/rate-test');protect(r,1);assert.throws(()=>protect(r,1),e=>e instanceof ServiceError&&e.status===429);
});
