import {z} from 'zod';
import {fetchBatch} from '../../../lib/finance/provider';
import {body,protect,failure} from '../../../lib/server/runtime';
const schema=z.object({codes:z.array(z.string().regex(/^\d{6}\.(SH|SZ|BJ)$/)).min(1).max(12),fields:z.array(z.enum(['pe_ttm','pb_mrq','net_profit_yoy','revenue_yoy','volatility_60d'])).min(1).max(5),report:z.string().regex(/^20\d{2}-[1-4]$/)}).strict();
export async function POST(request:Request){try{protect(request,75);const input=schema.parse(await body(request));const stocks=await fetchBatch([...new Set(input.codes)],[...new Set(input.fields)],input.report);return Response.json({stocks,servedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
