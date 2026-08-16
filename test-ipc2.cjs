const { app, ipcMain } = require('electron');
require('bytenode');
require('./electron/main.jsc');
app.whenReady().then(() => {
  console.log("Is Map?", ipcMain._invokeHandlers instanceof Map);
  if (ipcMain._invokeHandlers instanceof Map) {
    console.log("Keys:", Array.from(ipcMain._invokeHandlers.keys()));
  }
  app.quit();
});
