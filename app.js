
(() => {
  "use strict";

  const C = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const state = {
    subject: "General learning",
    history: [],
    busy: false,
    teacherLoggedIn: false,
    settings: {
      theme: C.appearance?.theme || "light",
      reducedMotion: false,
      voiceEnabled: C.voice?.enabled !== false,
      voiceName: C.voice?.voiceName || "",
      language: C.voice?.language || "en-IN",
      rate: Number(C.voice?.rate || 1),
      pitch: Number(C.voice?.pitch || 1),
      greeting: C.robot?.greeting || "Namaste! What shall we discover today?"
    },
    availableVoices: [],
    recognition: null,
    listening: false,
    pendingTranscript: "",
    speechGeneration: 0,
    cameraStream: null,
    capturedDataUrl: null,
    monitorStream: null,
    monitorCameraStream: null,
    audioContext: null,
    analyser: null,
    sourceNode: null,
    monitorFrame: 0,
    monitorRunning: false,
    currentLevel: 0,
    alertActive: false,
    alarmMuted: false,
    alarmAcknowledged: false,
    alarmTimer: null,
    clearSince: null,
    toastTimer: null,
    idleTimer: null,
    idleActionTimer: null
  };

  const configKey = String(C.gemini?.apiKey || "").trim();
  const configuredModel = String(C.gemini?.model || "gemini-3.5-flash-lite").trim();

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function showToast(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function setConnection(message, good = true) {
    const el = $("connectionStatus");
    if (!el) return;
    el.innerHTML = `<span class="status-dot" style="background:${good ? "#65a66d" : "#d99a43"}"></span>${escapeHTML(message)}`;
  }

  function setRobot(mood = "curious", greeting) {
    const robot = $("robot");
    const expression = $("robotExpression");
    const greetingEl = $("robotGreeting");
    if (robot) {
      robot.classList.remove("happy", "thinking", "talking", "alert", "yawning");
      if (["happy", "thinking", "talking", "alert", "yawning"].includes(mood)) {
        robot.classList.add(mood);
      }
    }
    const labels = {
      curious: "Feeling curious",
      happy: "Ready to help",
      thinking: "Thinking it through",
      talking: "Explaining an idea",
      alert: "Classroom alert",
      yawning: "A little sleepy"
    };
    if (expression) expression.textContent = labels[mood] || labels.curious;
    if (greetingEl && greeting !== undefined) greetingEl.textContent = greeting;
  }

  function startIdleAnimations() {
    clearTimeout(state.idleTimer);
    clearTimeout(state.idleActionTimer);

    const scheduleBlink = () => {
      state.idleTimer = setTimeout(() => {
        if (!$("robot") || $("alarmOverlay")?.hidden === false) {
          scheduleBlink();
          return;
        }
        const robot = $("robot");
        robot?.classList.add("blink");
        setTimeout(() => robot?.classList.remove("blink"), 150);
        scheduleBlink();
      }, 2300 + Math.random() * 3600);
    };

    const scheduleIdleAction = () => {
      state.idleActionTimer = setTimeout(() => {
        const robot = $("robot");
        if (!robot || state.busy || state.listening || state.monitorRunning ||
            $("alarmOverlay")?.hidden === false) {
          scheduleIdleAction();
          return;
        }

        if (Math.random() < 0.45) {
          robot.classList.add("yawning");
          setRobot("yawning");
          setTimeout(() => {
            robot.classList.remove("yawning");
            if (!state.busy) setRobot("curious");
          }, 1000);
        } else {
          robot.classList.add("happy");
          setTimeout(() => {
            robot.classList.remove("happy");
            if (!state.busy) setRobot("curious");
          }, 1100);
        }
        scheduleIdleAction();
      }, 15000 + Math.random() * 20000);
    };

    scheduleBlink();
    scheduleIdleAction();
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(C.storage?.settingsKey || "chinmayaAI.settings.v1") || "{}");
      state.settings = { ...state.settings, ...saved };
    } catch (_) {
      // Ignore invalid local settings and use config defaults.
    }

    try {
      const theme = localStorage.getItem(C.storage?.themeKey || "chinmayaAI.theme.v1");
      if (theme === "light" || theme === "dark") state.settings.theme = theme;
    } catch (_) {}
  }

  function saveSettingsToStorage() {
    try {
      localStorage.setItem(C.storage?.settingsKey || "chinmayaAI.settings.v1", JSON.stringify(state.settings));
      localStorage.setItem(C.storage?.themeKey || "chinmayaAI.theme.v1", state.settings.theme);
    } catch (_) {
      showToast("Settings could not be saved in this browser.");
    }
  }

  function applyTheme() {
    const dark = state.settings.theme === "dark";
    document.body.classList.toggle("dark", dark);
    $("themeIcon").textContent = dark ? "☀" : "☾";
    $("themeLabel").textContent = dark ? "Light mode" : "Dark mode";
    $("settingsThemeText").textContent = dark ? "Dark" : "Light";
    $("settingsThemeToggle").classList.toggle("active", dark);
    $("settingsThemeToggle").setAttribute("aria-pressed", String(dark));
  }

  function toggleTheme() {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveSettingsToStorage();
  }

  function applyReducedMotion() {
    document.body.classList.toggle("reduce-motion", !!state.settings.reducedMotion);
    $("motionToggle").classList.toggle("active", !!state.settings.reducedMotion);
    $("motionToggle").setAttribute("aria-pressed", String(!!state.settings.reducedMotion));
    $("motionText").textContent = state.settings.reducedMotion ? "On" : "Off";
  }

  function applyVoiceSettingsToUI() {
    $("voiceToggle").classList.toggle("active", !!state.settings.voiceEnabled);
    $("voiceToggle").setAttribute("aria-pressed", String(!!state.settings.voiceEnabled));
    $("voiceToggleText").textContent = state.settings.voiceEnabled ? "On" : "Off";
    $("sideVoice").querySelector("small").textContent = state.settings.voiceEnabled ? "Speak answers" : "Voice disabled";
    $("voiceRate").value = state.settings.rate;
    $("voicePitch").value = state.settings.pitch;
    $("voiceRateValue").textContent = `${Number(state.settings.rate).toFixed(2).replace(/0$/, "")}×`;
    $("voicePitchValue").textContent = Number(state.settings.pitch).toFixed(1);
    $("languageSelect").value = state.settings.language || "en-IN";
    $("greetingInput").value = state.settings.greeting || "";
    if ($("robotGreeting")) $("robotGreeting").textContent = state.settings.greeting;
  }

  function openModal(id) {
    const modal = $(id);
    if (modal) {
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(id) {
    const modal = $(id);
    if (modal) modal.hidden = true;
    if (![...document.querySelectorAll(".modal-backdrop")].some((el) => !el.hidden)) {
      document.body.style.overflow = "";
    }
    if (id === "cameraBackdrop") stopCamera();
    if (id === "monitorBackdrop" && !state.teacherLoggedIn) stopMonitorCamera();
  }

  function renderSubjects() {
    const grid = $("subjectGrid");
    grid.replaceChildren();

    (C.subjects || []).forEach((subject) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "subject-button";
      button.style.setProperty("--subject-colour", subject.color || "#34764b");
      button.style.setProperty("--subject-bg", subject.background || "#e3f4df");
      button.innerHTML = `<span class="subject-icon">${escapeHTML(subject.icon || "✦")}</span><span>${escapeHTML(subject.name)}</span>`;
      button.addEventListener("click", () => selectSubject(subject.name, button));
      grid.appendChild(button);
    });
  }

  function selectSubject(name, clickedButton) {
    state.subject = name;
    $("selectedSubjectLabel").textContent = name;
    document.querySelectorAll(".subject-button").forEach((button) => {
      button.classList.toggle("selected", button === clickedButton ||
        button.textContent.trim().includes(name));
    });
    $("messageInput").placeholder = `Ask about ${name}...`;
    setRobot("happy", `Let's explore ${name} together!`);
  }

  function renderMessage(role, text, spokenSummary = "") {
    const isUser = role === "user";
    const article = document.createElement("article");
    article.className = `message ${isUser ? "user-message" : "assistant-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = isUser ? "●" : "✦";

    const content = document.createElement("div");
    content.className = "message-content";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = isUser ? "You" : (C.robot?.name || "Chin Yantra");
    const time = document.createElement("span");
    time.textContent = " • Just now";
    meta.appendChild(time);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    // Preserve text safely and render paragraphs without interpreting HTML.
    String(text).split(/\n{2,}/).forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      bubble.appendChild(p);
    });

    content.append(meta, bubble);

    if (!isUser) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const speakButton = document.createElement("button");
      speakButton.type = "button";
      speakButton.className = "speak-message";
      speakButton.textContent = "▶ Listen";
      speakButton.addEventListener("click", () => speakText(spokenSummary || text));
      actions.appendChild(speakButton);
      content.appendChild(actions);
    }

    if (!isUser) article.appendChild(avatar);
    article.appendChild(content);
    $("chatMessages").appendChild(article);
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
    return article;
  }

  function setBusy(busy) {
    state.busy = busy;
    $("sendButton").disabled = busy;
    $("thinkingBar").hidden = !busy;
    $("messageInput").disabled = busy;
    if (busy) {
      setRobot("thinking");
      setConnection("Thinking...");
    } else {
      $("messageInput").disabled = false;
      setRobot("curious");
      setConnection("Ready to learn");
    }
  }

  function cleanModelJSON(raw) {
    let source = String(raw || "").trim();
    source = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed === "string") return { answer: parsed, spokenSummary: parsed };
      return {
        answer: String(parsed.answer || parsed.response || parsed.text || ""),
        spokenSummary: String(parsed.spokenSummary || parsed.spoken_summary || parsed.summary || parsed.answer || "")
      };
    } catch (_) {
      // A model or model version might ignore the JSON-only instruction.
      const marker = source.match(/(?:SPOKEN SUMMARY|VOICE SUMMARY)\s*:\s*([\s\S]*)$/i);
      if (marker) {
        const answer = source.slice(0, marker.index).replace(/^(?:ANSWER|DETAILED ANSWER)\s*:\s*/i, "").trim();
        return { answer: answer || source, spokenSummary: marker[1].trim() };
      }
      return { answer: source || "I couldn't generate a response. Please try again.", spokenSummary: source };
    }
  }

  function getApiKey() {
    if (!configKey || configKey === "PASTE YOUR API KEY HERE") return "";
    return configKey;
  }

  async function callGemini(contents, systemInstruction) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Add your Gemini API key to config.js first, then reload the page.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuredModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: Number(C.gemini?.temperature ?? 0.65),
        maxOutputTokens: Number(C.gemini?.maxOutputTokens ?? 1400),
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || `Gemini request failed (HTTP ${response.status}).`;
      throw new Error(detail);
    }

    const raw = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    if (!raw) {
      if (data.promptFeedback?.blockReason) {
        throw new Error("The request was blocked by the model's safety filters. Try rephrasing it.");
      }
      throw new Error("Gemini returned an empty answer. Please try again.");
    }
    return cleanModelJSON(raw);
  }

  async function sendMessage(textOverride, extraImagePart = null) {
    if (state.busy) return;

    const input = $("messageInput");
    const text = String(textOverride ?? input.value).trim();
    if (!text && !extraImagePart) return;

    const visibleUserText = text || "Please analyse this image.";
    renderMessage("user", visibleUserText);
    input.value = "";
    input.style.height = "auto";

    const parts = [{ text: `Selected subject: ${state.subject}\nStudent message: ${visibleUserText}` }];
    if (extraImagePart) parts.push(extraImagePart);

    const userContent = { role: "user", parts };
    const previousHistory = state.history.slice(-12);
    const requestContents = [...previousHistory, userContent];

    setBusy(true);
    try {
      const systemInstruction = [
        C.robot?.systemInstruction || "You are a helpful learning companion.",
        `The current subject is ${state.subject}.`,
        "The chat answer should be detailed enough to be useful but easy to read.",
        "The spokenSummary should be a short and simple explanation, normally one to three sentences.",
        "If an image is included, describe only what can reasonably be seen and say when something is unclear.",
        "Return JSON with answer and spokenSummary string properties."
      ].join("\n");

      const result = await callGemini(requestContents, systemInstruction);
      const answer = result.answer || "I couldn't prepare an answer this time. Please try again.";
      const spokenSummary = result.spokenSummary || answer;

      state.history.push(userContent, {
        role: "model",
        parts: [{ text: JSON.stringify({ answer, spokenSummary }) }]
      });
      if (state.history.length > 24) state.history = state.history.slice(-24);

      renderMessage("assistant", answer, spokenSummary);
      setRobot("happy", "Great question! Let's keep learning.");
      if (state.settings.voiceEnabled) speakText(spokenSummary);
    } catch (error) {
      const message = error?.message || "Something went wrong. Please try again.";
      renderMessage("assistant", `I couldn't complete that request.\n\n${message}\n\nCheck your internet connection, API key and model name in config.js.`);
      showToast(message);
      setConnection("Needs attention", false);
      setRobot("curious");
    } finally {
      setBusy(false);
    }
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const robot = $("robot");
    robot?.classList.remove("talking");
  }

  function getSelectedVoice() {
    const voices = state.availableVoices;
    if (!voices.length) return null;

    if (state.settings.voiceName) {
      const exact = voices.find((voice) => voice.name === state.settings.voiceName);
      if (exact) return exact;
    }

    const lang = state.settings.language || "en-IN";
    return voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
      || voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
      || voices[0];
  }

  function populateVoices() {
    if (!("speechSynthesis" in window)) {
      $("voiceState").textContent = "Speech unavailable";
      return;
    }

    state.availableVoices = window.speechSynthesis.getVoices() || [];
    const select = $("voiceSelect");
    if (!select) return;

    const oldValue = state.settings.voiceName;
    select.replaceChildren(new Option("Default English voice", ""));
    state.availableVoices.forEach((voice) => {
      const option = new Option(`${voice.name} (${voice.lang})`, voice.name);
      select.appendChild(option);
    });
    select.value = oldValue;
  }

  function speakText(text) {
    if (!state.settings.voiceEnabled) {
      showToast("Voice answers are turned off in Settings.");
      return;
    }
    if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
      showToast("Speech playback is not supported in this browser.");
      return;
    }

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(String(text || "").slice(0, 6000));
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = state.settings.language || "en-IN";
    utterance.rate = Math.max(.75, Math.min(1.25, Number(state.settings.rate || 1)));
    utterance.pitch = Math.max(.8, Math.min(1.2, Number(state.settings.pitch || 1)));

    utterance.onstart = () => {
      $("voiceState").textContent = "Speaking...";
      $("robot")?.classList.add("talking");
      setRobot("talking");
    };
    utterance.onend = () => {
      $("voiceState").textContent = state.listening ? "Listening..." : "Voice ready";
      $("robot")?.classList.remove("talking");
      if (!state.busy) setRobot("curious");
    };
    utterance.onerror = (event) => {
      $("voiceState").textContent = "Voice ready";
      $("robot")?.classList.remove("talking");
      if (event.error !== "canceled" && event.error !== "interrupted") {
        showToast("Speech playback failed. Try another browser voice.");
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function setListeningUI(listening) {
    state.listening = listening;
    $("micButton").classList.toggle("listening", listening);
    $("micButton").setAttribute("aria-label", listening ? "Stop voice input" : "Start voice input");
    $("voiceState").textContent = listening ? "Listening... speak now" : "Voice ready";
    if (listening) setRobot("happy", "I'm listening. Your words will send automatically.");
    else if (!state.busy) setRobot("curious");
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      $("micButton").disabled = true;
      $("voiceState").textContent = "Use Chrome for voice input";
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = state.settings.language || C.speechRecognition?.language || "en-IN";
    state.recognition = recognition;

    recognition.onstart = () => {
      state.pendingTranscript = "";
      setListeningUI(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) state.pendingTranscript += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      const displayed = `${state.pendingTranscript}${interim}`.trim();
      if (displayed) $("messageInput").value = displayed;
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showToast("Microphone permission was denied. Allow microphone access in your browser settings.");
        setListeningUI(false);
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        showToast(`Voice input issue: ${event.error}`);
      }
    };

    recognition.onend = () => {
      const finalText = state.pendingTranscript.trim();
      setListeningUI(false);
      state.pendingTranscript = "";

      if (finalText && C.speechRecognition?.autoSend !== false) {
        $("messageInput").value = "";
        sendMessage(finalText);
      } else if (finalText) {
        $("messageInput").value = finalText;
      }
    };
  }

  function toggleRecognition() {
    if (!state.recognition) {
      showToast("Voice recognition is not available. Try Chrome or Edge on HTTPS or localhost.");
      return;
    }
    if (state.listening) {
      state.recognition.stop();
    } else {
      stopSpeaking();
      state.pendingTranscript = "";
      try {
        state.recognition.lang = state.settings.language || "en-IN";
        state.recognition.start();
      } catch (_) {
        showToast("Voice input is already starting. Please wait a moment.");
      }
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera access requires a supported browser and a secure context such as localhost or HTTPS.");
      return;
    }
    try {
      stopCamera();
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      $("cameraVideo").srcObject = state.cameraStream;
      $("cameraVideo").hidden = false;
      $("cameraPlaceholder").hidden = true;
      $("startCamera").disabled = true;
      $("captureImage").disabled = false;
      $("stopCamera").disabled = false;
      $("captureStatus").textContent = "Camera is on. Capture a frame when ready.";
    } catch (error) {
      showToast(`Could not start camera: ${error.message || "permission denied"}`);
    }
  }

  function stopCamera() {
    if (state.cameraStream) state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
    const video = $("cameraVideo");
    if (video) {
      video.srcObject = null;
      video.hidden = true;
    }
    if ($("cameraPlaceholder")) $("cameraPlaceholder").hidden = false;
    if ($("startCamera")) $("startCamera").disabled = false;
    if ($("captureImage")) $("captureImage").disabled = true;
    if ($("stopCamera")) $("stopCamera").disabled = true;
    if ($("captureStatus")) $("captureStatus").textContent = "Camera is off.";
  }

  function captureImage() {
    const video = $("cameraVideo");
    if (!video || !video.videoWidth || !video.videoHeight) {
      showToast("Wait for the camera preview to appear, then try again.");
      return;
    }

    const canvas = $("cameraCanvas");
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    state.capturedDataUrl = canvas.toDataURL("image/jpeg", .82);
    $("capturedImage").src = state.capturedDataUrl;
    $("capturedImage").hidden = false;
    $("analyseImage").disabled = false;
    $("captureStatus").textContent = "Frame captured. It will only be sent when you select Analyse image.";
  }

  async function analyseImage() {
    if (!state.capturedDataUrl) {
      showToast("Capture a frame first.");
      return;
    }
    const question = $("imageQuestion").value.trim() || "Describe what is visible and explain anything educational that stands out.";
    const base64 = state.capturedDataUrl.split(",")[1];
    if (!base64) {
      showToast("The captured image could not be read.");
      return;
    }
    closeModal("cameraBackdrop");
    await sendMessage(question, { inlineData: { mimeType: "image/jpeg", data: base64 } });
  }

  function openTeacherTools() {
    if (state.teacherLoggedIn) {
      openModal("monitorBackdrop");
      return;
    }
    $("teacherPasswordInput").value = "";
    $("loginError").textContent = "";
    openModal("teacherBackdrop");
  }

  function teacherLogin() {
    const entered = $("teacherPasswordInput").value;
    if (entered !== String(C.teacher?.password || "1234")) {
      $("loginError").textContent = "That password is incorrect. Please try again.";
      return;
    }
    state.teacherLoggedIn = true;
    $("loginError").textContent = "";
    closeModal("teacherBackdrop");
    $("guestMonitorNotice").hidden = true;
    $("teacherMonitorControls").hidden = false;
    openModal("monitorBackdrop");
    showToast("Teacher tools unlocked for this demonstration.");
  }

  function teacherLogout() {
    stopMonitor();
    stopMonitorCamera();
    state.teacherLoggedIn = false;
    closeModal("monitorBackdrop");
    showToast("Teacher tools locked.");
  }

  async function startMonitor() {
    if (!state.teacherLoggedIn) {
      showToast("Teacher access is required.");
      return;
    }
    if (state.monitorRunning) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Microphone access requires HTTPS or localhost in a supported browser.");
      return;
    }

    try {
      state.monitorStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");

      state.audioContext = new AudioContextClass();
      await state.audioContext.resume();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 1024;
      state.analyser.smoothingTimeConstant = 0.22;
      state.sourceNode = state.audioContext.createMediaStreamSource(state.monitorStream);
      state.sourceNode.connect(state.analyser);

      state.monitorRunning = true;
      state.clearSince = null;
      $("monitorStart").disabled = true;
      $("monitorStop").disabled = false;
      $("monitorStatus").classList.add("running");
      $("monitorStatus").lastElementChild.textContent = "Microphone monitor running";
      setConnection("Classroom monitor active");
      showToast("Classroom sound monitor started.");
      monitorLoop();
    } catch (error) {
      stopMonitor();
      showToast(`Could not start the microphone: ${error.message || "permission denied"}`);
    }
  }

  function monitorLoop() {
    if (!state.monitorRunning || !state.analyser) return;
    const buffer = new Uint8Array(state.analyser.fftSize);
    state.analyser.getByteTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = (buffer[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / buffer.length);

    // A relative input indicator, not a calibrated decibel measurement.
    const percent = Math.min(100, Math.round(rms * 330));
    state.currentLevel = percent;

    $("soundLevelText").textContent = `${percent}%`;
    $("soundMeterFill").style.width = `${percent}%`;
    $("alarmLevelText").textContent = `${percent}%`;

    const threshold = Number($("noiseThreshold").value || C.classroom?.alertThreshold || 85);
    if (percent >= threshold) {
      state.clearSince = null;
      if (!state.alertActive) triggerAlarm(percent);
      else $("alarmLevelText").textContent = `${percent}%`;
    } else if (state.alertActive) {
      if (percent < Number(C.classroom?.clearBelowPercent ?? 75)) {
        if (!state.clearSince) state.clearSince = Date.now();
        const clearDelay = Number(C.classroom?.clearDelayMs ?? 2500);
        if (Date.now() - state.clearSince >= clearDelay) clearAlarm();
      } else {
        state.clearSince = null;
      }
    }

    state.monitorFrame = requestAnimationFrame(monitorLoop);
  }

  function playAlarmBeep() {
    if (state.alarmMuted || !state.alertActive) return;
    try {
      if (!state.audioContext || state.audioContext.state === "closed") return;
      if (state.audioContext.state === "suspended") state.audioContext.resume();

      const oscillator = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      const now = state.audioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = Number(C.classroom?.beepFrequency || 880);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Number(C.classroom?.alarmVolume || 0.30), now + 0.025);
      gain.gain.setValueAtTime(Number(C.classroom?.alarmVolume || 0.30), now + .12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + .24);
      oscillator.connect(gain);
      gain.connect(state.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + .26);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch (error) {
      console.warn("Alarm audio could not play:", error);
    }
  }

  function triggerAlarm(percent) {
    state.alertActive = true;
    state.alarmAcknowledged = false;
    state.clearSince = null;
    $("alarmOverlay").hidden = false;
    $("alarmLevelText").textContent = `${percent}%`;
    $("alarmDescription").textContent = `The microphone input has crossed the ${$("noiseThreshold").value}% threshold. Please lower the classroom volume.`;
    $("robot").classList.add("alert");
    setRobot("alert", "Classroom noise is too high. Let's bring the volume down.");
    document.body.classList.add("alarm-active");

    clearInterval(state.alarmTimer);
    playAlarmBeep();
    state.alarmTimer = setInterval(playAlarmBeep, Number(C.classroom?.beepIntervalMs || 650));

    // The initial microphone permission click also unlocks browser audio in most browsers.
    if (!state.alarmMuted && "speechSynthesis" in window) {
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(
        C.classroom?.spokenAlert ||
        "Classroom noise is too high. Please lower your voices so everyone can learn."
      );
      utterance.lang = state.settings.language || "en-IN";
      utterance.rate = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  }

  function silenceAlarm() {
    state.alarmMuted = !state.alarmMuted;
    $("alarmMute").textContent = state.alarmMuted ? "Enable alarm sound" : "Mute alarm";
    $("alarmOverlayMute").textContent = state.alarmMuted ? "Enable alarm sound" : "Mute alarm sound";
    $("monitorMuteStatus").textContent = state.alarmMuted
      ? "Alarm sound is muted; the visual alert remains active."
      : "Alarm sound is enabled.";
    if (state.alarmMuted) {
      clearInterval(state.alarmTimer);
      state.alarmTimer = null;
      stopSpeaking();
    } else if (state.alertActive) {
      playAlarmBeep();
      state.alarmTimer = setInterval(playAlarmBeep, Number(C.classroom?.beepIntervalMs || 650));
    }
  }

  function acknowledgeAlarm() {
    state.alarmAcknowledged = true;
    $("alarmTitle").textContent = "Alert acknowledged";
    $("alarmDescription").textContent = "The classroom alert remains active until the input level stays below the clearing threshold.";
    showToast("Alert acknowledged. The screen will return to normal when the level drops.");
  }

  function clearAlarm() {
    state.alertActive = false;
    state.clearSince = null;
    clearInterval(state.alarmTimer);
    state.alarmTimer = null;
    stopSpeaking();
    $("alarmOverlay").hidden = true;
    $("robot").classList.remove("alert");
    document.body.classList.remove("alarm-active");
    $("alarmTitle").textContent = "Noise level is too high!";
    $("alarmDescription").textContent = "The microphone level has crossed the configured threshold. Please lower the classroom volume.";
    setRobot("curious");
    if (state.monitorRunning) setConnection("Classroom monitor active");
  }

  async function stopMonitor() {
    state.monitorRunning = false;
    if (state.monitorFrame) cancelAnimationFrame(state.monitorFrame);
    state.monitorFrame = 0;

    if (state.monitorStream) {
      state.monitorStream.getTracks().forEach((track) => track.stop());
      state.monitorStream = null;
    }

    try {
      if (state.sourceNode) state.sourceNode.disconnect();
      if (state.analyser) state.analyser.disconnect();
      if (state.audioContext && state.audioContext.state !== "closed") {
        await state.audioContext.close();
      }
    } catch (_) {}

    state.sourceNode = null;
    state.analyser = null;
    state.audioContext = null;

    if (state.alertActive) clearAlarm();
    $("monitorStart").disabled = false;
    $("monitorStop").disabled = true;
    $("monitorStatus").classList.remove("running");
    $("monitorStatus").lastElementChild.textContent = "Monitor stopped";
    $("soundLevelText").textContent = "0%";
    $("soundMeterFill").style.width = "0%";
    setConnection("Ready to learn");
  }

  async function startMonitorCamera() {
    if (!state.teacherLoggedIn) {
      showToast("Teacher access is required.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera access requires HTTPS or localhost.");
      return;
    }
    try {
      stopMonitorCamera();
      state.monitorCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      $("monitorVideo").srcObject = state.monitorCameraStream;
      $("monitorVideo").hidden = false;
      $("monitorCameraPlaceholder").hidden = true;
      $("monitorCameraStart").disabled = true;
      $("monitorCameraStop").disabled = false;
    } catch (error) {
      showToast(`Could not start classroom camera: ${error.message || "permission denied"}`);
    }
  }

  function stopMonitorCamera() {
    if (state.monitorCameraStream) state.monitorCameraStream.getTracks().forEach((track) => track.stop());
    state.monitorCameraStream = null;
    if ($("monitorVideo")) {
      $("monitorVideo").srcObject = null;
      $("monitorVideo").hidden = true;
    }
    if ($("monitorCameraPlaceholder")) $("monitorCameraPlaceholder").hidden = false;
    if ($("monitorCameraStart")) $("monitorCameraStart").disabled = false;
    if ($("monitorCameraStop")) $("monitorCameraStop").disabled = true;
  }

  function setupEvents() {
    $("chatForm").addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage();
    });

    $("messageInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    $("newChat").addEventListener("click", () => {
      if (state.busy) return showToast("Please wait for the current answer to finish.");
      state.history = [];
      $("chatMessages").replaceChildren();
      renderMessage("assistant", "Namaste! A fresh learning space is ready. What would you like to explore?");
      setRobot("happy", "A fresh start. What shall we discover?");
    });

    $("clearChat")?.addEventListener("click", () => {
      state.history = [];
      $("chatMessages").replaceChildren();
    });

    document.querySelectorAll(".quick-prompt").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.dataset.prompt || "";
        const current = $("messageInput").value.trim();
        sendMessage(current ? `${current}\n\n${prompt}` : prompt);
      });
    });

    document.addEventListener("click", (event) => {
      const speakButton = event.target.closest(".speak-message");
      if (speakButton) {
        const message = speakButton.closest(".message");
        const paragraphs = [...(message?.querySelectorAll(".message-bubble p") || [])];
        if (paragraphs.length) speakText(paragraphs.map((p) => p.textContent).join("\n"));
      }
    });

    $("themeToggle").addEventListener("click", toggleTheme);
    $("settingsThemeToggle").addEventListener("click", toggleTheme);
    $("settingsOpen").addEventListener("click", () => openModal("settingsBackdrop"));
    $("sideSettings").addEventListener("click", () => openModal("settingsBackdrop"));
    $("sideVoice").addEventListener("click", () => {
      state.settings.voiceEnabled = !state.settings.voiceEnabled;
      applyVoiceSettingsToUI();
      saveSettingsToStorage();
      if (!state.settings.voiceEnabled) stopSpeaking();
      showToast(state.settings.voiceEnabled ? "Spoken answers enabled." : "Spoken answers disabled.");
    });

    $("motionToggle").addEventListener("click", () => {
      state.settings.reducedMotion = !state.settings.reducedMotion;
      applyReducedMotion();
      saveSettingsToStorage();
    });

    $("voiceToggle").addEventListener("click", () => {
      state.settings.voiceEnabled = !state.settings.voiceEnabled;
      applyVoiceSettingsToUI();
      saveSettingsToStorage();
      if (!state.settings.voiceEnabled) stopSpeaking();
    });

    $("voiceSelect").addEventListener("change", () => {
      state.settings.voiceName = $("voiceSelect").value;
      saveSettingsToStorage();
    });

    $("languageSelect").addEventListener("change", () => {
      state.settings.language = $("languageSelect").value;
      if (state.recognition) state.recognition.lang = state.settings.language;
      saveSettingsToStorage();
    });

    $("voiceRate").addEventListener("input", () => {
      state.settings.rate = Number($("voiceRate").value);
      $("voiceRateValue").textContent = `${state.settings.rate.toFixed(2).replace(/0$/, "")}×`;
    });
    $("voicePitch").addEventListener("input", () => {
      state.settings.pitch = Number($("voicePitch").value);
      $("voicePitchValue").textContent = state.settings.pitch.toFixed(1);
    });

    $("saveSettings").addEventListener("click", () => {
      state.settings.greeting = $("greetingInput").value.trim() || "Namaste! What shall we discover today?";
      state.settings.rate = Number($("voiceRate").value);
      state.settings.pitch = Number($("voicePitch").value);
      applyVoiceSettingsToUI();
      saveSettingsToStorage();
      showToast("Your settings have been saved.");
      closeModal("settingsBackdrop");
    });

    $("micButton").addEventListener("click", toggleRecognition);
    $("stopSpeaking").addEventListener("click", () => {
      stopSpeaking();
      $("voiceState").textContent = "Voice stopped";
    });

    $("cameraOpen").addEventListener("click", () => openModal("cameraBackdrop"));
    $("sideCamera").addEventListener("click", () => openModal("cameraBackdrop"));
    $("startCamera").addEventListener("click", startCamera);
    $("captureImage").addEventListener("click", captureImage);
    $("stopCamera").addEventListener("click", stopCamera);
    $("analyseImage").addEventListener("click", analyseImage);

    $("teacherOpen").addEventListener("click", openTeacherTools);
    $("teacherLogin").addEventListener("click", teacherLogin);
    $("teacherPasswordInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") teacherLogin();
    });
    $("showPassword").addEventListener("click", () => {
      const input = $("teacherPasswordInput");
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      $("showPassword").textContent = reveal ? "Hide" : "Show";
    });
    $("teacherLogout").addEventListener("click", teacherLogout);

    $("monitorStart").addEventListener("click", startMonitor);
    $("monitorStop").addEventListener("click", stopMonitor);
    $("monitorCameraStart").addEventListener("click", startMonitorCamera);
    $("monitorCameraStop").addEventListener("click", stopMonitorCamera);
    $("alarmMute").addEventListener("click", silenceAlarm);
    $("alarmOverlayMute").addEventListener("click", silenceAlarm);
    $("dismissAlarm").addEventListener("click", acknowledgeAlarm);

    $("noiseThreshold").addEventListener("input", () => {
      $("thresholdLabel").textContent = `${$("noiseThreshold").value}%`;
    });

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(backdrop.id);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.querySelectorAll(".modal-backdrop").forEach((modal) => {
          if (!modal.hidden) closeModal(modal.id);
        });
      }
    });

    window.addEventListener("beforeunload", () => {
      stopCamera();
      stopMonitorCamera();
      if (state.monitorStream) state.monitorStream.getTracks().forEach((track) => track.stop());
      stopSpeaking();
    });
  }

  function init() {
    loadSettings();
    $("robotName").textContent = C.robot?.name || "Chin Yantra";
    $("robotGreeting").textContent = state.settings.greeting;
    renderSubjects();
    applyTheme();
    applyReducedMotion();
    applyVoiceSettingsToUI();
    populateVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
    setupRecognition();
    setupEvents();
    startIdleAnimations();

    if (!getApiKey()) {
      setConnection("Add API key to begin", false);
    } else {
      setConnection("Ready to learn");
    }
  }

  init();
})();
