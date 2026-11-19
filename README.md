# Chinmaya AI

A vanilla HTML, CSS and JavaScript learning companion for Chinmaya Vidyalaya Kunnumpuram.

## Files

- `index.html` — page structure and dialogs
- `style.css` — responsive green, ivory and gold interface
- `config.js` — subjects, Gemini model settings, teacher demo settings and local storage limits
- `app.js` — chat, image upload, student camera, voice, saved chats, Study Mode, notes and teacher tools
- `logo.svg` — original vector logo
- `manifest.json` — installable web app metadata

## Run locally

Open the folder in VS Code and use Live Server, or serve it from `localhost`. Camera and microphone access require HTTPS or localhost and explicit browser permission. Load `config.js` before `app.js` (the supplied `index.html` already does this).

## Gemini setup

Open Settings in the app and paste a Gemini API key. The key is kept in JavaScript memory for the current page session and is cleared on refresh. The app calls the Gemini `generateContent` endpoint directly from the browser for demonstration purposes.

**Security:** A browser-only app cannot keep an API key secret. Before making this public for real students, put Gemini requests behind a server-side API proxy, apply authentication, quotas and rate limits, and never commit a real key to GitHub.

## Features

- Subject-based AI learning, including a separate Spirituality subject for Bhagavad Gita and reflective questions
- Text chat, image upload and student camera capture for visual questions
- Browser speech recognition and text-to-speech where supported, with a one-sentence spoken summary and a separate full-answer playback control
- Animated robot companion beside the chat, with blinking, greeting waves and speech-responsive mouth movement
- Concise AI replies designed to stay within one short paragraph
- Saved conversations with open, rename, delete and text export
- Study Mode for explanations, revision and quizzes
- Lecture notes stored in the current browser
- Teacher demo portal (PIN `1234`), classroom lesson timer, camera preview and relative microphone sound-level monitor
- Light/dark theme and reduced-motion option

## Limitations and privacy

Saved conversations and notes are stored in the browser's local storage on that device. They are not synchronised between devices. Image attachments are sent to Gemini only when the student sends the message. Student camera capture requires a direct click and permission; the preview is not uploaded until the user sends the attached image. Teacher camera and microphone streams are stopped when their tools are closed or the page is unloaded. The noise meter reports relative input level, not calibrated decibels, and does not record or upload audio.

The teacher PIN is a client-side demonstration gate, not secure authentication. Use a real server-side login for actual school deployment. Check school policies and obtain appropriate permission before enabling cameras or microphones.
