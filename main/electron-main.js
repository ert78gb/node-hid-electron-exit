import { app, BrowserWindow, systemPreferences } from "electron";
import * as path from "path";
import * as url from "url";

import DeviceService from "./device.service.js";

let areServicesInited = false;

/**
 * @type {DeviceService]
 */
let deviceService;

/**
 * @type {import("electron").BrowserWindow}
 */
let win;

async function createWindow() {
  if (isSecondInstance) {
    return;
  }

  // Create the browser window.
  win = new BrowserWindow({
    title: "Node HID Electron Exit",
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(import.meta.dirname, "preload.cjs"),
      spellcheck: false,
    },
    show: false,
  });

  deviceService = new DeviceService(win);

  win.loadURL(
    url.format({
      pathname: path.join(import.meta.dirname, "..", "renderer", "index.html"),
      protocol: "file:",
      slashes: true,
    }),
  );

  win.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  // Emitted when the window is closed.
  win.on("closed", async () => {
    console.log("[Electron Main] Window closed");
    win = null;
    try {
      await deviceService.close();
    } catch (error) {
      // TODO: Investigate it deeper. It happens on MacOs 15+ sometimes
      console.error(
        "[Electron Main] Error while closing DeviceService when electron has been closed",
        error,
      );
    }

    deviceService = null;
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.on("did-finish-load", () => {});

  win.webContents.on("render-process-gone", (event, details) => {
    console.log(
      `[Electron Main] render-process-gone, reason: ${details.reason} exitCode: ${details.exitCode}`,
    );
  });

  win.on("close", () => {
    console.log("[Electron Main] Window is closing");
  });
}

const isSecondInstance = !app.requestSingleInstanceLock();

if (isSecondInstance) {
  app.quit();
} else {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on("ready", createWindow);

  // Quit when all windows are closed.
  app.on("window-all-closed", () => {
    app.exit();
  });

  app.on("will-quit", () => {});

  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      await createWindow();
    }
  });

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.focus();
    }
  });
}
