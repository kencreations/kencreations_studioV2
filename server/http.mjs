import http from 'node:http';
import {submitOrder,transitionOrder,allocateStock,adjustStock,reconcileOrder,listOrders} from '../src/engine/bazaar/orderWorkflow.js';
import {activateLicenseInStore} from '../src/engine/licensing/licenseWorkflow.js';

// Explicitly injected trusted identity verification. Never infer a UID from JSON.
export function createBazaarServer({store,verifyIdentity,allowedOrigins=[]}) {
    const buckets=new Map();
    return http.createServer(async(request,response)=>{
        response.setHeader('Content-Type','application/json');
        response.setHeader('Cache-Control','no-store');
        response.setHeader('X-Content-Type-Options','nosniff');
        const origin=request.headers.origin;
        if(origin && !allowedOrigins.includes(origin)){response.writeHead(403).end(JSON.stringify({message:'Origin not allowed.'}));return;}
        if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
        response.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
        response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        if(request.method==='OPTIONS'){response.writeHead(204).end();return;}
        try {
            if(request.method==='GET' && request.url==='/health') {
                await store.transaction(tx=>tx.get('service_health/bazaar'));
                response.end(JSON.stringify({ready:true}));return;
            }
            if(request.method!=='POST' || !['/submit','/transition','/allocate','/adjust','/reconcile','/orders','/activate-license'].includes(request.url)) {response.writeHead(404).end(JSON.stringify({message:'Unknown operation.'}));return;}
            const ip=request.socket.remoteAddress, now=Date.now();
            for(const [key,bucket] of buckets)if(bucket.until<=now)buckets.delete(key);
            const bucket=buckets.get(ip) || {count:0,until:now+60000};bucket.count++;buckets.set(ip,bucket);
            if(bucket.count>120){response.writeHead(429).end(JSON.stringify({message:'Too many requests. Please wait a moment.'}));return;}
            if(!request.headers['content-type']?.startsWith('application/json'))throw new Error('JSON request required.');
            let size=0;const chunks=[];
            for await(const chunk of request){size+=chunk.length;if(size>65536)throw new Error('Request exceeds size limit.');chunks.push(chunk);}
            const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if(!payload || Array.isArray(payload) || typeof payload!=='object')throw new Error('Invalid request.');
            let result;
            if(request.url==='/submit')result=await submitOrder(store,payload);
            else {
                const header=request.headers.authorization;
                if(!header?.startsWith('Bearer ')){response.writeHead(401).end(JSON.stringify({message:'Authentication required.'}));return;}
                let identity;
                try {identity=await verifyIdentity(header.slice(7));}catch {response.writeHead(401).end(JSON.stringify({message:'Authentication expired. Sign in again.'}));return;}
                if(!identity?.uid)throw new Error('Authentication required.');
                if(request.url==='/activate-license') {
                    result=await activateLicenseInStore(store,identity.uid,payload);
                } else {
                    result=await ({'/transition':transitionOrder,'/allocate':allocateStock,'/adjust':adjustStock,'/reconcile':reconcileOrder,'/orders':listOrders}[request.url])(store,identity.uid,payload);
                }
            }
            response.end(JSON.stringify(result));
        } catch(error) {
            const internal=error.code && !['validation-failed'].includes(error.code);
            response.writeHead(internal?503:400).end(JSON.stringify({code:internal?'service-unavailable':'validation-failed',message:internal?'Ordering is temporarily unavailable. Please retry this same cart.':error instanceof SyntaxError?'Invalid request.':error.message}));
        }
    });
}
