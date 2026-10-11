import { useEffect, useState } from 'react';
import { checkoutAvailability } from '../../services/orderSubmissionService.js';
import { listSellerIcons, updateSellerIcon, uploadSellerIcon } from '../../services/bazaarIconService.js';
import { prepareIconUpload } from '../../engine/bazaar/iconUpload.js';
import { normalizeIcon, validComponentKey } from '../../engine/bazaar/icons.js';
import IconArtwork from './IconArtwork';

export default function SellerIconLibrary({ selected, onChange }) {
    const [icons,setIcons] = useState([]), [query,setQuery] = useState(''), [error,setError] = useState('');
    const [busy,setBusy] = useState(false), [image,setImage] = useState(null), [name,setName] = useState('');
    const [revision,setRevision] = useState(0), [draft,setDraft] = useState(null);
    const availability = checkoutAvailability();
    useEffect(() => {
        if (!availability.available) return;
        let active = true;
        listSellerIcons().then(data => { if(active) setIcons(data.icons || []); }).catch(e => {if(active) setError(e.message);});
        return () => {active=false;};
    },[availability.available,revision]);
    useEffect(() => () => { if(image?.url) URL.revokeObjectURL(image.url); },[image]);
    async function choose(event) {
        const file = event.target.files?.[0]; event.target.value=''; if(!file) return;
        setBusy(true); setError(''); setImage(null);
        try { const result=await prepareIconUpload(file); setImage({...result,url:URL.createObjectURL(result.blob)}); setName(file.name.replace(/\.[^.]+$/,'')); }
        catch(e) { setError(e.message); } finally {setBusy(false);}
    }
    async function upload() {
        setBusy(true); setError('');
        try { await uploadSellerIcon(image,name); setImage(null); setName(''); setRevision(v=>v+1); }
        catch(e){setError(e.message);} finally{setBusy(false);}
    }
    async function save(changes) {
        setBusy(true); setError('');
        try {
            await updateSellerIcon(draft.id,changes);
            onChange(selected.map(normalizeIcon).filter(i=>!changes.archived || i.id!==draft.id).map(i=>i.id===draft.id?{...i,...changes}:i));
            setDraft(null); setRevision(v=>v+1);
        } catch(e){setError(e.message);} finally{setBusy(false);}
    }
    const selectedIds = selected.map(i=>typeof i==='string'?i:i.id);
    return <section className="space-y-3 border-t pt-3">
        <h4 className="font-bold">Your icon artwork library</h4>
        {!availability.available && <p role="status" className="text-xs text-amber-800">Shared uploads are not configured. You can check a file locally below. It is not saved or made available to customers.</p>}
        <p className="text-xs text-gray-600">PNG, WebP or SVG, up to 2 MB and 2048 pixels. SVG is converted to PNG. Artwork does not create physical stock.</p>
        <input aria-label="Choose icon artwork" type="file" accept="image/png,image/webp,image/svg+xml" disabled={busy} onChange={choose} />
        {image && <div className="flex gap-3 items-center"><img className="w-16 h-16 object-contain" src={image.url} alt="Local artwork preview" /><input aria-label="New icon name" maxLength={80} value={name} onChange={e=>setName(e.target.value)} /><button type="button" disabled={!availability.available || busy || !name.trim()} onClick={upload}>Save to library</button></div>}
        {error && <p role="alert" className="text-red-700 text-xs">{error}</p>}
        <input aria-label="Search icon library" placeholder="Search your icons" value={query} onChange={e=>setQuery(e.target.value)} className="border rounded p-2 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{icons.filter(i=>!i.archived && i.name.toLowerCase().includes(query.toLowerCase())).map(icon=><div key={icon.id} className="border rounded p-2">
            <IconArtwork icon={icon} /><p>{icon.name}</p>
            <label className="text-xs"><input type="checkbox" checked={selectedIds.includes(icon.id)} disabled={icon.fulfillmentMode==='artwork_only' || !icon.fulfillmentMode || (icon.fulfillmentMode==='made_to_order' && !icon.components?.length)} onChange={e=>onChange(e.target.checked?[...selected,{...icon,libraryId:icon.id}]:selected.filter(i=>(typeof i==='string'?i:i.id)!==icon.id))} /> Enable for this product</label>
            <button type="button" onClick={()=>setDraft({...icon})} className="block text-xs text-teal-700">Rename / fulfillment / archive</button>
        </div>)}</div>
        {availability.available && icons.length===0 && <p className="text-xs">No saved icons yet.</p>}
        {draft && <div className="border p-3 rounded space-y-2">
            <input aria-label="Icon name" value={draft.name} maxLength={80} onChange={e=>setDraft({...draft,name:e.target.value})} />
            <select aria-label="Icon fulfillment" value={draft.fulfillmentMode || 'artwork_only'} onChange={e=>setDraft({...draft,fulfillmentMode:e.target.value})}><option value="artwork_only">Artwork only — unavailable to customers</option><option value="preprinted">Preprinted — existing inventory SKU</option><option value="made_to_order">Made to order — configured materials</option></select>
            {draft.fulfillmentMode==='preprinted' && <input aria-label="Existing icon inventory SKU" value={draft.inventorySku || ''} onChange={e=>setDraft({...draft,inventorySku:e.target.value})} />}
            {draft.fulfillmentMode==='made_to_order' && <div className="space-y-2">
                <p className="text-xs">Required material quantities per icon. Use existing inventory SKUs; the backend must verify every reference.</p>
                {(draft.components || []).map((component,index)=><div key={index} className="flex gap-2">
                    <input aria-label={`Material ${index+1} SKU`} value={component.component_key} onChange={e=>setDraft({...draft,components:draft.components.map((c,i)=>i===index?{...c,component_key:e.target.value}:c)})} />
                    <input aria-label={`Material ${index+1} quantity`} type="number" min="1" step="1" value={component.required_qty} onChange={e=>setDraft({...draft,components:draft.components.map((c,i)=>i===index?{...c,required_qty:Number(e.target.value)}:c)})} />
                    <button type="button" onClick={()=>setDraft({...draft,components:draft.components.filter((_,i)=>i!==index)})}>Remove</button>
                </div>)}
                <button type="button" onClick={()=>setDraft({...draft,components:[...(draft.components || []),{component_key:'',required_qty:1}]})}>Add material</button>
            </div>}
            <button type="button" disabled={busy || !draft.name.trim() || (draft.fulfillmentMode==='preprinted' && !validComponentKey(draft.inventorySku))} onClick={()=>save({name:draft.name.trim(),fulfillmentMode:draft.fulfillmentMode || 'artwork_only',inventorySku:draft.fulfillmentMode==='preprinted'?draft.inventorySku:null,components:draft.fulfillmentMode==='made_to_order'?(draft.components || []):[]})}>Save details</button>
            <button type="button" disabled={busy} onClick={()=>save({archived:true})}>Archive icon</button><button type="button" onClick={()=>setDraft(null)}>Close</button>
        </div>}
    </section>;
}
