/* ═══════════════════════════════════════════════════════════════════════
   XTRX AiGracy v2 — ChatGPT-style Frontend (Claude Focus)
   Support: assets/images.png (logo + avatar + sample image)
   Fallback: hardcoded model list (kalau /api/models gagal)
   ═══════════════════════════════════════════════════════════════════════ */

const ASSET_IMAGE = '/assets/images.png';
const DEFAULT_MODEL_ID = 'claude-opus-5-5';

// ═══ FALLBACK MODELS — dipakai kalau API gagal ═══
const FALLBACK_MODELS = [
  {"id":"antigravity","object":"model","owned_by":"combo","capabilities":{"vision":true,"pdf":false,"audioInput":true,"videoInput":true,"imageOutput":false,"audioOutput":false,"search":true,"tools":true,"reasoning":true,"thinkingFormat":"claude-budget","thinkingCanDisable":true,"thinkingRange":null,"contextWindow":1048576,"maxOutput":128000},"context_length":1048576,"max_completion_tokens":128000},
  {"id":"hermes","object":"model","owned_by":"combo","capabilities":{"vision":true,"pdf":false,"audioInput":true,"videoInput":true,"imageOutput":false,"audioOutput":false,"search":false,"tools":true,"reasoning":true,"thinkingFormat":"openai","thinkingCanDisable":true,"thinkingRange":null,"contextWindow":1048576,"maxOutput":131072},"context_length":1048576,"max_completion_tokens":131072},
  {"id":"claude-opus-5-5","object":"model","owned_by":"model-studio","resolved_model":"opencode/mimo-v2.6-flash-free","capabilities":{"vision":true,"pdf":false,"audioInput":true,"videoInput":true,"imageOutput":false,"audioOutput":false,"search":false,"tools":true,"reasoning":true,"thinkingFormat":"deepseek","thinkingCanDisable":false,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":1048576,"maxOutput":131072},"context_length":1000000,"max_completion_tokens":131072},
  {"id":"deepseek-v4-1-flash","object":"model","owned_by":"model-studio","resolved_model":"opencode/mimo-v2.6-flash-free","capabilities":{"vision":true,"pdf":false,"audioInput":true,"videoInput":true,"imageOutput":false,"audioOutput":false,"search":false,"tools":true,"reasoning":true,"thinkingFormat":"deepseek","thinkingCanDisable":false,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":1048576,"maxOutput":131072},"context_length":1000000,"max_completion_tokens":131072},
  {"id":"custom2/gatekey-unlimited-claude-opus-4.6","object":"model","owned_by":"custom2","capabilities":{"vision":true,"pdf":false,"audioInput":false,"videoInput":false,"imageOutput":false,"audioOutput":false,"search":true,"tools":true,"reasoning":true,"thinkingFormat":"claude-adaptive","thinkingCanDisable":true,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":200000,"maxOutput":64000},"context_length":200000,"max_completion_tokens":64000},
  {"id":"custom2/gatekey-unlimited-claude-sonnet-4.6","object":"model","owned_by":"custom2","capabilities":{"vision":true,"pdf":false,"audioInput":false,"videoInput":false,"imageOutput":false,"audioOutput":false,"search":true,"tools":true,"reasoning":true,"thinkingFormat":"claude-adaptive","thinkingCanDisable":true,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":200000,"maxOutput":64000},"context_length":200000,"max_completion_tokens":64000},
  {"id":"ag/claude-sonnet-4-6","object":"model","owned_by":"ag","capabilities":{"vision":true,"pdf":false,"audioInput":false,"videoInput":false,"imageOutput":false,"audioOutput":false,"search":true,"tools":true,"reasoning":true,"thinkingFormat":"claude-adaptive","thinkingCanDisable":true,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":1000000,"maxOutput":128000},"context_length":1000000,"max_completion_tokens":128000},
  {"id":"ag/claude-opus-4-6-thinking","object":"model","owned_by":"ag","capabilities":{"vision":true,"pdf":false,"audioInput":false,"videoInput":false,"imageOutput":false,"audioOutput":false,"search":true,"tools":true,"reasoning":true,"thinkingFormat":"claude-budget","thinkingCanDisable":true,"thinkingRange":null,"thinkingEffortSupported":false,"contextWindow":200000,"maxOutput":64000},"context_length":200000,"max_completion_tokens":64000}
];

// ─── State ───
const state = {
  models: [],
  selected: null,
  messages: [],
  pendingFiles: [],
  sending: false,
  filters: { query: '', category: 'opus' },
  systemPrompt: 'You are XTRX AiGracy powered by Claude Opus, a helpful AI assistant. Answer clearly, use code blocks when needed.',
  abortController: null,
  history: [],
  usingFallback: false,
};

const $ = (id) => document.getElementById(id);
const chatArea = $('chatArea');
const messageInput = $('messageInput');
const sendBtn = $('btnSend');
const attachBtn = $('btnAttach');
const fileInput = $('fileInput');
const pendingFiles = $('pendingFiles');
const hero = $('hero');

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
function isOpus(id) {
  return id.toLowerCase().includes('opus');
}

function providerLabel(p) {
  const map = {
    'ag': 'Claude',
    'custom2': 'Gatekey',
    'oc': 'OpenCode',
    'combo': 'Combo',
    'model-studio': 'Model Studio',
  };
  return map[p.toLowerCase()] || p;
}

function ctxLabel(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

function parseModel(raw) {
  const caps = raw.capabilities || {};
  const id = raw.id || '';
  const parts = id.split('/');
  return {
    id,
    ownedBy: raw.owned_by || 'unknown',
    displayName: parts.length > 1 ? parts.slice(1).join('/') : id,
    provider: parts.length > 1 ? parts[0] : (raw.owned_by || 'unknown'),
    vision: caps.vision === true,
    audioInput: caps.audioInput === true,
    videoInput: caps.videoInput === true,
    tools: caps.tools === true,
    reasoning: caps.reasoning === true,
    search: caps.search === true,
    contextWindow: raw.context_length || 0,
    maxOutput: raw.max_completion_tokens || 0,
    isOpus: isOpus(id),
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function fileIcon(f) {
  if (f.mime.startsWith('image/')) return '🖼️';
  if (f.mime.startsWith('video/')) return '🎬';
  if (f.mime.startsWith('audio/')) return '🎵';
  if (f.mime === 'application/pdf') return '📕';
  if (f.mime.startsWith('text/') || f.mime === 'application/json') return '📄';
  return '📎';
}

function guessMime(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.mov')) return 'video/quicktime';
  if (n.endsWith('.webm')) return 'video/webm';
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.json')) return 'application/json';
  return 'text/plain';
}

function makeAvatar(isUser) {
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  const img = document.createElement('img');
  img.src = ASSET_IMAGE;
  img.alt = isUser ? 'User' : 'Claude';
  img.onerror = () => {
    img.remove();
    avatar.textContent = isUser ? 'X' : '✦';
  };
  avatar.appendChild(img);
  return avatar;
}

// ═══════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════
const sidebar = $('sidebar');
const sidebarBackdrop = $('sidebarBackdrop');

$('btnSidebar').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('show');
});
$('sidebarClose').addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('show');
}

$('newChatBtn').addEventListener('click', () => {
  if (state.messages.length > 0) {
    if (!confirm('Mulai chat baru? Riwayat akan disimpan.')) return;
    saveToHistory();
  }
  state.messages = [];
  renderMessages();
  closeSidebar();
});

function saveToHistory() {
  if (state.messages.length === 0) return;
  const firstUser = state.messages.find(m => m.role === 'user');
  if (!firstUser) return;
  const title = (firstUser.content || 'Chat baru').slice(0, 40) || 'Chat baru';
  const cloned = state.messages.map(m => ({
    ...m,
    isStreaming: false,
    files: (m.files || []).map(f => ({ ...f })),
  }));
  state.history.unshift({ title, messages: cloned });
  renderHistory();
}

function renderHistory() {
  const container = $('historyList');
  if (state.history.length === 0) {
    container.innerHTML = '<div class="history-empty">Belum ada riwayat chat</div>';
    return;
  }
  container.innerHTML = state.history.map((h, i) => `
    <div class="history-item" data-idx="${i}">${escapeHtml(h.title)}</div>
  `).join('');

  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const item = state.history[idx];
      if (!item) return;
      state.messages = item.messages.map(m => ({ ...m, isStreaming: false }));
      renderMessages();
      closeSidebar();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// LOAD MODELS (dengan fallback, fokus Claude)
// ═══════════════════════════════════════════════════════════════════════
async function loadModels() {
  $('modelNameTop').textContent = 'Loading...';
  $('composerName').textContent = 'Loading';

  try {
    const res = await fetch('/api/models', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const list = data.data || [];

    if (list.length === 0) throw new Error('Empty model list');

    state.models = list.map(parseModel);
    state.usingFallback = false;
    toast(`✅ ${state.models.length} model loaded`);
  } catch (e) {
    console.warn('API error, using fallback models:', e);
    state.models = FALLBACK_MODELS.map(parseModel);
    state.usingFallback = true;
    toast(`⚠ Fallback: ${state.models.length} model (API offline)`);
  }

  // ⭐ PRIORITAS: Claude Opus dulu
  if (state.models.length > 0) {
    state.selected =
      state.models.find(m => m.id === DEFAULT_MODEL_ID) ||
      state.models.find(m => isOpus(m.id) && m.vision && m.tools) ||
      state.models.find(m => isOpus(m.id)) ||
      state.models.find(m => m.id.toLowerCase().includes('claude') && m.vision) ||
      state.models.find(m => m.id.toLowerCase().includes('claude')) ||
      state.models[0];

    applyModelToUI();
  } else {
    $('modelNameTop').textContent = 'Tidak ada model';
    $('composerName').textContent = '-';
  }
}

function applyModelToUI() {
  if (!state.selected) return;
  const m = state.selected;
  $('modelNameTop').textContent = m.displayName;
  $('composerName').textContent = m.displayName;
}

// ═══════════════════════════════════════════════════════════════════════
// FILE PICKER
// ═══════════════════════════════════════════════════════════════════════
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const f of files) await addPendingFile(f);
  fileInput.value = '';
  updateSendBtn();
});

async function addPendingFile(file) {
  if (file.size > 100 * 1024 * 1024) {
    toast(`⚠ ${file.name} > 100MB`);
    return;
  }
  const data = {
    name: file.name,
    mime: file.type || guessMime(file.name),
    size: file.size,
    dataUrl: null,
    bytes: null,
  };
  try {
    const dataUrl = await readAsDataURL(file);
    data.dataUrl = dataUrl;
    data.bytes = dataUrl.split(',')[1];
  } catch (e) {
    toast(`Gagal baca ${file.name}`);
    return;
  }
  state.pendingFiles.push(data);
  renderPendingFiles();
  updateSendBtn();
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('read error'));
    r.readAsDataURL(file);
  });
}

function renderPendingFiles() {
  if (state.pendingFiles.length === 0) {
    pendingFiles.classList.remove('active');
    pendingFiles.innerHTML = '';
    return;
  }
  pendingFiles.classList.add('active');
  pendingFiles.innerHTML = state.pendingFiles.map((f, i) => {
    let preview = '';
    if (f.mime.startsWith('image/')) {
      preview = `<img src="${f.dataUrl}" alt="" />`;
    } else if (f.mime.startsWith('video/')) {
      preview = `<video src="${f.dataUrl}" muted></video>`;
    } else {
      preview = `<div class="file-icon">${fileIcon(f)}</div>`;
    }
    return `
      <div class="pending-item">
        ${preview}
        <div class="file-name">${escapeHtml(f.name)}</div>
        <button class="pending-remove" data-idx="${i}">✕</button>
      </div>
    `;
  }).join('');

  pendingFiles.querySelectorAll('.pending-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.pendingFiles.splice(idx, 1);
      renderPendingFiles();
      updateSendBtn();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SEND
// ═══════════════════════════════════════════════════════════════════════
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
  updateSendBtn();
});

function updateSendBtn() {
  const hasText = messageInput.value.trim().length > 0;
  const hasFiles = state.pendingFiles.length > 0;
  sendBtn.disabled = (!hasText && !hasFiles) || state.sending;
}

// Suggest cards — otomatis load sample image
document.querySelectorAll('.suggest-card').forEach(card => {
  card.addEventListener('click', async () => {
    const prompt = card.dataset.prompt || '';
    const sampleImage = card.dataset.sampleImage;

    messageInput.value = prompt;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';

    if (sampleImage) {
      try {
        const res = await fetch(sampleImage);
        if (res.ok) {
          const blob = await res.blob();
          const fileName = sampleImage.split('/').pop() || 'images.png';
          const mime = blob.type || 'image/png';
          const file = new File([blob], fileName, { type: mime });
          await addPendingFile(file);
          toast(`📎 ${fileName} siap dikirim`);
        }
      } catch (e) {
        console.warn('Gagal load sample image:', e);
      }
    }

    updateSendBtn();
  });
});

async function sendMessage() {
  const text = messageInput.value.trim();
  if ((!text && state.pendingFiles.length === 0) || state.sending) return;
  if (!state.selected) { toast('⚠ Pilih model dulu'); return; }

  const files = [...state.pendingFiles];
  const userMsg = { role: 'user', content: text, files };
  const aiMsg = {
    role: 'assistant',
    content: '',
    isStreaming: true,
    modelName: state.selected.displayName,
  };

  state.messages.push(userMsg, aiMsg);
  state.sending = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  state.pendingFiles = [];
  renderPendingFiles();
  updateSendBtn();

  renderMessages();
  scrollToBottom();

  try {
    await streamCompletion(aiMsg);
  } catch (e) {
    aiMsg.content = `❌ **Error:** ${escapeHtml(e.message)}`;
    aiMsg.isStreaming = false;
    state.sending = false;
    renderMessages();
    toast(`❌ ${e.message}`);
  }
  updateSendBtn();
}

function buildApiMessages() {
  const out = [];
  if (state.systemPrompt.trim()) {
    out.push({ role: 'system', content: state.systemPrompt.trim() });
  }

  for (const m of state.messages) {
    if (m.isStreaming) continue;
    if (!m.content && (!m.files || m.files.length === 0)) continue;

    if (!m.files || m.files.length === 0) {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    const parts = [];
    if (m.content) parts.push({ type: 'text', text: m.content });

    for (const f of m.files) {
      if (f.mime.startsWith('image/')) {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${f.mime};base64,${f.bytes}` },
        });
      } else if (f.mime.startsWith('video/')) {
        parts.push({
          type: 'video_url',
          video_url: { url: `data:${f.mime};base64,${f.bytes}` },
        });
      } else if (f.mime.startsWith('audio/')) {
        parts.push({
          type: 'input_audio',
          input_audio: { data: f.bytes, format: f.name.split('.').pop() },
        });
      } else if (f.mime.startsWith('text/') || f.mime === 'application/json') {
        let txt = '';
        try { txt = atob(f.bytes); } catch (_) { txt = '[binary]'; }
        parts.push({
          type: 'text',
          text: `📄 File: ${f.name}\n\`\`\`\n${txt}\n\`\`\``,
        });
      } else {
        parts.push({
          type: 'text',
          text: `📎 Attached: ${f.name} (${fmtBytes(f.size)}, ${f.mime})`,
        });
      }
    }
    out.push({ role: m.role, content: parts });
  }
  return out;
}

async function streamCompletion(aiMsg) {
  const body = {
    model: state.selected.id,
    stream: true,
    messages: buildApiMessages(),
  };

  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: state.abortController.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        aiMsg.isStreaming = false;
        state.sending = false;
        renderMessages();
        return;
      }
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta;
        if (!delta) continue;
        const content = delta.content || '';
        const reasoning = delta.reasoning || '';
        if (content) {
          aiMsg.content += content;
          updateLastBubble(aiMsg.content);
        } else if (reasoning && !aiMsg.content) {
          aiMsg.content += reasoning;
          updateLastBubble(aiMsg.content);
        }
      } catch (_) {}
    }
  }

  aiMsg.isStreaming = false;
  state.sending = false;
  renderMessages();
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER MESSAGES
// ═══════════════════════════════════════════════════════════════════════
function renderMessages() {
  if (state.messages.length === 0) {
    chatArea.innerHTML = '';
    chatArea.appendChild(hero);
    hero.style.display = 'flex';
    return;
  }

  hero.style.display = 'none';
  const wrapper = document.createElement('div');

  state.messages.forEach((m, idx) => {
    wrapper.appendChild(buildMessageEl(m, idx));
  });

  chatArea.innerHTML = '';
  chatArea.appendChild(wrapper);
  attachCodeCopyButtons();
  scrollToBottom();
}

function buildMessageEl(m, idx) {
  const isUser = m.role === 'user';
  const row = document.createElement('div');
  row.className = `msg-row ${isUser ? 'user' : 'assistant'}`;
  row.dataset.idx = idx;

  const avatar = makeAvatar(isUser);
  const content = document.createElement('div');
  content.className = 'msg-content';

  let filesHtml = '';
  if (m.files && m.files.length > 0) {
    filesHtml = '<div class="msg-files">' + m.files.map(f => {
      if (f.mime.startsWith('image/')) {
        return `<img class="msg-file-img" src="${f.dataUrl}" alt="${escapeHtml(f.name)}" />`;
      }
      if (f.mime.startsWith('video/')) {
        return `<video class="msg-file-video" src="${f.dataUrl}" controls muted></video>`;
      }
      return `<span class="msg-file-chip">${fileIcon(f)} ${escapeHtml(f.name)}</span>`;
    }).join('') + '</div>';
  }

  let bodyHtml = '';
  if (isUser) {
    bodyHtml = escapeHtml(m.content || '').replace(/\n/g, '<br>');
  } else {
    if (m.isStreaming && !m.content) {
      bodyHtml = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    } else {
      bodyHtml = renderMarkdown(m.content || '');
      if (m.isStreaming) bodyHtml += '<span class="stream-cursor"></span>';
    }
  }

  const modelTag = (!isUser && m.modelName)
    ? `<div class="msg-model-tag">${escapeHtml(m.modelName)}</div>`
    : '';

  content.innerHTML = `${modelTag}${filesHtml}<div class="msg-bubble"><div class="md-content">${bodyHtml}</div></div>`;

  if (isUser) {
    row.appendChild(content);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(content);
  }
  return row;
}

function updateLastBubble(content) {
  const rows = chatArea.querySelectorAll('.msg-row.assistant');
  if (rows.length === 0) return;
  const last = rows[rows.length - 1];
  const md = last.querySelector('.md-content');
  if (!md) return;
  md.innerHTML = renderMarkdown(content) + '<span class="stream-cursor"></span>';
  attachCodeCopyButtons();
  scrollToBottom();
}

// ═══════════════════════════════════════════════════════════════════════
// MARKDOWN
// ═══════════════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const cleanCode = code.replace(/\n$/, '');
    return `<pre data-lang="${lang}"><code>${cleanCode}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  html = html.split(/\n\n+/).map(p => {
    if (/^\s*<(h\d|ul|ol|pre|blockquote)/.test(p)) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function attachCodeCopyButtons() {
  chatArea.querySelectorAll('pre').forEach(pre => {
    if (pre.dataset.copyAttached) return;
    pre.dataset.copyAttached = '1';
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = 'Copy', 1400);
      });
    });
    pre.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MODEL PICKER (default filter = opus)
// ═══════════════════════════════════════════════════════════════════════
function openModelPicker() {
  if (state.models.length === 0) return;
  renderModelList();
  openSheet('sheetModel');
}

$('btnModelTop').addEventListener('click', openModelPicker);
$('btnModelComposer').addEventListener('click', openModelPicker);

$('modelSearch').addEventListener('input', (e) => {
  state.filters.query = e.target.value.trim().toLowerCase();
  renderModelList();
});

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filters.category = btn.dataset.filter;
    renderModelList();
  });
});

// set filter "opus" aktif sejak awal
document.querySelectorAll('.filter-pill').forEach(b => {
  if (b.dataset.filter === 'opus') b.classList.add('active');
});

function filteredModels() {
  let list = state.models;
  const f = state.filters.category;
  const q = state.filters.query;

  if (f === 'opus') list = list.filter(m => isOpus(m.id));
  if (f === 'claude') list = list.filter(m => m.id.toLowerCase().includes('claude'));
  if (f === 'gemini') list = list.filter(m => m.id.toLowerCase().includes('gemini'));
  if (f === 'vision') list = list.filter(m => m.vision);
  if (f === 'tools') list = list.filter(m => m.tools);
  if (f === 'reasoning') list = list.filter(m => m.reasoning);

  if (q) list = list.filter(m => m.id.toLowerCase().includes(q));
  return list;
}

function renderModelList() {
  const list = filteredModels();
  const container = $('modelList');

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:#6E6E6E;font-size:13px;">Tidak ada model cocok</div>';
    return;
  }

  // Urutkan: Opus dulu
  list.sort((a, b) => {
    if (a.isOpus && !b.isOpus) return -1;
    if (!a.isOpus && b.isOpus) return 1;
    return 0;
  });

  container.innerHTML = list.map(m => {
    const isSelected = state.selected?.id === m.id;
    const caps = [];
    if (m.vision) caps.push(`<span class="cap-badge">👁</span>`);
    if (m.audioInput) caps.push(`<span class="cap-badge">🎤</span>`);
    if (m.videoInput) caps.push(`<span class="cap-badge">🎬</span>`);
    if (m.tools) caps.push(`<span class="cap-badge">🔧</span>`);
    if (m.reasoning) caps.push(`<span class="cap-badge">🧠</span>`);
    if (m.search) caps.push(`<span class="cap-badge">🔍</span>`);

    return `
      <div class="model-item ${isSelected ? 'selected' : ''} ${m.isOpus ? 'opus' : ''}" data-id="${escapeHtml(m.id)}">
        <div class="model-item-icon">✦</div>
        <div class="model-item-info">
          <div class="model-item-name">${escapeHtml(m.displayName)}</div>
          <div class="model-item-meta">
            <span class="provider-tag">${escapeHtml(providerLabel(m.provider))}</span>
            <span>${ctxLabel(m.contextWindow)} ctx</span>
            ${caps.join('')}
          </div>
        </div>
        <div class="model-item-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.model-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const model = state.models.find(m => m.id === id);
      if (!model) return;
      state.selected = model;
      applyModelToUI();
      closeSheet('sheetModel');
      toast(`✅ ${model.displayName}`);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SHEETS
// ═══════════════════════════════════════════════════════════════════════
function openSheet(id) { $(id).classList.add('open'); }
function closeSheet(id) { $(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => closeSheet(el.dataset.close));
});

$('btnSystem').addEventListener('click', () => {
  $('systemPrompt').value = state.systemPrompt;
  openSheet('sheetSystem');
});
$('btnSaveSystem').addEventListener('click', () => {
  state.systemPrompt = $('systemPrompt').value;
  closeSheet('sheetSystem');
  toast('✅ Instruksi disimpan');
});

$('btnClear').addEventListener('click', () => {
  if (state.messages.length === 0) return;
  if (!confirm('Hapus semua chat?')) return;
  state.messages = [];
  renderMessages();
  toast('🗑️ Chat dihapus');
});

// ═══════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ═══════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════
renderHistory();
loadModels();
updateSendBtn();