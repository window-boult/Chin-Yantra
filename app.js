(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const cfg = window.APP_CONFIG;

  if (!cfg) {
    console.error('APP_CONFIG missing. Load config.js before app.js.');
    return;
  }

  let apiKey = '';
  let selectedSubject = 'general';
  let history = [];
  let chatLog = [];
  let pendingImage = null;
  let lastAnswer = '';
  let recognition = null;
  let studentCameraStream = null;
  let teacherCameraStream = null;
  let audioStream = null;
  let audioContext = null;
  let analyser = null;
  let noiseFrame = null;
  let aboveSince = 0;
  let activeNoteId = null;
  let notes = loadJSON(cfg.storage.notesKey, []);
  let savedChats = loadJSON(cfg.storage.chatsKey, []);
  let toastTimer = null;
  let activeSavedChatId = null;
  let lessonTimerInterval = null;
  let lessonSecondsRemaining = 600;
  let lessonTimerRunning = false;
  let blinkTimer = null;

  const subject = () =>
    cfg.subjects.find(s => s.id === selectedSubject) || cfg.subjects[0];

  const escapeHTML = value =>
    String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  function loadJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function persistJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      toast('Browser storage is full. Export or remove older saved items.');
      return false;
    }
  }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function setConnection(ok, label) {
    const el = $('#connectionState');
    el.innerHTML = `<i></i> ${escapeHTML(label)}`;
    el.querySelector('i').style.background = ok ? '#68a875' : '#d4a342';
  }

  function openModal(id) {
    const el = $('#' + id);
    if (el) el.hidden = false;
  }

  function closeModal(id) {
    const el = $('#' + id);
    if (el) el.hidden = true;
  }

  function loadNotes() {
    return loadJSON(cfg.storage.notesKey, []);
  }

  function saveNotes() {
    if (persistJSON(cfg.storage.notesKey, notes)) {
      $('#noteStatus').textContent = 'Saved locally in this browser';
    }
  }

  function renderSubjects() {
    $('#quickSubjects').innerHTML = cfg.subjects.slice(0, 8).map(s =>
      `<button class="subject-chip ${s.id === selectedSubject ? 'selected' : ''}" data-subject="${escapeHTML(s.id)}"><span>${escapeHTML(s.icon)}</span>${escapeHTML(s.name)}</button>`
    ).join('');

    $('#subjectGrid').innerHTML = cfg.subjects.map(s =>
      `<button class="subject-card" data-subject="${escapeHTML(s.id)}"><span class="subject-icon">${escapeHTML(s.icon)}</span><b>${escapeHTML(s.name)}</b><small>${escapeHTML(s.hint)}</small></button>`
    ).join('');

    $$('.subject-chip,.subject-card').forEach(btn =>
      btn.addEventListener('click', () => selectSubject(btn.dataset.subject))
    );

    updateSubjectLabels();
  }

  function selectSubject(id, openingText = '') {
    if (!cfg.subjects.some(s => s.id === id)) return;

    selectedSubject = id;
    history = [];
    chatLog = [];
    activeSavedChatId = null;

    $('#messages').innerHTML = '';

    const s = subject();

    addMessage(
      'assistant',
      `Namaste! Let's explore ${s.name}. ${s.hint}${openingText ? `\n\n${openingText}` : ' What would you like to understand?'}`
    );

    renderSubjects();
    showView('chat');
  }

  function updateSubjectLabels() {
    $('#chatSubjectName').textContent = subject().name;
    $('#chatSubjectHint').textContent = subject().hint;
  }

  function showView(name) {
    $$('.view').forEach(v =>
      v.classList.toggle('active', v.id === name + 'View')
    );

    $$('.nav-item[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === name)
    );

    const labels = {
      chat: 'AI COMPANION',
      subjects: 'EXPLORE SUBJECTS',
      gita: 'GITA WISDOM',
      notes: 'LECTURE NOTES',
      saved: 'SAVED CONVERSATIONS',
      study: 'STUDY MODE'
    };

    $('#currentSection').textContent = labels[name] || 'AI COMPANION';
    $('#sidebar').classList.remove('open');

    if (name === 'notes') renderNotes();
    if (name === 'saved') renderSavedChats();
  }

  function addMessage(role, text, options = {}) {
    const row = document.createElement('div');
    row.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'assistant' ? '✧' : '●';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    if (options.image) {
      const tag = document.createElement('small');
      tag.className = 'image-message-label';
      tag.textContent = '📷 Image attached';
      bubble.appendChild(tag);
    }

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = new Date(options.time || Date.now()).toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit' }
    );

    bubble.appendChild(time);
    row.append(avatar, bubble);

    $('#messages').appendChild(row);
    $('#messages').scrollTop = $('#messages').scrollHeight;

    if (!options.noLog) {
      chatLog.push({
        role,
        text,
        time: options.time || Date.now(),
        image: Boolean(options.image)
      });
    }

    return row;
  }

  function renderChatLog(log) {
    $('#messages').innerHTML = '';
    chatLog = [];

    for (const item of log || []) {
      addMessage(item.role, item.text, {
        time: item.time,
        image: item.image,
        noLog: false
      });
    }

    if (!chatLog.length) {
      addMessage('assistant', 'Namaste! What would you like to learn today?');
    }
  }

  function robotState(state) {
    const robot = $('#robot');

    robot.classList.toggle('thinking', state === 'thinking');
    robot.classList.toggle('speaking', state === 'speaking');

    const caption = $('#robotCaption');

    if (caption) {
      caption.textContent =
        state === 'thinking' ? 'Thinking…' :
        state === 'speaking' ? 'Speaking…' :
        'Your learning companion';
    }
  }

  function waveRobot() {
    const robot = $('#robot');
    if (!robot) return;

    robot.classList.remove('waving');
    void robot.offsetWidth;
    robot.classList.add('waving');

    setTimeout(() => robot.classList.remove('waving'), 1250);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);

    blinkTimer = setTimeout(() => {
      const robot = $('#robot');

      if (robot && !robot.classList.contains('speaking')) {
        robot.classList.add('blinking');
        setTimeout(() => robot.classList.remove('blinking'), 150);
      }

      scheduleBlink();
    }, 2600 + Math.random() * 2800);
  }

  function speechSummary(text) {
    const clean = String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[`*_>#\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const first = clean.match(/^.{12,220}?[.!?](?=\s|$)/);

    if (first) return first[0];

    const words = clean.split(' ');

    return words.slice(0, Math.min(18, words.length)).join(' ') +
      (words.length > 18 ? '.' : '');
  }
    function systemInstruction() {
    const s = subject();

    return `You are Chinmaya AI, a warm, thoughtful and age-appropriate learning companion for students at ${cfg.schoolName}, ${cfg.location}. Current subject: ${s.name}. ${s.hint}

TEACHING STYLE: Keep every normal answer to ONE short paragraph maximum, ideally 2–4 clear sentences and under 70 words. Sound natural and helpful, like a concise AI tutor. Make the first sentence a simple, spoken-style summary of the whole answer, because the robot reads that sentence aloud. Then add only the most useful detail. Answer directly; avoid long introductions, repeated points and unnecessary headings. Define difficult words briefly. For calculations, show only the essential working in the same compact response. Encourage curiosity without overexplaining. Do not pretend to be a human, teacher, monk or spiritual authority.

CHINMAYA: You may explain general, well-established information about the Chinmaya Mission, Swami Chinmayananda, Chinmaya educational values and the broad aims of Chinmaya institutions. Do not invent facts about this particular school's staff, timetable, events, rules or facilities. Be clear when uncertain.

SPIRITUALITY: This is the separate subject for Bhagavad Gita questions, Indian philosophy, values and reflection. Explain the Gita respectfully and with historical and philosophical context. Do not fabricate Sanskrit verses, quotations or chapter/verse references. Label paraphrases clearly. Mention that translations and interpretations can differ. Ask thoughtful, open-ended questions when useful; do not pressure students to adopt a belief.

IMAGE ANALYSIS: If an image is attached, inspect the visible question, diagram or object. Explain what can be determined, solve school exercises step by step where appropriate, and say if text is unclear rather than guessing. Do not infer private details about people in images.

STUDY MODE: Keep study sessions concise too. Give a compact explanation and, when requested, a short quiz. Do not exceed one short paragraph unless the student explicitly asks for more detail.

SAFETY: Keep responses suitable for ages 13–17. Do not provide dangerous instructions. Do not claim to browse the internet or access school records. State uncertainty honestly.`;
  }

  function imagePart(dataUrl) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/.exec(dataUrl);

    if (!match) {
      throw new Error('Please use a PNG, JPG or WEBP image.');
    }

    return {
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    };
  }

  async function askGemini(text, imageData) {
    if (!apiKey) {
      openModal('settingsModal');
      $('#apiKeyInput').focus();
      throw new Error('Add your Gemini API key in Settings first.');
    }

    const model = ($('#modelInput').value.trim() || cfg.api.model)
      .replace(/^models\//, '');

    const url =
      `${cfg.api.baseUrl}${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = history.slice(-20).map(item => ({
      role: item.role,
      parts: [{ text: item.text }]
    }));

    const parts = [{ text }];

    if (imageData) parts.push(imagePart(imageData));

    contents.push({ role: 'user', parts });

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      cfg.api.timeoutMs || 60000
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction() }]
          },
          contents,
          generationConfig: {
            temperature: cfg.api.temperature,
            maxOutputTokens: cfg.api.maxOutputTokens
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          `Gemini request failed (${response.status}). Check API key, model access and quota.`
        );
      }

      const answer = (data.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('\n')
        .trim();

      if (!answer) {
        throw new Error(
          data.promptFeedback?.blockReason
            ? `Request blocked: ${data.promptFeedback.blockReason}`
            : 'Gemini returned an empty answer. Please try again.'
        );
      }

      history.push(
        { role: 'user', text },
        { role: 'model', text: answer }
      );

      return answer;

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('The request timed out. Please try again.');
      }

      throw err;

    } finally {
      clearTimeout(timer);
    }
  }

  async function sendMessage(text) {
    const clean = text.trim();

    if (!clean && !pendingImage) return;

    const image = pendingImage;
    pendingImage = null;

    $('#attachmentPreview').hidden = true;
    $('#attachmentPreview').innerHTML = '';

    addMessage('user', clean || 'Please analyse this image.', {
      image: Boolean(image)
    });

    if (/^(hi|hello|hey|namaste|good morning|good afternoon|good evening)\b/i.test(clean)) {
      waveRobot();
    }

    const send = $('#sendButton');

    send.disabled = true;
    $('#promptInput').disabled = true;
    robotState('thinking');

    const waiting = addMessage('assistant', 'Thinking this through…');

    try {
      const answer = await askGemini(
        clean || 'Please analyse this image and explain what is visible.',
        image
      );

      waiting.querySelector('.bubble div').textContent = answer;

      if (chatLog.length) {
        chatLog[chatLog.length - 1].text = answer;
      }

      lastAnswer = answer;
      robotState('idle');

      if ($('#autoSpeak').checked) {
        speak(speechSummary(answer));
      }

      setConnection(true, 'Gemini connected');
      persistActiveChat();

    } catch (err) {
      waiting.querySelector('.bubble div').textContent =
        `I couldn't complete that request. ${err.message}`;

      if (chatLog.length) {
        chatLog[chatLog.length - 1].text =
          `I couldn't complete that request. ${err.message}`;
      }

      setConnection(false, 'Check API settings');
      toast(err.message);

    } finally {
      send.disabled = false;
      $('#promptInput').disabled = false;
      $('#promptInput').focus();

      setTimeout(() => robotState('idle'), 1800);
    }
  }

  function newChat() {
    history = [];
    chatLog = [];
    activeSavedChatId = null;
    lastAnswer = '';

    $('#messages').innerHTML = '';

    addMessage(
      'assistant',
      `Namaste! Let's explore ${subject().name}. ${subject().hint}`
    );

    $('#promptInput').value = '';
    toast('Started a new conversation.');
  }

  function persistActiveChat() {
    if (!chatLog.length || !activeSavedChatId) return;

    const chat = savedChats.find(c => c.id === activeSavedChatId);
    if (!chat) return;

    chat.messages = chatLog.slice();
    chat.updated = Date.now();

    persistJSON(cfg.storage.chatsKey, savedChats);
  }

  function saveCurrentChat() {
    if (!chatLog.length) {
      toast('There is no conversation to save yet.');
      return;
    }

    const firstUser = chatLog.find(m => m.role === 'user');

    const defaultTitle = firstUser
      ? firstUser.text.slice(0, 48)
      : `${subject().name} conversation`;

    const title = window.prompt('Name this conversation:', defaultTitle);

    if (title === null) return;

    const trimmed = title.trim() || defaultTitle;

    const record = {
      id: activeSavedChatId ||
        `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      subjectId: selectedSubject,
      subjectName: subject().name,
      messages: chatLog.slice(),
      updated: Date.now()
    };

    const existingIndex = savedChats.findIndex(c => c.id === record.id);

    if (existingIndex >= 0) {
      savedChats[existingIndex] = record;
    } else {
      savedChats.unshift(record);
    }

    savedChats = savedChats.slice(
      0,
      cfg.storage.maxSavedChats || 60
    );

    activeSavedChatId = record.id;

    if (persistJSON(cfg.storage.chatsKey, savedChats)) {
      toast('Conversation saved on this device.');
      renderSavedChats();
    }
  }

  function renderSavedChats() {
    const list = $('#savedChatList');

    if (!savedChats.length) {
      list.innerHTML =
        '<p class="small-note">No saved conversations yet. Use “Save chat” above a conversation to keep it here.</p>';
      return;
    }

    list.innerHTML = savedChats.map(chat =>
      `<article class="saved-chat-card">
        <div class="saved-chat-info">
          <b>${escapeHTML(chat.title)}</b>
          <span>${escapeHTML(chat.subjectName || 'General learning')} · ${new Date(chat.updated).toLocaleString()}</span>
          <small>${(chat.messages || []).length} messages</small>
        </div>
        <div class="saved-chat-actions">
          <button class="outline-button" data-open-chat="${escapeHTML(chat.id)}">Open</button>
          <button class="outline-button" data-rename-chat="${escapeHTML(chat.id)}">Rename</button>
          <button class="outline-button danger-button" data-delete-chat="${escapeHTML(chat.id)}">Delete</button>
        </div>
      </article>`
    ).join('');

    $$('[data-open-chat]').forEach(btn =>
      btn.addEventListener('click', () => openSavedChat(btn.dataset.openChat))
    );

    $$('[data-rename-chat]').forEach(btn =>
      btn.addEventListener('click', () => renameSavedChat(btn.dataset.renameChat))
    );

    $$('[data-delete-chat]').forEach(btn =>
      btn.addEventListener('click', () => deleteSavedChat(btn.dataset.deleteChat))
    );
  }
    function openSavedChat(id) {
    const chat = savedChats.find(c => c.id === id);
    if (!chat) return;

    selectedSubject = cfg.subjects.some(s => s.id === chat.subjectId)
      ? chat.subjectId
      : 'general';

    activeSavedChatId = chat.id;
    history = [];

    for (const m of chat.messages || []) {
      if (m.role === 'user' || m.role === 'assistant') {
        history.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          text: m.text
        });
      }
    }

    chatLog = [];
    renderChatLog(chat.messages || []);

    lastAnswer =
      [...(chat.messages || [])].reverse()
        .find(m => m.role === 'assistant')?.text || '';

    renderSubjects();
    showView('chat');
    toast('Saved conversation opened.');
  }

  function renameSavedChat(id) {
    const chat = savedChats.find(c => c.id === id);
    if (!chat) return;

    const title = window.prompt('Rename conversation:', chat.title);
    if (title === null || !title.trim()) return;

    chat.title = title.trim();
    chat.updated = Date.now();

    persistJSON(cfg.storage.chatsKey, savedChats);
    renderSavedChats();
  }

  function deleteSavedChat(id) {
    const chat = savedChats.find(c => c.id === id);
    if (!chat) return;

    if (!window.confirm(`Delete “${chat.title}” from saved conversations?`)) {
      return;
    }

    savedChats = savedChats.filter(c => c.id !== id);

    if (activeSavedChatId === id) {
      activeSavedChatId = null;
    }

    persistJSON(cfg.storage.chatsKey, savedChats);
    renderSavedChats();
    toast('Saved conversation deleted.');
  }

  function exportCurrentChat() {
    if (!chatLog.length) {
      toast('There is no conversation to export.');
      return;
    }

    const content = chatLog.map(m =>
      `${m.role.toUpperCase()}\n${m.text}${m.image ? '\n[Image attached]' : ''}`
    ).join('\n\n');

    downloadText(
      `Chinmaya-AI-${subject().name.replace(/[^a-z0-9]+/gi, '-')}.txt`,
      content
    );
  }

  function downloadText(filename, content) {
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/plain;charset=utf-8' })
    );

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      toast('Speech playback is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      String(text || '').slice(0, 5000)
    );

    utterance.lang = $('#speechLanguage').value || cfg.voice.language;
    utterance.rate = cfg.voice.rate;
    utterance.pitch = cfg.voice.pitch;

    utterance.onstart = () => robotState('speaking');

    // Speech boundary events animate the robot's mouth while it speaks.
    utterance.onboundary = () => {
      const mouth = $('#robotMouth');

      if (mouth) {
        mouth.classList.remove('speech-pulse');
        void mouth.offsetWidth;
        mouth.classList.add('speech-pulse');
      }
    };

    utterance.onend = () => robotState('idle');
    utterance.onerror = () => robotState('idle');

    window.speechSynthesis.speak(utterance);
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast('Voice typing is not supported here. Please type your question.');
      return;
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      $('#voiceStatus').textContent = 'Voice input stopped';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = $('#speechLanguage').value || cfg.voice.language;
    recognition.interimResults = true;
    recognition.continuous = false;

    $('#voiceStatus').textContent = 'Listening… speak now';
    $('#micButton').classList.add('listening');

    recognition.onresult = event => {
      let transcript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      $('#promptInput').value = transcript;
    };

    recognition.onerror = event =>
      toast(`Voice input: ${event.error || 'not available'}`);

    recognition.onend = () => {
      recognition = null;
      $('#micButton').classList.remove('listening');
      $('#voiceStatus').textContent =
        'Enter to send · Shift+Enter for a new line';
    };

    try {
      recognition.start();
    } catch {
      toast('Could not start voice input.');
    }
  }

  function attachImage(file) {
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast('Choose a PNG, JPG or WEBP image.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast('Please choose an image smaller than 8 MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      pendingImage = reader.result;

      const img = document.createElement('img');
      img.src = reader.result;
      img.alt = 'Image ready for analysis';

      const label = document.createElement('span');
      label.textContent = file.name;

      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.className = 'text-button';

      remove.onclick = () => {
        pendingImage = null;
        $('#attachmentPreview').hidden = true;
        $('#attachmentPreview').innerHTML = '';
      };

      $('#attachmentPreview').replaceChildren(img, label, remove);
      $('#attachmentPreview').hidden = false;
    };

    reader.onerror = () => toast('Could not read that image.');
    reader.readAsDataURL(file);
  }

  async function startStudentCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Camera needs HTTPS or localhost and a supported browser.');
      return;
    }

    try {
      studentCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      $('#studentVideo').srcObject = studentCameraStream;
      $('#captureStudentPhoto').disabled = false;
      $('#cameraStatus').textContent =
        'Camera ready. Frame your question and take a photo.';

    } catch (err) {
      $('#cameraStatus').textContent = `Camera unavailable: ${err.message}`;
      toast(`Camera unavailable: ${err.message}`);
    }
  }

  function stopStudentCamera() {
    if (studentCameraStream) {
      studentCameraStream.getTracks().forEach(t => t.stop());
    }

    studentCameraStream = null;
    $('#studentVideo').srcObject = null;
    $('#captureStudentPhoto').disabled = true;
  }

  function captureStudentPhoto() {
    const video = $('#studentVideo');

    if (!studentCameraStream || !video.videoWidth) {
      toast('Start the camera and wait for the preview first.');
      return;
    }

    const canvas = $('#studentCanvas');
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    pendingImage = canvas.toDataURL('image/jpeg', 0.86);

    const img = document.createElement('img');
    img.src = pendingImage;
    img.alt = 'Photo captured for AI analysis';

    const label = document.createElement('span');
    label.textContent = 'Camera photo ready';

    const remove = document.createElement('button');
    remove.className = 'text-button';
    remove.textContent = 'Remove';

    remove.onclick = () => {
      pendingImage = null;
      $('#attachmentPreview').hidden = true;
      $('#attachmentPreview').innerHTML = '';
    };

    $('#attachmentPreview').replaceChildren(img, label, remove);
    $('#attachmentPreview').hidden = false;

    stopStudentCamera();
    closeModal('studentCameraModal');
    $('#promptInput').focus();

    if (!$('#promptInput').value.trim()) {
      $('#promptInput').value =
        'Please read and explain the question or learning material in this photo. Show the steps clearly.';
    }

    toast('Photo attached. Add a question or press Send.');
  }

  function renderNotes() {
    $('#notesList').innerHTML = notes.map(n =>
      `<button class="note-item ${n.id === activeNoteId ? 'active' : ''}" data-note="${escapeHTML(n.id)}">${escapeHTML(n.title || 'Untitled note')}<small>${new Date(n.updated).toLocaleDateString()}</small></button>`
    ).join('') || '<p class="small-note">No notes yet. Create your first note.</p>';

    $$('.note-item').forEach(btn =>
      btn.addEventListener('click', () => openNote(btn.dataset.note))
    );
  }

  function openNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    activeNoteId = id;
    $('#noteTitle').value = note.title;
    $('#noteBody').value = note.body;
    renderNotes();
  }

  function newNote() {
    activeNoteId = null;
    $('#noteTitle').value = '';
    $('#noteBody').value = '';
    $('#noteTitle').focus();
    renderNotes();
  }

  function saveCurrentNote() {
    const title = $('#noteTitle').value.trim() || 'Untitled note';
    const body = $('#noteBody').value;

    if (activeNoteId) {
      const n = notes.find(x => x.id === activeNoteId);
      if (n) Object.assign(n, { title, body, updated: Date.now() });

    } else {
      activeNoteId = String(Date.now());
      notes.unshift({ id: activeNoteId, title, body, updated: Date.now() });
    }

    saveNotes();
    renderNotes();
    toast('Note saved on this device.');
  }

  function exportNote() {
    const title = $('#noteTitle').value.trim() || 'Chinmaya note';

    downloadText(
      `${title.replace(/[^a-z0-9-_]/gi, '-')}.txt`,
      `${title}\n${'='.repeat(title.length)}\n\n${$('#noteBody').value}`
    );
  }

  async function openTeacherCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Camera access needs HTTPS or localhost.');
      return;
    }

    try {
      teacherCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      $('#teacherVideo').srcObject = teacherCameraStream;
      $('#teacherVideo').classList.add('active');

    } catch (err) {
      toast(`Camera unavailable: ${err.message}`);
    }
  }

  function stopTeacherCamera() {
    if (teacherCameraStream) {
      teacherCameraStream.getTracks().forEach(t => t.stop());
    }

    teacherCameraStream = null;
    $('#teacherVideo').srcObject = null;
    $('#teacherVideo').classList.remove('active');
  }

  async function startNoiseMonitor() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      toast('Microphone monitoring is not supported in this browser.');
      return;
    }

    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      audioContext = new AudioContext();

      const source = audioContext.createMediaStreamSource(audioStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;

      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      aboveSince = 0;

      const tick = () => {
        if (!analyser) return;

        analyser.getByteTimeDomainData(samples);

        let sum = 0;

        for (const value of samples) {
          const x = (value - 128) / 128;
          sum += x * x;
        }

        const rms = Math.sqrt(sum / samples.length);
        const level = Math.min(100, Math.round(rms * 350));

        $('#noiseFill').style.width = `${level}%`;
        $('#noiseReadout').textContent =
          `Relative sound level: ${level}% (not calibrated decibels)`;

        const now = Date.now();

        if (rms >= cfg.teacher.noiseThreshold) {
          if (!aboveSince) aboveSince = now;

          if (now - aboveSince >= cfg.teacher.noiseHoldMs) {
            $('#noiseAlert').hidden = false;
          }

        } else {
          aboveSince = 0;
          $('#noiseAlert').hidden = true;
        }

        noiseFrame = requestAnimationFrame(tick);
      };

      tick();
      toast('Noise monitor started. Audio is not recorded or uploaded.');

    } catch (err) {
      stopNoiseMonitor();
      toast(`Microphone unavailable: ${err.message}`);
    }
  }

  function stopNoiseMonitor() {
    if (noiseFrame) cancelAnimationFrame(noiseFrame);

    noiseFrame = null;
    analyser = null;

    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
    }

    audioStream = null;

    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }

    $('#noiseFill').style.width = '0';
    $('#noiseReadout').textContent = 'Microphone monitor is off';
    $('#noiseAlert').hidden = true;
  }
    function formatLessonTime(total) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateLessonTimerDisplay() {
    $('#lessonCountdown').textContent =
      formatLessonTime(lessonSecondsRemaining);
  }

  function stopLessonTimer() {
    clearInterval(lessonTimerInterval);
    lessonTimerInterval = null;
    lessonTimerRunning = false;
  }

  function startLessonTimer() {
    if (lessonTimerRunning) return;

    if (lessonSecondsRemaining <= 0) {
      const minutes = Math.max(
        1,
        Math.min(180, Number($('#lessonMinutes').value) || 10)
      );

      lessonSecondsRemaining = Math.round(minutes * 60);
    }

    lessonTimerRunning = true;
    $('#lessonTimerStatus').textContent = 'Timer running…';

    lessonTimerInterval = setInterval(() => {
      lessonSecondsRemaining = Math.max(0, lessonSecondsRemaining - 1);
      updateLessonTimerDisplay();

      if (lessonSecondsRemaining === 0) {
        stopLessonTimer();
        $('#lessonTimerStatus').textContent =
          'Time is up! The activity timer has finished.';

        toast('Classroom timer finished.');
      }
    }, 1000);
  }

  function pauseLessonTimer() {
    stopLessonTimer();
    $('#lessonTimerStatus').textContent = 'Timer paused.';
  }

  function resetLessonTimer() {
    stopLessonTimer();

    const minutes = Math.max(
      1,
      Math.min(180, Number($('#lessonMinutes').value) || 10)
    );

    lessonSecondsRemaining = Math.round(minutes * 60);

    updateLessonTimerDisplay();
    $('#lessonTimerStatus').textContent = 'Timer reset and ready.';
  }

  function closeTeacher() {
    stopLessonTimer();
    stopTeacherCamera();
    stopNoiseMonitor();

    closeModal('teacherModal');

    $('#teacherDashboard').hidden = true;
    $('#teacherLogin').hidden = false;
    $('#teacherPin').value = '';
  }

  // Navigation and common controls.
  $$('.nav-item[data-view]').forEach(btn =>
    btn.addEventListener('click', () => showView(btn.dataset.view))
  );

  $('#mobileMenu').addEventListener('click', () =>
    $('#sidebar').classList.toggle('open')
  );

  $('#settingsOpen').addEventListener('click', () =>
    openModal('settingsModal')
  );

  $('#settingsQuick').addEventListener('click', () =>
    openModal('settingsModal')
  );

  $('#teacherOpen').addEventListener('click', () =>
    openModal('teacherModal')
  );

  $$('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => {
      if (btn.dataset.close === 'teacherModal') {
        closeTeacher();

      } else if (btn.dataset.close === 'studentCameraModal') {
        stopStudentCamera();
        closeModal('studentCameraModal');

      } else {
        closeModal(btn.dataset.close);
      }
    })
  );

  $$('.modal-backdrop').forEach(backdrop =>
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        if (backdrop.id === 'teacherModal') {
          closeTeacher();

        } else if (backdrop.id === 'studentCameraModal') {
          stopStudentCamera();
          closeModal('studentCameraModal');

        } else {
          closeModal(backdrop.id);
        }
      }
    })
  );

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('settingsModal');

      if (!$('#teacherModal').hidden) {
        closeTeacher();
      }

      if (!$('#studentCameraModal').hidden) {
        stopStudentCamera();
        closeModal('studentCameraModal');
      }
    }
  });

  $('#themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');

    localStorage.setItem(
      'chinmayaTheme',
      document.body.classList.contains('dark') ? 'dark' : 'light'
    );
  });

  if (localStorage.getItem('chinmayaTheme') === 'dark') {
    document.body.classList.add('dark');
  }

  $('#chatForm').addEventListener('submit', e => {
    e.preventDefault();

    const text = $('#promptInput').value;

    $('#promptInput').value = '';
    $('#promptInput').style.height = 'auto';

    sendMessage(text);
  });

  $('#promptInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#chatForm').requestSubmit();
    }
  });

  $('#promptInput').addEventListener('input', () => {
    const el = $('#promptInput');

    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  });

  $('#imageButton').addEventListener('click', () =>
    $('#imageInput').click()
  );

  $('#imageInput').addEventListener('change', e => {
    attachImage(e.target.files[0]);
    e.target.value = '';
  });

  $('#cameraButton').addEventListener('click', () =>
    openModal('studentCameraModal')
  );

  $('#startStudentCamera').addEventListener('click', startStudentCamera);
  $('#captureStudentPhoto').addEventListener('click', captureStudentPhoto);

  $('#stopStudentCamera').addEventListener('click', () => {
    stopStudentCamera();
    $('#cameraStatus').textContent = 'Camera stopped.';
  });

  $('#micButton').addEventListener('click', startVoiceInput);

  $('#speakLast').addEventListener('click', () =>
    lastAnswer
      ? speak(lastAnswer)
      : toast('There is no answer to read yet.')
  );

  $('#clearChat').addEventListener('click', newChat);
  $('#saveChat').addEventListener('click', saveCurrentChat);
  $('#saveCurrentChatFromPage').addEventListener('click', saveCurrentChat);
  $('#exportCurrentChat').addEventListener('click', exportCurrentChat);

  // Gita content routes into the distinct Spirituality subject.
  $('#openSpiritualityFromGita').addEventListener('click', () =>
    selectSubject(
      'spirituality',
      'You are exploring the Bhagavad Gita. What question or idea would you like to discuss?'
    )
  );

  // Study mode: structured study prompt, delivered in the normal AI conversation.
  $('#startStudy').addEventListener('click', () => {
    const topic = $('#studyTopic').value.trim();

    if (!topic) {
      toast('Enter a topic to begin your study session.');
      $('#studyTopic').focus();
      return;
    }

    const level = $('#studyLevel').value;

    const mode = {
      simple: 'Give a simple, clear explanation suitable for a school student.',
      detailed: 'Give a detailed but well-organised lesson with examples.',
      exam: 'Create an exam-revision lesson with definitions, important points, common mistakes and a concise recap.',
      quiz: 'Teach the topic briefly, then create a 5-question quiz. Put questions first and answers in a separate answer key at the end.'
    }[level];

    selectSubject('general');
    showView('chat');

    $('#promptInput').value =
      `Create a Study Mode session about: ${topic}. ${mode} Use headings, key points, one relatable example, a quick recap and a mini knowledge check. Keep it accurate and age-appropriate.`;

    $('#chatForm').requestSubmit();
  });

  // Settings: API key is held in memory for this page session.
  $('#saveSettings').addEventListener('click', () => {
    apiKey = $('#apiKeyInput').value.trim() || apiKey;
    $('#apiKeyInput').value = '';

    cfg.api.model = $('#modelInput').value.trim() || cfg.api.model;

    localStorage.setItem(
      'chinmayaAutoSpeak',
      $('#autoSpeak').checked ? '1' : '0'
    );

    localStorage.setItem(
      'chinmayaLanguage',
      $('#speechLanguage').value
    );

    setConnection(
      Boolean(apiKey),
      apiKey ? 'Key ready for this tab' : 'API not connected'
    );

    closeModal('settingsModal');

    toast(
      apiKey
        ? 'API key ready for this session.'
        : 'Settings saved.'
    );
  });

  $('#forgetKey').addEventListener('click', () => {
    apiKey = '';
    $('#apiKeyInput').value = '';

    setConnection(false, 'API not connected');
    toast('API key cleared from this page.');
  });

  $('#modelInput').value = cfg.api.model;

  $('#speechLanguage').value =
    localStorage.getItem('chinmayaLanguage') || cfg.voice.language;

  $('#autoSpeak').checked =
    localStorage.getItem('chinmayaAutoSpeak') === '1';

  $('#reduceMotion').addEventListener('change', e =>
    document.body.classList.toggle('reduce-motion', e.target.checked)
  );

  // Notes.
  $('#newNote').addEventListener('click', newNote);
  $('#saveNote').addEventListener('click', saveCurrentNote);
  $('#exportNote').addEventListener('click', exportNote);

  $('#addChatNote').addEventListener('click', () => {
    if (!lastAnswer) {
      toast('There is no AI answer to add yet.');
      return;
    }

    $('#noteBody').value +=
      `${$('#noteBody').value ? '\n\n' : ''}${lastAnswer}`;

    toast('Last AI answer added to the note.');
  });

  // Teacher demo portal.
  $('#teacherLoginButton').addEventListener('click', () => {
    if ($('#teacherPin').value === String(cfg.teacher.demoPin)) {
      $('#teacherLogin').hidden = true;
      $('#teacherDashboard').hidden = false;
      toast('Demo teacher portal opened.');
    } else {
      toast('Incorrect PIN.');
    }
  });

  $('#teacherPin').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      $('#teacherLoginButton').click();
    }
  });

  $('#teacherLogout').addEventListener('click', closeTeacher);
  $('#startCamera').addEventListener('click', openTeacherCamera);
  $('#stopCamera').addEventListener('click', stopTeacherCamera);
  $('#startNoise').addEventListener('click', startNoiseMonitor);
  $('#stopNoise').addEventListener('click', stopNoiseMonitor);

  $('#startLessonTimer').addEventListener('click', startLessonTimer);
  $('#pauseLessonTimer').addEventListener('click', pauseLessonTimer);
  $('#resetLessonTimer').addEventListener('click', resetLessonTimer);
  $('#lessonMinutes').addEventListener('change', resetLessonTimer);

  window.addEventListener('beforeunload', () => {
    stopStudentCamera();
    stopTeacherCamera();
    stopNoiseMonitor();

    if (recognition) recognition.stop();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  });

  document.addEventListener('pointermove', e => {
    $$('.eye i').forEach(pupil => {
      const r = pupil.parentElement.getBoundingClientRect();

      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;

      pupil.style.transform =
        `translate(${Math.max(-3, Math.min(3, dx * 5))}px, ${Math.max(-3, Math.min(3, dy * 5))}px)`;
    });
  });

  renderSubjects();
  renderNotes();
  renderSavedChats();
  setConnection(false, 'API not connected');

  // Start the robot's occasional blinking animation.
  scheduleBlink();

})();