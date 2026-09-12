import { useEffect, useRef, useState } from 'react';

// Use a singleton worker instance so we don't spawn a worker per bead
let sharedWorker = null;
let pendingRequests = new Map();
let isInitialized = false;
let initPromise = null;

function getSharedWorker() {
    if (!sharedWorker) {
        sharedWorker = new Worker(new URL('../engine/workers/charm.worker.ts', import.meta.url), { type: 'module' });
        
        sharedWorker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'ready') {
                isInitialized = true;
            } else if (msg.type === 'charmBaseBuilt') {
                const { id, position, index } = msg;
                if (pendingRequests.has(id)) {
                    pendingRequests.get(id).resolve({ position, index });
                    pendingRequests.delete(id);
                }
            } else if (msg.type === 'error') {
                const { id, error } = msg;
                if (pendingRequests.has(id)) {
                    pendingRequests.get(id).reject(new Error(error));
                    pendingRequests.delete(id);
                }
            }
        };

        sharedWorker.postMessage({ type: 'init' });
    }
    return sharedWorker;
}

export function useCharmWorker() {
    // Ensure the worker is initialized when the hook is used
    useEffect(() => {
        getSharedWorker();
    }, []);

    const drillHole = async (position, index, params) => {
        const worker = getSharedWorker();
        const id = Math.random().toString(36).substring(2, 9);
        
        return new Promise((resolve, reject) => {
            pendingRequests.set(id, { resolve, reject });
            
            // position and index are typed arrays. We send their underlying buffers
            // Wait, we need to pass a COPY of the buffers if we don't want to detach them from the original geometry,
            // or we can just let them transfer and they become detached on the main thread (which is fine since we replace the geometry).
            
            // To be safe and avoid detaching the ExtrudeGeometry's buffers (which might be cached or reused by Three.js),
            // we send a copy of the data.
            const posCopy = new Float32Array(position);
            const indCopy = new Uint32Array(index);

            worker.postMessage({
                type: 'buildCharmBase',
                id,
                position: posCopy,
                index: indCopy,
                params
            }, [posCopy.buffer, indCopy.buffer]);
        });
    };

    return { drillHole };
}
