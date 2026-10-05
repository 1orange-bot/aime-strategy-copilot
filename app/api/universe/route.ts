import { z } from 'zod';
import {universe} from '../../../lib/finance/provider';
import {protect,failure} from '../../../lib/server/runtime';
export async function GET(request:Request){try{protect(request,15);const kind=z.enum(['csi300','sample']).parse(new URL(request.url).searchParams.get('kind'));return Response.json(await universe(kind),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
