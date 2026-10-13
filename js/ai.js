// ===========================
// PISKU AI ASSISTANT (js/ai.js)
// Asisten Pribadi Cerdas, Olah File, & Auto-Input Data
// ===========================

let chatHistory = [];
let isAiTyping = false;
let attachedFile = null; // { name, type, size, data, base64, isImage, isText, isPdf }

// Waktu reset otomatis: 24 jam (dalam milidetik)
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

function checkApiKeyStatus() {
  const apiKey = Store.getApiKey();
  const setupCard = document.getElementById('apiKeySetup');
  const suggestionsEl = document.getElementById('aiSuggestions');
  // Kunci API internal tersembunyi & otomatis aktif
  if (setupCard) setupCard.style.display = 'none';
  if (suggestionsEl) suggestionsEl.style.display = 'block';
  const keyInput = document.getElementById('geminiApiKeyInput');
  if (keyInput) keyInput.value = apiKey || '';
}

// ---- Auto-Reset & Restore Chat (24 Jam) ----
function checkAndRestorePiskuChat() {
  const lastTime = parseInt(localStorage.getItem('mylife_pisku_last_time') || '0', 10);
  const now = Date.now();

  if (!lastTime || (now - lastTime >= RESET_INTERVAL_MS)) {
    // Sudah 24 jam atau pertama kali -> reset percakapan
    resetPiskuChat(false);
  } else {
    // Masih dalam 24 jam -> pulihkan percakapan
    loadSavedPiskuMessages();
  }
}

