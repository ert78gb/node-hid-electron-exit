const outputTextarea = document.getElementById("output");

let stateChangedCounter = 0;
globalThis.ipcRenderer.on("hid-device-state-changed", (event, arg) => {
  outputTextarea.value += `State changed: ${stateChangedCounter++}\n`;
  outputTextarea.scrollTop = outputTextarea.scrollHeight;
});

console.info("Send start-poller", globalThis.ipcRenderer);
globalThis.ipcRenderer.send("start-poller");
