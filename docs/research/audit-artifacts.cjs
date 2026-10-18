// Static parsing only: supplied JavaScript is never evaluated.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const root = path.resolve('audit-artifacts/pixnprints-input');
const out = __dirname;
const files = fs.readdirSync(root, { recursive: true }).filter(p => fs.statSync(path.join(root,p)).isFile());
const names = new Set(files.map(p=>path.basename(p)));
const records = [];
function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  if(n.type) fn(n);
  for(const [k,v] of Object.entries(n)) if(k!=='loc') {
    if(Array.isArray(v)) v.forEach(x=>walk(x,fn));
    else if(v && typeof v==='object') walk(v,fn);
  }
}
for(const file of files) {
  const bytes=fs.readFileSync(path.join(root,file));
  const r={file:file.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),imports:[],exports:[]};
  if(file.endsWith('.js')) try {
    const ast=acorn.parse(bytes.toString(),{ecmaVersion:'latest',sourceType:'module',locations:true});
    walk(ast,n=>{
      if(n.type==='ImportDeclaration'||n.type==='ImportExpression'||(n.type.startsWith('Export')&&n.source)) {
        const source=n.source?.value;
        if(typeof source==='string')r.imports.push({source,line:n.loc.start.line,offset:n.start,symbols:(n.specifiers||[]).map(s=>({imported:s.imported?.name||s.imported?.value||s.type,local:s.local?.name})),present:names.has(path.basename(source))});
      }
      if(n.type==='ExportNamedDeclaration') for(const s of n.specifiers)r.exports.push({local:s.local?.name,exported:s.exported?.name});
      if(n.type==='ExportDefaultDeclaration')r.exports.push({exported:'default'});
    });
    r.parse='ok';
  } catch(e){r.parse=e.message;}
  records.push(r);
}
fs.writeFileSync(path.join(out,'artifact-index.json'),JSON.stringify(records,null,2));
let inv='# Supplied artifact inventory\n\nConfirmed: static byte inventory and SHA-256 hashes. Paths below are relative to `audit-artifacts/pixnprints-input/`. Originals remain in Downloads; extracted inputs are isolated from application source. No supplied code was executed.\n\n| File | Bytes | SHA-256 | AST parse |\n|---|---:|---|---|\n';
for(const r of records)inv+=`| ${r.file} | ${r.bytes} | ${r.sha256} | ${r.parse||'HTML; not JavaScript'} |\n`;
fs.writeFileSync(path.join(out,'file-inventory.md'),inv);
let dep='# Static dependency graph\n\nConfirmed: Acorn syntax analysis of every supplied JavaScript file. Import aliases, export aliases, line numbers and character offsets are preserved in [artifact-index.json](artifact-index.json). Presence matches basenames because the ZIP flattened its original directories; this does not prove deployment-path resolution. Dynamic computed imports and manifest string tables require additional interpretation. No runtime graph is claimed.\n\n';
for(const r of records){dep+=`## ${r.file}\n\nExports: ${r.exports.map(e=>`${e.local||''} → ${e.exported}`).join(', ')||'none found'}.\n\n`;for(const i of r.imports)dep+=`- ${i.source} — ${i.present?'basename present':'MISSING'}; line ${i.line}, offset ${i.offset}; ${i.symbols.map(s=>s.imported+' → '+s.local).join(', ')}\n`;dep+='\n';}
fs.writeFileSync(path.join(out,'dependency-graph.md'),dep);
console.log(JSON.stringify({files:records.length,parsed:records.filter(r=>r.parse==='ok').length,errors:records.filter(r=>r.parse&&r.parse!=='ok'),missing:[...new Set(records.flatMap(r=>r.imports.filter(i=>!i.present).map(i=>i.source)))]},null,2));
