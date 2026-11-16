# CHINMAYA AI — Chin Yantra

A single-page school learning companion with an animated robot, subject modes, Gemini chat, voice input/output, camera Q&A, teacher demo login, and local classroom sound-level monitor.

## Files
- `index.html` — complete application (HTML, CSS, configuration, and JavaScript are embedded).
- `logo.svg` — shared brand mark used in the header and browser tab.
- `manifest.json` — installable web-app metadata.

## Run locally
1. Open this folder in VS Code.
2. Start a local server (for example, VS Code Live Server). Camera and microphone permissions require `localhost` or HTTPS.
3. Open the local URL in a modern browser.

## Configure Gemini
Open `index.html`, find `window.APP_CONFIG` near the top of the document, and replace `PASTE YOUR API KEY HERE` with your own Gemini API key. The model is configurable there; `gemini-2.5-flash` is the starter setting, but model availability depends on the API key and current Google AI Studio access.

**Security:** A key embedded in a browser page is visible to visitors. Use a server-side proxy and server environment secret for any public deployment. Restrict the key in Google Cloud/AI Studio where possible. If a real key was previously pasted into a chat or public repository, revoke it and create a new one.

## Teacher demo
The default demonstration password is `1234`. This is a client-side demo gate only, not secure authentication. Do not use it to protect real teacher accounts or private data.

## Notes
- The classroom monitor analyses microphone levels locally in the browser; it does not record or upload audio. Its percentage is a relative level, not calibrated decibels.
- The camera only starts after the user presses **Start camera**. A captured frame is sent to Gemini only after **Analyse frame** is pressed.
- This repository is a static front-end demo. Do not publish a real API key in the repository.
