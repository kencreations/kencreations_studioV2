const { app, ipcMain } = require('electron');
require('bytenode');
require('./electron/main.jsc');
app.whenReady().then(() => {
  const handlers = Object.keys(ipcMain._invokeHandlers || {});
  console.log("Registered IPC Invoke handlers:", handlers);
  app.quit();
});
