// Deterministic browser fixtures. This module is only aliased by preview-server.mjs.
import { publicClickerOptions } from '../../src/engine/bazaar/configuration.js';
const product = {
    id:'clicker',productId:'clicker',shopId:'shop_fixture',name:'Personalized Clicker',category:'clicker',type:'made_to_order',isPublished:true,price:100,retailPrice:100,maxOrderQty:5,
    customizationOptions:{available_slots:[2,4,6],allowed_characters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',colors:[{id:'pink',name:'Pink',hex:'#f9a8d4'},{id:'purple',name:'Purple',hex:'#c4b5fd'},{id:'yellow',name:'Yellow',hex:'#fde047'},{id:'blue',name:'Blue',hex:'#7dd3fc'}],base_colors:[{id:'black',name:'Black',hex:'#1e293b'},{id:'white',name:'White',hex:'#f1f5f9'}],casing_styles:[{id:'standard',name:'Standard'}],switches:[{consumableId:'mx',name:'Mechanical switch',extraPrice:3}],keycap_styles:[{id:'rounded',name:'Rounded',extraPrice:0}],add_ons:[{id:'ring',name:'Keyring',price:5}],slot_pricing:{2:0,4:20,6:40},icon_caps_enabled:true,available_icons:["heart",{id:"fixture-art",name:"Fixture artwork",imageUrl:"/icon.png",fulfillmentMode:"preprinted",inventorySku:"fixture_icon"}],base_included_letters:2,extra_per_letter_price:10},
};
product.customizationOptions = publicClickerOptions(product);
const shop={id:'shop_fixture',shopId:'shop_fixture',slug:'fixture-shop',name:'Fixture Maker',isPublished:true,cashEnabled:true};
const event={id:'ev_fixture',eventId:'ev_fixture',shopId:'shop_fixture',slug:'fixture-event',name:'Fixture Bazaar',isPublished:true,status:'Active',catalog:{clicker:{enabled:true,price_override:90}}};
export const getPublicShopBySlug=async()=>shop;
export const getPublicShopById=async()=>shop;
export const getPublicEvent=async()=>event;
export const getPublicEventBySlugOrId=async id=>{
    if(id==='denied')throw Object.assign(new Error('Fixture permission denial'),{code:'permission-denied'});
    if(id==='missing')return null;
    return event;
};
export const getPublicProducts=async()=>[product];
export const getPublicProduct=async()=>product;
export const getEventProducts=async()=>event.catalog;

export const getShopId = uid => `shop_${uid}`;
export const shopOrdersCol = () => { throw new Error("Seller collection access is not part of this browser fixture"); };
