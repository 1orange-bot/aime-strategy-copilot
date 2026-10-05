import {registry} from '../strategy/schema.ts';
import type { Snapshot,Indicator } from '../strategy/schema.ts';
export function mockSnapshot(report:string,universe:'sample'|'csi300'='sample'):Snapshot {
 const fields=Object.keys(registry) as Indicator[];const createdAt='2026-09-30T07:00:00.000Z';
 return {id:'mock-fixture-v1',mode:'mock',createdAt,universe:universe==='csi300'?'沪深300':'12只研究样本',universeCount:12,report,warnings:['这是12只构造股票的测试样本，不是实际沪深300成分、金融事实或选股结论。'],stocks:Array.from({length:12},(_,i)=>({code:`DEMO-${String(i+1).padStart(2,'0')}`,name:`演示公司${i+1}`,metrics:Object.fromEntries(fields.map(field=>{
 const value=field==='pe_ttm'?10+i*3:field==='pb_mrq'?1+i*.3:field==='net_profit_yoy'?(i-2)*.04:field==='revenue_yoy'?(i-1)*.025:.10+i*.024;
 return [field,{id:`demo-${i}-${field}`,field,value:i===10&&field==='net_profit_yoy'?null:value,rawField:field,rawValue:value,unit:registry[field].unit,source:'构造测试数据',endpoint:'local fixture',observedAt:createdAt,fetchedAt:createdAt,reportPeriod:report,requestId:null,quality:i===10&&field==='net_profit_yoy'?'missing':'valid',reason:i===10&&field==='net_profit_yoy'?'演示缺失字段场景。':undefined}];
 }))}))};
}
