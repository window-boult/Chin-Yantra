
/*
  CHINMAYA AI — CENTRAL CONFIGURATION

  Paste your Gemini API key below.
  IMPORTANT: A key in browser-side JavaScript is visible to visitors.
  Do not publish this file or commit your real key to a public repository.
*/

window.APP_CONFIG = {
  appName: "CHINMAYA AI",

  robot: {
    name: "Chin Yantra",
    greeting: "Namaste! What shall we discover today?",
    systemInstruction: [
      "You are Chin Yantra, the friendly AI learning companion for CHINMAYA AI.",
      "Help school students learn accurately, patiently and creatively.",
      "Explain concepts clearly, using age-appropriate language, examples and step-by-step reasoning.",
      "Be respectful, calm, encouraging and curious.",
      "When appropriate, distinguish verified facts from uncertainty. Never invent sources, data or scientific claims.",
      "For schoolwork, help the learner understand rather than merely giving unexplained answers.",
      "Return a JSON object with exactly two string properties:",
      "\"answer\": a useful, moderately detailed answer suitable for displaying in the chat.",
      "\"spokenSummary\": a short, simple version suitable for reading aloud, usually one to three sentences.",
      "The spokenSummary must be a concise explanation of the same answer, not a different answer.",
      "Return valid JSON only. Do not wrap it in Markdown fences."
    ].join(" ")
  },

  gemini: {
    // Replace this placeholder with your own key.
    apiKey: "AQ.Ab8RN6JmI38MYZZrsyqBWF2XoyYo-l_YeKrvlHnWSUeDxhBCNQ",

    // Change this model ID if you prefer another model available to your key.
    model: "gemini-3.5-flash-lite",

    temperature: 0.65,
    maxOutputTokens: 1400
  },

  appearance: {
    theme: "light",
    green: "#34764b",
    orange: "#ef9b45"
  },

  voice: {
    enabled: true,

    // An empty string selects a browser-provided default English voice.
    voiceName: "",
    language: "en-IN",
    rate: 1.0,
    pitch: 1.0
  },

  speechRecognition: {
    language: "en-IN",
    autoSend: true
  },

  subjects: [
    { name: "Mathematics", icon: "∑", color: "#3478c8", background: "#e5efff" },
    { name: "Physics", icon: "⚛", color: "#7655bd", background: "#eee8ff" },
    { name: "Chemistry", icon: "⚗", color: "#148a83", background: "#ddf5ef" },
    { name: "Biology", icon: "❋", color: "#38854b", background: "#e3f4df" },
    { name: "History", icon: "⌛", color: "#b16d35", background: "#fff0df" },
    { name: "Geography", icon: "◉", color: "#278c9c", background: "#def4f6" },
    { name: "Artificial Intelligence", icon: "✧", color: "#bc5b87", background: "#ffe7f0" },
    { name: "Robotics", icon: "▣", color: "#d17b27", background: "#fff0d9" }
  ],

  classroom: {
    // Relative microphone input level, not a calibrated dB measurement.
    alertThreshold: 85,

    // The input must remain below this level for this long before auto-clearing.
    clearBelowPercent: 75,
    clearDelayMs: 2500,

    // Alarm volume is intentionally limited for hearing safety.
    alarmVolume: 0.30,
    beepFrequency: 880,
    beepDurationMs: 260,
    beepIntervalMs: 650,

    spokenAlert: "Classroom noise is too high. Please lower your voices so everyone can learn."
  },

  teacher: {
    // Demonstration password only; not secure authentication.
    password: "1234"
  },

  storage: {
    settingsKey: "chinmayaAI.settings.v1",
    themeKey: "chinmayaAI.theme.v1"
  }
};
