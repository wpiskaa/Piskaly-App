// ==========================================
// LANGGANAN.JS - SUBSCRIPTION TRACKER
// ==========================================

let currentSubFilter = 'all';
let editingSubId = null;
let selectedSubColor = '#1db954';

// When true, the next list render skips the entrance animation (pay / pause updates)
let _subSuppressAnim = false;

const SUB_PRESETS = {
  spotify: {
    nama: 'Spotify Premium',
    biaya: 54990,
    siklus: 'bulanan',
    kategori: 'musik',
    metode: 'GoPay',
    catatan: 'Paket Individual bulanan',
    color: '#1db954',
    icon: 'music'
  },
  netflix: {
    nama: 'Netflix',
    biaya: 65000,
    siklus: 'bulanan',
    kategori: 'streaming',
    metode: 'DANA',
    catatan: 'Paket Mobile streaming',
    color: '#e50914',
    icon: 'film'
  },
  youtube: {
    nama: 'YouTube Premium',
    biaya: 59000,
    siklus: 'bulanan',
    kategori: 'streaming',
    metode: 'GoPay',
    catatan: 'Bebas iklan & background play',
    color: '#ef4444',
    icon: 'play-square'
  },
  icloud: {
    nama: 'iCloud+ / Google One',
    biaya: 29000,
    siklus: 'bulanan',
    kategori: 'cloud',
    metode: 'Apple Pay / App Store',
    catatan: 'Penyimpanan cloud 200 GB',
    color: '#0ea5e9',
    icon: 'cloud'
  },
  chatgpt: {
    nama: 'ChatGPT Plus',
    biaya: 320000,
    siklus: 'bulanan',
    kategori: 'ai',
    metode: 'Kartu Kredit',
    catatan: 'Akses GPT-4o & AI tools',
    color: '#10b981',
    icon: 'bot'
  },
  disney: {
    nama: 'Disney+ Hotstar',
    biaya: 65000,
    siklus: 'bulanan',
    kategori: 'streaming',
    metode: 'GoPay',
    catatan: 'Paket Basic bulanan',
    color: '#2563eb',
    icon: 'tv'
  },
  canva: {
    nama: 'Canva Pro',
    biaya: 95000,
    siklus: 'bulanan',
    kategori: 'produktivitas',
    metode: 'Debit Card / Bank',
    catatan: 'Desain grafis & aset premium',
    color: '#8b5cf6',
    icon: 'palette'
  },
  wifi: {
    nama: 'Wifi / Internet Rumah',
    biaya: 250000,
    siklus: 'bulanan',
    kategori: 'internet',
    metode: 'Debit Card / Bank',
    catatan: 'Langganan internet provider',
    color: '#f59e0b',
    icon: 'wifi'
  }
};

const SUB_CATEGORY_LABELS = {
  musik: '🎵 Musik & Audio',
  streaming: '🎬 Video & Film',
  cloud: '☁️ Cloud Storage',
  ai: '🤖 AI & Software',
  produktivitas: '⚡ Produktivitas',
  internet: '🌐 Internet & ISP',
  gaming: '🎮 Gaming',
  lainnya: '📦 Layanan Lain'
};

function subEsc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function subFormatYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Menghitung biaya bulanan yang dinormalisasi
function getMonthlyEquivalent(biaya, siklus) {
  const b = Number(biaya) || 0;
  if (siklus === 'tahunan') return Math.round(b / 12);
  if (siklus === 'mingguan') return Math.round(b * 4.345);
  return b; // default bulanan
}

