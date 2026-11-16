
/* CHINMAYA AI / CHIN YANTRA — central configuration.
   Edit values here, save, and refresh. Browser-side API keys are visible to visitors.
*/
window.APP_CONFIG = {
  appName: "CHINMAYA AI",
  robotName: "Chin Yantra",
  apiKey: "PASTE YOUR API KEY HERE", // Optional; app will prompt at startup if left unchanged.

  // Use a model identifier enabled for your Gemini API key.
  model: "gemini-2.5-flash",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",
  language: "en-IN",
  greeting: "Your curious, kind, and eco-friendly learning buddy. What shall we discover today?",
  defaultSubject: "Mathematics",
  defaultExpression: "idle",
  reducedMotion: false,

  theme: {
    primary: "#176b45",
    primaryDark: "#104b34",
    secondary: "#f28a27",
    background: "#f6f5ed",
    accent: "#b8d96a",
    cream: "#fff9e9",
    text: "#183d2d"
  },

  voice: {
    enabled: true,
    voiceName: "",
    language: "en-IN",
    rate: 1.0,
    pitch: 1.08,
    volume: 0.9,
    speakByDefault: false,
    showSpeakButton: true,
    allowSpeechRecognition: true
  },

  teacherPassword: "1234", // DEMONSTRATION ONLY; never use as real authentication.

  monitor: {
    noiseSensitivity: 55,
    soundLevelThreshold: 0.085,
    triggerDurationMs: 1800,
    repeatCount: 3,
    alertDurationMs: 5000,
    alarmCooldownMs: 12000,
    defaultAlarmEnabled: true,
    allowTeacherMute: true,
    sampleIntervalMs: 100
  },

  interface: {
    maxHistoryMessages: 24,
    maxOutputTokens: 1200,
    cameraMaxWidth: 960,
    cameraJpegQuality: 0.82,
    toastDurationMs: 3200
  },

  subjects: [
    {
      name: "Mathematics",
      icon: "∑",
      description: "Make numbers make sense",
      instruction: "Teach mathematics step by step. Show working for calculations, define symbols, check the result, and use an everyday analogy when useful. Never skip essential reasoning.",
      questions: [
        "Explain fractions with a pizza example",
        "Help me solve a linear equation",
        "What is the difference between area and perimeter?"
      ]
    },
    {
      name: "Physics",
      icon: "◉",
      description: "Discover how the world works",
      instruction: "Teach physics with scientifically accurate principles, units, equations, and real-world examples. Explain what each variable means and distinguish simplified models from reality.",
      questions: [
        "Why does a rainbow form?",
        "Explain Newton's laws simply",
        "What is the difference between mass and weight?"
      ]
    },
    {
      name: "Chemistry",
      icon: "⚗",
      description: "Explore matter and reactions",
      instruction: "Teach chemistry safely and accurately. Explain particles, elements, compounds, reactions, and equations at school level. Do not recommend dangerous experiments or mixing unknown chemicals.",
      questions: [
        "What is an atom made of?",
        "How are acids different from bases?",
        "Explain chemical reactions with examples"
      ]
    },
    {
      name: "Biology",
      icon: "❧",
      description: "Understand living things",
      instruction: "Teach biology using clear explanations of living systems, evidence-based facts, and relatable examples. Explain scientific terms in plain language and avoid overstating uncertain claims.",
      questions: [
        "How do plants make their food?",
        "What do mitochondria do?",
        "How does the human heart work?"
      ]
    },
    {
      name: "History",
      icon: "⌛",
      description: "Travel through time",
      instruction: "Teach history with chronology, context, causes, consequences, and multiple perspectives where relevant. Separate established evidence from interpretation and do not invent dates or quotations.",
      questions: [
        "Why are historical sources important?",
        "What caused the French Revolution?",
        "How do historians study ancient civilisations?"
      ]
    },
    {
      name: "Geography",
      icon: "◎",
      description: "Explore our changing planet",
      instruction: "Teach geography with clear spatial reasoning, map concepts, physical and human geography, and examples. Be careful with current facts and distinguish weather from climate.",
      questions: [
        "Why do monsoons happen?",
        "How are latitude and longitude used?",
        "What causes earthquakes?"
      ]
    },
    {
      name: "Artificial Intelligence",
      icon: "✧",
      description: "Learn how smart systems work",
      instruction: "Explain AI and machine learning accessibly, including benefits, limitations, bias, privacy, and responsible use. Do not claim AI is conscious or always correct.",
      questions: [
        "How does a chatbot generate answers?",
        "What is machine learning?",
        "Can AI make mistakes or show bias?"
      ]
    },
    {
      name: "Robotics",
      icon: "⚙",
      description: "Imagine, design, build",
      instruction: "Teach robotics through sensors, actuators, controllers, programming, and safe engineering principles. Use beginner-friendly examples and remind students to get adult supervision for tools, electricity, or moving machinery.",
      questions: [
        "How does a robot use sensors?",
        "What is the job of a microcontroller?",
        "How can I plan a simple school robot?"
      ]
    }
  ]
};
