import { registry,sampleStocks } from '../strategy/schema.ts';
import type { StockData,Indicator,Evidence } from '../strategy/schema.ts';
import { normalizeMetric,iso,volatility,numberOrNull } from './normalize.ts';
import { setting,ServiceError } from '../server/runtime.ts';

type Envelope={code:number;request_id?:string;data:Record<string,unknown>};
const cache=new Map<string,{until:number;value:Envelope}>();
export async function fuyao(path:string,params:Record<string,string>={}){
 const key=await setting('FUYAO_API_KEY');if(!key)throw new ServiceError('扶摇数据尚未配置，请由产品维护者配置数据密钥。',503,'DATA_NOT_CONFIGURED');
 const url=new URL(path,'https://fuyao.aicubes.cn');for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const cacheKey=url.toString();const cached=cache.get(cacheKey);if(cached&&cached.until>Date.now())return cached.value;
 for(let attempt=0;attempt<2;attempt++){
  let response:Response;
  try{response=await fetch(url,{headers:{'X-api-key':key},signal:AbortSignal.timeout(16000)});}catch{throw new ServiceError('扶摇数据请求超时或无法连接，请稍后重试。',504,'DATA_TIMEOUT');}
  if(response.status===429){if(attempt===0){await new Promise(r=>setTimeout(r,1200));continue;}throw new ServiceError('数据源限流，请降低请求频率。',429,'DATA_RATE_LIMITED');}
  if(!response.ok)throw new ServiceError(`数据源返回HTTP ${response.status}，本次未生成正常结果。`,502,'DATA_HTTP_ERROR');
  let value:Envelope;try{value=await response.json() as Envelope;}catch{throw new ServiceError('数据源响应格式异常。',502,'DATA_RESPONSE_INVALID');}
  if(value.code===4001){if(!attempt){await new Promise(r=>setTimeout(r,1200));continue;}throw new ServiceError('数据源限流，请稍后重试。',429,'DATA_RATE_LIMITED');}
  if(value.code!==0){const error=value.code===2001?'数据密钥无效。':value.code===2003?'账号没有所需金融数据能力权限。':`金融接口返回业务错误 ${value.code}。`;throw new ServiceError(error,502,`FUYAO_${value.code}`);}
  if(!value.data||typeof value.data!=='object')throw new ServiceError('金融数据结构缺失。',502,'DATA_RESPONSE_INVALID');
  cache.set(cacheKey,{until:Date.now()+300000,value});if(cache.size>1500)cache.delete(cache.keys().next().value!);
  return value;
 }
 throw new ServiceError('数据暂时不可用。');
}
export async function universe(kind:'csi300'|'sample'){
 if(kind==='sample')return {stocks:sampleStocks,label:'12只研究样本',timestamp:null,requestId:null};
 const v=await fuyao('/api/a-share-index/constituents/ths-stock-list',{thscode:'000300.SH'});
 const items=Array.isArray(v.data.item)?v.data.item as Record<string,unknown>[]:[];
 const stocks=items.filter(x=>typeof x.thscode==='string'&&/^\d{6}\.(SH|SZ|BJ)$/.test(x.thscode)).map(x=>({code:String(x.thscode),name:typeof x.name==='string'?x.name:String(x.thscode)}));
 if(!stocks.length||stocks.length>350)throw new ServiceError('股票池为空或超出本版范围，本次未执行筛选。',502,'UNIVERSE_INVALID');
 const unique=[...new Map(stocks.map(s=>[s.code,s])).values()];
 return {stocks:unique,label:'沪深300',timestamp:iso(v.data.timestamp),requestId:v.request_id??null};
}
export async function tradingDays(){
 const v=await fuyao('/api/a-share/calendar/trading-days');
 // date_ms is China-local midnight. Allow a completed trading day only after 15:30 Beijing time.
 const days=[...new Set((Array.isArray(v.data.item)?v.data.item as Record<string,unknown>[]:[]).map(x=>numberOrNull(x.date_ms)).filter((x):x is number=>x!==null&&x+15.5*3600000<=Date.now()))].sort((a,b)=>a-b);
 if(days.length<61)throw new ServiceError('交易日历不足，无法校验历史窗口。',502,'CALENDAR_INVALID');
 return days;
}
function envelopeEvidence(code:string,field:Indicator,rawField:string,rawValue:unknown,env:Envelope,endpoint:string,report?:string):Omit<Evidence,'value'|'quality'>{
 return {id:`${code}:${field}:${env.request_id??'no-request-id'}`,field,rawField,rawValue,unit:registry[field].unit,source:'同花顺扶摇',endpoint,observedAt:iso(env.data.timestamp),fetchedAt:new Date().toISOString(),requestId:env.request_id??null,reportPeriod:report,publishedAt:report?null:undefined};
}
function errorEvidence(code:string,field:Indicator,e:unknown,report:string):Evidence{
 return {id:`${code}:${field}:error`,field,rawField:field,rawValue:null,value:null,unit:registry[field].unit,source:'同花顺扶摇',endpoint:'',observedAt:null,fetchedAt:new Date().toISOString(),requestId:null,reportPeriod:report,quality:'error',reason:e instanceof ServiceError?e.message:'此字段请求失败。'};
}
export async function fetchBatch(codes:string[],fields:Indicator[],report:string){
 const valuationFields=fields.filter(f=>f==='pe_ttm'||f==='pb_mrq');
 let val:Envelope|undefined;let valError:unknown;
 if(valuationFields.length)try{val=await fuyao('/api/a-share/valuations/snapshot',{thscodes:codes.join(',')});}catch(e){if(e instanceof ServiceError&&/2001|2003|NOT_CONFIGURED/.test(e.code))throw e;valError=e;}
 const dates=fields.includes('volatility_60d')||valuationFields.length?await tradingDays():[];
 const rows:StockData[]=[];
 // Three stocks at a time, each stock calls its single-target tools in order.
 for(let start=0;start<codes.length;start+=3){
  const part=await Promise.all(codes.slice(start,start+3).map(async code=>{
   const metrics:StockData['metrics']={};let name=sampleStocks.find(s=>s.code===code)?.name??code;
   if(val){const item=(Array.isArray(val.data.item)?val.data.item as Record<string,unknown>[]:[]).find(x=>x.thscode===code);if(typeof item?.name==='string')name=item.name;
    for(const field of valuationFields){const e=normalizeMetric(envelopeEvidence(code,field,field,item?.[field]??null,val,'/api/a-share/valuations/snapshot'));
     if(e.quality==='valid'&&!e.observedAt){e.quality='missing';e.reason='接口未提供有效数据时点。';}
     if(e.observedAt&&dates.length&&new Date(e.observedAt).getTime()<dates.at(-3)!){e.quality='stale';e.reason='估值上游元数据时点早于最近三个交易日，无法验证当前筛选。';}
     metrics[field]=e;
    }
   }else for(const field of valuationFields)metrics[field]=errorEvidence(code,field,valError,report);
   const financialFields=fields.filter(f=>f==='net_profit_yoy'||f==='revenue_yoy');
   if(financialFields.length)try{
    const v=await fuyao('/api/a-share/financials/indicators',{thscode:code,report});
    if(v.data.thscode!==code||v.data.report!==report)throw new ServiceError('上游财报代码或报告期不一致。',502,'FINANCIAL_PERIOD_MISMATCH');
    const items=(Array.isArray(v.data.abilities)?v.data.abilities as {indicators?:Record<string,unknown>[]}[]:[]).flatMap(x=>Array.isArray(x.indicators)?x.indicators:[]);
    for(const f of financialFields){const raw=f==='net_profit_yoy'?'calculate_parent_holder_net_profit_yoy_growth_ratio':'calculate_operating_income_yoy_growth_ratio';const item=items.find(x=>x.index_id===raw);const ev=normalizeMetric(envelopeEvidence(code,f,raw,item?.value??null,v,'/api/a-share/financials/indicators',report),true);ev.reason=ev.reason??'接口提供所选报告期累计同比，净利润采用归母口径；未提供公告日，不能用于历史时点回测。';metrics[f]=ev;}
   }catch(e){if(e instanceof ServiceError&&/2001|2003/.test(e.code))throw e;for(const f of financialFields)metrics[f]=errorEvidence(code,f,e,report);}
   if(fields.includes('volatility_60d'))try{
    const v=await fuyao('/api/a-share/prices/historical',{thscode:code,interval:'1d',start:String(dates.at(-90)??dates[0]),end:String(Date.now()),adjust:'forward'});
    const bars=(Array.isArray(v.data.item)?v.data.item as {date_ms:unknown;close_price:unknown}[]:[]).filter(b=>Number(b.date_ms)<=dates.at(-1)!);
    const calc=volatility(bars,dates);
    metrics.volatility_60d={...envelopeEvidence(code,'volatility_60d','item[].date_ms, item[].close_price',bars,v,'/api/a-share/prices/historical'),value:calc.value,quality:calc.value===null?'missing':'valid',reason:calc.reason,calculation:'前复权收盘价简单收益率样本标准差 × √252；60个交易日收益率，61个相邻价格点',sampleCount:calc.sampleCount,windowStart:calc.windowStart,windowEnd:calc.windowEnd};
   }catch(e){if(e instanceof ServiceError&&/2001|2003/.test(e.code))throw e;metrics.volatility_60d=errorEvidence(code,'volatility_60d',e,report);}
   return {code,name,metrics};
  }));rows.push(...part);
 }
 if(rows.every(s=>Object.values(s.metrics).every(e=>e.quality==='error')))throw new ServiceError('本批次所有数据请求失败，请重试；未使用演示数据替代。',502,'BATCH_FAILED');
 return rows;
}
