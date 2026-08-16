"use strict";

const { app } = require("electron");
const bytenode = require("bytenode");
const path = require("path");
const fs = require("fs");

const ELECTRON_DIR = __dirname;

const filesToCompile = [
    "main.cjs",
    "db.cjs",
    "licenseManager.cjs",
    "syncWorker.cjs",
];

app.whenReady().then(async () => {
    console.log("\n[bytenode] Starting V8 bytecode compilation (Browser Process)...\n");

    for (const filename of filesToCompile) {
        const srcPath = path.join(ELECTRON_DIR, filename);
        const outPath = srcPath.replace(".cjs", ".jsc");

        if (!fs.existsSync(srcPath)) {
            console.warn(`[bytenode] SKIP: ${filename} (not found)`);
            continue;
        }

        try {
            await bytenode.compileFile({ filename: srcPath, output: outPath });
            console.log(`[bytenode] ✅ ${filename} → ${path.basename(outPath)}`);
        } catch (err) {
            console.error(`[bytenode] ❌ Failed to compile ${filename}:`, err.message);
            app.exit(1);
        }
    }

    console.log("\n[bytenode] Compilation complete.\n");
    app.quit();
});
