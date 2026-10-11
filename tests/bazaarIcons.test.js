import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { normalizeIcon, safeIconUrl, iconComponents, validComponentKey } from '../src/engine/bazaar/icons.js';
import { canonicalClickerConfiguration, publicClickerOptions } from '../src/engine/bazaar/configuration.js';
import { decomposeProductBOM } from '../src/engine/bazaar/bom.js';
import { calculateItemPrice } from '../src/engine/bazaar/pricing.js';
import { validateIconHeader, sanitizeIconSvg, ICON_MAX_BYTES } from '../src/engine/bazaar/iconUpload.js';
globalThis.DOMParser=DOMParser; globalThis.XMLSerializer=XMLSerializer;
const icon={id:'cat-art',name:'Cat artwork',imageUrl:'https://assets.example.test/seller/cat.png',fulfillmentMode:'preprinted',inventorySku:'icon_stock_cat_v1',price:7};
const product={productId:'test',type:'made_to_order',retailPrice:100,customizationOptions:{available_slots:[1],allowed_characters:'A',colors:[{id:'pink',name:'Pink',extraPrice:999}],base_colors:[{id:'white',name:'White'}],icon_caps_enabled:true,available_icons:[icon],base_included_letters:1}};
const config={slots:1,casing_color:'white',slotsData:[{type:'icon',iconId:'cat-art',char:'Z',colorId:'forged',styleId:'forged',imageUrl:'https://evil.example/forged.png'}]};
test('legacy string icons resolve to the same labeled built-in symbol',()=>{
    assert.equal(normalizeIcon('heart').emoji,'❤️');assert.equal(normalizeIcon('gamepad').name,'Gaming');
    assert.equal(normalizeIcon('unknown').name,'unknown');
});
test('icon canonical snapshots strip letter choices and trust only seller artwork',()=>{
    const canonical=canonicalClickerConfiguration(product,config),slot=canonical.slotsData[0];
    for(const field of ['char','colorId','colorHex','colorName','styleId'])assert.equal(field in slot,false);
    assert.equal(slot.imageUrl,icon.imageUrl);assert.equal(slot.iconName,icon.name);
    assert.equal(calculateItemPrice({product,customization:config}).unitPrice,107);
    const bom=decomposeProductBOM({product,customization:canonical});
    assert.equal(bom[0].component_key,'icon_stock_cat_v1');
    assert.ok(bom.every(p=>!p.component_key.includes('forged')));
});
test('letter snapshots remove inactive icon metadata',()=>{
    const slot=canonicalClickerConfiguration(product,{...config,slotsData:[{type:'letter',isIcon:true,char:'A',colorId:'pink',iconId:'cat-art',imageUrl:icon.imageUrl}]}).slotsData[0];
    assert.equal(slot.type,'letter');assert.equal('iconId' in slot,false);assert.equal('imageUrl' in slot,false);
});
test('public artwork metadata excludes inventory and supplier/cost information',()=>{
    const visible=publicClickerOptions(product).available_icons[0];
    assert.equal(visible.imageUrl,icon.imageUrl);assert.equal('inventorySku' in visible,false);
    assert.equal('components' in visible,false);
});
test('artwork does not grant stock; configured production components are required',()=>{
    assert.throws(()=>iconComponents({...icon,fulfillmentMode:'artwork_only'}),/Artwork alone/);
    assert.throws(()=>iconComponents({...icon,inventorySku:'finished_undefined'}),/configure/);
    assert.deepEqual(iconComponents({...icon,fulfillmentMode:'made_to_order',components:[{component_key:'resin',required_qty:2}]}),[{component_key:'resin',required_qty:2}]);
    for(const key of [null,'finished_undefined','cap_null_pink','../other',''])assert.equal(validComponentKey(key),false);
    assert.throws(()=>decomposeProductBOM({product:{type:'ready_made'}}),/product ID/);
});
test('image URLs cannot execute scripts or embed Firestore base64 payloads',()=>{
    for(const url of ['javascript:alert(1)','data:image/png;base64,x','//evil.test/x','http://insecure.test/x','https://user:password@example.test/x'])assert.equal(safeIconUrl(url),'');
    assert.equal(safeIconUrl('/icons/cat.png'),'/icons/cat.png');
});
test('upload validator rejects oversized, empty and spoofed raster files',()=>{
    assert.throws(()=>validateIconHeader(new Uint8Array(ICON_MAX_BYTES+1),'image/png'),/2 MB/);
    assert.throws(()=>validateIconHeader(new Uint8Array(),'image/png'),/2 MB/);
    assert.throws(()=>validateIconHeader(new TextEncoder().encode('<script>bad</script>'),'image/png'),/contents/);
    validateIconHeader(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png');
});
test('SVG rejects scripts, event handlers, embedded content and external resources',()=>{
    assert.match(sanitizeIconSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0L10 10" fill="#000"/></svg>'),/<path/);
    for(const markup of ['<script>alert(1)</script>','<foreignObject/>','<image href="https://evil.test/x"/>','<path onload="alert(1)"/>','<path style="fill:red"/>','<path fill="url(https://evil.test/x)"/>'])assert.throws(()=>sanitizeIconSvg(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`));
    assert.throws(()=>sanitizeIconSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg/>'),/entities/);
});
