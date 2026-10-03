// ===========================
// AI.JS - GEMINI AI ASSISTANT
// ===========================

let chatHistory = [];
let isAiTyping = false;

function checkApiKeyStatus() {
  const apiKey = Store.getApiKey();
  const setupCard = document.getElementById('apiKeySetup');
  const suggestionsEl = document.getElementById('aiSuggestions');
  if (apiKey) {
    setupCard.style.display = 'none';
    suggestionsEl.style.display = 'block';
  } else {
    setupCard.style.display = 'block';
    suggestionsEl.style.display = 'none';
  }
  // Pre-fill api key input in setup card
  document.getElementById('geminiApiKeyInput').value = apiKey || '';
}

async function sendMessageToAI(userMessage) {
  const apiKey = Store.getApiKey();
  if (!apiKey) {
    showToast('Masukkan Gemini API Key terlebih dahulu!', 'error');
    checkApiKeyStatus();
    return;
  }
  if (isAiTyping) return;

  // Build context from user data
  const profil = Store.getProfil();
  const jadwal = Store.getJadwal();
  const tugas = Store.getTugas().filter(t => !t.done);
  const transaksi = Store.getTransaksi();
  const now = new Date();
  const thisMonthTrans = transaksi.filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = thisMonthTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0);
  const expense = thisMonthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0);

  const systemPrompt = `Kamu adalah Aiden, asisten AI personal yang cerdas, ramah, dan suportif untuk ${profil.name || 'pengguna'}.
Pengguna adalah mahasiswa ${profil.jurusan ? 'jurusan ' + profil.jurusan : ''} ${profil.univ ? 'di ' + profil.univ : ''} semester ${profil.semester || '?'}.

DATA PENGGUNA SAAT INI:
- Jadwal kuliah: ${jadwal.length} mata kuliah terdaftar
- Tugas belum selesai: ${tugas.length} tugas
${tugas.length > 0 ? '- Tugas deadline dekat: ' + tugas.slice(0,3).map(t => `${t.nama} (${t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID') : 'tanpa deadline'})`).join(', ') : ''}
- Keuangan bulan ini: Pemasukan Rp ${income.toLocaleString('id-ID')}, Pengeluaran Rp ${expense.toLocaleString('id-ID')}, Saldo Rp ${(income-expense).toLocaleString('id-ID')}
- Waktu sekarang: ${now.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})} pukul ${now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}

PANDUAN:
- Jawab dalam Bahasa Indonesia yang natural, akrab, dan suportif
- Gunakan emoji secukupnya untuk membuat percakapan lebih menarik
- Berikan saran yang praktis dan relevan dengan konteks mahasiswa
- Jika ada pertanyaan tentang data pengguna, gunakan data di atas
- Format respons dengan baik, gunakan bullet points jika membantu
- Maksimal 300 kata per respons kecuali diminta lebih panjang`;

  // Add user message to UI
  appendMessage('user', userMessage);
  chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

  // Show typing indicator
  isAiTyping = true;
  showTypingIndicator();

  try {
    // Build conversation contents
    const contents = [];

    // Add system context as first user message if no history
    if (chatHistory.length === 1) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt + '\n\nPesan pertama dari pengguna: ' + userMessage }]
      });
    } else {
      // Include full history with system context
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Siap! Aku Aiden, asisten AI personal kamu. Apa yang bisa aku bantu?' }]
      });
      // Add chat history (skip first since we reconstructed it)
      chatHistory.slice(0, -1).forEach(msg => contents.push(msg));
      // Add current message
      contents.push({ role: 'user', parts: [{ text: userMessage }] });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ]
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API Error ' + response.status);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, aku tidak bisa memproses pesan itu.';

    removeTypingIndicator();
    appendMessage('assistant', aiText);
    chatHistory.push({ role: 'model', parts: [{ text: aiText }] });

    // Limit history to last 20 messages
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  } catch (err) {
    removeTypingIndicator();
    let errMsg = 'Gagal menghubungi AI. ';
    if (err.message.includes('API_KEY_INVALID') || err.message.includes('400')) {
      errMsg += 'API Key tidak valid. Periksa kembali API Key di Profil.';
    } else if (err.message.includes('QUOTA')) {
      errMsg += 'Kuota API habis. Coba lagi nanti.';
    } else {
      errMsg += err.message;
    }
    appendMessage('assistant', '❌ ' + errMsg);
  }

  isAiTyping = false;
}

function appendMessage(role, text) {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;

  // Format markdown-like text
  const formatted = formatAIText(text);

  div.innerHTML = `
    ${role === 'assistant' ? `<div class="msg-avatar"><i data-lucide="sparkles"></i></div>` : ''}
    <div class="msg-bubble">${formatted}</div>
    ${role === 'user' ? `<div class="msg-avatar" style="background:linear-gradient(135deg,#1a2a6c,#2563eb)">
      <i data-lucide="user"></i>
    </div>` : ''}
  `;
  container.appendChild(div);
  lucide.createIcons({ nodes: [div] });
  container.scrollTop = container.scrollHeight;
}

function formatAIText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">$1</code>')
    .replace(/^[-•]\s(.+)/gm, '<li style="margin-left:16px;margin-top:4px">$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .split('</p><p>').map(p => `<p>${p}</p>`).join('');
}

function showTypingIndicator() {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg assistant';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar"><i data-lucide="sparkles"></i></div>
    <div class="msg-bubble">
      <div class="ai-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.appendChild(div);
  lucide.createIcons({ nodes: [div] });
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function sendSuggestion(text) {
  document.getElementById('aiInput').value = text;
  sendAIMessage();
}

function sendAIMessage() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text || isAiTyping) return;
  input.value = '';
  input.style.height = 'auto';
  sendMessageToAI(text);
}

document.addEventListener('DOMContentLoaded', () => {
  // Save API Key from setup card
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('geminiApiKeyInput').value.trim();
    if (!key) { showToast('Masukkan API Key terlebih dahulu!', 'error'); return; }
    const profil = Store.getProfil();
    profil.apiKey = key;
    Store.setProfil(profil);
    document.getElementById('profileApiKey').value = key;
    checkApiKeyStatus();
    showToast('✅ API Key disimpan!', 'success');
  });

  // Send button
  document.getElementById('aiSendBtn').addEventListener('click', sendAIMessage);

  // Enter to send (shift+enter for newline)
  document.getElementById('aiInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIMessage();
    }
  });

  // Auto resize textarea
  document.getElementById('aiInput').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });
});
