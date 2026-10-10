import { useState, useEffect, useRef } from 'react';

export function useMacropadWorker(socketUrl, stemUrl, switchUrl, params) {
    const [parts, setParts] = useState([]);
    const [switchPlacements, setSwitchPlacements] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [switchMesh, setSwitchMesh] = useState(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const workerRef = useRef(null);
    const initDoneRef = useRef(false);

    const latestParams = useRef(params);
    useEffect(() => { latestParams.current = params; }, [params]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        initDoneRef.current = false;
        const worker = new Worker(new URL('../engine/workers/geometry.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e) => {
            if (!active) return;
            const msg = e.data;
            if (msg.type === 'ready') {
                Promise.all([
                    fetch(socketUrl, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Geometry asset could not be loaded."); return r.arrayBuffer(); }),
                    fetch(stemUrl, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Geometry asset could not be loaded."); return r.arrayBuffer(); }),
                    fetch(switchUrl, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Geometry asset could not be loaded."); return r.arrayBuffer(); })
                ]).then(([socketBuf, stemBuf, switchBuf]) => {
                    if (!active) return;
                    worker.postMessage({
                        type: 'init',
                        socket: socketBuf,
                        stem: stemBuf,
                        switch: switchBuf
                    }, [socketBuf, stemBuf, switchBuf]);
                }).catch(error => { if (active) { setWarnings([error.message]); setIsBuilding(false); } });
            } else if (msg.type === 'initDone') {
                initDoneRef.current = true;
                if (msg.switchMesh) {
                    setSwitchMesh(msg.switchMesh);
                }
                // Trigger a build if we already have params
                if (latestParams.current) {
                    setIsBuilding(true);
                    worker.postMessage({
                        type: 'buildMacropad',
                        params: JSON.parse(JSON.stringify(latestParams.current))
                    });
                }
            } else if (msg.type === 'parts') {
                setParts(msg.parts);
                setSwitchPlacements(msg.switchPlacements);
                setWarnings(msg.warnings);
                setIsBuilding(false);
            } else if (msg.type === 'error') {
                console.error("Geometry worker error:", msg.message);
                setWarnings([`Worker Error: ${msg.message}`]);
                setIsBuilding(false);
            }
        };

        worker.onerror = () => { if (active) { setWarnings(["Geometry worker failed. Reload the editor to retry."]); setIsBuilding(false); } };
        return () => {
            active = false; controller.abort();
            workerRef.current = null; initDoneRef.current = false;
            worker.terminate();
        };
    }, [socketUrl, stemUrl, switchUrl]);

    // When inputs change, trigger build
    useEffect(() => {
        if (!initDoneRef.current || !workerRef.current) return;
        if (!params) return;

        setIsBuilding(true);
        workerRef.current.postMessage({
            type: 'buildMacropad',
            params: JSON.parse(JSON.stringify(params))
        });
    }, [params]);

    return { parts, switchPlacements, warnings, isBuilding, switchMesh };
}