function renderSubscriptions() {
  const listEl = document.getElementById('subList');
  const subs = Store.getSubscriptions() || [];

  // Hitung komitmen biaya bulanan dan tahunan
  let totalMonthly = 0;
  let activeCount = 0;
  subs.forEach(s => {
    if (s.status === 'aktif') {
      activeCount++;
      totalMonthly += getMonthlyEquivalent(s.biaya, s.siklus);
    }
  });

  const totalYearly = totalMonthly * 12;

  // Update Hero Summary
  const monthlyTotalEl = document.getElementById('subMonthlyTotal');
  const yearlyTotalEl = document.getElementById('subYearlyTotal');
  const activeCountEl = document.getElementById('subActiveCount');
  if (monthlyTotalEl) monthlyTotalEl.textContent = formatRupiahFull(totalMonthly);
  if (yearlyTotalEl) yearlyTotalEl.textContent = formatRupiahFull(totalYearly);
  if (activeCountEl) activeCountEl.textContent = `${activeCount} Layanan`;

  // Update Quick Widget di Tab Ringkasan
  const quickTotalEl = document.getElementById('subQuickTotal');
  const quickCountEl = document.getElementById('subQuickCount');
  if (quickTotalEl) quickTotalEl.textContent = `${formatRupiahFull(totalMonthly)} / bln`;
  if (quickCountEl) quickCountEl.textContent = `${activeCount} Layanan`;

  // Cari tagihan terdekat
  const todayStr = subFormatYMD(new Date());
  const todayDate = new Date(todayStr + 'T00:00:00');

  const activeSubs = subs.filter(s => s.status === 'aktif' && s.tanggalTagihan);
  activeSubs.sort((a, b) => a.tanggalTagihan.localeCompare(b.tanggalTagihan));

  const nextAlertEl = document.getElementById('subNextAlert');
  const nextAlertTextEl = document.getElementById('subNextAlertText');
  if (nextAlertEl && nextAlertTextEl) {
    if (activeSubs.length > 0) {
      const nearest = activeSubs[0];
      const targetDate = new Date(nearest.tanggalTagihan + 'T00:00:00');
      const diffDays = Math.round((targetDate - todayDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        nextAlertTextEl.innerHTML = `⚠️ <b>Hari ini</b> jatuh tempo tagihan <b>${subEsc(nearest.nama)}</b> (${formatRupiahFull(nearest.biaya)})!`;
      } else if (diffDays === 1) {
        nextAlertTextEl.innerHTML = `🔔 <b>Besok</b> jatuh tempo <b>${subEsc(nearest.nama)}</b> (${formatRupiahFull(nearest.biaya)}).`;
      } else if (diffDays > 1 && diffDays <= 7) {
        nextAlertTextEl.innerHTML = `🔔 Tagihan terdekat: <b>${subEsc(nearest.nama)}</b> dalam <b>${diffDays} hari</b> (${formatRupiahFull(nearest.biaya)}).`;
      } else if (diffDays < 0) {
        nextAlertTextEl.innerHTML = `⚠️ Tagihan <b>${subEsc(nearest.nama)}</b> terlewat ${Math.abs(diffDays)} hari yang lalu.`;
      } else {
        nextAlertTextEl.innerHTML = `Tagihan berikutnya: <b>${subEsc(nearest.nama)}</b> tanggal ${formatDate(nearest.tanggalTagihan)}.`;
      }
    } else {
      nextAlertTextEl.textContent = 'Tidak ada tagihan aktif dalam waktu dekat.';
    }
  }

  if (!listEl) return;

  // Filter subscriptions
  let filtered = subs;
  if (currentSubFilter === 'active') {
    filtered = filtered.filter(s => s.status === 'aktif');
  } else if (currentSubFilter === 'soon') {
    filtered = filtered.filter(s => {
      if (s.status !== 'aktif' || !s.tanggalTagihan) return false;
      const targetDate = new Date(s.tanggalTagihan + 'T00:00:00');
      const diffDays = Math.round((targetDate - todayDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
  } else if (currentSubFilter === 'paused') {
    filtered = filtered.filter(s => s.status !== 'aktif');
  }

  // Sort: upcoming renewals first
  filtered.sort((a, b) => (a.tanggalTagihan || '').localeCompare(b.tanggalTagihan || ''));

  listEl.classList.toggle('list-static', _subSuppressAnim);
  _subSuppressAnim = false;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="fin-empty">
        <div class="fin-empty-icon">💳</div>
        <h4>Belum Ada Langganan</h4>
        <p>${currentSubFilter !== 'all' ? 'Tidak ada langganan pada filter ini.' : 'Catat langganan Spotify, Netflix, YouTube, iCloud, Wifi, dll di sini agar anggaran bulanan tetap terkontrol.'}</p>
        <button class="btn-primary" onclick="openSubModal()">+ Tambah Langganan</button>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(s => {
    const isPaused = s.status !== 'aktif';
    const targetDate = s.tanggalTagihan ? new Date(s.tanggalTagihan + 'T00:00:00') : null;
    let diffDays = targetDate ? Math.round((targetDate - todayDate) / (1000 * 60 * 60 * 24)) : null;

    let dueBadgeHtml = '';
    if (s.tanggalTagihan && !isPaused) {
      if (diffDays === 0) {
        dueBadgeHtml = `<span class="debt-due late">Hari ini!</span>`;
      } else if (diffDays === 1) {
        dueBadgeHtml = `<span class="debt-due soon">Besok</span>`;
      } else if (diffDays > 1 && diffDays <= 3) {
        dueBadgeHtml = `<span class="debt-due soon">${diffDays} hari lagi</span>`;
      } else if (diffDays > 3) {
        dueBadgeHtml = `<span class="debt-due ok">${diffDays} hari lagi</span>`;
      } else {
        dueBadgeHtml = `<span class="debt-due late">Terlewat</span>`;
      }
    }

    const cycleText = s.siklus === 'tahunan' ? '/ thn' : s.siklus === 'mingguan' ? '/ mgg' : '/ bln';
    const categoryLabel = SUB_CATEGORY_LABELS[s.kategori] || 'Layanan';
    const cardColor = s.color || '#2563eb';

    html += `
      <div class="debt-card sub ${isPaused ? 'paid' : ''}" style="--sub-color: ${subEsc(cardColor)}">
        <div class="debt-top">
          <div class="debt-avatar">
            <i data-lucide="${subEsc(s.icon || 'repeat')}"></i>
          </div>
          <div class="debt-info">
            <div class="debt-name">
              <span>${subEsc(s.nama)}</span>
              ${dueBadgeHtml}
              ${isPaused ? '<span class="debt-due muted">Dijeda</span>' : ''}
            </div>
            <div class="debt-sub">
              ${categoryLabel}${s.metode ? ' • ' + subEsc(s.metode) : ''}${s.catatan ? ' • "' + subEsc(s.catatan) + '"' : ''}
            </div>
          </div>
          <div class="debt-amount">
            ${formatRupiahFull(s.biaya)}
            <small>${cycleText}</small>
          </div>
        </div>

        <div class="debt-bottom">
          <span class="debt-progress-text">
            ${s.tanggalTagihan ? `<i data-lucide="calendar"></i>Tagihan: ${formatDate(s.tanggalTagihan)}` : (isPaused ? 'Status: Dijeda' : 'Status: Aktif')}
          </span>
          <span class="debt-actions">
            <button type="button" class="debt-btn" onclick="logSubPayment('${s.id}')" title="Catat pembayaran ini ke pengeluaran">
              <i data-lucide="check-circle-2"></i>Bayar
            </button>
            <button type="button" class="debt-btn ghost" onclick="toggleSubStatus('${s.id}')">
              ${s.status === 'aktif' ? 'Jeda' : 'Aktifkan'}
            </button>
            <button type="button" class="debt-btn ghost icon" onclick="editSub('${s.id}')" aria-label="Edit">
              <i data-lucide="pencil"></i>
            </button>
            <button type="button" class="debt-btn danger icon" onclick="deleteSub('${s.id}', event)" aria-label="Hapus">
              <i data-lucide="trash-2"></i>
            </button>
          </span>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  lucide.createIcons({ nodes: [listEl] });
}

// 1-Tap Catat Pembayaran ke Pengeluaran Bulanan
function logSubPayment(id) {
  const subs = Store.getSubscriptions();
  const sub = subs.find(s => String(s.id) === String(id));
  if (!sub) return;

  const now = new Date();
  const todayStr = subFormatYMD(now);

  // Buat transaksi pengeluaran otomatis
  const newTrans = {
    id: uid(),
    keterangan: `Langganan ${sub.nama}`,
    jumlah: Number(sub.biaya) || 0,
    type: 'expense',
    kategori: 'Hiburan',
    tanggal: todayStr,
    createdAt: now.toISOString()
  };

  const allTrans = Store.getTransaksi();
  allTrans.unshift(newTrans);
  Store.setTransaksi(allTrans);

  // Majukan tanggal tagihan berikutnya sesuai siklus
  if (sub.tanggalTagihan) {
    const curDate = new Date(sub.tanggalTagihan + 'T12:00:00');
    if (sub.siklus === 'tahunan') {
      curDate.setFullYear(curDate.getFullYear() + 1);
    } else if (sub.siklus === 'mingguan') {
      curDate.setDate(curDate.getDate() + 7);
    } else {
      curDate.setMonth(curDate.getMonth() + 1);
    }
    sub.tanggalTagihan = subFormatYMD(curDate);
    Store.setSubscriptions(subs);
  }

  if (typeof playPopSound === 'function') playPopSound('pop');
  showToast(`✅ Pembayaran ${sub.nama} dicatat ke pengeluaran!`, 'success');

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  _subSuppressAnim = true;
  renderSubscriptions();
  if (typeof renderKeuangan === 'function') renderKeuangan();
}

function toggleSubStatus(id) {
  const subs = Store.getSubscriptions();
  const sub = subs.find(s => String(s.id) === String(id));
  if (!sub) return;

  sub.status = sub.status === 'aktif' ? 'jeda' : 'aktif';
  Store.setSubscriptions(subs);

  showToast(sub.status === 'aktif' ? `Langganan ${sub.nama} diaktifkan kembali` : `Langganan ${sub.nama} dijeda`, 'info');

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  _subSuppressAnim = true;
  renderSubscriptions();
}

function setSubFilter(filter) {
  currentSubFilter = filter;
  document.querySelectorAll('#finPane-langganan .debt-tab, .sub-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subfilter === filter);
  });
  renderSubscriptions();
}

function applySubPreset(key) {
  const preset = SUB_PRESETS[key];
  if (!preset) return;

  document.getElementById('subNama').value = preset.nama;
  const biayaInput = document.getElementById('subBiaya');
  if (biayaInput) {
    biayaInput.value = formatRupiahDisplay(preset.biaya);
  }
  document.getElementById('subSiklus').value = preset.siklus || 'bulanan';
  document.getElementById('subKategori').value = preset.kategori || 'lainnya';
  document.getElementById('subMetode').value = preset.metode || 'GoPay';
  document.getElementById('subCatatan').value = preset.catatan || '';

  // Default tanggal tagihan 1 bulan dari sekarang
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  document.getElementById('subTanggal').value = subFormatYMD(nextMonth);

  selectedSubColor = preset.color || '#1db954';
  updateColorPicker('subColorPicker', selectedSubColor);

  showToast(`✨ Template ${preset.nama} dipilih!`, 'info', 1600);
}

function openSubModal() {
  editingSubId = null;
  document.getElementById('modalLanggananTitle').textContent = 'Tambah Langganan';
  document.getElementById('subNama').value = '';
  document.getElementById('subBiaya').value = '';
  document.getElementById('subSiklus').value = 'bulanan';
  document.getElementById('subKategori').value = 'musik';
  document.getElementById('subMetode').value = 'GoPay';
  document.getElementById('subStatus').value = 'aktif';
  document.getElementById('subCatatan').value = '';
  document.getElementById('subEditId').value = '';

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  document.getElementById('subTanggal').value = subFormatYMD(nextMonth);

  selectedSubColor = '#1db954';
  updateColorPicker('subColorPicker', selectedSubColor);

  openModal('modalLangganan');
}

function editSub(id) {
  const subs = Store.getSubscriptions();
  const sub = subs.find(s => String(s.id) === String(id));
  if (!sub) return;

  editingSubId = id;
  document.getElementById('modalLanggananTitle').textContent = 'Edit Langganan';
  document.getElementById('subNama').value = sub.nama || '';
  document.getElementById('subBiaya').value = formatRupiahDisplay(sub.biaya || 0);
  document.getElementById('subSiklus').value = sub.siklus || 'bulanan';
  document.getElementById('subKategori').value = sub.kategori || 'musik';
  document.getElementById('subMetode').value = sub.metode || 'GoPay';
  document.getElementById('subStatus').value = sub.status || 'aktif';
  document.getElementById('subTanggal').value = sub.tanggalTagihan || '';
  document.getElementById('subCatatan').value = sub.catatan || '';
  document.getElementById('subEditId').value = id;

  selectedSubColor = sub.color || '#1db954';
  updateColorPicker('subColorPicker', selectedSubColor);

  openModal('modalLangganan');
}

function deleteSub(id, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!id) return;
  if (!window.confirm('Apakah kamu yakin ingin menghapus catatan langganan ini?')) return;

  let subs = Store.getSubscriptions().filter(s => String(s.id) !== String(id));
  Store.setSubscriptions(subs);

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  showToast('🗑️ Langganan dihapus', 'error');
  renderSubscriptions();
}

function saveSubscription() {
  const nama = document.getElementById('subNama').value.trim();
  const biaya = parseRupiahInput(document.getElementById('subBiaya').value);
  const tanggalTagihan = document.getElementById('subTanggal').value;

  if (!nama || !biaya) {
    showToast('Nama layanan dan biaya tagihan wajib diisi!', 'error');
    return;
  }

  const siklus = document.getElementById('subSiklus').value;
  const kategori = document.getElementById('subKategori').value;
  const metode = document.getElementById('subMetode').value;
  const status = document.getElementById('subStatus').value;
  const catatan = document.getElementById('subCatatan').value.trim();

  // Tentukan icon berdasarkan kategori
  let icon = 'repeat';
  if (kategori === 'musik') icon = 'music';
  else if (kategori === 'streaming') icon = 'film';
  else if (kategori === 'cloud') icon = 'cloud';
  else if (kategori === 'ai') icon = 'bot';
  else if (kategori === 'produktivitas') icon = 'palette';
  else if (kategori === 'internet') icon = 'wifi';
  else if (kategori === 'gaming') icon = 'gamepad-2';

  let subs = Store.getSubscriptions();
  if (editingSubId) {
    subs = subs.map(s => {
      if (String(s.id) === String(editingSubId)) {
        return {
          ...s,
          nama,
          biaya,
          siklus,
          kategori,
          metode,
          status,
          tanggalTagihan,
          catatan,
          color: selectedSubColor,
          icon
        };
      }
      return s;
    });
  } else {
    const newSub = {
      id: 'sub-' + uid(),
      nama,
      biaya,
      siklus,
      kategori,
      metode,
      status,
      tanggalTagihan,
      catatan,
      color: selectedSubColor,
      icon,
      createdAt: new Date().toISOString()
    };
    subs.push(newSub);
  }

  Store.setSubscriptions(subs);
  closeModal('modalLangganan');

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  showToast(editingSubId ? '✅ Langganan diperbarui!' : '✅ Langganan ditambahkan!', 'success');
  editingSubId = null;

  renderSubscriptions();
}

// Window exposures
window.renderSubscriptions = renderSubscriptions;
window.openSubModal = openSubModal;
window.editSub = editSub;
window.deleteSub = deleteSub;
window.saveSubscription = saveSubscription;
window.logSubPayment = logSubPayment;
window.toggleSubStatus = toggleSubStatus;
window.setSubFilter = setSubFilter;
window.applySubPreset = applySubPreset;

// Init DOM listeners
document.addEventListener('DOMContentLoaded', () => {
  // Color picker for Subscription
  document.querySelectorAll('#subColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSubColor = btn.dataset.color;
      updateColorPicker('subColorPicker', selectedSubColor);
    });
  });

  // Attach auto rupiah formatter to subBiaya
  const biayaInput = document.getElementById('subBiaya');
  if (biayaInput && typeof attachRupiahFormatter === 'function') {
    attachRupiahFormatter(biayaInput);
  }
});
