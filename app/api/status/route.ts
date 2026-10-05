import {setting} from '../../../lib/server/runtime';
export async function GET(){return Response.json({dataConfigured:!!await setting('FUYAO_API_KEY'),aiConfigured:!!await setting('DEEPSEEK_API_KEY'),model:await setting('DEEPSEEK_MODEL')||'deepseek-flash',provider:'同花顺扶摇',scope:['沪深300','12只研究样本']},{headers:{'Cache-Control':'no-store'}});}
