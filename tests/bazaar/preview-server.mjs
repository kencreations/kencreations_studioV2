import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const server=await createServer({configFile:false,plugins:[{name:'bazaar-test-fixtures',enforce:'pre',resolveId(source){if(/services\/bazaarService(?:\.js)?$/.test(source))return path.resolve('tests/bazaar/fixtureService.js');}},react()],server:{host:'127.0.0.1',port:5192,strictPort:true}});
await server.listen();
console.log('Fixture preview: http://127.0.0.1:5192/tests/bazaar/preview.html#/bazaar/e/ev_fixture');
