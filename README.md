# Console Capture Viewer

Play your console on your Windows laptop or PC using a USB capture card. No TV required.

Console Capture Viewer shows the picture from an HDMI capture card full screen and plays the game's sound through your laptop's speakers or headphones. It is a simple, lightweight viewer: no streaming setup, no scenes, no accounts.

```
Console  --HDMI-->  Capture card  --USB-->  Windows PC  (Console Capture Viewer)
```

## Features

- **Live video and sound** from the capture card, with the sound sent straight to your speakers or headphones
- **Automatic device detection**, including cards plugged in while the app is open
- **Mode scanning**: the app tests each card and lists only the resolutions and frame rates it really supports (from 640x480 up to 4K, where the card allows)
- **Sound output picker** to send game audio to any speaker or headset
- **Volume and mute**
- **Fullscreen** (F11, or double-click the picture), plus fit, fill, or stretch scaling
- **Screenshots** (PNG) and **recording** (WebM)
- **Always on top** mode, handy for a small window next to other apps
- The control bar and mouse cursor hide automatically while you play
- Keeps your PC awake while the viewer is open
- Remembers your settings

## What you need

- A Windows 10 or 11 PC or laptop (64-bit)
- A USB capture card that appears to Windows as a standard camera (UVC). Most low-cost HDMI to USB or USB-C capture dongles work this way and need no driver. Examples include dongles built on MS2109-style chips, and many Elgato, AVerMedia, and similar cards.
- An HDMI cable from your console to the card's input

## Install

1. Go to the [Releases](../../releases) page.
2. Download **Console-Capture-Viewer-Setup.exe** (the installer) and run it. This is the recommended choice: it adds shortcuts and keeps itself up to date.

Prefer not to install anything? Download **Console-Capture-Viewer-Portable.exe** instead. It's a single `.exe` that runs from anywhere, such as a USB stick, but it doesn't update itself.

The installed version checks GitHub for new versions when it starts, downloads them in the background, and offers a **Restart to update** button. You can also press **Updates** in the control bar to check manually. (The portable version doesn't update itself.)

### "Windows protected your PC" or "dangerous file" warnings

Console Capture Viewer isn't code-signed yet (signing certificates cost money), so Windows and your browser may warn about it. This happens with any new unsigned program and doesn't mean the file is unsafe. The full source is in this repo and the installer is built by the public GitHub workflow, so you can check exactly what you're getting.

To continue:

- **Edge:** in Downloads, click **...** next to the file, choose **Keep**, then **Show more**, then **Keep anyway**.
- **Chrome:** click the warning in the download bar and choose **Keep**.
- **Windows SmartScreen when you run it:** choose **More info**, then **Run anyway**.
- **If you downloaded a `.zip`:** right-click it, open **Properties**, tick **Unblock**, apply, and then unzip.

## Use it

1. Connect the console's HDMI output to the capture card's **HDMI IN**, and plug the card into your PC by USB.
2. Open Console Capture Viewer.
3. Pick the card under **Video**. The matching **Audio** input is usually selected for you; if not, choose it (often named "Digital Audio Interface" or "USB Digital Audio").
4. Choose where the sound should play under **Sound output**.
5. Press **Start**.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| F11 or F | Fullscreen |
| Esc | Leave fullscreen |
| M | Mute |
| S | Screenshot |
| R | Start or stop recording |
| T | Always on top |
| H | Show or hide the control bar |

## Troubleshooting

**Black screen or "no signal".** Many consoles (PS5, Xbox, Switch) turn on HDMI copy protection (HDCP), which blocks capture cards. Turn HDCP off in the console's settings. Also try setting the console to 1080p output.

**"Couldn't open the capture card".** Only one app can use the card at a time. Close OBS, Elgato software, or any camera app, then press Start again.

**No sound.** Pick the card's audio device under **Audio** (not your laptop microphone), and check **Sound output** and the volume slider.

**Picture is delayed.** A small delay is normal with USB capture, so it suits casual play more than competitive play. Lower resolutions can help a little. Avoid USB hubs; plug the card directly into the PC.

**Low frame rate or only 30 fps.** Many budget cards top out at 1080p at 30 fps. The Quality menu lists only what your card supports.

**Card not listed.** Press **Refresh**, try another USB port, and check that Windows shows the card in Device Manager under Cameras or Sound, video and game controllers.

## Build from source

Requires [Node.js](https://nodejs.org/) 20 or newer.

```
npm install
npm start        # run in development
npm run dist     # build the Windows installer into dist/
```

The installer is also built automatically by the GitHub Actions workflow in `.github/workflows/build.yml`. Push a tag such as `v1.0.0` to build it and attach it to a release.

The app is built with [Electron](https://www.electronjs.org/) and uses the browser's standard camera and audio capture, so there is nothing to install on the system besides the app itself.

## Notes

- Only for personal use with content you are allowed to capture. Respect the terms of your console and game services.
- This project is not affiliated with any console maker or capture card brand.

## License

[MIT](LICENSE)
