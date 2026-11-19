/* CHINMAYA AI configuration. Never put a private production API key here. */
window.APP_CONFIG = {
  appName: "Chinmaya AI",
  schoolName: "Chinmaya Vidyalaya Kunnumpuram",
  location: "Thiruvananthapuram, Kerala, India",

  api: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",
    model: "gemini-3.5-flash-lite",
    temperature: 0.65,
    maxOutputTokens: 2200,
    timeoutMs: 60000
  },

  storage: {
    notesKey: "chinmayaNotes",
    chatsKey: "chinmayaSavedChats",
    maxSavedChats: 60
  },

  teacher: {
    demoPin: "1234", // Demo only; use server-side authentication for real staff access.
    noiseThreshold: 0.12,
    noiseHoldMs: 1400
  },

  voice: {
    language: "en-IN",
    rate: 1,
    pitch: 1
  },

  subjects: [
    { id: "general", name: "General learning", icon: "✦", hint: "Ask anything you are curious about." },
    { id: "mathematics", name: "Mathematics", icon: "∑", hint: "Let's solve it step by step." },
    { id: "physics", name: "Physics", icon: "◉", hint: "Explore how the universe works." },
    { id: "chemistry", name: "Chemistry", icon: "⚗", hint: "Understand matter and reactions." },
    { id: "biology", name: "Biology", icon: "❧", hint: "Discover life and living systems." },
    { id: "history", name: "History", icon: "⌛", hint: "Understand people, events and evidence." },
    { id: "geography", name: "Geography", icon: "◎", hint: "Explore Earth and its people." },
    { id: "ai", name: "Artificial intelligence", icon: "✧", hint: "Learn how intelligent systems work." },
    { id: "robotics", name: "Robotics", icon: "⚙", hint: "Connect code, electronics and mechanics." },
    {
      id: "spirituality",
      name: "Spirituality",
      icon: "ॐ",
      hint: "Explore the Bhagavad Gita, Indian philosophy, values and reflection with respect and context."
    }
  ]
};