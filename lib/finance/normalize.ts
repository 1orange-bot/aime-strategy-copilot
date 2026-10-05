import type { Evidence,Indicator } from '../strategy/schema.ts';
export function numberOrNull(v:unknown):number|null {
 if(typeof v!=='number'&&typeof v!=='string')return null;
 if(typeof v==='string'&&(v.trim()===''||!/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(v.trim())))return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}
export function iso(v:unknown):string|null {const n=numberOrNull(v);if(n===null||n<=0)return null;const d=new Date(n);return Number.isNaN(d.getTime())?null:d.toISOString();}
export function normalizeMetric(e:Omit<Evidence,'value'|'quality'>,percent=false):Evidence {
 const n=numberOrNull(e.rawValue);
 const value=n===null?null:percent?n/100:n;
 const invalid=value!==null&&(['pe_ttm','pb_mrq'] as Indicator[]).includes(e.field)&&value<=0;
 return {...e,value,quality:n===null?'missing':invalid?'invalid':'valid',reason:n===null?'上游字段缺失，未用0替代。':invalid?'非正估值指标不适用于常规估值判断。':e.reason};
}
export function volatility(bars:{date_ms:unknown;close_price:unknown}[],expectedDates?:number[]){
 const sorted=[...bars].sort((a,b)=>Number(a.date_ms)-Number(b.date_ms)).slice(-61);
 if(sorted.length<61)return {value:null,reason:'不足61个价格点，无法验证60日波动率。'};
 const dates=sorted.map(b=>Number(b.date_ms));
 if(new Set(dates).size!==61||dates.some(n=>!Number.isFinite(n)))return {value:null,reason:'日期重复或无效，不能计算波动率。'};
 if(expectedDates?.length){const expected=expectedDates.slice(-61);if(expected.length!==61||dates.some((n,i)=>n!==expected[i]))return {value:null,reason:'行情序列未覆盖最近61个交易日，可能停牌或缺失。'};}
 const prices=sorted.map(b=>numberOrNull(b.close_price));
 if(prices.some(n=>n===null||n<=0))return {value:null,reason:'存在无效收盘价，未进行填充。'};
 const p=prices as number[];const returns=p.slice(1).map((v,i)=>v/p[i]-1);
 const mean=returns.reduce((a,b)=>a+b,0)/60;
 const value=Math.sqrt(returns.reduce((sum,r)=>sum+(r-mean)**2,0)/59)*Math.sqrt(252);
 return {value,reason:undefined,sampleCount:60,windowStart:iso(dates[0])!,windowEnd:iso(dates[60])!};
}
