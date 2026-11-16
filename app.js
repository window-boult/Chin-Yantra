
(() => {
  'use strict';

  const raw = window.APP_CONFIG || {};

  const fallback = {
    appName: 'CHINMAYA AI',
    robotName: 'Chin Yantra',
    apiKey: 'PASTE YOUR API KEY HERE',
    model: 'gemini-3.5-flash-lite',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
    language: 'en-IN',
    greeting: 'Your curious learning buddy. What shall we discover today?',
    defaultSubject: 'Mathematics',
    defaultExpression: 'idle',
    reducedMotion: false,

    theme: {
      primary: '#176b45',
      primaryDark: '#104b34',
      secondary: '#f28a27',
      background: '#f6f5ed',
      accent: '#b8d96a',
      cream: '#fff9e9',
      text: '#183d2d'
    },

    voice: {
      enabled: true,
      voiceName: '',
      language: 'en-IN',
      rate: 1,
      pitch: 1.08,
      volume: .9,
      speakByDefault: false,
      showSpeakButton: true,
      allowSpeechRecognition: true
    },

    teacherPassword: '1234',

    monitor: {
      noiseSensitivity: 55,
      soundLevelThreshold: .085,
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
      cameraJpegQuality: .82,
      toastDurationMs: 3200
    },

    subjects: []
  };

  const cfg = {
    ...fallback,
    ...raw,
    theme: { ...fallback.theme, ...(raw.theme || {}) },
    voice: { ...fallback.voice, ...(raw.voice || {}) },
    monitor: { ...fallback.monitor, ...(raw.monitor || {}) },
    interface: { ...fallback.interface, ...(raw.interface || {}) },
    subjects: Array.isArray(raw.subjects) && raw.subjects.length
      ? raw.subjects
      : fallback.subjects
  };

  const $ = id => document.getElementById(id);

  const els = Object.fromEntries([
    'headerStatus',
    'robotStatus',
    'robotNameTitle',
    'robotGreeting',
    'robotStage',
    'subjectGrid',
    'chatSubjectTitle',
    'chatStatus',
    'suggestions',
    'messages',
    'emptyState',
    'messageInput',
    'sendBtn',
    'charCount',
    'voiceToggle',
    'teacherLoginOpen',
    'newChatBtn',
    'clearChatBtn',
    'micBtn',
    'cameraBtn',
    'quizBtn',
    'simplerBtn',
    'exampleBtn',
    'quizBoostBtn',
    'classMonitorOpen',
    'cameraModal',
    'cameraVideo',
    'cameraPlaceholder',
    'cameraQuestion',
    'startCameraBtn',
    'stopCameraBtn',
    'analyseCameraBtn',
    'cameraStatus',
    'teacherModal',
    'teacherLoginForm',
    'teacherPasswordInput',
    'showPasswordBtn',
    'loginError',
    'monitorModal',
    'monitorDot',
    'monitorSummary',
    'dbValue',
    'meterFill',
    'monitorStateText',
    'sensitivityRange',
    'sensitivityLabel',
    'startMonitorBtn',
    'stopMonitorBtn',
    'muteAlarmBtn',
    'teacherLogoutBtn',
    'alarmOverlay',
    'alarmCountdown',
    'dismissAlarmBtn',
    'alarmMuteQuickBtn',
    'toastRegion'
  ].map(id => [id, $(id)]));

  const state = {
    subject: cfg.defaultSubject,
    history: [],
    busy: false,
    requestId: 0,
    expression: cfg.defaultExpression || 'idle',
    voiceEnabled: !!cfg.voice.enabled,
    teacher: false,
    cameraStream: null,
    recognition: null,
    recognitionActive: false,
    speaking: false,
    speechUtterance: null,
    blinkTimer: null,
    monitoring: false,
    audioContext: null,
    analyser: null,
    micStream: null,
    monitorFrame: null,
    overThresholdSince: 0,
    thresholdHits: 0,
    lastAlertAt: 0,
    alertTimer: null,
    alertCountdownTimer: null,
    alarmMuted: !cfg.monitor.defaultAlarmEnabled,
    monitorSensitivity: clamp(
      Number(cfg.monitor.noiseSensitivity) || 55,
      1,
      100
    ),
    cameraBusy: false,
    shuttingDown: false
  };

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function safeText(value) {
    return String(value ?? '');
  }

  function validHex(v, fb) {
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fb;
  }

  function initTheme() {
    const t = cfg.theme;
    const root = document.documentElement;

    root.style.setProperty('--green', validHex(t.primary, fallback.theme.primary));
    root.style.setProperty('--green-dark', validHex(t.primaryDark, fallback.theme.primaryDark));
    root.style.setProperty('--orange', validHex(t.secondary, fallback.theme.secondary));
    root.style.setProperty('--bg', validHex(t.background, fallback.theme.background));
    root.style.setProperty('--cream', validHex(t.cream, fallback.theme.cream));
    root.style.setProperty('--text', validHex(t.text, fallback.theme.text));
    root.style.setProperty('--accent', validHex(t.accent, fallback.theme.accent));

    if (cfg.reducedMotion) {
      document.documentElement.classList.add('force-reduced-motion');
    }

    document.title = `${cfg.appName} · ${cfg.robotName}`;
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`.trim();
    node.textContent = message;
    els.toastRegion.append(node);

    window.setTimeout(
      () => node.remove(),
      Math.max(1500, Number(cfg.interface.toastDurationMs) || 3200)
    );
  }

  function setExpression(expression, status) {
    const allowed = [
      'idle',
      'thinking',
      'listening',
      'speaking',
      'happy',
      'curious',
      'encouraging',
      'error'
    ];

    state.expression = allowed.includes(expression) ? expression : 'idle';
    els.robotStage.dataset.expression = state.expression;

    const map = {
      idle: 'Your learning buddy',
      thinking: 'Chin Yantra is thinking…',
      listening: 'Chin Yantra is listening…',
      speaking: 'Chin Yantra is speaking…',
      happy: 'That was a great question!',
      curious: 'Curiosity activated!',
      encouraging: 'You can do this!',
      error: 'Let’s try that again'
    };

    els.robotStatus.textContent = status || map[state.expression] || map.idle;

    els.headerStatus.textContent =
      state.expression === 'thinking' ? 'Thinking…' :
      state.expression === 'listening' ? 'Listening…' :
      state.expression === 'speaking' ? 'Speaking…' :
      state.monitoring ? 'Monitor active' :
      'Ready to learn';

    els.chatStatus.textContent =
      state.expression === 'thinking' ? 'Working on your answer…' :
      state.expression === 'listening' ? 'Listening to your voice…' :
      state.expression === 'speaking' ? 'Reading response aloud' :
      state.busy ? 'Working…' :
      'Chin Yantra is ready';
  }

  function startBlinking() {
    const schedule = () => {
      if (state.shuttingDown) return;

      const delay = 2800 + Math.random() * 3500;

      state.blinkTimer = setTimeout(() => {
        if (!['thinking', 'listening', 'speaking'].includes(state.expression)) {
          els.robotStage.classList.add('blinking');

          setTimeout(
            () => els.robotStage.classList.remove('blinking'),
            130
          );
        }

        schedule();
      }, delay);
    };

    schedule();
  }

  function initSubjects() {
    els.subjectGrid.replaceChildren();

    cfg.subjects.forEach(subject => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'subject-card';
      b.setAttribute('aria-pressed', String(subject.name === state.subject));
      b.dataset.subject = subject.name;

      const icon = document.createElement('span');
      icon.className = 'subject-icon';
      icon.textContent = subject.icon || '✧';

      const name = document.createElement('strong');
      name.textContent = subject.name;

      const desc = document.createElement('small');
      desc.textContent = subject.description || 'Explore and learn';

      b.append(icon, name, desc);
      b.addEventListener('click', () => selectSubject(subject.name));

      els.subjectGrid.append(b);
    });

    updateSubjectUI();
  }

  function subjectData() {
    return cfg.subjects.find(s => s.name === state.subject) ||
      cfg.subjects[0] ||
      {
        name: state.subject,
        instruction: 'Be a friendly, accurate school tutor.',
        questions: []
      };
  }

  function updateSubjectUI() {
    const sub = subjectData();

    els.chatSubjectTitle.textContent = `Let’s explore ${sub.name}`;
    els.robotGreeting.textContent = cfg.greeting;
    els.suggestions.replaceChildren();

    (sub.questions || []).slice(0, 4).forEach(q => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'suggestion-chip';
      b.textContent = q;
      b.addEventListener('click', () => sendMessage(q));
      els.suggestions.append(b);
    });

    [...els.subjectGrid.querySelectorAll('.subject-card')].forEach(b => {
      b.setAttribute(
        'aria-pressed',
        String(b.dataset.subject === state.subject)
      );
    });
  }

  function selectSubject(name) {
    if (!cfg.subjects.some(s => s.name === name)) return;

    state.subject = name;
    updateSubjectUI();
    setExpression('curious');
    toast(`${name} mode selected.`);

    setTimeout(() => {
      if (state.expression === 'curious') setExpression('idle');
    }, 1100);
  }

  function scrollMessages() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function hideEmpty() {
    if (els.emptyState) els.emptyState.remove();
  }

  function addMessage(role, text, options = {}) {
    hideEmpty();

    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user' : 'assistant'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '●' : '✦';

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = safeText(text);
    content.append(bubble);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = role === 'user' ? 'You' : cfg.robotName;
    content.append(meta);

    if (role !== 'user' && !options.typing) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const copy = document.createElement('button');
      copy.className = 'message-action';
      copy.type = 'button';
      copy.textContent = 'Copy';

      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Response copied.');
        } catch {
          toast('Clipboard access is unavailable in this browser.', 'warning');
        }
      });

      actions.append(copy);

      if (cfg.voice.showSpeakButton) {
        const speak = document.createElement('button');
        speak.className = 'message-action';
        speak.type = 'button';
        speak.textContent = '▶ Speak';
        speak.addEventListener('click', () => speakText(text));
        actions.append(speak);
      }

      content.append(actions);
    }

    row.append(avatar, content);
    els.messages.append(row);
    scrollMessages();

    return row;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = 'typingRow';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '✦';

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble typing-indicator';
    bubble.setAttribute('aria-label', 'Chin Yantra is thinking');

    for (let i = 0; i < 3; i++) {
      bubble.append(document.createElement('span'));
    }

    content.append(bubble);
    row.append(avatar, content);
    els.messages.append(row);
    scrollMessages();

    return row;
  }

  function cleanError(status, body) {
    if (status === 400) {
      return 'The request was not accepted. Check the selected model and request settings.';
    }

    if (status === 401 || status === 403) {
      return 'Gemini could not authorise this request. Check your API key and its API access in Google AI Studio.';
    }

    if (status === 404) {
      return `The model “${cfg.model}” was not found or is unavailable to this API key. Change config.js to a currently supported model.`;
    }

    if (status === 429) {
      return 'Gemini is receiving too many requests or a quota was reached. Wait a little and try again.';
    }

    if (status >= 500) {
      return 'The Gemini service is temporarily unavailable. Please try again soon.';
    }

    try {
      const j = JSON.parse(body);
      return j.error?.message ||
        'The request failed. Please check your connection and configuration.';
    } catch {
      return 'The request failed. Please check your internet connection and try again.';
    }
  }

  function systemInstruction() {
    const sub = subjectData();

    return `You are ${cfg.robotName}, the kind, patient educational AI companion in ${cfg.appName} for school learners. Selected subject: ${sub.name}. Subject-specific guidance: ${sub.instruction || ''}
Use age-appropriate school-level language, explain ideas accurately, encourage learning, and use examples. Do not fabricate school-specific facts, schedules, policies, teachers, or exam dates. If asked, say you do not have access to a school database. Be clear about uncertainty. For normal questions, use a simple explanation, analogy, example, and takeaway when useful. Never claim to see a live camera scene unless an image was provided in this request.`;
  }

  function apiReady() {
    if (
      !cfg.apiKey ||
      cfg.apiKey === 'PASTE YOUR API KEY HERE' ||
      cfg.apiKey.trim().length < 10
    ) {
      showApiKeyModal();
      return false;
    }

    if (!cfg.model || !/^[a-zA-Z0-9._-]+$/.test(cfg.model)) {
      toast('The Gemini model setting in config.js looks invalid.', 'error');
      return false;
    }

    return true;
  }

  async function askGemini(prompt, imageData) {
    if (!apiReady()) return null;

    const contents = state.history
      .slice(-Math.max(2, Number(cfg.interface.maxHistoryMessages) || 24))
      .map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

    const parts = [{ text: prompt }];

    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      });
    }

    contents.push({
      role: 'user',
      parts
    });

    const url =
      `${String(cfg.apiBaseUrl || fallback.apiBaseUrl).replace(/\/$/, '')}/${encodeURIComponent(cfg.model)}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction() }]
          },
          contents,
          generationConfig: {
            temperature: .65,
            maxOutputTokens: clamp(
              Number(cfg.interface.maxOutputTokens) || 1200,
              128,
              8192
            )
          }
        }),
        signal: controller.signal
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(cleanError(response.status, body));
      }

      let data;

      try {
        data = JSON.parse(body);
      } catch {
        throw new Error('Gemini returned an unreadable response. Please try again.');
      }

      const answer = (data.candidates || [])
        .flatMap(c => c.content?.parts || [])
        .map(p => p.text || '')
        .filter(Boolean)
        .join('\n')
        .trim();

      if (!answer) {
        const reason = data.promptFeedback?.blockReason;

        throw new Error(
          reason
            ? `Gemini could not answer this request (${reason}). Try rephrasing it.`
            : 'Gemini returned no text. Try a different question or model.'
        );
      }

      return answer;

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('The request took too long. Check your connection and try again.');
      }

      throw err;

    } finally {
      clearTimeout(timeout);
    }
  }

  async function sendMessage(textOverride, options = {}) {
    if (state.busy) {
      toast('One request is already in progress. Please wait.', 'warning');
      return;
    }

    const text = (textOverride ?? els.messageInput.value).trim();

    if (!text && !options.imageData) return;

    if (text.length > 8000) {
      toast('Please keep your question under 8,000 characters.', 'warning');
      return;
    }

    if (!options.imageData) {
      addMessage('user', text);
      els.messageInput.value = '';
      resizeInput();
    }

    state.busy = true;

    const request = ++state.requestId;

    els.sendBtn.disabled = true;
    setExpression('thinking');

    const typing = showTyping();

    try {
      const answer = await askGemini(
        text || 'Please describe the captured image carefully.',
        options.imageData
      );

      if (request !== state.requestId) return;

      if (!answer) {
        typing.remove();
        return;
      }

      typing.remove();
      addMessage('assistant', answer);

      state.history.push(
        { role: 'user', text: text || 'Please analyse the image.' },
        { role: 'model', text: answer }
      );

      state.history = state.history.slice(
        -Math.max(2, Number(cfg.interface.maxHistoryMessages) || 24)
      );

      setExpression('happy');

      setTimeout(() => {
        if (!state.busy && state.expression === 'happy') {
          setExpression('idle');
        }
      }, 1600);

      if (state.voiceEnabled && cfg.voice.speakByDefault) {
        speakText(answer);
      }

    } catch (err) {
      typing.remove();

      if (request === state.requestId) {
        addMessage(
          'assistant',
          `I couldn't complete that request. ${err.message || 'Please try again.'}`
        );

        setExpression('error');
        toast(err.message || 'Request failed.', 'error');

        setTimeout(() => {
          if (!state.busy && state.expression === 'error') {
            setExpression('idle');
          }
        }, 1800);
      }

    } finally {
      if (request === state.requestId) {
        state.busy = false;
        els.sendBtn.disabled = false;

        if (['thinking', 'error'].includes(state.expression)) {
          setExpression('idle');
        }
      }
    }
  }

  function resizeInput() {
    els.messageInput.style.height = 'auto';
    els.messageInput.style.height =
      Math.min(140, els.messageInput.scrollHeight) + 'px';

    els.charCount.textContent =
      `${els.messageInput.value.length} / 8000`;
  }

  function newChat() {
    if (state.busy) {
      toast('Wait for the current answer before starting a new chat.', 'warning');
      return;
    }

    state.history = [];
    els.messages.replaceChildren();

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'emptyState';

    const spark = document.createElement('div');
    spark.className = 'empty-spark';
    spark.textContent = '✧';

    const h = document.createElement('h3');
    h.textContent = 'Every great discovery starts with a question.';

    const p = document.createElement('p');
    p.textContent =
      'Pick a suggestion above or ask Chin Yantra anything you’re learning.';

    empty.append(spark, h, p);
    els.messages.append(empty);

    updateSubjectUI();
    toast('A fresh conversation is ready.');
  }

  function clearChat() {
    if (!state.history.length) {
      toast('This conversation is already empty.');
      return;
    }

    if (window.confirm('Clear this conversation? This cannot be undone.')) {
      newChat();
    }
  }

  function speakText(text) {
    if (!state.voiceEnabled || !cfg.voice.enabled) {
      toast('Voice output is turned off. Enable it with the speaker button.', 'warning');
      return;
    }

    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      toast('Speech synthesis is not supported in this browser.', 'warning');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    let chosen = null;

    if (cfg.voice.voiceName) {
      chosen = voices.find(v => v.name === cfg.voice.voiceName) || null;
    }

    if (!chosen && cfg.voice.language) {
      chosen =
        voices.find(v => v.lang.toLowerCase() === cfg.voice.language.toLowerCase()) ||
        voices.find(v =>
          v.lang.toLowerCase().startsWith(
            cfg.voice.language.split('-')[0].toLowerCase()
          )
        ) ||
        null;
    }

    if (chosen) utterance.voice = chosen;

    utterance.lang = chosen?.lang || cfg.voice.language || cfg.language;
    utterance.rate = clamp(Number(cfg.voice.rate) || 1, .5, 2);
    utterance.pitch = clamp(Number(cfg.voice.pitch) || 1, .5, 2);
    utterance.volume = clamp(Number(cfg.voice.volume) || .9, 0, 1);

    state.speechUtterance = utterance;
    state.speaking = true;

    setExpression('speaking');

    utterance.onboundary = () => {
      els.robotStage.classList.add('speaking-boundary');
    };

    utterance.onend = () => {
      state.speaking = false;
      state.speechUtterance = null;
      els.robotStage.classList.remove('speaking-boundary');
      setExpression('idle');
    };

    utterance.onerror = () => {
      state.speaking = false;
      state.speechUtterance = null;
      setExpression('idle');
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    state.speaking = false;
    state.speechUtterance = null;
    setExpression('idle');
  }

  function toggleVoice() {
    state.voiceEnabled = !state.voiceEnabled;

    els.voiceToggle.textContent = state.voiceEnabled ? '🔊' : '🔇';
    els.voiceToggle.setAttribute('aria-pressed', String(state.voiceEnabled));

    toast(
      state.voiceEnabled
        ? 'Voice output enabled.'
        : 'Voice output muted.'
    );

    if (!state.voiceEnabled) stopSpeaking();
  }

  function startRecognition() {
    if (!cfg.voice.allowSpeechRecognition) {
      toast('Microphone dictation is disabled in config.js.', 'warning');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      toast('Speech recognition is not supported here. You can still type your question.', 'warning');
      return;
    }

    if (state.recognitionActive) {
      state.recognition?.stop();
      return;
    }

    const rec = new SR();

    state.recognition = rec;
    rec.lang = cfg.voice.language || cfg.language;
    rec.interimResults = true;
    rec.continuous = false;

    let finalText = '';

    state.recognitionActive = true;
    els.micBtn.classList.add('listening');
    setExpression('listening');

    rec.onresult = e => {
      let interim = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const phrase = e.results[i][0].transcript;

        if (e.results[i].isFinal) {
          finalText += phrase;
        } else {
          interim += phrase;
        }
      }

      els.messageInput.value = (finalText + interim).trim();
      resizeInput();
    };

    rec.onerror = e => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast(`Microphone input: ${e.error}. You can type instead.`, 'warning');
      }
    };

    rec.onend = () => {
      state.recognitionActive = false;
      els.micBtn.classList.remove('listening');

      if (state.expression === 'listening') {
        setExpression('idle');
      }

      if (finalText.trim()) {
        toast('Speech added to the message box. Review it, then press Send.');
      }
    };

    try {
      rec.start();
    } catch {
      state.recognitionActive = false;
      els.micBtn.classList.remove('listening');
      setExpression('idle');
      toast('Could not start speech recognition. Try again.', 'warning');
    }
  }

  function showModal(id) {
    $(id).classList.remove('hidden');

    const focus = $(id).querySelector('input,textarea,button');

    if (focus) setTimeout(() => focus.focus(), 50);
  }

  function hideModal(id) {
    $(id).classList.add('hidden');

    if (id === 'cameraModal') {
      stopCamera();
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      els.cameraStatus.textContent =
        'Camera access is unavailable. Use a modern browser over localhost or HTTPS.';
      return;
    }

    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: {
            ideal: cfg.interface.cameraMaxWidth || 960
          }
        },
        audio: false
      });

      els.cameraVideo.srcObject = state.cameraStream;
      await els.cameraVideo.play();

      els.cameraPlaceholder.classList.add('hidden');
      els.startCameraBtn.disabled = true;
      els.stopCameraBtn.disabled = false;
      els.analyseCameraBtn.disabled = false;

      els.cameraStatus.textContent =
        'Camera is active. Capture analysis happens only when you press Analyse frame.';

    } catch (err) {
      els.cameraStatus.textContent =
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
          : 'Could not start the camera. Check that a camera is connected and not in use by another app.';

      toast(els.cameraStatus.textContent, 'warning');
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(t => t.stop());
      state.cameraStream = null;
    }

    els.cameraVideo.srcObject = null;
    els.cameraPlaceholder.classList.remove('hidden');
    els.startCameraBtn.disabled = false;
    els.stopCameraBtn.disabled = true;
    els.analyseCameraBtn.disabled = true;
    els.cameraStatus.textContent = 'Camera is off.';

    state.cameraBusy = false;
  }

  async function analyseCamera() {
    if (!state.cameraStream || !els.cameraVideo.videoWidth) {
      toast('Start the camera and wait for the preview before analysing.', 'warning');
      return;
    }

    if (state.busy || state.cameraBusy) return;

    const canvas = document.createElement('canvas');

    const maxW = clamp(
      Number(cfg.interface.cameraMaxWidth) || 960,
      320,
      1600
    );

    const scale = Math.min(1, maxW / els.cameraVideo.videoWidth);

    canvas.width = Math.round(els.cameraVideo.videoWidth * scale);
    canvas.height = Math.round(els.cameraVideo.videoHeight * scale);

    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      els.cameraVideo,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataUrl = canvas.toDataURL(
      'image/jpeg',
      clamp(Number(cfg.interface.cameraJpegQuality) || .82, .4, .95)
    );

    const imageData = {
      mimeType: 'image/jpeg',
      data: dataUrl.split(',')[1]
    };

    const question =
      els.cameraQuestion.value.trim() ||
      'Describe what is visible in this image. Be careful about uncertainty and do not infer details that are not clearly visible.';

    hideModal('cameraModal');

    await sendMessage(question, { imageData });
  }

  function loginTeacher(event) {
    event.preventDefault();

    if (els.teacherPasswordInput.value === String(cfg.teacherPassword)) {
      state.teacher = true;

      els.teacherPasswordInput.value = '';
      els.loginError.textContent = '';

      hideModal('teacherModal');

      els.monitorSummary.textContent = 'Teacher mode enabled';
      els.monitorDot.classList.remove('muted-dot');
      els.classMonitorOpen.textContent = 'Open class monitor ↗';

      toast('Teacher demonstration mode enabled.');

    } else {
      els.loginError.textContent = 'That password does not match. Try again.';
      setExpression('error');

      setTimeout(() => setExpression('idle'), 1000);
    }
  }

  function openMonitor() {
    if (!state.teacher) {
      showModal('teacherModal');
      toast('Teacher login is required to use the class monitor.', 'warning');
      return;
    }

    showModal('monitorModal');
    updateMonitorControls();
  }

  async function startMonitor() {
    if (!state.teacher) {
      toast('Teacher login is required.', 'warning');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Microphone audio analysis is unavailable in this browser.', 'error');
      return;
    }

    try {
      state.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('This browser does not support Web Audio analysis.');
      }

      state.audioContext = new AudioContextClass();
      await state.audioContext.resume();

      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 1024;
      state.analyser.smoothingTimeConstant = .25;

      const source =
        state.audioContext.createMediaStreamSource(state.micStream);

      source.connect(state.analyser);

      state.monitoring = true;
      state.overThresholdSince = 0;
      state.thresholdHits = 0;

      els.startMonitorBtn.disabled = true;
      els.stopMonitorBtn.disabled = false;

      els.monitorStateText.textContent =
        'Monitoring live microphone sound levels locally…';

      els.monitorSummary.textContent = 'Microphone active · monitoring';
      els.monitorDot.classList.remove('muted-dot');
      els.headerStatus.textContent = 'Monitor active';

      toast('Class sound monitoring started. Audio stays in this browser.');

      monitorLoop();

    } catch (err) {
      stopMonitor();

      toast(
        err.message || 'Could not start microphone monitoring. Check permission settings.',
        'error'
      );
    }
  }

  function thresholdForSensitivity() {
    const sens = state.monitorSensitivity / 100;

    const base = clamp(
      Number(cfg.monitor.soundLevelThreshold) || .085,
      .005,
      .8
    );

    return clamp(base * (1.5 - sens * 1.15), .008, .9);
  }

  function monitorLoop() {
    if (!state.monitoring || !state.analyser) return;

    const buffer = new Uint8Array(state.analyser.fftSize);

    state.analyser.getByteTimeDomainData(buffer);

    let sum = 0;

    for (let i = 0; i < buffer.length; i++) {
      const sample = (buffer[i] - 128) / 128;
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / buffer.length);
    const scaled = clamp((rms / .25) * 100, 0, 100);

    els.dbValue.textContent = `${Math.round(scaled)}%`;
    els.meterFill.style.width = `${scaled}%`;

    const now = Date.now();
    const over = rms > thresholdForSensitivity();

    if (over) {
      if (!state.overThresholdSince) {
        state.overThresholdSince = now;
      }

      state.thresholdHits++;

    } else {
      state.overThresholdSince = 0;
      state.thresholdHits = Math.max(0, state.thresholdHits - 1);
    }

    const duration = Number(cfg.monitor.triggerDurationMs) || 1800;
    const hits = Math.max(1, Number(cfg.monitor.repeatCount) || 3);

    if (
      over &&
      now - state.overThresholdSince >= duration &&
      state.thresholdHits >= hits &&
      now - state.lastAlertAt >=
        (Number(cfg.monitor.alarmCooldownMs) || 12000)
    ) {
      triggerAlarm();

      state.lastAlertAt = now;
      state.overThresholdSince = 0;
      state.thresholdHits = 0;
    }

    state.monitorFrame = setTimeout(
      monitorLoop,
      clamp(Number(cfg.monitor.sampleIntervalMs) || 100, 50, 500)
    );
  }

  function updateMonitorControls() {
    els.startMonitorBtn.disabled = state.monitoring;
    els.stopMonitorBtn.disabled = !state.monitoring;

    els.muteAlarmBtn.disabled = !cfg.monitor.allowTeacherMute;

    els.muteAlarmBtn.textContent =
      state.alarmMuted ? 'Unmute alarm' : 'Mute alarm';

    els.alarmMuteQuickBtn.textContent =
      state.alarmMuted ? 'Unmute alarm' : 'Mute alarm';

    els.sensitivityRange.value = state.monitorSensitivity;

    els.sensitivityLabel.textContent =
      state.monitorSensitivity < 35
        ? 'High'
        : state.monitorSensitivity > 70
          ? 'Very high'
          : 'Medium';
  }

  function stopMonitor() {
    state.monitoring = false;

    if (state.monitorFrame) {
      clearTimeout(state.monitorFrame);
    }

    state.monitorFrame = null;
    state.overThresholdSince = 0;
    state.thresholdHits = 0;

    if (state.micStream) {
      state.micStream.getTracks().forEach(t => t.stop());
      state.micStream = null;
    }

    if (state.audioContext) {
      state.audioContext.close().catch(() => {});
      state.audioContext = null;
    }

    state.analyser = null;

    els.meterFill.style.width = '0%';
    els.dbValue.textContent = '—';

    els.startMonitorBtn.disabled = !state.teacher;
    els.stopMonitorBtn.disabled = true;

    els.monitorStateText.textContent = 'Monitoring is off.';

    if (state.teacher) {
      els.monitorSummary.textContent = 'Teacher mode enabled';
      els.monitorDot.classList.add('muted-dot');
    } else {
      els.monitorSummary.textContent = 'Teacher sign-in required';
      els.monitorDot.classList.add('muted-dot');
    }

    if (!els.monitorModal.classList.contains('hidden')) {
      updateMonitorControls();
    }
  }

  function triggerAlarm() {
    if (!state.monitoring) return;

    els.alarmOverlay.classList.remove('hidden');

    let remaining = Math.ceil(
      (Number(cfg.monitor.alertDurationMs) || 5000) / 1000
    );

    els.alarmCountdown.textContent =
      `Alert will clear in ${remaining} seconds`;

    if (!state.alarmMuted) {
      playAlarmTone();
    }

    if (state.alertTimer) clearTimeout(state.alertTimer);
    if (state.alertCountdownTimer) clearInterval(state.alertCountdownTimer);

    state.alertCountdownTimer = setInterval(() => {
      remaining--;

      if (remaining > 0) {
        els.alarmCountdown.textContent =
          `Alert will clear in ${remaining} seconds`;
      }
    }, 1000);

    state.alertTimer = setTimeout(
      dismissAlarm,
      Number(cfg.monitor.alertDurationMs) || 5000
    );
  }

  function playAlarmTone() {
    if (state.alarmMuted) return;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;

      if (!AC) return;

      const context = new AC();
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = .08;

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start();

      osc.frequency.setValueAtTime(
        660,
        context.currentTime + .18
      );

      osc.stop(context.currentTime + .36);

      osc.onended = () => context.close().catch(() => {});

    } catch {
      // Browser may block sound until user interaction.
    }
  }

  function dismissAlarm() {
    if (state.alertTimer) clearTimeout(state.alertTimer);
    if (state.alertCountdownTimer) clearInterval(state.alertCountdownTimer);

    state.alertTimer = null;
    state.alertCountdownTimer = null;

    els.alarmOverlay.classList.add('hidden');
  }

  function toggleAlarmMute() {
    if (!cfg.monitor.allowTeacherMute) {
      toast('Alarm muting is disabled in config.js.', 'warning');
      return;
    }

    state.alarmMuted = !state.alarmMuted;

    updateMonitorControls();

    toast(
      state.alarmMuted
        ? 'Alarm sound muted. Visual alerts remain active.'
        : 'Alarm sound enabled.'
    );
  }

  function logoutTeacher() {
    stopMonitor();
    dismissAlarm();

    state.teacher = false;

    els.teacherPasswordInput.value = '';
    els.monitorSummary.textContent = 'Teacher sign-in required';
    els.monitorDot.classList.add('muted-dot');

    hideModal('monitorModal');
    hideModal('teacherModal');

    toast('Logged out. Classroom monitoring has stopped.');
  }

  function addBoost(kind) {
    const last = [...state.history]
      .reverse()
      .find(m => m.role === 'model');

    if (!last) {
      toast('Ask a question first, then use a learning boost.', 'warning');
      return;
    }

    const prompts = {
      simpler: 'Explain your previous answer more simply for a school student. Use short sentences and define any difficult words.',
      example: 'Give one concrete, everyday example that helps me understand your previous answer.',
      quiz: 'Create a short 3-question quiz based on your previous answer. Ask one question at a time and wait for my answer before revealing the solution.'
    };

    sendMessage(prompts[kind]);
  }

  // API key is held in memory only; it is never written to localStorage/sessionStorage.

  function showApiKeyModal() {
    const modal = $('apiKeyModal');

    if (modal) modal.classList.remove('hidden');

    const input = $('apiKeyInput');

    if (input) setTimeout(() => input.focus(), 80);
  }

  function acceptApiKey(value) {
    const key = String(value || '').trim();

    if (key.length < 20) {
      $('apiKeyError').textContent =
        'That key looks too short. Copy the complete Gemini API key and try again.';

      return false;
    }

    cfg.apiKey = key;

    $('apiKeyError').textContent = '';
    $('apiKeyModal').classList.add('hidden');

    toast('Gemini key accepted for this tab. You can start learning.');

    return true;
  }

  function setupApiKey() {
    const form = $('apiKeyForm');

    form?.addEventListener('submit', e => {
      e.preventDefault();
      acceptApiKey($('apiKeyInput').value);
    });

    $('toggleApiKey')?.addEventListener('click', () => {
      const input = $('apiKeyInput');

      input.type =
        input.type === 'password' ? 'text' : 'password';

      $('toggleApiKey').textContent =
        input.type === 'password' ? 'Show' : 'Hide';
    });

    $('useConfiguredKey')?.addEventListener('click', () => {
      if (
        cfg.apiKey &&
        cfg.apiKey !== 'PASTE YOUR API KEY HERE' &&
        cfg.apiKey.trim().length >= 20
      ) {
        $('apiKeyModal').classList.add('hidden');
        toast('Using the key from config.js.');

      } else {
        $('apiKeyError').textContent =
          'No usable key is configured. Paste your key above.';
      }
    });
  }

  // Lecture notes: local-only notebook with save, restore and plain-text export.

  const NOTES_STORAGE_KEY = 'chinYantraLectureNotesV1';

  function readNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function renderSavedNotes() {
    const list = $('savedNotesList');

    if (!list) return;

    list.replaceChildren();

    const notes = readNotes();

    if (!notes.length) {
      list.textContent = 'No saved notes yet.';
      return;
    }

    notes.forEach((note, index) => {
      const row = document.createElement('div');
      row.className = 'saved-note-row';

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'saved-note-open';
      open.textContent = `${note.title} · ${note.subject}`;

      open.addEventListener('click', () => {
        $('notesHeading').value = note.title;
        $('notesSubject').value = note.subject;
        $('notesContent').value = note.content;

        $('notesStatus').textContent =
          'Loaded saved note. Edit and save to update it.';
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'saved-note-delete';
      del.textContent = 'Delete';

      del.addEventListener('click', () => {
        const all = readNotes();

        all.splice(index, 1);

        localStorage.setItem(
          NOTES_STORAGE_KEY,
          JSON.stringify(all)
        );

        renderSavedNotes();
      });

      row.append(open, del);
      list.append(row);
    });
  }

  function openNotes() {
    if (!$('notesModal')) return;

    $('notesModal').classList.remove('hidden');
    renderSavedNotes();
  }

  function saveNotes() {
    const title =
      $('notesHeading').value.trim() ||
      `${$('notesSubject').value} notes`;

    const content = $('notesContent').value.trim();

    if (!content) {
      $('notesStatus').textContent =
        'Add some notes before saving.';
      return;
    }

    const notes = readNotes();

    const existing = notes.findIndex(
      n => n.title === title && n.subject === $('notesSubject').value
    );

    const note = {
      title,
      subject: $('notesSubject').value,
      content,
      updatedAt: new Date().toISOString()
    };

    if (existing >= 0) {
      notes[existing] = note;
    } else {
      notes.unshift(note);
    }

    try {
      localStorage.setItem(
        NOTES_STORAGE_KEY,
        JSON.stringify(notes.slice(0, 50))
      );

      $('notesStatus').textContent = 'Saved on this device.';

      renderSavedNotes();
      toast('Lecture notes saved.');

    } catch {
      $('notesStatus').textContent =
        'Could not save. Browser storage may be full or disabled.';
    }
  }

  function addLatestChatToNotes() {
    const recent = state.history
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'You' : cfg.robotName}: ${m.text}`)
      .join('\n\n');

    if (!recent) {
      toast('There is no conversation to add yet.', 'warning');
      return;
    }

    const current = $('notesContent').value.trim();

    $('notesContent').value =
      (current ? current + '\n\n' : '') +
      '--- Chat excerpt ---\n' +
      recent;

    $('notesHeading').value =
      $('notesHeading').value ||
      `${state.subject} — chat notes`;

    toast('Latest conversation added to your notes.');
  }

  function downloadNotes() {
    const title =
      $('notesHeading').value.trim() ||
      'Chin-Yantra-Lecture-Notes';

    const content =
      `${title}\n` +
      `Subject: ${$('notesSubject').value}\n` +
      `Date: ${new Date().toLocaleString()}\n\n` +
      `${$('notesContent').value}`;

    if (!$('notesContent').value.trim()) {
      toast('Write or load some notes before downloading.', 'warning');
      return;
    }

    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/plain;charset=utf-8' })
    );

    const a = document.createElement('a');

    a.href = url;
    a.download = title.replace(/[^a-z0-9-_]+/gi, '-') + '.txt';

    a.click();

    URL.revokeObjectURL(url);
  }

  function initRobotEyeTracking() {
    const stage = els.robotStage;

    if (!stage || !window.matchMedia('(pointer:fine)').matches) {
      return;
    }

    const pupils = [...stage.querySelectorAll('.pupil')];

    if (!pupils.length) return;

    let frame = 0;

    let targetX = 0;
    let targetY = 0;

    let currentX = 0;
    let currentY = 0;

    document.addEventListener('pointermove', e => {
      const rect = stage.getBoundingClientRect();

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * .39;

      targetX = clamp(
        (e.clientX - cx) / Math.max(150, rect.width * .55),
        -1,
        1
      );

      targetY = clamp(
        (e.clientY - cy) / Math.max(120, rect.height * .45),
        -1,
        1
      );
    });

    const animate = () => {
      currentX += (targetX - currentX) * .12;
      currentY += (targetY - currentY) * .12;

      pupils.forEach(p => {
        p.style.transform =
          `translate(${currentX * 4}px, ${currentY * 3}px)`;
      });

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    window.addEventListener(
      'pagehide',
      () => cancelAnimationFrame(frame),
      { once: true }
    );
  }

  function bindEvents() {
    els.sendBtn.addEventListener('click', () => sendMessage());

    els.messageInput.addEventListener('input', resizeInput);

    els.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    els.newChatBtn.addEventListener('click', newChat);
    els.clearChatBtn.addEventListener('click', clearChat);
    els.voiceToggle.addEventListener('click', toggleVoice);
    els.micBtn.addEventListener('click', startRecognition);

    els.cameraBtn.addEventListener('click', () => {
      els.cameraQuestion.value = '';
      showModal('cameraModal');
    });

    els.startCameraBtn.addEventListener('click', startCamera);
    els.stopCameraBtn.addEventListener('click', stopCamera);
    els.analyseCameraBtn.addEventListener('click', analyseCamera);

    els.teacherLoginOpen.addEventListener(
      'click',
      () => showModal('teacherModal')
    );

    els.teacherLoginForm.addEventListener('submit', loginTeacher);

    els.showPasswordBtn.addEventListener('click', () => {
      const reveal = els.teacherPasswordInput.type === 'password';

      els.teacherPasswordInput.type = reveal ? 'text' : 'password';

      els.showPasswordBtn.textContent = reveal ? 'Hide' : 'Show';

      els.showPasswordBtn.setAttribute(
        'aria-label',
        reveal ? 'Hide password' : 'Show password'
      );
    });

    els.classMonitorOpen.addEventListener('click', openMonitor);
    els.startMonitorBtn.addEventListener('click', startMonitor);
    els.stopMonitorBtn.addEventListener('click', stopMonitor);
    els.muteAlarmBtn.addEventListener('click', toggleAlarmMute);
    els.alarmMuteQuickBtn.addEventListener('click', toggleAlarmMute);
    els.dismissAlarmBtn.addEventListener('click', dismissAlarm);
    els.teacherLogoutBtn.addEventListener('click', logoutTeacher);

    els.sensitivityRange.addEventListener('input', () => {
      state.monitorSensitivity = Number(els.sensitivityRange.value);
      updateMonitorControls();
    });

    els.simplerBtn.addEventListener(
      'click',
      () => addBoost('simpler')
    );

    els.exampleBtn.addEventListener(
      'click',
      () => addBoost('example')
    );

    els.quizBtn.addEventListener('click', () =>
      sendMessage(
        'Quiz me on ' + state.subject +
        '. Ask one question at a time, wait for my answer, then give feedback and continue.'
      )
    );

    els.quizBoostBtn.addEventListener(
      'click',
      () => addBoost('quiz')
    );

    $('openNotesBtn')?.addEventListener('click', openNotes);
    $('saveNotesBtn')?.addEventListener('click', saveNotes);
    $('addChatToNotesBtn')?.addEventListener('click', addLatestChatToNotes);
    $('downloadNotesBtn')?.addEventListener('click', downloadNotes);

    document.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', () => hideModal(b.dataset.close));
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) hideModal(backdrop.id);
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['cameraModal', 'teacherModal', 'monitorModal'].forEach(id => {
          if (!$(id).classList.contains('hidden')) {
            hideModal(id);
          }
        });
      }
    });

    window.addEventListener('pagehide', shutdown);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.recognitionActive) {
        state.recognition?.stop();
      }
    });
  }

  function shutdown() {
    state.shuttingDown = true;

    stopCamera();
    stopMonitor();
    stopSpeaking();

    if (state.recognitionActive) {
      state.recognition?.abort();
    }

    dismissAlarm();

    if (state.blinkTimer) {
      clearTimeout(state.blinkTimer);
    }
  }

  function init() {
    initTheme();

    els.robotNameTitle.textContent = `I'm ${cfg.robotName}!`;
    els.robotGreeting.textContent = cfg.greeting;

    els.voiceToggle.textContent =
      state.voiceEnabled ? '🔊' : '🔇';

    els.voiceToggle.setAttribute(
      'aria-pressed',
      String(state.voiceEnabled)
    );

    els.sensitivityRange.value = state.monitorSensitivity;

    initSubjects();
    bindEvents();
    setupApiKey();
    initRobotEyeTracking();
    startBlinking();

    setExpression('idle');

    if (!cfg.apiKey || cfg.apiKey === 'PASTE YOUR API KEY HERE') {
      showApiKeyModal();
    }

    if (!cfg.voice.enabled) {
      els.voiceToggle.title = 'Voice output is disabled in config.js';
    }

    if (!cfg.voice.allowSpeechRecognition) {
      els.micBtn.disabled = true;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      els.cameraBtn.title =
        'Camera needs browser support and localhost or HTTPS';
    }

    updateMonitorControls();
  }

  init();

})();
