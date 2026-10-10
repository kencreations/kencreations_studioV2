// Dependency injection allows deterministic authorization/save/cancellation tests.
export function createExportRunner({ authorize, serialize, save, record, onBusy, onError, lock = { busy: false } }) {
    return async ({ getScene, format, filename, dispose, printConfig }) => {
        if (lock.busy) return { success: false, reason: 'busy' };
        lock.busy = true;
        let scene;
        try {
            const access = await authorize();
            if (!access.allowed) return { success: false, reason: access.reason };
            onBusy?.(true);
            scene = await getScene(format);
            const blob = await serialize(scene, format, printConfig);
            // Access may change while geometry/ZIP generation is running.
            if (!(await authorize()).allowed) return { success: false, reason: 'access-changed' };
            const saved = await save(blob, filename, format);
            if (!saved.success) return saved;
            // Analytics failures (including synchronous failures) cannot cancel a save.
            Promise.resolve().then(() => record?.({ format, filename, eventId: crypto.randomUUID() })).catch(() => {});
            return { success: true };
        } catch (error) {
            onError?.(error);
            return { success: false, reason: 'error', error };
        } finally {
            if (scene && dispose) dispose(scene);
            lock.busy = false;
            onBusy?.(false);
        }
    };
}

export async function saveModel(blob, filename, format, desktop = globalThis.window?.electronAPI) {
    if (desktop?.saveFileDialog) {
        const result = await desktop.saveFileDialog({ defaultName: filename, filterName: `${format.toUpperCase()} Files`, extension: format, fileData: new Uint8Array(await blob.arrayBuffer()) });
        if (result?.success) return result;
        if (result?.reason === 'canceled') return result;
        throw new Error(result?.error || 'The file could not be saved.');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        return { success: true, downloadInitiated: true };
    } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
