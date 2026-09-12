"use strict";

// In development we intentionally load the plain source main process so the live-file edits
// we make during debugging are picked up immediately. The packaged app still uses the compiled
// .jsc bytecode, because that is what is shipped through electron-builder.
if (process.env.NODE_ENV === "development") {
    require("./main.cjs");
} else {
    require("bytenode");
    require("./main.jsc");
}
