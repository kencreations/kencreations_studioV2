import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useGeometryWorker — manages the geometry Web Worker lifecycle for the clicker editor.
 *
 * Handles:
 *  - Worker creation & teardown
 *  - Asset initialization (socket, stem, display switch 3MF files)
 *  - Rebuild triggers whenever regions/outline/params change
 *  - Returns the built parts, switch placements, build status, and the display switch mesh
 */
export function useGeometryWorker(socketUrl, stemUrl, switchUrl, regions, outline, params) {
    const [parts, setParts] = useState([]);
    const [switchPlacements, setSwitchPlacements] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [switchMesh, setSwitchMesh] = useState(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const workerRef = useRef(null);
    const initDoneRef = useRef(false);
    // Keep a ref to the latest inputs so the onmessage handler always sees fresh values.
    const latestInputsRef = useRef({ regions, outline, params });

    useEffect(() => {
        latestInputsRef.current = { regions, outline, params };
    }, [regions, outline, params]);

    useEffect(() => {
        const worker = new Worker(new URL('../engine/workers/geometry.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        initDoneRef.current = false;

        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'ready') {
                // Fetch and send MX assets to the worker
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
                }).catch(err => {
                    console.error('[useGeometryWorker] Failed to load 3MF assets:', err);
                });
            } else if (msg.type === 'initDone') {
                initDoneRef.current = true;
                if (msg.switchMesh) {
                    setSwitchMesh(msg.switchMesh);
                }
                // Use the ref so we get the CURRENT inputs, not the stale closure values
                const { regions: r, outline: o, params: p } = latestInputsRef.current;
                if (r && o && p) {
                    setIsBuilding(true);
                    worker.postMessage({
                        type: 'buildClicker',
                        regions: r,
                        outline: o,
                        params: JSON.parse(JSON.stringify(p))
                    });
                }
            } else if (msg.type === 'parts') {
                setParts(msg.parts);
                setSwitchPlacements(msg.switchPlacements ?? []);
                setWarnings(msg.warnings ?? []);
                setIsBuilding(false);
            } else if (msg.type === 'error') {
                console.error('[useGeometryWorker] Worker error:', msg.message);
                setIsBuilding(false);
            }
        };

        return () => {
            worker.terminate();
            workerRef.current = null;
            initDoneRef.current = false;
        };
    }, [socketUrl, stemUrl, switchUrl]);

    // When inputs change and the worker is ready, trigger a rebuild
    useEffect(() => {
        if (!initDoneRef.current || !workerRef.current) return;
        if (!regions || !outline || !params) return;

        setIsBuilding(true);
        workerRef.current.postMessage({
            type: 'buildClicker',
            regions,
            outline,
            params: JSON.parse(JSON.stringify(params))
        });
    }, [regions, outline, params]);

    return { parts, switchPlacements, warnings, isBuilding, switchMesh };
}
