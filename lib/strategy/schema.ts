import { z } from 'zod';

export const registry = {
  pe_ttm: { name: '市盈率 PE · TTM', unit: '倍', percent: false, period: '最近12个月', hint: '仅对正市盈率采用常规估值比较；阈值不代表公允价值。' },
  pb_mrq: { name: '市净率 PB · MRQ', unit: '倍', percent: false, period: '最近报告期', hint: '负净资产时不适用；跨行业比较需谨慎。' },
  net_profit_yoy: { name: '归母净利润同比增长率', unit: '%', percent: true, period: '所选财报累计同比', hint: '采用归属于母公司股东的净利润同比；经营改善的代理，可能受低基数或非经常性损益影响。' },
  revenue_yoy: { name: '营业收入同比增长率', unit: '%', percent: true, period: '所选财报累计同比', hint: '所选报告期累计营收同比；营收增长不等于盈利增长。' },
  volatility_60d: { name: '60日年化波动率', unit: '%', percent: true, period: '60个交易日', hint: '前复权收盘价简单收益率样本标准差 × √252；历史低波动不保证未来安全。' },
} as const;
export type Indicator = keyof typeof registry;
export const ConditionSchema = z.object({
  id: z.string().min(1).max(60),
  concept: z.string().min(1).max(80),
  field: z.enum(['pe_ttm','pb_mrq','net_profit_yoy','revenue_yoy','volatility_60d']),
  operator: z.enum(['>','>=','<','<=','=','between']),
  value: z.union([z.number().finite(),z.tuple([z.number().finite(),z.number().finite()])]),
  assumption: z.boolean(),
}).strict().superRefine((c,ctx)=>{
  if ((c.operator==='between')!==Array.isArray(c.value)) ctx.addIssue({code:'custom',message:'区间条件必须使用两个数值，其他运算使用单值'});
  if (Array.isArray(c.value) && c.value[0]>c.value[1]) ctx.addIssue({code:'custom',message:'区间下限不能高于上限'});
  const values=Array.isArray(c.value)?c.value:[c.value];
  if(values.some(v=>Math.abs(v)>100000)) ctx.addIssue({code:'custom',message:'数值超过可验证范围'});
});
export const StrategySchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(60),
  originalQuery: z.string().max(2000),
  universe: z.enum(['csi300','sample']),
  report: z.string().regex(/^20\d{2}-[1-4]$/),
  conditions: z.array(ConditionSchema).max(10),
  assumptions: z.array(z.string().max(250)).max(10),
  unresolved: z.array(z.string().max(250)).max(10),
}).strict().superRefine((s,ctx)=>{
  if(!s.conditions.length&&!s.unresolved.length)ctx.addIssue({code:'custom',message:'至少需要一个有效条件，或明确列出待澄清诉求'});
  if(new Set(s.conditions.map(c=>c.id)).size!==s.conditions.length)ctx.addIssue({code:'custom',message:'条件标识重复'});
});
export type Condition=z.infer<typeof ConditionSchema>;
export type Strategy=z.infer<typeof StrategySchema>;
export type Evidence={
  id:string; field:Indicator; rawField:string; rawValue:unknown; value:number|null;
  unit:string; source:string; endpoint:string; observedAt:string|null; fetchedAt:string;
  reportPeriod?:string; publishedAt?:string|null; requestId:string|null;
  quality:'valid'|'missing'|'invalid'|'stale'|'error'; reason?:string;
  calculation?:string; sampleCount?:number; windowStart?:string; windowEnd?:string;
};
export type StockData={code:string;name:string;metrics:Partial<Record<Indicator,Evidence>>};
export type Snapshot={id:string;mode:'real'|'mock';createdAt:string;universe:string;universeCount:number;stocks:StockData[];warnings:string[];report:string;universeEvidence?:{observedAt:string|null;requestId:string|null}};
export type Status='pass'|'fail'|'unknown';
export type StockResult=StockData&{status:Status;checks:{condition:Condition;status:Status;evidence:Evidence|null;reason:string}[]};
export const sampleStocks=[
 {code:'600519.SH',name:'贵州茅台'},{code:'000858.SZ',name:'五粮液'},
 {code:'600036.SH',name:'招商银行'},{code:'601318.SH',name:'中国平安'},
 {code:'300750.SZ',name:'宁德时代'},{code:'002594.SZ',name:'比亚迪'},
 {code:'000333.SZ',name:'美的集团'},{code:'600900.SH',name:'长江电力'},
 {code:'601899.SH',name:'紫金矿业'},{code:'600030.SH',name:'中信证券'},
 {code:'000651.SZ',name:'格力电器'},{code:'600276.SH',name:'恒瑞医药'},
];
export function defaultReport(now=new Date()){const y=now.getUTCFullYear();const m=now.getUTCMonth()+1;return m>=11?`${y}-3`:m>=9?`${y}-2`:m>=5?`${y}-1`:`${y-1}-3`;}
export function initialStrategy():Strategy{return {version:1,name:'经营改善与历史稳定性',originalQuery:'',universe:'csi300',report:defaultReport(),conditions:[
 {id:'profit',concept:'经营改善的代理指标',field:'net_profit_yoy',operator:'>',value:0,assumption:true},
 {id:'pe',concept:'估值合理的代理指标',field:'pe_ttm',operator:'<',value:30,assumption:true},
 {id:'vol',concept:'历史走势稳定',field:'volatility_60d',operator:'<',value:.25,assumption:true},
],assumptions:['净利润同比为正作为经营改善的代理。','PE仅对正值适用；30倍为可修改默认上限。','年化波动率25%为历史稳定性的默认阈值。'],unresolved:[]};}
export function formatValue(field:Indicator,value:number|null){if(value===null||!Number.isFinite(value))return '—';return `${(registry[field].percent?value*100:value).toLocaleString('zh-CN',{maximumFractionDigits:2})}${registry[field].unit}`;}
export function formatCondition(c:Condition){return c.operator==='between'&&Array.isArray(c.value)?`${formatValue(c.field,c.value[0])} 至 ${formatValue(c.field,c.value[1])}`:`${c.operator} ${formatValue(c.field,c.value as number)}`;}
