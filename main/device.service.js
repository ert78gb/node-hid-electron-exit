import { ipcMain } from "electron";
import { setTimeout } from "node:timers/promises";
import { devicesAsync, HID } from "node-hid";

export default class DeviceService {
  /**
   * @type {import("node-hid").HID}
   */
  #device;

  /**
   * @type {boolean}
   */
  #exiting = false;

  /**
   * @type {boolean}
   */
  #pollingAllowed = false;

  /**
   * @type {boolean}
   */
  #isPolling = false;

  /**
   * @type {import("electron").BrowserWindow}
   */
  #win;

  /**
   * @param {import("electron").BrowserWindow} win
   */
  constructor(win) {
    this.#win = win;
    // it just starts the infinite loop
    this.#poll().catch((error) => {
      console.error("[DeviceService] device poller error: ", error);
    });

    // Allow the poller after the renderer process stared the app
    ipcMain.on("start-poller", (event, arg) => {
      this.startPolling();
    });

    console.info("[DeviceService] inited");
  }

  async close() {
    this.#exiting = true;
    await this.stopPolling();
    // Maybe here should be close the HID device ??? But the crashes happen earlier
  }

  startPolling() {
    console.info("[DeviceService] start polling");
    this.#pollingAllowed = true;
  }

  async stopPolling() {
    return new Promise(async (resolve) => {
      this.#pollingAllowed = false;

      while (true) {
        if (!this.#isPolling) {
          return resolve();
        }

        await setTimeout(100);
      }
    });
  }

  /**
   * @returns {Promise<import("node-hid").HID>}
   */
  async getDevice() {
    if (!this.#device) {
      const devices = await devicesAsync();
      const device = devices.find(
        (dev) =>
          dev.vendorId === 0x37a8 &&
          dev.productId === 0x0003 &&
          ((dev.usagePage === 128 && dev.usage === 129) ||
            (dev.usagePage === 65280 && dev.usage === 1)),
      );

      if (!device) {
        throw new Error("Device not found");
      }

      this.#device = new HID(device.path);
    }

    return this.#device;
  }

  /**
   * Send data to the UHK device and wait for the response.
   * Throw an error when 1st byte of the response is not 0
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>}
   */
  async write(buffer) {
    return new Promise(async (resolve, reject) => {
      try {
        const device = await this.getDevice();

        const sendData = Array.prototype.slice.call(buffer, 0);
        device.write(sendData);
        // Allow to renderer process to draw the content
        await setTimeout(1);
        const receivedData = device.readTimeout(1000);

        if (receivedData[0] !== 0) {
          return reject(
            new Error(
              `Communications error with UHK. Response code: ${receivedData[0]}`,
            ),
          );
        }

        return resolve(Buffer.from(receivedData));
      } catch (error) {
        if (this.#device) {
          this.#device.close();
          this.#device = null;
        }
        return reject(error);
      }
    });
  }

  /**
   * @returns {Promise<void>}
   */
  async #poll() {
    while (true) {
      if (this.#pollingAllowed) {
        this.#isPolling = true;

        try {
          // We process the available devices to detect multiple device connections
          // It is here just for the simulation of the real app
          const devices = await devicesAsync();

          // query the device state. The first byte is the report id, the second byte is the command id
          const response = await this.write(Buffer.from([0, 9]));

          // We send the processed response to the renderer process, but for now, we just send a dummy object
          if (!this.#win.isDestroyed()) {
            this.#win.webContents.send(
              "hid-device-state-changed",
              JSON.stringify({ data: "information" }),
            );
          }
        } catch (error) {
          console.error(
            "[DeviceService] Error while polling the device",
            error,
          );
        }
      }

      this.#isPolling = false;
      await setTimeout(100);
    }
  }
}
