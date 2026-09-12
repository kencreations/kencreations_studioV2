import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

type Wasm = Awaited<ReturnType<typeof Module>>;
let modulePromise: Promise<Wasm> | null = null;

async function getModule(): Promise<Wasm> {
    if (!modulePromise) {
        modulePromise = (async () => {
            const wasm = await Module({ locateFile: () => wasmUrl });
            wasm.setup();
            return wasm;
        })();
    }
    return modulePromise;
}

self.onmessage = async (e: MessageEvent) => {
    const msg = e.data;
    
    if (msg.type === 'init') {
        await getModule();
        self.postMessage({ type: 'ready' });
        return;
    }

    if (msg.type === 'buildCharmBase') {
        const { id, position, index, params } = msg;
        const {
            size,
            baseOffset,
            baseHeight,
            holeOrientation,
            holeDiameter,
            holeCount,
            holeDistance,
        } = params;

        try {
            const wasm = await getModule();
            
            const trash: any[] = [];
            const track = (o: any) => {
                trash.push(o);
                return o;
            };

            const mesh = new wasm.Mesh({
                numProp: 3,
                vertProperties: position,
                triVerts: index,
            });
            mesh.merge();
            let baseSolid;
            try {
                baseSolid = wasm.Manifold.ofMesh(mesh);
            } catch (err) {
                console.warn("Mesh non-manifold, falling back to cube", err);
                baseSolid = wasm.Manifold.cube([size, size, baseHeight], true).translate([0, 0, -baseHeight / 2]);
            }

            const drillLength = size + baseOffset * 4;
            const drillRadius = holeDiameter / 2;
            const zOffset = -(baseHeight / 2);
            const isHorizontal = holeOrientation === "horizontal";

            let finalSolid = baseSolid;

            if (holeCount === 2) {
                const dist = holeDistance + holeDiameter;
                for (let i = 0; i < 2; i++) {
                    const holeSolid = track(wasm.Manifold.cylinder(drillLength, drillRadius, drillRadius, 24));
                    let cylinder = track(holeSolid.translate([0, 0, -drillLength / 2]));

                    if (isHorizontal) {
                        cylinder = track(cylinder.rotate([0, 90, 0]));
                    } else {
                        cylinder = track(cylinder.rotate([90, 0, 0]));
                    }
                    
                    const offset = i === 0 ? -dist / 2 : dist / 2;
                    if (isHorizontal) {
                        cylinder = track(cylinder.translate([0, offset, zOffset]));
                    } else {
                        cylinder = track(cylinder.translate([offset, 0, zOffset]));
                    }

                    finalSolid = track(finalSolid.subtract(cylinder));
                }
            } else {
                const holeSolid = track(wasm.Manifold.cylinder(drillLength, drillRadius, drillRadius, 24));
                let cylinder = track(holeSolid.translate([0, 0, -drillLength / 2]));

                if (isHorizontal) {
                    cylinder = track(cylinder.rotate([0, 90, 0]));
                } else {
                    cylinder = track(cylinder.rotate([90, 0, 0]));
                }

                cylinder = track(cylinder.translate([0, 0, zOffset]));
                finalSolid = track(finalSolid.subtract(cylinder));
            }

            const resultMesh = finalSolid.getMesh();
            const outPosition = new Float32Array(resultMesh.vertProperties);
            const outIndex = new Uint32Array(resultMesh.triVerts);
            
            // Clean up to prevent memory leaks in WASM
            for (const o of trash) {
                try {
                    o.delete();
                } catch {
                    // already freed
                }
            }
            if (finalSolid !== baseSolid) {
                try { baseSolid.delete(); } catch {}
            }
            try { finalSolid.delete(); } catch {}
            try { mesh.delete(); } catch {}

            self.postMessage({
                type: 'charmBaseBuilt',
                id,
                position: outPosition,
                index: outIndex
            }, [outPosition.buffer, outIndex.buffer]);

        } catch (err: any) {
            console.error("Charm worker error:", err);
            self.postMessage({ type: 'error', id, error: err.message });
        }
    }
};
