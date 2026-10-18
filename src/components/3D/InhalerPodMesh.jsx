import { useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { initPodKernel, buildPod, podPlacement, podDimensions, podPrintScene } from '../../utils/inhalerPodGeometry';
import { podConfig } from '../../data/inhalerPodDefaults';
import { useFontStore } from '../../hooks/useFontStore';
import { load3DFont } from '../../utils/fontManager';

function Part({part,geometry,config}) {
    const mesh=useRef(),target=podPlacement(config,part);
    const [initial]=useState(target.z);
    useFrame((_,dt)=>{if(mesh.current)mesh.current.position.z=THREE.MathUtils.damp(mesh.current.position.z,target.z,10,Math.min(dt,0.05));});
    const vc=!!geometry.attributes.color;
    return <mesh ref={mesh} geometry={geometry} position={[0,0,initial]} rotation={[target.rx,0,0]} name={`Pod_${part}`}>
        <meshStandardMaterial color={vc?'#ffffff':config[part+'Color']} vertexColors={vc} roughness={0.5}/>
    </mesh>;
}
export default function InhalerPodMesh({config,ref,onStatus}) {
    const {allFonts}=useFontStore();
    const c=podConfig(config);
    const key=JSON.stringify({...c,viewMode:undefined,showReference:undefined});
    const geometryConfig=useMemo(()=>JSON.parse(key),[key]);
    const [built,setBuilt]=useState(null);
    useEffect(()=>{
        let active=true;
        Promise.resolve().then(async()=>{
            onStatus({loading:true,error:''});await initPodKernel(wasmUrl);
            let font=null;
            if(geometryConfig.personalized&&geometryConfig.text.trim()&&!['body','loop','fitTest'].includes(geometryConfig.printMode)){
                const option=allFonts.find(f=>f.id===geometryConfig.font)||allFonts[0];
                if(!option)throw new Error('Select an available font before personalizing.');
                font=await load3DFont(option);
            }
            if(!active)return;
            const parts=buildPod(geometryConfig,font);
            if(!active){Object.values(parts).forEach(g=>g.dispose());return;}
            setBuilt({key,parts,config:geometryConfig});onStatus({loading:false,error:''});
        }).catch(error=>{if(active)onStatus({loading:false,error:error.message});});
        return()=>{active=false;};
    },[key,geometryConfig,allFonts,onStatus]);
    useEffect(()=>()=>{if(built)Object.values(built.parts).forEach(g=>g.dispose());},[built]);
    useImperativeHandle(ref,()=>({getPrintScene(){
        if(!built||built.key!==key)throw new Error('The pod is updating. Wait for the geometry to finish.');
        return podPrintScene(c,built.parts);
    }}));
    if(!built)return null;
    const display={...built.config,viewMode:c.viewMode},d=podDimensions(display);
    return <group name="Inhaler_Pod">
        {Object.entries(built.parts).map(([part,geometry])=><Part key={geometry.uuid} part={part} geometry={geometry} config={display}/>)}
        {c.showReference&&c.printMode==='kit'&&<mesh position={[0,0,c.floor+c.length/2]} rotation={[Math.PI/2,0,0]} userData={{excludeFromExport:true}}>
            <cylinderGeometry args={[c.diameter/2,c.diameter/2,c.length,96]}/>
            <meshStandardMaterial color="#65bb92" transparent opacity={0.2} depthWrite={false}/>
        </mesh>}
        <directionalLight position={[d.bodyRadius*3,-30,80]} intensity={0.5}/>
    </group>;
}
