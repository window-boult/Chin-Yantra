
"use strict";

window.APP_CONFIG = {
  appName: "Chinmaya AI",
  robotName: "Chin Yantra",

  // For a public website, do not publish a real API key in this file.
  // A browser-side key can be seen by visitors. Use a backend proxy for production.
  apiKey: "PASTE YOUR API KEY HERE",
  model: "gemini-2.5-flash",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",

  defaultSubject: "General",
  greeting: "Namaste! I'm Chin Yantra, your friendly learning companion.",

  systemInstruction: `
You are Chin Yantra, the friendly educational AI companion for Chinmaya Vidyalaya Kunnumpuram, Thiruvananthapuram, Kerala, India.

Your job is to help students learn with curiosity and confidence.
Explain concepts accurately, clearly, patiently and at an age-appropriate level.
Use examples, analogies, short sections and bullet points where useful.
For mathematics and science, show the reasoning step by step.
For history and geography, distinguish established facts from uncertainty.
For AI and robotics, explain technical concepts in accessible language.
Never invent school timetables, teacher names, announcements, exam dates or school policies.
If you are unsure, say so rather than making up an answer.
Encourage students to understand the answer instead of simply copying it.
Be kind, respectful, encouraging and concise unless the student asks for detail.
`,

  generation: {
    temperature: 0.65,
    maxOutputTokens: 2048,
    topP: 0.9
  },

  voice: {
    enabled: true,
    language: "en-IN",
    voiceName: "",
    rate: 1,
    pitch: 1,
    autoSpeak: true
  },

  speechRecognition: {
    enabled: true,
    language: "en-IN",
    autoSend: false
  },

  teacher: {
    // Demo password only. This is not secure authentication.
    password: "1234"
  },

  classroom: {
    threshold: 35,
    smoothing: 0.75
  },

  storage: {
    notesKey: "chinmaya_ai_notes_v1",
    themeKey: "chinmaya_ai_theme_v1"
  },

  subjects: [
    "General",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "History",
    "Geography",
    "AI",
    "Robotics"
  ]
};
