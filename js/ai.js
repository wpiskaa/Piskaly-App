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

// ---- Pembersihan Pesan Halusinasi & Restore Chat (24 Jam) ----
function sanitizePiskuMessages() {
  try {
    const list = (Store.getAiMessages ? Store.getAiMessages() : JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]')) || [];
    const cleaned = list.filter(m => {
      if (m.text) {
        const lower = m.text.toLowerCase();
        if (lower.includes('ke clinic') || lower.includes('5 agenda') || lower.includes('3 agenda') || lower.includes('duplikasi sesi') || lower.includes('16:00') || lower.includes('recovery')) {
          return false;
        }
      }
      return true;
    });
    if (cleaned.length !== list.length) {
      if (Store.setAiMessages) Store.setAiMessages(cleaned);
      else localStorage.setItem('mylife_pisku_messages', JSON.stringify(cleaned));
    }
  } catch (e) {
    console.warn('Gagal membersihkan pesan halusinasi:', e);
  }
}

function checkAndRestorePiskuChat() {
  sanitizePiskuMessages();
  const lastTime = parseInt((Store.getAiLastTime && Store.getAiLastTime()) || '0', 10);
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
  if (Store.setAiMessages) {
    Store.setAiMessages([]);
    Store.setAiLastTime(Date.now());
  } else {
    localStorage.removeItem('mylife_pisku_messages');
    localStorage.setItem('mylife_pisku_last_time', Date.now().toString());
  }
  chatHistory = [];

  const container = document.getElementById('aiMessages');
  if (container) {
    container.innerHTML = `
      <div class="ai-msg assistant">
        <div class="msg-avatar"><img src="icons/icon-piska.jpg?v=3.16" alt="Pisku" class="pisku-msg-img" /></div>
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
    const list = (Store.getAiMessages ? Store.getAiMessages() : JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]')) || [];
    list.push(msgObj);
    const trimmed = list.slice(-30);
    if (Store.setAiMessages) {
      Store.setAiMessages(trimmed);
      Store.setAiLastTime(Date.now());
    } else {
      localStorage.setItem('mylife_pisku_messages', JSON.stringify(trimmed));
      localStorage.setItem('mylife_pisku_last_time', Date.now().toString());
    }
  } catch (e) {
    console.warn('Gagal menyimpan riwayat chat Pisku:', e);
  }
}

function loadSavedPiskuMessages() {
  const container = document.getElementById('aiMessages');
  if (!container) return;

  try {
    const list = (Store.getAiMessages ? Store.getAiMessages() : JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]')) || [];
    if (!list.length) {
      resetPiskuChat(false);
      return;
    }

    container.innerHTML = '';
    const storedPendingMap = getPendingPiskuActionsFromStore();

    list.forEach(item => {
      let cardHTML = item.actionCardHTML || '';
      if (item.pendingId && item.pendingActions) {
        const actionInfo = storedPendingMap[item.pendingId] || { status: item.actionStatus || 'pending' };
        if (actionInfo.status === 'pending') {
          window.pendingPiskuActions[item.pendingId] = item.pendingActions;
        }
        cardHTML = generateActionCardHTML(item.pendingId, item.pendingActions, actionInfo.status);
      }

      renderMessageElement(item.role, item.text, item.file, cardHTML, false, item.pendingId, item.pendingActions, item.actionStatus || 'pending');
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

// ---- Manajemen Tindakan & Validasi Pengguna (Human-in-the-Loop Validation) ----
window.pendingPiskuActions = window.pendingPiskuActions || {};

function getPendingPiskuActionsFromStore() {
  return Store.get('mylife_pisku_pending_map', {}) || {};
}

function savePendingPiskuActionToStore(pendingId, actions, status = 'pending') {
  try {
    const map = getPendingPiskuActionsFromStore();
    map[pendingId] = { actions, status, updatedAt: Date.now() };
    Store.set('mylife_pisku_pending_map', map);
  } catch (e) {
    console.warn('Gagal menyimpan pending action Pisku:', e);
  }
}

function updateSavedMessageActionStatus(pendingId, newStatus, actions) {
  try {
    const list = (Store.getAiMessages ? Store.getAiMessages() : JSON.parse(localStorage.getItem('mylife_pisku_messages') || '[]')) || [];
    const updated = list.map(item => {
      if (item.pendingId === pendingId) {
        return {
          ...item,
          actionStatus: newStatus,
          actionCardHTML: generateActionCardHTML(pendingId, actions || item.pendingActions || [], newStatus)
        };
      }
      return item;
    });
    if (Store.setAiMessages) {
      Store.setAiMessages(updated);
    } else {
      localStorage.setItem('mylife_pisku_messages', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Gagal update status pesan aksi Pisku:', e);
  }
}

// Format ringkasan data sebelum dikonfirmasi pengguna
function formatActionPreviewList(actions) {
  if (!Array.isArray(actions)) return [];
  const previews = [];
  const nowStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];

  actions.forEach(act => {
    const d = act.data || {};
    try {
      if (act.action === 'add_jadwal') {
        const matkul = (d.matkul || '').trim();
        if (!matkul) return;
        const hari = d.hari || 'Senin';
        const jam = `${d.jamMulai || '08:00'} - ${d.jamSelesai || '10:00'}`;
        const ruang = d.ruangan || d.ruang || '-';
        const dosen = d.dosen ? ` • Dosen: ${d.dosen}` : '';
        previews.push({
          icon: '📅',
          title: `Jadwal Kuliah: ${matkul}`,
          desc: `${hari}, ${jam} (Ruang ${ruang})${dosen} • ${d.sks || 2} SKS`
        });
      } else if (act.action === 'add_transaksi') {
        const jumlah = parseFloat(d.jumlah) || 0;
        if (!jumlah || jumlah <= 0) return;
        const type = d.type === 'income' ? 'income' : 'expense';
        const tgl = d.tanggal || nowStr;
        previews.push({
          icon: type === 'income' ? '💰' : '💸',
          title: `${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(jumlah) : 'Rp ' + jumlah.toLocaleString('id-ID')}`,
          desc: `${d.keterangan || (type === 'income' ? 'Pemasukan' : 'Pengeluaran')} • Kategori: ${d.kategori || 'Lainnya'} • Tanggal: ${tgl}`
        });
      } else if (act.action === 'add_tugas') {
        const nama = (d.nama || '').trim();
        if (!nama) return;
        previews.push({
          icon: '📝',
          title: `Tugas Kuliah: ${nama}`,
          desc: `Mata Kuliah: ${d.matkul || 'Umum'} ${d.deadline ? '• Deadline: ' + d.deadline : ''}`
        });
      } else if (act.action === 'add_event') {
        const nama = (d.nama || d.title || '').trim();
        if (!nama) return;
        const tgl = d.tanggal || d.date || nowStr;
        const jam = d.jamMulai || d.time || '09:00';
        previews.push({
          icon: '📆',
          title: `Agenda Kalender: ${nama}`,
          desc: `Tanggal: ${tgl} • Pukul: ${jam} ${d.lokasi ? '• ' + d.lokasi : ''}`
        });
      } else if (act.action === 'add_catatan') {
        const judul = (d.judul || '').trim();
        if (!judul) return;
        previews.push({
          icon: '📌',
          title: `Catatan Baru: ${judul}`,
          desc: `Kategori: ${d.kategori || 'Kuliah'} ${d.isi ? '• ' + (d.isi.length > 50 ? d.isi.slice(0, 50) + '...' : d.isi) : ''}`
        });
      } else if (act.action === 'add_goal') {
        const nama = (d.nama || '').trim();
        const target = parseFloat(d.target) || 0;
        if (!nama || !target || target <= 0) return;
        previews.push({
          icon: '🎯',
          title: `Target Tabungan: ${nama}`,
          desc: `Target Dana: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(target) : 'Rp ' + target.toLocaleString('id-ID')} ${d.deadline ? '• Deadline: ' + d.deadline : ''}`
        });
      } else if (act.action === 'add_debt') {
        const nama = (d.nama || '').trim();
        const jumlah = parseFloat(d.jumlah) || 0;
        if (!nama || !jumlah || jumlah <= 0) return;
        const tipe = d.tipe === 'piutang' ? 'piutang' : 'hutang';
        previews.push({
          icon: '🤝',
          title: `${tipe === 'hutang' ? 'Hutang ke' : 'Piutang dari'}: ${nama}`,
          desc: `Nominal: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(jumlah) : 'Rp ' + jumlah.toLocaleString('id-ID')} ${d.catatan ? '• ' + d.catatan : ''}`
        });
      } else if (act.action === 'edit_jadwal') {
        const target = d.targetMatkul || d.matkul || 'Jadwal Kuliah';
        const hari = d.hari ? `${d.hari}, ` : '';
        const jam = (d.jamMulai || d.jamSelesai) ? `${d.jamMulai || ''} - ${d.jamSelesai || ''}` : '';
        const ruang = d.ruangan || d.ruang ? ` (Ruang ${d.ruangan || d.ruang})` : '';
        previews.push({
          icon: '✏️',
          title: `Ubah Jadwal: ${target}${d.matkul && d.matkul !== target ? ' ➔ ' + d.matkul : ''}`,
          desc: `Pembaruan: ${hari}${jam}${ruang}${d.dosen ? ' • Dosen: ' + d.dosen : ''}`
        });
      } else if (act.action === 'delete_jadwal') {
        const target = d.targetMatkul || d.matkul || 'Jadwal Kuliah';
        previews.push({
          icon: '🗑️',
          title: `Hapus Jadwal: ${target}`,
          desc: d.targetHari || d.hari ? `Hari: ${d.targetHari || d.hari}` : 'Menghapus jadwal kuliah ini dari sistem'
        });
      } else if (act.action === 'edit_event') {
        const target = d.targetNama || d.nama || 'Agenda';
        const tgl = d.tanggal || '';
        const jam = d.jamMulai ? `pukul ${d.jamMulai}${d.jamSelesai ? ' - ' + d.jamSelesai : ''}` : '';
        previews.push({
          icon: '✏️',
          title: `Ubah Agenda: ${target}${d.nama && d.nama !== target ? ' ➔ ' + d.nama : ''}`,
          desc: `Pembaruan: ${tgl} ${jam} ${d.lokasi ? '📍 ' + d.lokasi : ''}`
        });
      } else if (act.action === 'delete_event') {
        const target = d.targetNama || d.nama || 'Agenda';
        previews.push({
          icon: '🗑️',
          title: `Hapus Agenda: ${target}`,
          desc: d.targetTanggal || d.tanggal ? `Tanggal: ${d.targetTanggal || d.tanggal}` : 'Menghapus agenda kegiatan ini dari kalender'
        });
      } else if (act.action === 'edit_tugas') {
        const target = d.targetNama || d.nama || 'Tugas';
        previews.push({
          icon: '✏️',
          title: `Ubah Tugas: ${target}`,
          desc: `Pembaruan: ${d.deadline ? 'Deadline: ' + d.deadline : ''} ${d.done !== undefined ? (d.done ? '• Selesai' : '• Belum Selesai') : ''}`
        });
      } else if (act.action === 'delete_tugas') {
        const target = d.targetNama || d.nama || 'Tugas';
        previews.push({
          icon: '🗑️',
          title: `Hapus Tugas: ${target}`,
          desc: 'Menghapus tugas ini dari daftar tugas'
        });
      } else if (act.action === 'edit_catatan') {
        const target = d.targetJudul || d.judul || 'Catatan';
        previews.push({
          icon: '✏️',
          title: `Ubah Catatan: ${target}`,
          desc: d.judul && d.judul !== target ? `Judul baru: ${d.judul}` : 'Memperbarui isi catatan'
        });
      } else if (act.action === 'delete_catatan') {
        const target = d.targetJudul || d.judul || 'Catatan';
        previews.push({
          icon: '🗑️',
          title: `Hapus Catatan: ${target}`,
          desc: 'Menghapus catatan ini dari daftar catatan'
        });
      }
    } catch (e) {
      console.warn('Gagal memformat preview aksi:', act, e);
    }
  });

  return previews;
}

// Format Kartu Validasi & Konfirmasi
function generateActionCardHTML(pendingId, actions, status = 'pending') {
  const previews = formatActionPreviewList(actions);
  if (!previews.length) return '';

  let badgeHTML = '';
  let footerHTML = '';

  if (status === 'confirmed') {
    badgeHTML = `<span class="ai-action-badge success"><i data-lucide="check"></i> Data Tersimpan</span>`;
    footerHTML = `
      <div class="ai-action-status-confirmed">
        <i data-lucide="check-check"></i> Data telah divalidasi dan tersimpan di aplikasi
      </div>
    `;
  } else if (status === 'cancelled') {
    badgeHTML = `<span class="ai-action-badge cancelled"><i data-lucide="x"></i> Dibatalkan</span>`;
    footerHTML = `
      <div class="ai-action-status-cancelled">
        <i data-lucide="ban"></i> Input data telah dibatalkan oleh pengguna
      </div>
    `;
  } else {
    badgeHTML = `<span class="ai-action-badge pending"><i data-lucide="alert-circle"></i> Butuh Validasi</span>`;
    footerHTML = `
      <div class="ai-action-btns" id="btns_${pendingId}">
        <button type="button" class="ai-btn-confirm" onclick="confirmPiskuAction('${pendingId}')">
          <i data-lucide="check-circle-2"></i> Konfirmasi &amp; Masukkan Data
        </button>
        <button type="button" class="ai-btn-cancel" onclick="cancelPiskuAction('${pendingId}')">
          <i data-lucide="x-circle"></i> Batalkan
        </button>
      </div>
    `;
  }

  return `
    <div class="ai-action-card" id="card_${pendingId}">
      <div class="ai-action-head">
        <div class="ai-action-title-wrap">
          <span class="ai-action-spark">⚡</span>
          <b>Rencana Input Pisku</b>
        </div>
        ${badgeHTML}
      </div>
      <p class="ai-action-note">${status === 'pending' ? 'Periksa kembali data di bawah sebelum dimasukkan ke aplikasi:' : 'Data hasil pemrosesan Pisku:'}</p>
      <ul class="ai-action-list">
        ${previews.map(r => `
          <li class="ai-action-item">
            <span class="ai-action-icon">${r.icon}</span>
            <div class="ai-action-text">
              <b>${r.title}</b>
              ${r.desc ? `<small>${r.desc}</small>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
      <div id="footer_${pendingId}">
        ${footerHTML}
      </div>
    </div>
  `;
}

// Handler Konfirmasi oleh Pengguna
window.confirmPiskuAction = function(pendingId) {
  let actions = window.pendingPiskuActions[pendingId];
  if (!actions) {
    const stored = getPendingPiskuActionsFromStore();
    if (stored && stored[pendingId] && stored[pendingId].actions) {
      actions = stored[pendingId].actions;
    }
  }

  if (!actions || !actions.length) {
    showToast('Data aksi tidak ditemukan atau sudah selesai diproses.', 'info');
    return;
  }

  const results = executePiskuActions(actions);
  savePendingPiskuActionToStore(pendingId, actions, 'confirmed');

  // Update Tampilan Kartu secara langsung
  const card = document.getElementById('card_' + pendingId);
  if (card) {
    const badge = card.querySelector('.ai-action-badge');
    if (badge) {
      badge.className = 'ai-action-badge success';
      badge.innerHTML = '<i data-lucide="check"></i> Data Tersimpan';
    }
    const note = card.querySelector('.ai-action-note');
    if (note) note.textContent = 'Data hasil pemrosesan Pisku:';
    const footer = document.getElementById('footer_' + pendingId);
    if (footer) {
      footer.innerHTML = `
        <div class="ai-action-status-confirmed">
          <i data-lucide="check-check"></i> ${results.length} data telah divalidasi dan tersimpan di aplikasi
        </div>
      `;
    }
    lucide.createIcons({ nodes: [card] });
  }

  updateSavedMessageActionStatus(pendingId, 'confirmed', actions);
  if (typeof playHapticFeedback === 'function') playHapticFeedback('success');
  showToast(`⚡ ${results.length} data berhasil divalidasi & dimasukkan ke aplikasi!`, 'success', 2800);
};

// Handler Pembatalan oleh Pengguna
window.cancelPiskuAction = function(pendingId) {
  const actions = window.pendingPiskuActions[pendingId] || (getPendingPiskuActionsFromStore()?.[pendingId]?.actions);
  savePendingPiskuActionToStore(pendingId, actions || [], 'cancelled');

  const card = document.getElementById('card_' + pendingId);
  if (card) {
    const badge = card.querySelector('.ai-action-badge');
    if (badge) {
      badge.className = 'ai-action-badge cancelled';
      badge.innerHTML = '<i data-lucide="x"></i> Dibatalkan';
    }
    const footer = document.getElementById('footer_' + pendingId);
    if (footer) {
      footer.innerHTML = `
        <div class="ai-action-status-cancelled">
          <i data-lucide="ban"></i> Input data telah dibatalkan oleh pengguna
        </div>
      `;
    }
    lucide.createIcons({ nodes: [card] });
  }

  updateSavedMessageActionStatus(pendingId, 'cancelled', actions);
  showToast('Input data dibatalkan', 'info');
};

// ---- Eksekusi Tindakan ke Database Aplikasi ----
function executePiskuActions(actions) {
  if (!Array.isArray(actions) || !actions.length) return [];

  const results = [];
  const nowStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];

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
          ruangan: d.ruangan || d.ruang || '-',
          jamMulai: d.jamMulai || '08:00',
          jamSelesai: d.jamSelesai || '10:00',
          dosen: d.dosen || '',
          sks: parseInt(d.sks) || 2,
          color: d.color || '#2563eb',
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setJadwal(list);
        results.push({
          icon: '📅',
          title: `Jadwal: ${item.matkul}`,
          desc: `${item.hari}, ${item.jamMulai} - ${item.jamSelesai} (${item.ruangan})`
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
          prioritas: d.prioritas || 'medium',
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
        const nama = (d.nama || d.title || '').trim();
        if (!nama) return;
        const list = Store.getEvents();
        const tanggal = d.tanggal || d.date || nowStr;
        const item = {
          id: typeof uid === 'function' ? uid() : 'ev_' + Date.now() + Math.random().toString(36).substr(2, 4),
          nama: nama,
          tanggal: tanggal,
          jamMulai: d.jamMulai || d.time || '09:00',
          jamSelesai: d.jamSelesai || '',
          lokasi: d.lokasi || '',
          deskripsi: d.deskripsi || d.desc || '',
          color: d.color || '#2563eb',
          createdAt: new Date().toISOString()
        };
        list.push(item);
        Store.setEvents(list);
        results.push({
          icon: '📆',
          title: `Agenda: ${item.nama}`,
          desc: `${item.tanggal} pukul ${item.jamMulai} ${item.lokasi ? '📍 ' + item.lokasi : ''}`
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
          color: d.color || '#2563eb',
          createdAt: new Date().toISOString(),
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

      else if (act.action === 'edit_jadwal') {
        const targetMatkul = (d.targetMatkul || d.matkul || '').trim().toLowerCase();
        const targetHari = (d.targetHari || d.hari || '').trim().toLowerCase();
        const list = Store.getJadwal();
        const idx = list.findIndex(j => {
          if (d.targetId && j.id === d.targetId) return true;
          const matchMatkul = (j.matkul || '').toLowerCase().includes(targetMatkul);
          if (targetHari) return matchMatkul && (j.hari || '').toLowerCase() === targetHari;
          return matchMatkul;
        });
        if (idx !== -1) {
          const old = list[idx];
          if (d.matkul) old.matkul = d.matkul.trim();
          if (d.hari) old.hari = d.hari.trim();
          if (d.ruangan || d.ruang) old.ruangan = (d.ruangan || d.ruang).trim();
          if (d.jamMulai) old.jamMulai = d.jamMulai.trim();
          if (d.jamSelesai) old.jamSelesai = d.jamSelesai.trim();
          if (d.dosen !== undefined) old.dosen = d.dosen.trim();
          if (d.sks) old.sks = parseInt(d.sks) || old.sks;
          old.updatedAt = new Date().toISOString();
          Store.setJadwal(list);
          results.push({
            icon: '✏️',
            title: `Jadwal Diperbarui: ${old.matkul}`,
            desc: `${old.hari}, ${old.jamMulai} - ${old.jamSelesai} (${old.ruangan || '-'})`
          });
        }
      }

      else if (act.action === 'delete_jadwal') {
        const targetMatkul = (d.targetMatkul || d.matkul || '').trim().toLowerCase();
        const targetHari = (d.targetHari || d.hari || '').trim().toLowerCase();
        let list = Store.getJadwal();
        const initialLen = list.length;
        list = list.filter(j => {
          if (d.targetId && j.id === d.targetId) return false;
          const matchMatkul = (j.matkul || '').toLowerCase().includes(targetMatkul);
          if (targetHari) return !(matchMatkul && (j.hari || '').toLowerCase() === targetHari);
          return !matchMatkul;
        });
        if (list.length !== initialLen) {
          Store.setJadwal(list);
          results.push({
            icon: '🗑️',
            title: `Jadwal Dihapus: ${d.targetMatkul || d.matkul}`,
            desc: 'Berhasil dihapus dari jadwal kuliah'
          });
        }
      }

      else if (act.action === 'edit_event') {
        const targetNama = (d.targetNama || d.nama || '').trim().toLowerCase();
        const targetTanggal = (d.targetTanggal || d.tanggal || '').trim();
        const list = Store.getEvents();
        const idx = list.findIndex(e => {
          if (d.targetId && e.id === d.targetId) return true;
          const matchNama = (e.nama || e.title || '').toLowerCase().includes(targetNama);
          if (targetTanggal) return matchNama && (e.tanggal || e.date) === targetTanggal;
          return matchNama;
        });
        if (idx !== -1) {
          const old = list[idx];
          if (d.nama) old.nama = d.nama.trim();
          if (d.tanggal) old.tanggal = d.tanggal.trim();
          if (d.jamMulai) old.jamMulai = d.jamMulai.trim();
          if (d.jamSelesai !== undefined) old.jamSelesai = d.jamSelesai.trim();
          if (d.lokasi !== undefined) old.lokasi = d.lokasi.trim();
          if (d.deskripsi !== undefined) old.deskripsi = d.deskripsi.trim();
          if (d.color) old.color = d.color;
          old.updatedAt = new Date().toISOString();
          Store.setEvents(list);
          results.push({
            icon: '✏️',
            title: `Agenda Diperbarui: ${old.nama}`,
            desc: `${old.tanggal} • ${old.jamMulai} ${old.lokasi ? '📍 ' + old.lokasi : ''}`
          });
        }
      }

      else if (act.action === 'delete_event') {
        const targetNama = (d.targetNama || d.nama || '').trim().toLowerCase();
        const targetTanggal = (d.targetTanggal || d.tanggal || '').trim();
        let list = Store.getEvents();
        const initialLen = list.length;
        list = list.filter(e => {
          if (d.targetId && e.id === d.targetId) return false;
          const matchNama = (e.nama || e.title || '').toLowerCase().includes(targetNama);
          if (targetTanggal) return !(matchNama && (e.tanggal || e.date) === targetTanggal);
          return !matchNama;
        });
        if (list.length !== initialLen) {
          Store.setEvents(list);
          results.push({
            icon: '🗑️',
            title: `Agenda Dihapus: ${d.targetNama || d.nama}`,
            desc: 'Berhasil dihapus dari kalender'
          });
        }
      }

      else if (act.action === 'edit_tugas') {
        const targetNama = (d.targetNama || d.nama || '').trim().toLowerCase();
        const list = Store.getTugas();
        const idx = list.findIndex(t => (d.targetId && t.id === d.targetId) || (t.nama || '').toLowerCase().includes(targetNama));
        if (idx !== -1) {
          const old = list[idx];
          if (d.nama) old.nama = d.nama.trim();
          if (d.matkul) old.matkul = d.matkul.trim();
          if (d.deadline !== undefined) old.deadline = d.deadline.trim();
          if (d.deskripsi !== undefined) old.deskripsi = d.deskripsi.trim();
          if (d.prioritas) old.prioritas = d.prioritas;
          if (d.done !== undefined) old.done = Boolean(d.done);
          Store.setTugas(list);
          results.push({
            icon: '✏️',
            title: `Tugas Diperbarui: ${old.nama}`,
            desc: `${old.matkul} • Deadline: ${old.deadline || '-'}`
          });
        }
      }

      else if (act.action === 'delete_tugas') {
        const targetNama = (d.targetNama || d.nama || '').trim().toLowerCase();
        let list = Store.getTugas();
        const initialLen = list.length;
        list = list.filter(t => (d.targetId && t.id !== d.targetId) || !(t.nama || '').toLowerCase().includes(targetNama));
        if (list.length !== initialLen) {
          Store.setTugas(list);
          results.push({
            icon: '🗑️',
            title: `Tugas Dihapus: ${d.targetNama || d.nama}`,
            desc: 'Berhasil dihapus dari daftar tugas'
          });
        }
      }

      else if (act.action === 'edit_catatan') {
        const targetJudul = (d.targetJudul || d.judul || '').trim().toLowerCase();
        const list = Store.getCatatan();
        const idx = list.findIndex(c => (d.targetId && c.id === d.targetId) || (c.judul || '').toLowerCase().includes(targetJudul));
        if (idx !== -1) {
          const old = list[idx];
          if (d.judul) old.judul = d.judul.trim();
          if (d.isi !== undefined) old.isi = d.isi;
          if (d.kategori) old.kategori = d.kategori;
          old.updatedAt = new Date().toISOString();
          Store.setCatatan(list);
          results.push({
            icon: '✏️',
            title: `Catatan Diperbarui: ${old.judul}`,
            desc: `Kategori: ${old.kategori}`
          });
        }
      }

      else if (act.action === 'delete_catatan') {
        const targetJudul = (d.targetJudul || d.judul || '').trim().toLowerCase();
        let list = Store.getCatatan();
        const initialLen = list.length;
        list = list.filter(c => (d.targetId && c.id !== d.targetId) || !(c.judul || '').toLowerCase().includes(targetJudul));
        if (list.length !== initialLen) {
          Store.setCatatan(list);
          results.push({
            icon: '🗑️',
            title: `Catatan Dihapus: ${d.targetJudul || d.judul}`,
            desc: 'Berhasil dihapus dari catatan'
          });
        }
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
  }

  return results;
}

// ---- Komunikasi Utama Pisku (Gemini Flash Multimodal Cepat & Akurat) ----
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

  // Ambil konteks lengkap data pengguna saat ini dari database
  const profil = Store.getProfil() || {};
  const jadwal = Store.getJadwal() || [];
  const tugas = (Store.getTugas() || []).filter(t => !t.done);
  const transaksi = Store.getTransaksi() || [];
  const events = Store.getEvents() || [];
  const catatan = Store.getCatatan() || [];
  const now = new Date();
  const nowIso = typeof getLocalDateString === 'function' ? getLocalDateString(now) : now.toISOString().split('T')[0];

  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayDayName = dayNames[now.getDay()];

  // Filter jadwal kuliah hari ini secara presisi
  const todayJadwal = jadwal.filter(j => j.hari === todayDayName)
    .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));
  const todayJadwalText = todayJadwal.length > 0
    ? todayJadwal.map(j => `  • ${j.matkul} (Pukul: ${j.jamMulai} - ${j.jamSelesai}, Ruang: ${j.ruangan || j.ruang || '-'}, Dosen: ${j.dosen || '-'}, ${j.sks || 2} SKS)`).join('\n')
    : '  (Tidak ada jadwal kuliah hari ini / Libur)';

  // Rangkuman seluruh jadwal kuliah per hari
  const allJadwalText = jadwal.length > 0
    ? jadwal.map(j => `  • [${j.hari}] ${j.matkul} (${j.jamMulai} - ${j.jamSelesai}, Ruang ${j.ruangan || j.ruang || '-'})`).join('\n')
    : '  (Belum ada jadwal kuliah yang tersimpan)';

  // Kegiatan kalender hari ini secara presisi
  const todayEvents = events.filter(e => (e.tanggal || e.date) === nowIso)
    .sort((a, b) => (a.jamMulai || a.time || '').localeCompare(b.jamMulai || b.time || ''));
  const todayEventsText = todayEvents.length > 0
    ? todayEvents.map(e => `  • ${e.nama || e.title} (Pukul: ${e.jamMulai || e.time || '-'} ${e.jamSelesai ? 's/d ' + e.jamSelesai : ''}, Lokasi: ${e.lokasi || '-'}) ${e.deskripsi || e.desc ? `[Ket: ${e.deskripsi || e.desc}]` : ''}`).join('\n')
    : '  (Tidak ada kegiatan kalender yang terdaftar untuk hari ini)';

  // Agenda kalender mendatang
  const upcomingEvents = events.filter(e => (e.tanggal || e.date) > nowIso)
    .sort((a, b) => (a.tanggal || a.date || '').localeCompare(b.tanggal || b.date || ''))
    .slice(0, 8);
  const upcomingEventsText = upcomingEvents.length > 0
    ? upcomingEvents.map(e => `  • ${e.tanggal || e.date}: ${e.nama || e.title} (Pukul: ${e.jamMulai || e.time || '-'}, Lokasi: ${e.lokasi || '-'})`).join('\n')
    : '  (Tidak ada kegiatan mendatang)';

  // Catatan pengguna
  const catatanText = catatan.length > 0
    ? catatan.slice(0, 8).map(c => `  • "${c.judul || 'Tanpa Judul'}" [${c.kategori || 'Umum'}]: ${(c.isi || '').slice(0, 150)}`).join('\n')
    : '  (Belum ada catatan yang tersimpan)';

  // Tugas aktif
  const tugasText = tugas.length > 0
    ? tugas.slice(0, 8).map(t => `  • ${t.nama} [Matkul: ${t.matkul || 'Umum'}, Deadline: ${t.deadline || 'Tanpa deadline'}]`).join('\n')
    : '  (Semua tugas kuliah telah selesai)';

  // Keuangan bulan ini
  const thisMonthTrans = transaksi.filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = thisMonthTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0);
  const expense = thisMonthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0);
  const saldo = income - expense;

  const systemPrompt = `Kamu adalah Pisku, asisten AI pribadi pintar dan akurat untuk ${profil.name || 'Piska'} di aplikasi Piskaly.
Pengguna adalah mahasiswa ${profil.jurusan ? 'jurusan ' + profil.jurusan : ''} ${profil.univ ? 'di ' + profil.univ : ''} semester ${profil.semester || '?'}.

WAKTU & TANGGAL REALTIME:
- Hari Ini: ${now.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
- Kode Tanggal: ${nowIso}
- Jam Sekarang: ${now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB

==================================================
DATA RESMI & AKTUAL APLIKASI SAAT INI (SATU-SATUNYA SUMBER KEBENARAN):
==================================================
1. JADWAL KULIAH HARI INI (${todayDayName.toUpperCase()}):
${todayJadwalText}

2. KEGIATAN / AGENDA KALENDER HARI INI (${nowIso}):
${todayEventsText}

3. JADWAL KULIAH MINGGUAN LENGKAP:
${allJadwalText}

4. AGENDA KALENDER MENDATANG:
${upcomingEventsText}

5. TUGAS KULIAH BELUM SELESAI:
${tugasText}

6. CATATAN PENGGUNA TERBARU:
${catatanText}

7. KEUANGAN BULAN INI:
  • Pemasukan: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(income) : 'Rp ' + income.toLocaleString('id-ID')}
  • Pengeluaran: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(expense) : 'Rp ' + expense.toLocaleString('id-ID')}
  • Saldo Tersedia: ${typeof formatRupiahFull === 'function' ? formatRupiahFull(saldo) : 'Rp ' + saldo.toLocaleString('id-ID')}

==================================================
PEDOMAN INTEGRITAS DATA & ANTI-HALUSINASI (WAJIB DIPATUHI 100%):
==================================================
1. SINKRONISASI DATA HARUS 100% SESUAI DATABASE:
   - Agenda kegiatan hari ini (${nowIso}) di database aplikasi HANYA ADA TEPAT ${todayEvents.length} AGENDA:
${todayEventsText}
   - Kamu WAJIB secara tegas dan jujur menyatakan bahwa hari ini HANYA TERCATAT ${todayEvents.length} AGENDA di sistem kalender Piskaly.
   - Sebutkan HANYA agenda resmi di atas (nama, jam, dan lokasi yang sama persis). DILARANG KERAS mengarang agenda fiktif, menduplikasi sesi, memecah satu agenda menjadi beberapa bagian, atau menyebut kegiatan lain!
   - PENTING: Jika pengguna mengutip teks lama tentang 5 agenda atau 'Ke Clinic' atau '16:00' dan mengeluhkan data tidak sinkron/ngawur, PAHAMI bahwa data duplikat/hantu tersebut telah resmi DIBERSIHKAN dari database. Minta maaf atas kekeliruan sebelumnya dan tegaskan bahwa data sah yang aktif sekarang HANYA ADA ${todayEvents.length} AGENDA (Sport Massage 13:30 - 14:30 di Nom Clinic Yogyakarta). JANGAN SEKALI-KALI mengulang daftar 5 agenda fiktif tersebut!
2. DILARANG KERAS MENGARANG ATAU MENAMBAHKAN JADWAL/AGENDA/ACARA FIKTIF:
   - Rujuk HANYA data nomor 1 (Jadwal Kuliah Hari Ini) dan nomor 2 (Kegiatan Kalender Hari Ini).
   - Sebutkan HANYA yang ada di daftar tersebut dengan jam dan nama yang persis sama.
3. JANGAN PERNAH MENGAKU "SUDAH MEMASUKKAN DATA KE SISTEM" TANPA VALIDASI PENGGUNA:
   - Aplikasi menggunakan sistem validasi tombol konfirmasi pengguna.
   - Bila pengguna meminta kamu mencatat atau merangkum sesuatu, buat blok aksi JSON: actions, lalu jelaskan bahwa rencana tersebut sudah kamu siapkan dan minta pengguna menekan tombol konfirmasi di bawah.
4. FORMAT AKSI JSON (Untuk Menambah, Mengedit/Mengubah, atau Menghapus Data):
\`\`\`json:actions
[
  // 1. Menambah data baru:
  { "action": "add_jadwal", "data": { "hari": "Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu", "matkul": "Nama Matkul", "ruangan": "Ruang/Lab", "jamMulai": "08:00", "jamSelesai": "10:00", "dosen": "Nama Dosen", "sks": 3 } },
  { "action": "add_event", "data": { "nama": "Nama Kegiatan", "tanggal": "YYYY-MM-DD", "jamMulai": "09:00", "jamSelesai": "10:00", "lokasi": "Lokasi", "deskripsi": "Deskripsi" } },
  { "action": "add_tugas", "data": { "nama": "Nama Tugas", "matkul": "Mata Kuliah", "deadline": "YYYY-MM-DD", "deskripsi": "Deskripsi" } },
  { "action": "add_transaksi", "data": { "type": "expense|income", "jumlah": 25000, "kategori": "Makan|Transport|Belanja|Hiburan|Pendidikan|Kesehatan|Uang Saku|Kerja|Lainnya", "keterangan": "Keterangan", "tanggal": "YYYY-MM-DD" } },
  { "action": "add_catatan", "data": { "judul": "Judul Catatan", "isi": "Isi lengkap", "kategori": "Kuliah|Pribadi|Ide|Penting" } },
  { "action": "add_goal", "data": { "nama": "Target Tabungan", "target": 5000000, "deadline": "YYYY-MM-DD" } },
  { "action": "add_debt", "data": { "tipe": "hutang|piutang", "nama": "Nama Orang", "jumlah": 50000, "jatuhTempo": "YYYY-MM-DD", "catatan": "Keterangan" } },

  // 2. Mengedit/Mengubah data yang sudah ada (WAJIB gunakan ini jika pengguna ingin mengubah/mengedit, JANGAN gunakan add_* karena akan membuat data duplikat!):
  { "action": "edit_jadwal", "data": { "targetMatkul": "Nama Matkul Lama", "targetHari": "Hari Lama (opsional)", "matkul": "Nama Baru (opsional)", "hari": "Hari Baru", "jamMulai": "08:00", "jamSelesai": "10:00", "ruangan": "Ruang Baru", "dosen": "Nama Dosen", "sks": 3 } },
  { "action": "edit_event", "data": { "targetNama": "Nama Agenda Lama", "targetTanggal": "YYYY-MM-DD (opsional)", "nama": "Nama Baru (opsional)", "tanggal": "YYYY-MM-DD", "jamMulai": "14:00", "jamSelesai": "15:00", "lokasi": "Lokasi Baru", "deskripsi": "Keterangan Baru" } },
  { "action": "edit_tugas", "data": { "targetNama": "Nama Tugas Lama", "nama": "Nama Tugas Baru", "deadline": "YYYY-MM-DD", "deskripsi": "...", "done": false } },
  { "action": "edit_catatan", "data": { "targetJudul": "Judul Catatan Lama", "judul": "Judul Baru", "isi": "Isi baru", "kategori": "Kuliah" } },

  // 3. Menghapus data:
  { "action": "delete_jadwal", "data": { "targetMatkul": "Nama Matkul", "targetHari": "Hari (opsional)" } },
  { "action": "delete_event", "data": { "targetNama": "Nama Agenda", "targetTanggal": "YYYY-MM-DD (opsional)" } },
  { "action": "delete_tugas", "data": { "targetNama": "Nama Tugas" } },
  { "action": "delete_catatan", "data": { "targetJudul": "Judul Catatan" } }
]
\`\`\`
5. DILARANG MEMBUAT BLOK JSON:ACTIONS JIKA TIDAK ADA PERMINTAAN TAMBAH/UBAH/HAPUS DATA:
   - Jika pengguna HANYA bertanya (contoh: "ada kegiatan apa hari ini?", "apa jadwalku hari ini?", "tugas apa yang belum selesai?"), CUKUP jawab dengan teks penjelasan ramah berdasarkan DATA RESMI di atas.
   - JANGAN PERNAH menyertakan blok \`\`\`json:actions ... \`\`\` jika pengguna tidak meminta menambahkan/mengubah/menghapus data!
6. KEMAMPUAN MEMINDAI GAMBAR / FOTO KALENDER & DOKUMEN (FITUR MULTIMODAL UNGGULAN):
   - Pisku MEMILIKI KEMAMPUAN LENGKAP untuk membaca, memindai, dan mengekstrak isi gambar/foto kalender (kalender akademik, kalender dinding, screenshot agenda/kalender eksternal, poster acara, jadwal kuliah mingguan, struk belanja, dsb.) SECARA LANGSUNG SEKALIGUS ke dalam sistem Piskaly!
   - DILARANG KERAS menolak atau berkata "Pisku belum memiliki fitur memindai gambar kalender secara langsung".
   - Jika pengguna melampirkan gambar kalender/jadwal/dokumen, Pisku WAJIB langsung memindai setiap tanggal dan agenda penting yang ada di gambar tersebut, lalu menyusunnya sekaligus ke dalam satu blok \`\`\`json:actions ... \`\`\` (misal: serangkaian 'add_event', 'add_jadwal', atau 'add_tugas').
   - Pengguna tinggal menekan 1 tombol konfirmasi di bawah pesanmu untuk memasukkan seluruh agenda dari gambar kalender tersebut ke aplikasi Piskaly secara otomatis!
7. Gaya Bicara: Hangat, sopan, akurat, dan jujur berdasarkan fakta database.`;

  // Render pesan user di layar
  appendMessage('user', userMessage, currentFile);

  isAiTyping = true;
  showTypingIndicator();

  try {
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

    // Bangun riwayat percakapan murni & aman (bersihkan sisa halusinasi asisten lama)
    const contents = [];
    const safeHistory = chatHistory
      .filter(msg => {
        const txt = (msg.parts?.[0]?.text || '').toLowerCase();
        if (txt.includes('16:00') || txt.includes('ke clinic') || txt.includes('5 agenda') || txt.includes('3 agenda') || txt.includes('recovery') || txt.includes('duplikasi')) {
          return false;
        }
        return true;
      })
      .slice(-4);
    safeHistory.forEach(msg => contents.push(msg));
    contents.push({ role: 'user', parts: userParts });

    // Model Gemini resmi tercepat, stabil, dan memiliki kuota aktif
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];

    let lastError = null;
    let data = null;

    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents,
              generationConfig: {
                temperature: 0.2,
                topK: 20,
                topP: 0.85,
                maxOutputTokens: 1024,
              },
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
              ]
            })
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = new Error(errData.error?.message || `API Error ${response.status} on ${model}`);
          console.warn(`Model ${model} return ${response.status}, mencoba fallback...`);
          if (response.status === 404 || response.status === 503 || response.status === 429) {
            continue;
          } else {
            break;
          }
        }
      } catch (netErr) {
        lastError = netErr;
        console.warn(`Jaringan error saat menghubungi ${model}:`, netErr);
      }
    }

    if (!data) {
      throw lastError || new Error('Tidak ada respon dari server Gemini.');
    }
    const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, Pisku tidak dapat memproses pesan itu saat ini.';

    // Deteksi aksi yang disarankan AI (TIDAK langsung input, butuh validasi user)
    let cleanText = rawAiText;
    let proposedActions = null;
    let pendingId = null;
    const actionMatch = rawAiText.match(/```(?:json:actions|actions)\s*([\s\S]*?)\s*```/);

    if (actionMatch && actionMatch[1]) {
      try {
        const parsed = JSON.parse(actionMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          proposedActions = parsed;
          pendingId = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          window.pendingPiskuActions[pendingId] = proposedActions;
          savePendingPiskuActionToStore(pendingId, proposedActions, 'pending');
        }
        cleanText = rawAiText.replace(/```(?:json:actions|actions)[\s\S]*?```/g, '').trim();
      } catch (parseErr) {
        console.warn('Gagal parsing JSON actions dari AI:', parseErr);
      }
    }

    const actionCardHTML = proposedActions ? generateActionCardHTML(pendingId, proposedActions, 'pending') : '';

    removeTypingIndicator();
    appendMessage('assistant', cleanText, null, actionCardHTML, pendingId, proposedActions, 'pending');

    chatHistory.push({ role: 'user', parts: userParts.filter(p => p.text) });
    chatHistory.push({ role: 'model', parts: [{ text: cleanText }] });
    if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);

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
function appendMessage(role, text, fileObj = null, actionCardHTML = '', pendingId = null, pendingActions = null, actionStatus = 'pending') {
  renderMessageElement(role, text, fileObj, actionCardHTML, true, pendingId, pendingActions, actionStatus);
}

function renderMessageElement(role, text, fileObj = null, actionCardHTML = '', saveToStorage = true, pendingId = null, pendingActions = null, actionStatus = 'pending') {
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
    ${role === 'assistant' ? `<div class="msg-avatar"><img src="icons/icon-piska.jpg?v=3.16" alt="Pisku" class="pisku-msg-img" /></div>` : ''}
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
      pendingId,
      pendingActions,
      actionStatus,
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
    <div class="msg-avatar"><img src="icons/icon-piska.jpg?v=3.16" alt="Pisku" class="pisku-msg-img" /></div>
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
