const { ipcRenderer } = require("electron");

globalThis.ipcRenderer = ipcRenderer;
console.info("ipcRenderer is set");
