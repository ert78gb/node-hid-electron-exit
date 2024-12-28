This repo is reproduce the issue of node-hid and electron exit.

Steps:
- clone this repo
- run `npm install`
- run `npm start`
- close the electron window

The code read data from a USB device in every 250 ms.
