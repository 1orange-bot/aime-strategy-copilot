import { StrategySchema,registry,formatValue,formatCondition } from './schema.ts';
import type { Strategy,Condition,Snapshot,Status,StockResult,Indicator } from './schema.ts';

export function matches(value:number,c:Condition){
 const v=c.value as number;
 switch(c.operator){case '>':return value>v;case '>=':return value>=v;case '<':return value<v;case '<=':return value<=v;case '=':return value===v;case 'between':return Array.isArray(c.value)&&value>=c.value[0]&&value<=c.value[1];}
}
export function conflicts(strategy:Strategy){
 const errors:string[]=[];
 for(const field of Object.keys(registry) as Indicator[]){
  const cs=strategy.conditions.filter(c=>c.field===field);
  let lo=-Infinity,hi=Infinity,loOpen=false,hiOpen=false;
  const lower=(v:number,open:boolean)=>{if(v>lo){lo=v;loOpen=open;}else if(v===lo)loOpen ||=open;};
  const upper=(v:number,open:boolean)=>{if(v<hi){hi=v;hiOpen=open;}else if(v===hi)hiOpen ||=open;};
  if(field==='pe_ttm'||field==='pb_mrq')lower(0,true);
  if(field==='volatility_60d')lower(0,false);
  for(const c of cs){const v=c.value as number;switch(c.operator){case '>':lower(v,true);break;case '>=':lower(v,false);break;case '<':upper(v,true);break;case '<=':upper(v,false);break;case '=':lower(v,false);upper(v,false);break;case 'between':if(Array.isArray(c.value)){lower(c.value[0],false);upper(c.value[1],false);}break;}}
  if(cs.length&&(lo>hi||(lo===hi&&(loOpen||hiOpen))))errors.push(`${registry[field].name} 条件没有有效交集，请修改阈值或运算符。`);
 }
 return errors;
}
export function screen(input:Strategy,snapshot:Snapshot):StockResult[]{
 const s=StrategySchema.parse(input);
 const errs=conflicts(s);
 if(errs.length||s.unresolved.length)throw new Error([...errs,...s.unresolved].join('；'));
 if(s.report!==snapshot.report)throw new Error('财务报告期与快照不一致，需要重新获取数据。');
 if((s.universe==='csi300'?'沪深300':'12只研究样本')!==snapshot.universe)throw new Error('股票池与快照不一致，需要重新获取数据。');
 return snapshot.stocks.map(stock=>{
  const checks=s.conditions.map(condition=>{
   const evidence=stock.metrics[condition.field]??null;
   let status:Status='unknown';let reason=evidence?.reason??'当前快照未获取此指标，请重新获取数据。';
   if(evidence?.quality==='valid'&&evidence.value!==null&&Number.isFinite(evidence.value)){
    if((condition.field==='pe_ttm'||condition.field==='pb_mrq')&&evidence.value<=0)reason='非正估值指标不适用于常规低估值判断。';
    else {status=matches(evidence.value,condition)?'pass':'fail';reason=`${formatValue(condition.field,evidence.value)} ${status==='pass'?'满足':'不满足'} ${formatCondition(condition)}`;}
   }
   return {condition,status,evidence,reason};
  });
  const status:Status=checks.some(c=>c.status==='fail')?'fail':checks.every(c=>c.status==='pass')?'pass':'unknown';
  return {...stock,status,checks};
 });
}
export function missingSnapshotFields(strategy:Strategy,snapshot:Snapshot){
 return [...new Set(strategy.conditions.map(c=>c.field))].filter(field=>snapshot.stocks.some(stock=>!stock.metrics[field]));
}
function requireSnapshotFields(strategy:Strategy,snapshot:Snapshot){
 const fields=missingSnapshotFields(strategy,snapshot);
 if(fields.length)throw new Error(`当前快照未获取 ${fields.map(f=>registry[f].name).join('、')}，请重新获取数据后生成新结论。`);
}
export function compareStrategies(before:Strategy,after:Strategy,snapshot:Snapshot){
 requireSnapshotFields(before,snapshot);requireSnapshotFields(after,snapshot);
 const a=screen(before,snapshot).filter(s=>s.status==='pass').map(s=>s.code);
 const afterRows=screen(after,snapshot),b=afterRows.filter(s=>s.status==='pass').map(s=>s.code);
 return {snapshotId:snapshot.id,before:a.length,after:b.length,added:b.filter(x=>!a.includes(x)),removed:afterRows.filter(x=>x.status==='fail'&&a.includes(x.code)).map(x=>x.code),pending:afterRows.filter(x=>x.status==='unknown'&&a.includes(x.code)).map(x=>x.code),retained:b.filter(x=>a.includes(x))};
}
export function conditionImpact(strategy:Strategy,snapshot:Snapshot){
 requireSnapshotFields(strategy,snapshot);
 const results=screen(strategy,snapshot);const current=results.filter(x=>x.status==='pass').length;
 return strategy.conditions.map(c=>({id:c.id,failed:results.filter(x=>x.checks.find(k=>k.condition.id===c.id)?.status==='fail').length,unknown:results.filter(x=>x.checks.find(k=>k.condition.id===c.id)?.status==='unknown').length,addedIfRemoved:strategy.conditions.length>1?screen({...strategy,conditions:strategy.conditions.filter(x=>x.id!==c.id)},snapshot).filter(x=>x.status==='pass').length-current:null}));
}