function resetPiskuChat(notify = true) {
  localStorage.removeItem('mylife_pisku_messages');
  localStorage.setItem('mylife_pisku_last_time', Date.now().toString());
  chatHistory = [];

  const container = document.getElementById('aiMessages');
  if (container) {
    container.innerHTML = `
      <div class="ai-msg assistant">
        <div class="msg-avatar"><i data-lucide="sparkles"></i></div>
        <div class="msg-bubble">
          <p>Halo! Aku <b>Pisku</b>, asisten AI pintar kamu 🤖✨</p>
          <p>Aku bisa bantu menjawab pertanyaan, <b>mengolah foto / file dokumen</b>, dan <b>langsung menginputkan data otomatis</b> ke aplikasi (jadwal kuliah, catatan keuangan, tugas, agenda kalender, target menabung, dll).</p>
          <p><small style="color:var(--text-muted)">💡 Tips: Ketik jadwal semestermu sekaligus atau kirim foto jadwal/struk belanja!</small></p>
        </div>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
  }

  if (notify && typeof showToast === 'function') {
    showToast('🔄 Percakapan Pisku telah dibersihkan', 'info');
  }
}

function savePiskuMessageToStorage(msgObj) {
  try {
    const list = JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]');
    list.push(msgObj);
    localStorage.setItem('mylife_pisku_messages', JSON.stringify(list.slice(-30))); // Simpan max 30 pesan terakhir
    localStorage.setItem('mylife_pisku_last_time', Date.now().toString());
  } catch (e) {
    console.warn('Gagal menyimpan riwayat chat Pisku:', e);
  }
}

function loadSavedPiskuMessages() {
  const container = document.getElementById('aiMessages');
  if (!container) return;

  try {
    const list = JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]');
    if (!list.length) {
      resetPiskuChat(false);
      return;
    }

    container.innerHTML = '';
    list.forEach(item => {
      renderMessageElement(item.role, item.text, item.file, item.actionCardHTML, false);
      if (item.text) {
        chatHistory.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        });
      }
    });
    lucide.createIcons({ nodes: [container] });
    container.scrollTop = container.scrollHeight;
  } catch {
    resetPiskuChat(false);
  }
}

// ---- File Attachment Handler ----
function initFileAttachment() {
  const attachBtn = document.getElementById('aiAttachBtn');
  const fileInput = document.getElementById('aiFileInput');
  const previewBox = document.getElementById('aiFilePreview');

  if (!attachBtn || !fileInput) return;

  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Batas ukuran 15MB
    if (file.size > 15 * 1024 * 1024) {
      showToast('Ukuran file maksimal 15 MB!', 'error');
      fileInput.value = '';
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isText = file.type.startsWith('text/') || /\.(txt|csv|json|md)$/i.test(file.name);

    const reader = new FileReader();

    if (isImage || isPdf) {
      reader.onload = (ev) => {
        const fullDataUrl = ev.target.result;
        const base64Data = fullDataUrl.split(',')[1];
        attachedFile = {
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: (file.size / 1024).toFixed(1) + ' KB',
          dataUrl: fullDataUrl,
          base64: base64Data,
          isImage,
          isPdf,
          isText: false
        };
        showFilePreview();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => {
        attachedFile = {
          name: file.name,
          type: file.type || 'text/plain',
          size: (file.size / 1024).toFixed(1) + ' KB',
          textContent: ev.target.result,
          isImage: false,
          isPdf: false,
          isText: true
        };
        showFilePreview();
      };
      reader.readAsText(file);
    }
  });
}

function showFilePreview() {
  const previewBox = document.getElementById('aiFilePreview');
  const attachBtn = document.getElementById('aiAttachBtn');
  if (!previewBox || !attachedFile) return;

  let iconHTML = '';
  if (attachedFile.isImage) {
    iconHTML = `<img src="${attachedFile.dataUrl}" alt="Thumbnail" class="ai-file-thumb" />`;
  } else {
    iconHTML = `<div class="ai-file-icon"><i data-lucide="${attachedFile.isPdf ? 'file-text' : 'file'}"></i></div>`;
  }

  previewBox.innerHTML = `
    <div class="ai-file-preview-info">
      ${iconHTML}
      <div>
        <div class="ai-file-name" title="${attachedFile.name}">${attachedFile.name}</div>
        <div class="ai-file-size">${attachedFile.size}</div>
      </div>
    </div>
    <button type="button" class="ai-file-del-btn" onclick="clearAttachedFile()" title="Hapus Lampiran">
      <i data-lucide="x"></i>
    </button>
  `;
  previewBox.classList.remove('hidden');
  if (attachBtn) attachBtn.classList.add('has-file');
  lucide.createIcons({ nodes: [previewBox] });
}

function clearAttachedFile() {
  attachedFile = null;
  const fileInput = document.getElementById('aiFileInput');
  const previewBox = document.getElementById('aiFilePreview');
  const attachBtn = document.getElementById('aiAttachBtn');

  if (fileInput) fileInput.value = '';
  if (previewBox) {
    previewBox.innerHTML = '';
    previewBox.classList.add('hidden');
  }
  if (attachBtn) attachBtn.classList.remove('has-file');
}

// ---- Eksekusi Tindakan Otomatis (Auto-Input Actions) ----
function executePiskuActions(actions) {
  if (!Array.isArray(actions) || !actions.length) return null;

  const results = [];
  const nowStr = new Date().toISOString().split('T')[0];

  actions.forEach(act => {
    const d = act.data || {};
    try {
      if (act.action === 'add_jadwal') {
        const matkul = (d.matkul || '').trim();
        if (!matkul) return;
        const list = Store.getJadwal();
        const item = {
          id: typeof uid === 'function' ? uid() : 'j_' + Date.now() + Math.random().toString(36).substr(2, 4),
          hari: d.hari || 'Senin',
          matkul: matkul,
          ruang: d.ruang || '-',
          jamMulai: d.jamMulai || '08:00',
          jamSelesai: d.jamSelesai || '10:00',
          dosen: d.dosen || '',
          sks: parseInt(d.sks) || 2
        };
        list.push(item);
        Store.setJadwal(list);
        results.push({
          icon: '📅',
          title: `Jadwal: ${item.matkul}`,
          desc: `${item.hari}, ${item.jamMulai} - ${item.jamSelesai} (${item.ruang})`
        });
      }

      else if (act.action === 'add_transaksi') {
        const jumlah = parseFloat(d.jumlah);
        if (!jumlah || jumlah <= 0) return;
        const list = Store.getTransaksi();
        const type = d.type === 'income' ? 'income' : 'expense';
        const item = {
          id: typeof uid === 'function' ? uid() : 't_' + Date.now() + Math.random().toString(36).substr(2, 4),
          type: type,
          jumlah: jumlah,
          kategori: d.kategori || (type === 'income' ? 'Uang Saku' : 'Lainnya'),
          keterangan: d.keterangan || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
          tanggal: d.tanggal || nowStr,
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setTransaksi(list);
        results.push({
          icon: type === 'income' ? '💰' : '💸',
          title: `${type === 'income' ? '+' : '-'}${formatRupiahFull(jumlah)} (${item.kategori})`,
          desc: `${item.keterangan} • ${item.tanggal}`
        });
      }

      else if (act.action === 'add_tugas') {
        const nama = (d.nama || '').trim();
        if (!nama) return;
        const list = Store.getTugas();
        const item = {
          id: typeof uid === 'function' ? uid() : 'tg_' + Date.now() + Math.random().toString(36).substr(2, 4),
          nama: nama,
          matkul: d.matkul || 'Umum',
          deadline: d.deadline || '',
          deskripsi: d.deskripsi || '',
          done: false,
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setTugas(list);
        results.push({
          icon: '📝',
          title: `Tugas: ${item.nama}`,
          desc: `${item.matkul} ${item.deadline ? '• Deadline: ' + item.deadline : ''}`
        });
      }

      else if (act.action === 'add_event') {
        const title = (d.title || '').trim();
        if (!title) return;
        const list = Store.getEvents();
        const item = {
          id: typeof uid === 'function' ? uid() : 'ev_' + Date.now() + Math.random().toString(36).substr(2, 4),
          title: title,
          date: d.date || nowStr,
          time: d.time || '09:00',
          desc: d.desc || ''
        };
        list.push(item);
        Store.setEvents(list);
        results.push({
          icon: '📆',
          title: `Agenda: ${item.title}`,
          desc: `${item.date} pukul ${item.time}`
        });
      }

      else if (act.action === 'add_catatan') {
        const judul = (d.judul || '').trim();
        if (!judul) return;
        const list = Store.getCatatan();
        const item = {
          id: typeof uid === 'function' ? uid() : 'c_' + Date.now() + Math.random().toString(36).substr(2, 4),
          judul: judul,
          isi: d.isi || '',
          kategori: d.kategori || 'Kuliah',
          pinned: false,
          updatedAt: new Date().toISOString()
        };
        list.push(item);
        Store.setCatatan(list);
        results.push({
          icon: '📌',
          title: `Catatan: ${item.judul}`,
          desc: `Kategori: ${item.kategori}`
        });
      }

      else if (act.action === 'add_goal') {
        const nama = (d.nama || '').trim();
        const target = parseFloat(d.target);
        if (!nama || !target || target <= 0) return;
        const list = Store.getGoals();
        const item = {
          id: typeof uid === 'function' ? uid() : 'g_' + Date.now() + Math.random().toString(36).substr(2, 4),
          nama: nama,
          target: target,
          deadline: d.deadline || '',
          icon: '🎯',
          history: [],
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setGoals(list);
        results.push({
          icon: '🎯',
          title: `Target: ${item.nama}`,
          desc: `Target Dana: ${formatRupiahFull(target)}`
        });
      }

      else if (act.action === 'add_debt') {
        const nama = (d.nama || '').trim();
        const jumlah = parseFloat(d.jumlah);
        if (!nama || !jumlah || jumlah <= 0) return;
        const list = Store.getDebts();
        const tipe = d.tipe === 'piutang' ? 'piutang' : 'hutang';
        const item = {
          id: typeof uid === 'function' ? uid() : 'd_' + Date.now() + Math.random().toString(36).substr(2, 4),
          tipe: tipe,
          nama: nama,
          jumlah: jumlah,
          jatuhTempo: d.jatuhTempo || '',
          catatan: d.catatan || '',
          payments: [],
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setDebts(list);
        results.push({
          icon: '🤝',
          title: `${tipe === 'hutang' ? 'Hutang ke' : 'Piutang dari'} ${item.nama}`,
          desc: `${formatRupiahFull(jumlah)} ${item.catatan ? '• ' + item.catatan : ''}`
        });
      }
    } catch (err) {
      console.warn('Gagal memproses aksi Pisku:', act, err);
    }
  });

  if (results.length > 0) {
    // Refresh semua halaman aktif
    if (typeof renderHome === 'function') renderHome();
    if (typeof renderJadwal === 'function') renderJadwal();
    if (typeof renderTugas === 'function') renderTugas();
    if (typeof renderKeuangan === 'function') renderKeuangan();
    if (typeof renderCatatan === 'function') renderCatatan();
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof updateStats === 'function') updateStats();

    // Otomatis simpan & sinkron ke Cloud Firestore
    if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
      FirebaseService.syncUploadAll(false);
    }

    if (typeof playHapticFeedback === 'function') playHapticFeedback('success');
    if (typeof showToast === 'function') {
      showToast(`⚡ Pisku berhasil memasukkan ${results.length} data ke aplikasi!`, 'success', 2600);
    }
  }

  return results;
}

// Format kartu rekap hasil aksi otomatis
function generateActionCardHTML(results) {
  if (!results || !results.length) return '';
  return `
    <div class="ai-action-card">
      <div class="ai-action-head">
        <span>⚡ Pisku Auto-Input</span>
        <span class="ai-action-badge">${results.length} Data Tersimpan</span>
      </div>
      <ul class="ai-action-list">
        ${results.map(r => `
          <li class="ai-action-item">
            <span class="ai-action-icon">${r.icon}</span>
            <div class="ai-action-text">
              <b>${r.title}</b>
              ${r.desc ? `<small>${r.desc}</small>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// ---- Komunikasi Utama Pisku (Gemini 1.5 Flash Multimodal) ----
async function sendMessageToAI(userMessage) {
  const apiKey = Store.getApiKey();
  if (!apiKey) {
    showToast('Masukkan Gemini API Key terlebih dahulu!', 'error');
    checkApiKeyStatus();
    return;
  }
  if (isAiTyping) return;

  const currentFile = attachedFile;
  clearAttachedFile();

  // Ambil konteks lengkap data pengguna saat ini
  const profil = Store.getProfil();
  const jadwal = Store.getJadwal();
  const tugas = Store.getTugas().filter(t => !t.done);
  const transaksi = Store.getTransaksi();
  const events = Store.getEvents();
  const now = new Date();
  const nowIso = now.toISOString().split('T')[0];

  const thisMonthTrans = transaksi.filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = thisMonthTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0);
  const expense = thisMonthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0);

  const systemPrompt = `Kamu adalah Pisku, asisten AI personal serba bisa yang cerdas, ramah, dan suportif untuk ${profil.name || 'pengguna'} di aplikasi Piskaly.
Pengguna adalah mahasiswa ${profil.jurusan ? 'jurusan ' + profil.jurusan : ''} ${profil.univ ? 'di ' + profil.univ : ''} semester ${profil.semester || '?'}.

DATA PENGGUNA SAAT INI:
- Hari & Tanggal Sekarang: ${now.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})} (${nowIso}), pukul ${now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
- Jadwal kuliah: ${jadwal.length} matkul terdaftar (${jadwal.slice(0,5).map(j => `${j.hari} ${j.matkul}`).join(', ')}${jadwal.length > 5 ? '...' : ''})
- Tugas belum selesai: ${tugas.length} tugas (${tugas.slice(0,3).map(t => `${t.nama} [${t.deadline || 'no-dl'}]`).join(', ')})
- Keuangan bulan ini: Pemasukan ${formatRupiahFull(income)}, Pengeluaran ${formatRupiahFull(expense)}, Saldo Tersedia ${formatRupiahFull(income-expense)}
- Agenda mendatang: ${events.length} agenda

KEMAMPUAN UTAMA - AUTO-INPUT & PENGOLAHAN FILE:
Kamu MEMILIKI KEMAMPUAN LANGSUNG untuk menginputkan data ke dalam sistem aplikasi Piskaly!
Bila pengguna meminta untuk:
1. Memasukkan jadwal kuliah (misal dari rangkuman teks atau foto/file jadwal yang dikirimkan).
2. Mencatat transaksi keuangan (pemasukan/pengeluaran/struk belanja).
3. Menambahkan tugas kuliah & deadline.
4. Menjadwalkan agenda/kegiatan di kalender.
5. Menulis catatan baru.
6. Membuat target tabungan.
7. Mencatat hutang atau piutang.

MAKA, di akhir jawabanmu, WAJIB sertakan blok kode aksi JSON dengan format PERSIS:
\`\`\`json:actions
[
  { "action": "add_jadwal", "data": { "hari": "Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu", "matkul": "Nama Matkul", "ruang": "Ruangan/Lab", "jamMulai": "08:00", "jamSelesai": "10:00", "dosen": "Nama Dosen", "sks": 3 } },
  { "action": "add_transaksi", "data": { "type": "expense|income", "jumlah": 25000, "kategori": "Makan|Transport|Belanja|Hiburan|Pendidikan|Kesehatan|Uang Saku|Kerja|Lainnya", "keterangan": "Keterangan", "tanggal": "YYYY-MM-DD" } },
  { "action": "add_tugas", "data": { "nama": "Nama Tugas", "matkul": "Mata Kuliah", "deadline": "YYYY-MM-DD", "deskripsi": "Deskripsi" } },
  { "action": "add_event", "data": { "title": "Nama Agenda", "date": "YYYY-MM-DD", "time": "HH:MM", "desc": "Deskripsi" } },
  { "action": "add_catatan", "data": { "judul": "Judul Catatan", "isi": "Isi lengkap", "kategori": "Kuliah|Pribadi|Ide|Penting" } },
  { "action": "add_goal", "data": { "nama": "Target Tabungan", "target": 5000000, "deadline": "YYYY-MM-DD" } },
  { "action": "add_debt", "data": { "tipe": "hutang|piutang", "nama": "Nama Orang", "jumlah": 50000, "jatuhTempo": "YYYY-MM-DD", "catatan": "Keterangan" } }
]
\`\`\`

ATURAN PENTING:
- Jika pengguna mengirim beberapa jadwal sekaligus (misal 5 matkul), buatkan 5 item "add_jadwal" di dalam array actions tersebut!
- Jika pengguna melampirkan foto dokumen/jadwal atau file teks, baca seluruh isinya secara teliti dan ubah menjadi actions yang sesuai.
- Hitung tanggal secara cerdas: tanggal hari ini adalah ${nowIso}. Jika pengguna bilang "besok", "lusa", "jumat depan", hitung ke format YYYY-MM-DD yang tepat.
- Nominal uang murni angka (contoh 25000, 1000000).
- Jawab dalam Bahasa Indonesia yang hangat, akrab, solutif, dan beri tahu pengguna bahwa data sudah berhasil diproses.`;

  // Render pesan user di layar
  appendMessage('user', userMessage, currentFile);

  isAiTyping = true;
  showTypingIndicator();

  try {
    // Siapkan parts untuk request ke Gemini
    const userParts = [];

    // Jika ada lampiran file gambar / PDF
    if (currentFile) {
      if (currentFile.isImage || currentFile.isPdf) {
        userParts.push({
          inlineData: {
            mimeType: currentFile.type,
            data: currentFile.base64
          }
        });
        userParts.push({
          text: `[PENGGUNA MELAMPIRKAN FILE: ${currentFile.name}]. Tolong olah dan pahami isi dokumen ini dengan cermat.\n\nPesan pengguna: ${userMessage || 'Tolong olah dan masukkan data dari file ini ke aplikasi.'}`
        });
      } else if (currentFile.isText) {
        userParts.push({
          text: `[ISI FILE DOKUMEN: ${currentFile.name}]\n${currentFile.textContent}\n\n[Pesan Pengguna]: ${userMessage || 'Tolong masukkan data dari file ini ke aplikasi.'}`
        });
      }
    } else {
      userParts.push({ text: userMessage });
    }

    // Bangun riwayat percakapan
    const contents = [];

    if (chatHistory.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n[Pesan Pertama Pengguna]:' }, ...userParts]
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Halo! Aku Pisku, asisten AI pribadi kamu. Siap membantu percakapan, membaca file, dan mengatur data aplikasi!' }]
      });
      chatHistory.slice(-10).forEach(msg => contents.push(msg));
      contents.push({ role: 'user', parts: userParts });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
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
    const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, Pisku tidak dapat memproses pesan itu saat ini.';

    // Deteksi dan eksekusi actions
    let cleanText = rawAiText;
    let actionResults = [];
    const actionMatch = rawAiText.match(/```(?:json:actions|actions)\s*([\s\S]*?)\s*```/);

    if (actionMatch && actionMatch[1]) {
      try {
        const parsedActions = JSON.parse(actionMatch[1]);
        actionResults = executePiskuActions(parsedActions);
        // Hapus blok json dari teks yang ditampilkan ke pengguna
        cleanText = rawAiText.replace(/```(?:json:actions|actions)[\s\S]*?```/g, '').trim();
      } catch (parseErr) {
        console.warn('Gagal parsing JSON actions dari AI:', parseErr);
      }
    }

    const actionCardHTML = generateActionCardHTML(actionResults);

    removeTypingIndicator();
    appendMessage('assistant', cleanText, null, actionCardHTML);

    chatHistory.push({ role: 'user', parts: userParts.filter(p => p.text) });
    chatHistory.push({ role: 'model', parts: [{ text: cleanText }] });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  } catch (err) {
    removeTypingIndicator();
    let errMsg = 'Gagal menghubungi Pisku. ';
    if (err.message.includes('API_KEY_INVALID') || err.message.includes('400')) {
      errMsg += 'API Key tidak valid. Periksa kembali API Key di Profil.';
    } else if (err.message.includes('QUOTA')) {
      errMsg += 'Kuota API habis sementara. Coba lagi beberapa saat lagi.';
    } else {
      errMsg += err.message;
    }
    appendMessage('assistant', '❌ ' + errMsg);
  }

  isAiTyping = false;
}

// ---- Render Message Elements ----
function appendMessage(role, text, fileObj = null, actionCardHTML = '') {
  renderMessageElement(role, text, fileObj, actionCardHTML, true);
}

function renderMessageElement(role, text, fileObj = null, actionCardHTML = '', saveToStorage = true) {
  const container = document.getElementById('aiMessages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;

  let fileAttachmentHTML = '';
  if (fileObj) {
    if (fileObj.isImage && fileObj.dataUrl) {
      fileAttachmentHTML = `
        <div class="msg-file-attachment">
          <img src="${fileObj.dataUrl}" alt="${fileObj.name}" class="msg-file-img" />
        </div>`;
    } else {
      fileAttachmentHTML = `
        <div class="msg-file-attachment">
          <span class="msg-file-chip">
            <i data-lucide="file-text"></i> ${fileObj.name} (${fileObj.size || ''})
          </span>
        </div>`;
    }
  }

  const formatted = text ? formatAIText(text) : '';

  div.innerHTML = `
    ${role === 'assistant' ? `<div class="msg-avatar"><i data-lucide="sparkles"></i></div>` : ''}
    <div class="msg-bubble">
      ${fileAttachmentHTML}
      ${formatted}
      ${actionCardHTML || ''}
    </div>
    ${role === 'user' ? `<div class="msg-avatar" style="background:linear-gradient(135deg,#1a2a6c,#2563eb)"><i data-lucide="user"></i></div>` : ''}
  `;

  container.appendChild(div);
  lucide.createIcons({ nodes: [div] });
  container.scrollTop = container.scrollHeight;

  if (saveToStorage) {
    savePiskuMessageToStorage({
      role,
      text,
      file: fileObj ? { name: fileObj.name, size: fileObj.size, isImage: fileObj.isImage, dataUrl: fileObj.isImage ? fileObj.dataUrl : null } : null,
      actionCardHTML,
      time: Date.now()
    });
  }
}

function formatAIText(text) {
  if (!text) return '';
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
  if (!container) return;
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

// Masukkan template teks ke textarea agar bisa diedit manual dan dikirim secara manual
function sendSuggestion(text) {
  const input = document.getElementById('aiInput');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  input.focus();
  const len = input.value.length;
  input.setSelectionRange(len, len);
  input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function sendAIMessage() {
  const input = document.getElementById('aiInput');
  if (!input) return;
  const text = input.value.trim();
  if ((!text && !attachedFile) || isAiTyping) return;
  input.value = '';
  input.style.height = 'auto';
  sendMessageToAI(text);
}

// ---- Inisialisasi DOM ----
document.addEventListener('DOMContentLoaded', () => {
  // Pulihkan atau reset otomatis 24 jam
  checkAndRestorePiskuChat();

  // Inisialisasi tombol file attachment
  initFileAttachment();

  // Tombol manual reset percakapan
  const resetBtn = document.getElementById('aiResetChatBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset obrolan dengan Pisku ke tampilan awal?')) {
        resetPiskuChat(true);
      }
    });
  }

  // Simpan API Key dari form setup
  const saveKeyBtn = document.getElementById('saveApiKeyBtn');
  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
      const keyInput = document.getElementById('geminiApiKeyInput');
      const key = keyInput ? keyInput.value.trim() : '';
      if (!key) { showToast('Masukkan API Key terlebih dahulu!', 'error'); return; }
      const profil = Store.getProfil();
      profil.apiKey = key;
      Store.setProfil(profil);
      const profKey = document.getElementById('profileApiKey');
      if (profKey) profKey.value = key;
      checkApiKeyStatus();
      showToast('✅ API Key Pisku berhasil disimpan!', 'success');
    });
  }

  // Tombol Kirim
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendAIMessage);

  // Enter untuk kirim (Shift+Enter untuk baris baru)
  const aiInput = document.getElementById('aiInput');
  if (aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage();
      }
    });

    aiInput.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    });
  }
});
