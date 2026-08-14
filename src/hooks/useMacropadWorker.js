import { useState, useEffect, useRef } from 'react';

export function useMacropadWorker(socketUrl, stemUrl, switchUrl, params) {
    const [parts, setParts] = useState([]);
    const [switchPlacements, setSwitchPlacements] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [switchMesh, setSwitchMesh] = useState(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const workerRef = useRef(null);
    const initDoneRef = useRef(false);

    useEffect(() => {
        const worker = new Worker(new URL('../engine/workers/geometry.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'ready') {
                Promise.all([
                    fetch(socketUrl).then(r => r.arrayBuffer()),
                    fetch(stemUrl).then(r => r.arrayBuffer()),
                    fetch(switchUrl).then(r => r.arrayBuffer())
                ]).then(([socketBuf, stemBuf, switchBuf]) => {
                    worker.postMessage({
                        type: 'init',
                        socket: socketBuf,
                        stem: stemBuf,
                        switch: switchBuf
                    }, [socketBuf, stemBuf, switchBuf]);
                });
            } else if (msg.type === 'initDone') {
                initDoneRef.current = true;
                if (msg.switchMesh) {
                    setSwitchMesh(msg.switchMesh);
                }
                // Trigger a build if we already have params
                if (params) {
                    setIsBuilding(true);
                    worker.postMessage({
                        type: 'buildMacropad',
                        params
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

        return () => {
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
