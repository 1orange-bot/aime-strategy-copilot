export class ServiceError extends Error { status:number; code:string; constructor(message:string,status=502,code='SERVICE_ERROR'){super(message);this.status=status;this.code=code;} }
export async function setting(name:string){
 try{const {env}=await import('cloudflare:workers');const value=(env as Record<string,unknown>)[name];if(typeof value==='string')return value;}catch{}
 return process.env[name]??'';
}
const counts=new Map<string,{n:number;start:number}>();
export function protect(request:Request,limit=75){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ServiceError('请从本网站发起请求。',403,'ORIGIN_REJECTED');
 const ip=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]??'local';
 const key=`${ip}:${new URL(request.url).pathname}`;const now=Date.now();const c=counts.get(key);
 if(!c||now-c.start>60000)counts.set(key,{n:1,start:now});
 else if(++c.n>limit)throw new ServiceError('请求过于频繁，请稍后再试。',429,'RATE_LIMITED');
 if(counts.size>5000)for(const [k,v] of counts)if(now-v.start>60000)counts.delete(k);
}
export async function body(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ServiceError('请求格式必须为JSON。',415,'INVALID_BODY');
 if(Number(request.headers.get('content-length')??0)>16000)throw new ServiceError('输入内容过长。',413,'INPUT_TOO_LONG');
 const reader=request.body?.getReader();if(!reader)throw new ServiceError('请求内容为空。',400,'INVALID_BODY');
 const chunks:Uint8Array[]=[];let length=0;
 for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>16000){await reader.cancel();throw new ServiceError('输入内容过长。',413,'INPUT_TOO_LONG');}chunks.push(value);}
 const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}const text=new TextDecoder().decode(data);
 try{return JSON.parse(text);}catch{throw new ServiceError('请求内容无法解析。',400,'INVALID_BODY');}
}
export function failure(e:unknown){
 const requestId=crypto.randomUUID();
 if(e instanceof ServiceError)return Response.json({error:e.message,code:e.code,requestId},{status:e.status,headers:{'Cache-Control':'no-store'}});
 return Response.json({error:'当前请求无法完成，请检查条件或稍后重试。',code:'INVALID_REQUEST',requestId},{status:400,headers:{'Cache-Control':'no-store'}});
}
