import {z} from 'zod';
import {fetchBatch} from '../../../lib/finance/provider.ts';
import {availableReports} from '../../../lib/strategy/schema.ts';
import {body,protect,failure,ServiceError} from '../../../lib/server/runtime.ts';
const schema=z.object({codes:z.array(z.string().regex(/^\d{6}\.(SH|SZ|BJ)$/)).min(1).max(12),fields:z.array(z.enum(['pe_ttm','pb_mrq','net_profit_yoy','revenue_yoy','volatility_60d'])).min(1).max(5),report:z.string().regex(/^20\d{2}-[1-4]$/)}).strict();
export async function POST(request:Request){try{protect(request,75);const input=schema.parse(await body(request));if(!availableReports().includes(input.report))throw new ServiceError('报告期不在可选范围，请重新选择可用报告期。',422,'REPORT_UNAVAILABLE');const stocks=await fetchBatch([...new Set(input.codes)],[...new Set(input.fields)],input.report);return Response.json({stocks,servedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
