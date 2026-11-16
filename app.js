
"use strict";

(() => {
  const CFG = window.APP_CONFIG;
  if (!CFG) {
    console.error("APP_CONFIG is missing. Check that config.js loads before app.js.");
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    subject: CFG.defaultSubject || "General",
    history: [],
    lastAnswer: "",
    busy: false,
    imageData: null,
    cameraStream: null,
    recognition: null,
    micStream: null,
    audioContext: null,
    monitorFrame: null,
    noteId: null,
    notes: [],
    teacherLoggedIn: false,
    theme: "light"
  };

  const el = {
    messages: $("#chatMessages"),
    welcome: $("#welcomeCard"),
    form: $("#chatForm"),
    input: $("#messageInput"),
    send: $("#sendBtn"),
    voice: $("#voiceBtn"),
    camera: $("#cameraBtn"),
    attachmentPreview: $("#attachmentPreview"),
    attachmentImage: $("#attachmentImage"),
    removeAttachment: $("#removeAttachmentBtn"),
    robot: $("#robot"),
    robotStatus: $("#robotStatus"),
    robotSub: $("#robotSubStatus"),
    robotMouth: $("#robotMouth"),
    toast: $("#toast")
  };

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove("show"), 3000);
  }

  function setRobot(mode, title, subtitle) {
    el.robot.classList.remove("thinking", "speaking", "happy");
    if (mode) el.robot.classList.add(mode);
    el.robotStatus.textContent = title;
    el.robotSub.textContent = subtitle;
  }

  function scrollMessages() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function addMessage(role, text, image = null) {
    if (el.welcome) el.welcome.remove();

    const wrapper = document.createElement("article");
    wrapper.className = `message ${role}`;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "Y" : "✦";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "Image attached to question";
      img.className = "message-image";
      bubble.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "message-text";
    body.textContent = text;
    bubble.appendChild(body);

    wrapper.append(avatar, bubble);
    el.messages.appendChild(wrapper);
    scrollMessages();
    return wrapper;
  }

  function addTyping() {
    const node = addMessage("assistant", "Chin Yantra is thinking...");
    node.classList.add("typing-message");
    setRobot("thinking", "Thinking...", "Finding the best explanation.");
    return node;
  }

  function formatAnswer(text) {
    // Safe lightweight formatting: escape HTML before adding basic Markdown.
    let output = escapeHTML(text);
    output = output.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*(.*?)\*/g, "<em>$1</em>");
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/^### (.*)$/gm, "<h4>$1</h4>");
    output = output.replace(/^## (.*)$/gm, "<h3>$1</h3>");
    output = output.replace(/^# (.*)$/gm, "<h3>$1</h3>");
    output = output.replace(/^\s*[-*] (.*)$/gm, "• $1");
    output = output.replace(/\n/g, "<br>");
    return output;
  }

  function addFormattedAnswer(node, text) {
    const body = node.querySelector(".message-text");
    body.innerHTML = formatAnswer(text);
    node.classList.remove("typing-message");
    scrollMessages();
  }

  async function callGemini(question, imageData) {
    if (!CFG.apiKey || CFG.apiKey === "PASTE YOUR API KEY HERE") {
      throw new Error("Add your Gemini API key in config.js before using the chatbot.");
    }

    const endpoint = `${CFG.apiBaseUrl}${encodeURIComponent(CFG.model)}:generateContent?key=${encodeURIComponent(CFG.apiKey)}`;

    const contents = state.history.slice(-16).map(item => ({
      role: item.role,
      parts: [{ text: item.text }]
    }));

    const parts = [{ text: `Selected subject: ${state.subject}\nStudent question: ${question}` }];

    if (imageData) {
      const [header, data] = imageData.split(",");
      const mimeType = (header.match(/data:(.*?);base64/) || [])[1] || "image/jpeg";
      parts.push({ inline_data: { mime_type: mimeType, data } });
    }

    contents.push({ role: "user", parts });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: CFG.systemInstruction }]
        },
        contents,
        generationConfig: {
          temperature: CFG.generation.temperature,
          maxOutputTokens: CFG.generation.maxOutputTokens,
          topP: CFG.generation.topP
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data?.error?.message || `Gemini request failed (${response.status}).`;
      throw new Error(detail);
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n")
      .trim();

    if (!answer) throw new Error("Gemini returned an empty response. Please try again.");
    return answer;
  }

  async function sendMessage(question, imageData = null) {
    question = question.trim();
    if ((!question && !imageData) || state.busy) return;

    state.busy = true;
    el.send.disabled = true;
    el.input.disabled = true;

    const displayQuestion = question || "Please explain this image.";
    addMessage("user", displayQuestion, imageData);
    el.input.value = "";
    autoResizeInput();

    const typing = addTyping();

    try {
      const answer = await callGemini(displayQuestion, imageData);
      addFormattedAnswer(typing, answer);
      state.history.push(
        { role: "user", text: displayQuestion },
        { role: "model", text: answer }
      );
      state.lastAnswer = answer;
      setRobot("happy", "Great question!", "Let's keep learning.");
      if (CFG.voice.enabled && CFG.voice.autoSpeak) speak(answer);
    } catch (error) {
      typing.querySelector(".message-text").textContent = `I couldn't complete that request. ${error.message}`;
      typing.classList.remove("typing-message");
      setRobot("", "Ready to help!", "You can try again.");
      console.error(error);
    } finally {
      state.busy = false;
      el.send.disabled = false;
      el.input.disabled = false;
      el.input.focus();
    }
  }

  function autoResizeInput() {
    el.input.style.height = "auto";
    el.input.style.height = `${Math.min(el.input.scrollHeight, 130)}px`;
  }

  // Subject selection
  $$(".subject-card").forEach(button => {
    button.addEventListener("click", () => {
      $$(".subject-card").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      state.subject = button.dataset.subject;
      $("#notesSubject").value = state.subject;
      toast(`${state.subject} selected`);
    });
  });

  // Suggested questions
  $$(".suggestion").forEach(button => {
    button.addEventListener("click", () => sendMessage(button.dataset.question));
  });

  el.form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(el.input.value, state.imageData);
    clearAttachment();
  });

  el.input.addEventListener("input", autoResizeInput);
  el.input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.form.requestSubmit();
    }
  });

  $("#clearChatBtn").addEventListener("click", () => {
    state.history = [];
    state.lastAnswer = "";
    el.messages.innerHTML = "";
    const welcome = document.createElement("div");
    welcome.className = "welcome-card";
    welcome.innerHTML = `<div class="welcome-icon">🌱</div><h2>Ready for a new adventure?</h2><p>Choose a subject and ask your next question!</p>`;
    el.messages.appendChild(welcome);
    setRobot("", "Ready to learn!", "Ask me anything.");
  });

  // Voice output
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("Speech output isn't supported by this browser. Text chat still works.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = CFG.voice.language;
    utterance.rate = CFG.voice.rate;
    utterance.pitch = CFG.voice.pitch;

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === CFG.voice.voiceName);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onstart = () => setRobot("speaking", "Speaking...", "Listen and learn!");
    utterance.onend = () => setRobot("happy", "Done explaining!", "What's next?");
    utterance.onerror = () => setRobot("", "Ready to help!", "You can read the answer too.");
    window.speechSynthesis.speak(utterance);
  }

  // Voice input
  el.voice.addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!CFG.speechRecognition.enabled || !Recognition) {
      toast("Voice input isn't supported here. You can type your question instead.");
      return;
    }

    if (state.recognition) {
      state.recognition.stop();
      state.recognition = null;
      el.voice.classList.remove("recording");
      return;
    }

    const recognition = new Recognition();
    state.recognition = recognition;
    recognition.lang = CFG.speechRecognition.language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      el.voice.classList.add("recording");
      toast("Listening... speak now.");
    };
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      el.input.value = transcript;
      autoResizeInput();
      if (CFG.speechRecognition.autoSend) el.form.requestSubmit();
    };
    recognition.onerror = event => toast(`Voice input error: ${event.error}`);
    recognition.onend = () => {
      el.voice.classList.remove("recording");
      state.recognition = null;
    };

    try { recognition.start(); }
    catch (error) { toast("Couldn't start voice input. Please try again."); }
  });

  // Camera and image attachment
  function showModal(id) {
    const modal = document.getElementById(id);
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function hideModal(id) {
    document.getElementById(id).hidden = true;
    if (!$(".modal-backdrop:not([hidden])")) document.body.classList.remove("modal-open");
    if (id === "cameraModal") stopCamera();
  }

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => hideModal(button.dataset.close));
  });

  $$(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) hideModal(backdrop.id);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-backdrop:not([hidden])").forEach(modal => hideModal(modal.id));
    }
  });

  function showAttachment(dataUrl) {
    state.imageData = dataUrl;
    el.attachmentImage.src = dataUrl;
    el.attachmentPreview.hidden = false;
  }

  function clearAttachment() {
    state.imageData = null;
    el.attachmentImage.removeAttribute("src");
    el.attachmentPreview.hidden = true;
  }

  el.removeAttachment.addEventListener("click", clearAttachment);

  el.camera.addEventListener("click", () => showModal("cameraModal"));

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      $("#cameraStatus").textContent = "Camera isn't supported in this browser. Try uploading an image instead.";
      return;
    }
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false
      });
      $("#cameraVideo").srcObject = state.cameraStream;
      $("#captureBtn").disabled = false;
      $("#cameraStatus").textContent = "Camera ready. Capture when you're ready.";
    } catch (error) {
      $("#cameraStatus").textContent = "Camera permission was unavailable. You can upload an image instead.";
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }
    $("#cameraVideo").srcObject = null;
    $("#captureBtn").disabled = true;
  }

  $("#cameraStartBtn").addEventListener("click", startCamera);

  $("#captureBtn").addEventListener("click", () => {
    const video = $("#cameraVideo");
    if (!video.videoWidth) {
      toast("Start the camera first.");
      return;
    }
    const canvas = $("#cameraCanvas");
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    showAttachment(canvas.toDataURL("image/jpeg", 0.82));
    hideModal("cameraModal");
    toast("Image attached. Add a question and send it.");
  });

  $("#imageUpload").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Please choose an image smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      showAttachment(reader.result);
      hideModal("cameraModal");
      toast("Image attached. Add a question and send it.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  });

  // Notes
  function loadNotes() {
    try {
      state.notes = JSON.parse(localStorage.getItem(CFG.storage.notesKey) || "[]");
      if (!Array.isArray(state.notes)) state.notes = [];
    } catch {
      state.notes = [];
    }
    renderNotes();
  }

  function persistNotes() {
    try {
      localStorage.setItem(CFG.storage.notesKey, JSON.stringify(state.notes));
      renderNotes();
    } catch {
      toast("Couldn't save notes. Your browser storage may be full.");
    }
  }

  function renderNotes() {
    const list = $("#savedNotesList");
    list.innerHTML = "";
    if (!state.notes.length) {
      list.innerHTML = '<p class="empty-notes">No saved notes yet.</p>';
      return;
    }

    state.notes.forEach(note => {
      const button = document.createElement("button");
      button.className = `saved-note ${note.id === state.noteId ? "selected" : ""}`;
      button.innerHTML = `<strong>${escapeHTML(note.title || "Untitled note")}</strong><small>${escapeHTML(note.subject || "General")}</small>`;
      button.addEventListener("click", () => openNote(note.id));
      list.appendChild(button);
    });
  }

  function openNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note) return;
    state.noteId = id;
    $("#notesTitle").value = note.title;
    $("#notesSubject").value = note.subject;
    $("#notesContent").value = note.content;
    renderNotes();
  }

  function resetNote() {
    state.noteId = null;
    $("#notesTitle").value = "";
    $("#notesSubject").value = state.subject;
    $("#notesContent").value = "";
    renderNotes();
  }

  $("#notesOpenBtn").addEventListener("click", () => {
    showModal("notesModal");
    loadNotes();
  });

  $("#newNoteBtn").addEventListener("click", resetNote);

  $("#saveNotesBtn").addEventListener("click", () => {
    const title = $("#notesTitle").value.trim() || "Untitled note";
    const subject = $("#notesSubject").value;
    const content = $("#notesContent").value.trim();

    if (!content) {
      $("#notesStatus").textContent = "Write something before saving.";
      return;
    }

    const now = new Date().toISOString();
    if (state.noteId) {
      const note = state.notes.find(item => item.id === state.noteId);
      if (note) Object.assign(note, { title, subject, content, updatedAt: now });
    } else {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      state.noteId = id;
      state.notes.unshift({ id, title, subject, content, updatedAt: now });
    }

    persistNotes();
    $("#notesStatus").textContent = "Note saved on this device.";
  });

  $("#addChatToNotesBtn").addEventListener("click", () => {
    if (!state.lastAnswer) {
      $("#notesStatus").textContent = "Ask a question first to add its answer.";
      return;
    }
    const current = $("#notesContent").value;
    $("#notesContent").value = `${current}${current ? "\n\n" : ""}${state.lastAnswer}`;
    $("#notesStatus").textContent = "Last answer added to your note.";
  });

  $("#downloadNotesBtn").addEventListener("click", () => {
    const title = $("#notesTitle").value.trim() || "Chinmaya AI Notes";
    const content = `${title}\nSubject: ${$("#notesSubject").value}\n\n${$("#notesContent").value}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w-]+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });

  // Teacher portal
  $("#teacherOpenBtn").addEventListener("click", () => {
    showModal("teacherModal");
    $("#teacherLogin").hidden = state.teacherLoggedIn;
    $("#teacherDashboard").hidden = !state.teacherLoggedIn;
  });

  $("#teacherLoginForm").addEventListener("submit", event => {
    event.preventDefault();
    const password = $("#teacherPasswordInput").value;
    if (password === CFG.teacher.password) {
      state.teacherLoggedIn = true;
      $("#teacherLogin").hidden = true;
      $("#teacherDashboard").hidden = false;
      $("#teacherLoginError").textContent = "";
      $("#teacherPasswordInput").value = "";
    } else {
      $("#teacherLoginError").textContent = "Incorrect password. Please try again.";
    }
  });

  $("#teacherLogoutBtn").addEventListener("click", () => {
    stopMonitor();
    state.teacherLoggedIn = false;
    $("#teacherLogin").hidden = false;
    $("#teacherDashboard").hidden = true;
    hideModal("teacherModal");
  });

  async function startMonitor() {
    if (!navigator.mediaDevices?.getUserMedia) {
      $("#noiseStatus").textContent = "Microphone monitoring isn't supported in this browser.";
      return;
    }

    try {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio analysis is unavailable.");

      state.audioContext = new AudioContextClass();
      const source = state.audioContext.createMediaStreamSource(state.micStream);
      const analyser = state.audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      $("#startMonitorBtn").disabled = true;
      $("#stopMonitorBtn").disabled = false;
      $("#noiseStatus").textContent = "Monitoring microphone activity. Audio is not recorded or saved.";

      const update = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(100, Math.round(rms * 260));
        const smoothed = Number($("#noiseValue").dataset.level || 0) * CFG.classroom.smoothing
          + level * (1 - CFG.classroom.smoothing);

        $("#noiseValue").dataset.level = smoothed;
        $("#noiseValue").textContent = `${Math.round(smoothed)}%`;
        $("#noiseBar").style.width = `${Math.round(smoothed)}%`;

        const loud = smoothed >= CFG.classroom.threshold;
        $("#noiseAlert").hidden = !loud;
        $("#noiseStatus").textContent = loud ? "Noise level is above the configured threshold." : "Classroom noise level is within the configured range.";

        state.monitorFrame = requestAnimationFrame(update);
      };
      update();
    } catch (error) {
      $("#noiseStatus").textContent = "Microphone access failed. Check browser permission and try again.";
      console.error(error);
      stopMonitor();
    }
  }

  function stopMonitor() {
    if (state.monitorFrame) cancelAnimationFrame(state.monitorFrame);
    state.monitorFrame = null;

    if (state.micStream) {
      state.micStream.getTracks().forEach(track => track.stop());
      state.micStream = null;
    }
    if (state.audioContext) {
      state.audioContext.close().catch(() => {});
      state.audioContext = null;
    }

    $("#startMonitorBtn").disabled = false;
    $("#stopMonitorBtn").disabled = true;
    $("#noiseAlert").hidden = true;
    $("#noiseStatus").textContent = "Monitoring stopped.";
  }

  $("#startMonitorBtn").addEventListener("click", startMonitor);
  $("#stopMonitorBtn").addEventListener("click", stopMonitor);

  // Theme
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(CFG.storage.themeKey, theme);
  }

  $("#themeToggle").addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  try {
    setTheme(localStorage.getItem(CFG.storage.themeKey) || "light");
  } catch {
    setTheme("light");
  }

  // Robot eye tracking
  document.addEventListener("pointermove", event => {
    const eyes = $$(".pupil");
    eyes.forEach(pupil => {
      const rect = pupil.parentElement.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(3, Math.hypot(dx, dy) / 100);
      pupil.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
    });
  });

  // Cleanup active hardware resources on page exit.
  window.addEventListener("pagehide", () => {
    stopCamera();
    stopMonitor();
    if (state.recognition) state.recognition.stop();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  });

  loadNotes();
  setRobot("", "Ready to learn!", "Ask me anything.");
  console.info(`${CFG.appName} initialized.`);
})();
