import { useState, useEffect, useRef } from 'react';

export function useGeometryWorker(socketUrl, stemUrl, switchUrl, regions, outline, params) {
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
                // Trigger a build if we already have regions and params
                if (regions && outline && params) {
                    setIsBuilding(true);
                    worker.postMessage({
                        type: 'buildClicker',
                        regions,
                        outline,
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
        if (!regions || !outline || !params) return;

        setIsBuilding(true);
        // Deep clone params in case it has non-clonable elements or weird Proxies, though should be plain objects
        workerRef.current.postMessage({
            type: 'buildClicker',
            regions,
            outline,
            params: JSON.parse(JSON.stringify(params))
        });
    }, [regions, outline, params]);

    return { parts, switchPlacements, warnings, isBuilding, switchMesh };
}
