import { useCallback, useRef, useState } from 'react';
import { Package, Ruler, Type, Link } from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import EditorCanvas from '../components/EditorCanvas';
import PrinterSelector from '../components/PrinterSelector';
import TemplateManager from '../components/TemplateManager';
import { HistoryControls } from '../components/HistoryControls';
import { useHistoryState } from '../hooks/useHistoryState';
import { useFontStore } from '../hooks/useFontStore';
import { SidebarSection, ControlSlider, ControlSelect, ControlToggle, ControlInput } from '../components/UI/EditorControls';
import InhalerPodMesh from '../components/3D/InhalerPodMesh';
import { POD_DEFAULTS, POD_LIMITS, podConfig } from '../data/inhalerPodDefaults';
import { podDimensions } from '../utils/inhalerPodGeometry';

export default function KatinkoInhalerPodEditor() {
    const [config,setConfig,history]=useHistoryState(POD_DEFAULTS);
    const update=patch=>setConfig(prev=>podConfig({...prev,...patch}));
    const model=useRef(),{allFonts}=useFontStore();
    const [status,setStatus]=useState({loading:true,error:''});
    const receiveStatus=useCallback(value=>setStatus(value),[]);
    const c=podConfig(config),d=podDimensions(c);
    const slider=(key,label,step=0.1)=><ControlSlider key={key} label={label} value={c[key]} min={POD_LIMITS[key][0]} max={POD_LIMITS[key][1]} step={step} unit="mm" onChange={value=>update({[key]:value})}/>;
    const colors=['body','cap','loop','text'];
    return <EditorLayout title="Katinko Inhaler Pod" stackedHeader
        topBarActions={<HistoryControls {...history} onUndo={history.undo} onRedo={history.redo} onReset={history.reset}/>}
        sidebarContent={<>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 mb-4">
                <strong>Provisional prototype — not physically verified</strong>
                <p className="mt-1">16 × 65 mm is an editable placeholder, not a measured Katinko size. Original closure remains intact. Pickup socket is disabled: remove the outer cap, then lift the inhaler out by hand.</p>
            </div>
            <PrinterSelector/>
            <TemplateManager editorId="katinko-inhaler-pod" currentSettings={c} onLoadTemplate={tpl=>setConfig(podConfig(tpl))}/>
            <SidebarSection title="Make" icon={Package}>
                <ControlSelect label="Export parts" value={c.printMode} onChange={v=>update({printMode:v})} options={[
                    {value:'kit',label:'Full kit — 3 parts'},{value:'body',label:'Body only'},{value:'cap',label:'Cap only'},
                    {value:'loop',label:'Loop only'},{value:'fitTest',label:'Fit test — short neck, cap and loop'},
                ]}/>
                <ControlToggle label="Show provisional inhaler envelope" checked={c.showReference} onChange={v=>update({showReference:v})}/>
                <p className="text-xs text-gray-500">The translucent envelope is never exported. Assembled/Exploded changes preview only.</p>
            </SidebarSection>
            <SidebarSection title="Provisional dimensions" icon={Ruler}>
                <p className="text-xs text-gray-500">No verified product presets yet. Measure the complete inhaler with its original cap installed.</p>
                {slider('diameter','Capped inhaler maximum diameter',0.5)}{slider('length','Capped inhaler overall length',0.5)}
                {slider('exposure','Exposed gripping length',0.5)}{slider('fitClearance','Radial cavity clearance',0.05)}
                {slider('axialClearance','Top clearance',0.1)}{slider('wall','Neck and cap wall')}{slider('floor','Bottom / cap roof thickness')}
                {slider('threadLength','Thread pitch / engagement length')}{slider('threadClearance','Radial thread clearance',0.05)}
                <p className="text-xs text-gray-500">Body height: {d.bodyHeight.toFixed(1)} mm · Closed height: {d.capSeat.toFixed(1)} mm. Single-start right-hand threads; prototype fit only.</p>
            </SidebarSection>
            <SidebarSection title="Independent loop retention" icon={Link}>
                {slider('loopClearance','Arm-to-groove clearance',0.05)}{slider('armThickness','Flexible arm radial thickness')}{slider('holeDiameter','Keychain hole diameter')}
                <p className="text-xs text-amber-800">Three internal spring arms pass the lead-in bead and engage the body groove. The outer ring stays closed. Flex, fatigue and pull-off strength are UNTESTED. Print the short fit kit first; do not rely on this prototype to secure valuables.</p>
                <p className="text-xs text-gray-500">Assembly: insert capped inhaler → push loop down until seated → screw on outer cap. Pickup disabled; opening does not automatically withdraw the inhaler.</p>
            </SidebarSection>
            <SidebarSection title="Personalization" icon={Type}>
                <ControlToggle label="Personalize cap" checked={c.personalized} onChange={v=>update({personalized:v})}/>
                {c.personalized&&<>
                    <ControlInput label="Name" value={c.text} onChange={e=>update({text:e.target.value})}/>
                    <ControlSelect label="Font" value={c.font} onChange={v=>update({font:v})} options={allFonts.map(f=>({value:f.id,label:f.label}))}/>
                    <ControlSelect label="Text style" value={c.textStyle} onChange={v=>update({textStyle:v})} options={[{value:'engraved',label:'Engraved'},{value:'embossed',label:'Embossed'}]}/>
                    {slider('textDepth','Relief depth')}
                    <p className="text-xs text-gray-500">Auto-fit inside the flat cap top. Engraving leaves at least 0.8 mm of roof. Raised text may require supports in the print layout.</p>
                </>}
            </SidebarSection>
            <SidebarSection title="Colors"><div className="grid grid-cols-2 gap-3">{colors.map(part=><label key={part} className="text-xs capitalize">{part}<input aria-label={`${part} color`} type="color" value={c[part+'Color']} onChange={e=>update({[part+'Color']:e.target.value})} className="block w-full h-8 rounded"/></label>)}</div>
                <p className="text-xs text-gray-500">3MF retains surface colors; STL is geometry only. Engraved text color is a surface assignment, not a separate inlay.</p>
            </SidebarSection>
        </>}>
        <EditorCanvas title="Katinko Inhaler Pod" cameraPosition={[140,130,230]} cameraTarget={[0,65,0]}
            getCustomExportScene={()=>{if(status.loading||status.error||!model.current)throw new Error(status.error||'Pod geometry is loading.');return model.current.getPrintScene();}}
            leftToolbarActions={<div className="flex gap-1 rounded-xl bg-white p-1 border border-teal-200">{['assembled','exploded'].map(mode=><button key={mode} aria-pressed={c.viewMode===mode} onClick={()=>update({viewMode:mode})} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${c.viewMode===mode?'bg-teal-600 text-white':'text-gray-600'}`}>{mode}</button>)}</div>}>
            <InhalerPodMesh ref={model} config={c} onStatus={receiveStatus}/>
        </EditorCanvas>
        <div role="status" className="absolute top-4 left-4 max-w-xs rounded-xl bg-white/90 p-3 text-xs shadow pointer-events-none">
            {status.error?<span className="text-red-700">{status.error}</span>:status.loading?'Building printable geometry…':'Provisional dimensions · Pickup disabled · No physical fit validation'}
        </div>
    </EditorLayout>;
}
