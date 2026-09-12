/**
 * Asset Path Helper
 * Resolves paths reliably in both dev and production (Electron) environments.
 * 
 * Using `new URL(path, import.meta.url).href` works perfectly for assets INSIDE the `src/` folder 
 * because Vite statically analyzes and bundles them.
 * 
 * HOWEVER, for assets inside the `/public` folder (Task 3: preventing the bundler from scrambling them),
 * Vite does not bundle them. They are copied directly to the `dist` folder.
 * In production, `import.meta.url` points to the nested chunk (e.g. `dist/assets/index-xyz.js`).
 * If we resolve against that, it looks for files in `dist/assets/public/...` which fails.
 * 
 * Instead, for public assets in an Electron file:// environment with client-side routing,
 * we resolve relative to the base URL (index.html).
 */
export const getAssetUrl = (relativePath) => {
    // Remove leading slash if present to ensure proper relative resolution
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    
    if (import.meta.env.DEV) {
        // In development, resolve against the dev server origin
        return new URL(cleanPath, import.meta.url).origin + '/' + cleanPath;
    } else {
        // In production, resolve against the base window location (ignoring HashRouter fragments)
        let base = window.location.href.split('#')[0];
        if (base.endsWith('index.html')) {
            base = base.substring(0, base.lastIndexOf('/') + 1);
        } else if (!base.endsWith('/')) {
            base += '/';
        }
        return new URL(cleanPath, base).href;
    }
};
