// ===========================
// JADWAL.JS - SCHEDULE HUB (KULIAH, AGENDA, OLAHRAGA)
// ===========================

let activeJadwalTab = 'kuliah';
let selectedDay = 'Senin';
let selectedJadwalColor = '#2563eb';
let editingJadwalId = null;

// State for Agenda Hub
let currentAgendaFilter = 'all';

// State for Rutin Olahraga
let currentWorkoutDay = 'all';
let selectedSportColor = '#2563eb';
let editingSportId = null;

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setJadwalTab(tab) {
  if (!tab) tab = 'kuliah';
  activeJadwalTab = tab;

  document.querySelectorAll('#jadwalSubnavTabs .jadwal-subnav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.jadwal-subpane').forEach(pane => {
    pane.classList.add('hidden');
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById(`jadwalPane-${tab}`);
  if (targetPane) {
    targetPane.classList.remove('hidden');
    targetPane.classList.add('active');
  }

  const titleEl = document.getElementById('pageTitle');
  if (titleEl && currentPage === 'jadwal') {
    if (tab === 'kuliah') titleEl.textContent = 'Jadwal Kuliah';
    else if (tab === 'agenda') titleEl.textContent = 'Jadwal Agenda';
    else if (tab === 'olahraga') titleEl.textContent = 'Rutin Olahraga';
  }

  if (tab === 'kuliah') {
    renderJadwal();
  } else if (tab === 'agenda') {
    renderAgendaHub();
  } else if (tab === 'olahraga') {
    renderWorkoutHub();
  }
}

function renderJadwal() {
  if (activeJadwalTab === 'agenda') {
    renderAgendaHub();
    return;
  }
  if (activeJadwalTab === 'olahraga') {
    renderWorkoutHub();
    return;
  }

  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const today = days[new Date().getDay()];
  if (!selectedDay) {
    selectedDay = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].includes(today) ? today : 'All';
  }
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === selectedDay);
  });
  renderJadwalList();
}

function renderJadwalCardHtml(j, showDayBadge = false) {
  return `
    <div class="jadwal-card" id="jadwal-${j.id}">
      <div class="jadwal-card-inner" style="border-left-color:${j.color || '#2563eb'}">
        <div class="jadwal-time">
          <div class="jt-start">${j.jamMulai}</div>
          <div class="jt-end">${j.jamSelesai}</div>
        </div>
        <div class="jadwal-info">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
            <div class="jadwal-matkul" style="margin-bottom:0;">${j.matkul}</div>
            ${showDayBadge ? `<span class="jadwal-day-badge">${j.hari}</span>` : ''}
          </div>
          <div class="jadwal-meta">
            ${j.ruangan ? `<div class="jadwal-meta-item"><i data-lucide="map-pin"></i>${j.ruangan}</div>` : ''}
            ${j.dosen ? `<div class="jadwal-meta-item"><i data-lucide="user"></i>${j.dosen}</div>` : ''}
            ${j.sks ? `<div class="jadwal-meta-item"><i data-lucide="layers"></i>${j.sks} SKS</div>` : ''}
          </div>
        </div>
      </div>
      <div class="jadwal-actions">
        <button type="button" class="action-btn edit" onclick="editJadwal('${j.id}')">Edit</button>
        <button type="button" class="action-btn delete" onclick="deleteJadwal('${j.id}', event)">Hapus</button>
      </div>
    </div>
  `;
}

function renderJadwalList() {
  const container = document.getElementById('jadwalList');
  if (!container) return;

  if (selectedDay === 'All') {
    const allJadwal = Store.getJadwal();
    if (!allJadwal.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="calendar-x"></i>
          <h4>Belum Ada Jadwal Kuliah</h4>
          <p>Belum ada jadwal kuliah yang tersimpan.<br>Klik tombol + untuk menambahkan jadwal baru.</p>
        </div>
      `;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    let html = '';

    daysOrder.forEach(day => {
      const dayItems = allJadwal
        .filter(j => j.hari === day)
        .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));

      if (dayItems.length > 0) {
        html += `
          <div class="jadwal-day-group">
            <div class="jadwal-day-header">
              <div class="jadwal-day-title-wrap">
                <span class="jadwal-day-dot"></span>
                <span class="jadwal-day-name">${day}</span>
              </div>
              <span class="jadwal-day-count-badge">${dayItems.length} Mata Kuliah</span>
            </div>
            <div class="jadwal-day-items">
              ${dayItems.map(j => renderJadwalCardHtml(j, false)).join('')}
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  // Single Day filter
  const jadwal = Store.getJadwal()
    .filter(j => j.hari === selectedDay)
    .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));

  if (!jadwal.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-x"></i>
        <h4>Tidak ada jadwal</h4>
        <p>Belum ada jadwal untuk hari ${selectedDay}.<br>Klik tombol + untuk menambahkan.</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = jadwal.map(j => renderJadwalCardHtml(j, false)).join('');
  lucide.createIcons({ nodes: [container] });
}

function editJadwal(id) {
  const jadwal = Store.getJadwal().find(j => String(j.id) === String(id));
  if (!jadwal) return;
  editingJadwalId = id;
  document.getElementById('modalJadwalTitle').textContent = 'Edit Jadwal';
  document.getElementById('jadwalMatkul').value = jadwal.matkul;
  document.getElementById('jadwalHari').value = jadwal.hari;
  document.getElementById('jadwalSks').value = jadwal.sks || '';
  document.getElementById('jadwalJamMulai').value = jadwal.jamMulai;
  document.getElementById('jadwalJamSelesai').value = jadwal.jamSelesai;
  document.getElementById('jadwalRuangan').value = jadwal.ruangan || '';
  document.getElementById('jadwalDosen').value = jadwal.dosen || '';
  selectedJadwalColor = jadwal.color || '#2563eb';
  updateColorPicker('jadwalColorPicker', selectedJadwalColor);

  const delBtn = document.getElementById('deleteJadwalModalBtn');
  if (delBtn) {
    delBtn.style.display = 'inline-flex';
    lucide.createIcons({ nodes: [delBtn] });
  }

  openModal('modalJadwal');
}

function deleteJadwal(id, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!id) return;
  if (!window.confirm('Apakah kamu yakin ingin menghapus jadwal kuliah ini?')) return;
  executeDeleteJadwal(id);
}

function deleteCurrentEditingJadwal() {
  if (!editingJadwalId) return;
  if (!window.confirm('Hapus jadwal kuliah yang sedang dibuka ini?')) return;
  executeDeleteJadwal(editingJadwalId);
}

function executeDeleteJadwal(id) {
  if (!id) return;
  const current = Store.getJadwal();
  const filtered = current.filter(j => String(j.id) !== String(id));
  Store.setJadwal(filtered);

  if (editingJadwalId && String(editingJadwalId) === String(id)) {
    closeModal('modalJadwal');
    editingJadwalId = null;
  }

  renderJadwalList();
  if (typeof renderHome === 'function') renderHome();
  if (typeof updateStats === 'function') updateStats();
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }
  showToast('🗑️ Jadwal kuliah dihapus', 'error');
}

function saveJadwal() {
  const matkul = document.getElementById('jadwalMatkul').value.trim();
  const jamMulai = document.getElementById('jadwalJamMulai').value;
  const jamSelesai = document.getElementById('jadwalJamSelesai').value;

  if (!matkul || !jamMulai || !jamSelesai) {
    showToast('Lengkapi field yang diperlukan!', 'error'); return;
  }

  const data = {
    id: editingJadwalId || uid(),
    matkul,
    hari: document.getElementById('jadwalHari').value,
    sks: document.getElementById('jadwalSks').value,
    jamMulai,
    jamSelesai,
    ruangan: document.getElementById('jadwalRuangan').value.trim(),
    dosen: document.getElementById('jadwalDosen').value.trim(),
    color: selectedJadwalColor,
    createdAt: editingJadwalId ? undefined : new Date().toISOString()
  };

  let jadwal = Store.getJadwal();
  if (editingJadwalId) {
    jadwal = jadwal.map(j => String(j.id) === String(editingJadwalId) ? { ...j, ...data } : j);
  } else {
    jadwal.push(data);
  }
  Store.setJadwal(jadwal);

  selectedDay = data.hari;
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === selectedDay);
  });

  closeModal('modalJadwal');
  resetJadwalForm();
  renderJadwalList();
  if (currentPage === 'home') renderHome();
  updateStats();
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }
  showToast(editingJadwalId ? '✅ Jadwal diperbarui!' : '✅ Jadwal ditambahkan!', 'success');
  editingJadwalId = null;
}

function resetJadwalForm() {
  ['jadwalMatkul','jadwalSks','jadwalJamMulai','jadwalJamSelesai','jadwalRuangan','jadwalDosen'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modalJadwalTitle').textContent = 'Tambah Jadwal Kuliah';
  selectedJadwalColor = '#2563eb';
  updateColorPicker('jadwalColorPicker', selectedJadwalColor);
  const delBtn = document.getElementById('deleteJadwalModalBtn');
  if (delBtn) delBtn.style.display = 'none';
  editingJadwalId = null;
}

function updateColorPicker(pickerId, selectedColor) {
  document.querySelectorAll(`#${pickerId} .color-opt`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === selectedColor);
  });
}

// ==========================================
// AGENDA HUB (JADWAL KEGIATAN & KALENDER)
// ==========================================

function getEventRelativeBadge(dateStr) {
  const today = new Date();
  const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = formatYMD(today);

  if (dateStr === todayStr) {
    return `<span class="agenda-hub-badge today">Hari Ini</span>`;
  }

  const todayDate = new Date(todayStr + 'T00:00:00');
  const targetDate = new Date(dateStr + 'T00:00:00');
  const diffTime = targetDate - todayDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return `<span class="agenda-hub-badge upcoming">Besok</span>`;
  } else if (diffDays > 1) {
    return `<span class="agenda-hub-badge upcoming">${diffDays} hari lagi</span>`;
  } else if (diffDays === -1) {
    return `<span class="agenda-hub-badge past">Kemarin</span>`;
  } else {
    return `<span class="agenda-hub-badge past">Selesai/Lewat</span>`;
  }
}

function formatIndoDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function setAgendaFilter(filter) {
  currentAgendaFilter = filter;
  document.querySelectorAll('.agenda-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderAgendaHub();
}

function filterAgendaList() {
  renderAgendaHub();
}

function openAddEventFromJadwal() {
  if (typeof resetEventForm === 'function') {
    resetEventForm();
  }
  const dateInput = document.getElementById('eventTanggal');
  if (dateInput) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    dateInput.value = todayStr;
  }
  openModal('modalEvent');
}

function renderAgendaHub() {
  const container = document.getElementById('agendaList');
  if (!container) return;

  const events = Store.getEvents() || [];
  const searchInput = document.getElementById('agendaSearchInput');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const today = new Date();
  const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = formatYMD(today);

  // Filter by query
  let filtered = events.filter(e => {
    if (!query) return true;
    const nama = (e.nama || '').toLowerCase();
    const lokasi = (e.lokasi || '').toLowerCase();
    const deskripsi = (e.deskripsi || '').toLowerCase();
    return nama.includes(query) || lokasi.includes(query) || deskripsi.includes(query);
  });

  // Filter by chip
  if (currentAgendaFilter === 'today') {
    filtered = filtered.filter(e => e.tanggal === todayStr);
  } else if (currentAgendaFilter === 'upcoming') {
    filtered = filtered.filter(e => e.tanggal >= todayStr);
  } else if (currentAgendaFilter === 'past') {
    filtered = filtered.filter(e => e.tanggal < todayStr);
  }

  // Sort
  if (currentAgendaFilter === 'past') {
    filtered.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.jamMulai || '').localeCompare(a.jamMulai || ''));
  } else {
    filtered.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.jamMulai || '').localeCompare(b.jamMulai || ''));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-x"></i>
        <h4>Tidak Ada Agenda</h4>
        <p>${query ? 'Tidak ada agenda yang cocok dengan pencarianmu.' : 'Belum ada agenda atau kegiatan pada kategori ini.'}<br>Klik tombol + Tambah untuk membuat agenda baru.</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  let html = '';
  filtered.forEach(e => {
    const badgeHtml = getEventRelativeBadge(e.tanggal);
    const dateFormatted = formatIndoDate(e.tanggal);
    const timeFormatted = e.jamMulai ? (e.jamSelesai ? `${e.jamMulai} - ${e.jamSelesai}` : e.jamMulai) : null;

    html += `
      <div class="agenda-hub-card" id="agenda-card-${e.id}" style="border-left-color: ${e.color || '#2563eb'}">
        <div class="agenda-hub-top">
          <h4 class="agenda-hub-title">${escapeHtml(e.nama)}</h4>
          ${badgeHtml}
        </div>
        <div class="agenda-hub-meta">
          <div class="agenda-hub-meta-item">
            <i data-lucide="calendar"></i>
            <span>${dateFormatted}</span>
          </div>
          ${timeFormatted ? `
            <div class="agenda-hub-meta-item">
              <i data-lucide="clock"></i>
              <span>${timeFormatted}</span>
            </div>
          ` : ''}
          ${e.lokasi ? `
            <div class="agenda-hub-meta-item">
              <i data-lucide="map-pin"></i>
              <span>${escapeHtml(e.lokasi)}</span>
            </div>
          ` : ''}
        </div>
        ${e.deskripsi ? `<p class="agenda-hub-desc">${escapeHtml(e.deskripsi)}</p>` : ''}
        <div class="agenda-hub-actions">
          <button type="button" class="action-btn edit" onclick="editEvent('${e.id}')">Edit</button>
          <button type="button" class="action-btn delete" onclick="deleteEvent('${e.id}')">Hapus</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons({ nodes: [container] });
}

// ==========================================
// WORKOUT HUB (RUTIN OLAHRAGA & FITNESS)
// ==========================================

function getSportIcon(kategori) {
  switch (kategori) {
    case 'gym': return 'dumbbell';
    case 'lari': return 'flame';
    case 'sepeda': return 'bike';
    case 'renang': return 'waves';
    case 'badminton': return 'trophy';
    case 'futsal': return 'trophy';
    case 'workout': return 'zap';
    case 'yoga': return 'heart';
    default: return 'activity';
  }
}

function getSportCategoryLabel(kategori) {
  const map = {
    gym: '🏋️‍♂️ Gym / Fitness',
    lari: '🏃‍♂️ Lari / Jogging',
    sepeda: '🚴‍♂️ Sepeda',
    renang: '🏊‍♂️ Renang',
    badminton: '🏸 Badminton',
    futsal: '⚽ Futsal / Bola',
    workout: '🤸‍♂️ Workout Rumahan',
    yoga: '🧘‍♀️ Yoga & Stretch',
    lainnya: '⚡ Olahraga'
  };
  return map[kategori] || 'Olahraga';
}

function updateWorkoutSummaryStats(workouts) {
  const weeklyEl = document.getElementById('workoutWeeklyStatus');
  const motivEl = document.getElementById('workoutMotivation');
  const streakEl = document.getElementById('workoutStreakCount');
  if (!weeklyEl || !streakEl) return;

  const now = new Date();
  const todayDay = now.getDay();
  const mondayOffset = (todayDay === 0 ? -6 : 1) - todayDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const thisWeekDates = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    thisWeekDates.add(formatYMD(d));
  }

  let weeklyDoneCount = 0;
  workouts.forEach(w => {
    if (w.history) {
      Object.keys(w.history).forEach(dateStr => {
        if (w.history[dateStr] && thisWeekDates.has(dateStr)) {
          weeklyDoneCount++;
        }
      });
    }
  });

  // Calculate streak of consecutive days with workouts
  let streak = 0;
  let checkDate = new Date(now);
  const checkYMD = formatYMD(checkDate);
  const hadWorkoutToday = workouts.some(w => w.history && w.history[checkYMD]);
  if (!hadWorkoutToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dStr = formatYMD(checkDate);
    const completed = workouts.some(w => w.history && w.history[dStr]);
    if (completed) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  weeklyEl.textContent = `${weeklyDoneCount} Sesi Selesai Minggu Ini`;
  streakEl.innerHTML = `🔥 ${streak}`;

  if (weeklyDoneCount >= 4) {
    motivEl.textContent = 'Luar biasa! Konsistensi kamu tingkat atlet, pertahankan ritme ini! 💪';
  } else if (weeklyDoneCount >= 2) {
    motivEl.textContent = 'Mantap! Badan terasa lebih bugar dan energi lebih terjaga.';
  } else if (weeklyDoneCount === 1) {
    motivEl.textContent = 'Awal yang baik! Yuk tambah 1-2 sesi lagi minggu ini.';
  } else {
    motivEl.textContent = 'Yuk sempatkan 30 menit hari ini untuk keringatan & bakar kalori!';
  }
}

function setWorkoutDayFilter(day) {
  currentWorkoutDay = day;
  document.querySelectorAll('#workoutDayFilter .workout-day-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === day);
  });
  renderWorkoutHub();
}

function renderWorkoutHub() {
  const container = document.getElementById('workoutList');
  if (!container) return;

  const workouts = Store.getOlahraga() || [];
  updateWorkoutSummaryStats(workouts);

  const now = new Date();
  const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayDateStr = formatYMD(now);
  const todayDayName = INDO_DAYS[now.getDay()];

  let filtered = workouts;
  if (currentWorkoutDay !== 'all') {
    filtered = filtered.filter(w => Array.isArray(w.hari) && w.hari.includes(currentWorkoutDay));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="dumbbell"></i>
        <h4>Belum Ada Rutin Olahraga</h4>
        <p>${currentWorkoutDay !== 'all' ? `Belum ada jadwal olahraga untuk hari ${currentWorkoutDay}.` : 'Mulai catat jadwal latihan, gym, lari, atau workout kamu di sini!'}<br>Klik tombol + Tambah untuk memulai.</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const shortDays = { Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam', Jumat: 'Jum', Sabtu: 'Sab', Minggu: 'Min' };

  let html = '';
  filtered.forEach(w => {
    const isCompletedToday = Boolean(w.history && w.history[todayDateStr]);
    const isTodayActive = Array.isArray(w.hari) && w.hari.includes(todayDayName);
    const iconName = getSportIcon(w.kategori);
    const categoryLabel = getSportCategoryLabel(w.kategori);

    let daysRowHtml = '';
    allDays.forEach(day => {
      const activeInRoutine = Array.isArray(w.hari) && w.hari.includes(day);
      let cls = 'workout-day-tag';
      if (activeInRoutine) {
        cls += day === todayDayName ? ' today-active' : ' active';
      }
      daysRowHtml += `<span class="${cls}">${shortDays[day]}</span>`;
    });

    html += `
      <div class="workout-card ${isTodayActive ? 'is-today' : ''}" style="border-left-color: ${w.color || '#2563eb'}">
        <div class="workout-card-top">
          <div class="workout-icon-box" style="background: ${w.color || '#2563eb'}">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="workout-title-group">
            <h4 class="workout-title">${escapeHtml(w.nama)}</h4>
            <div class="workout-sub-time">
              <i data-lucide="clock"></i>
              <span>${w.jam || '06:30'} WIB</span>
              ${isTodayActive ? `<span style="color:#059669; font-weight:800; font-size:11px;">• Jadwal Hari Ini</span>` : ''}
            </div>
          </div>
        </div>

        <div class="workout-meta-chips">
          <span class="workout-meta-chip"><i data-lucide="activity"></i> ${categoryLabel}</span>
          ${w.durasi ? `<span class="workout-meta-chip"><i data-lucide="target"></i> ${escapeHtml(w.durasi)}</span>` : ''}
          ${w.lokasi ? `<span class="workout-meta-chip"><i data-lucide="map-pin"></i> ${escapeHtml(w.lokasi)}</span>` : ''}
        </div>

        <div class="workout-days-row">
          ${daysRowHtml}
        </div>

        ${w.catatan ? `<div class="workout-notes">"${escapeHtml(w.catatan)}"</div>` : ''}

        <div class="workout-footer-row">
          <button class="workout-check-btn ${isCompletedToday ? 'completed' : 'uncompleted'}" onclick="toggleOlahragaToday('${w.id}')">
            <i data-lucide="${isCompletedToday ? 'check-circle-2' : 'circle'}"></i>
            <span>${isCompletedToday ? 'Selesai Hari Ini 🎉' : 'Tandai Sudah Latihan'}</span>
          </button>
          <div class="workout-action-btns">
            <button type="button" class="action-btn edit" onclick="editOlahraga('${w.id}')">Edit</button>
            <button type="button" class="action-btn delete" onclick="deleteOlahraga('${w.id}', event)">Hapus</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons({ nodes: [container] });
}

function toggleOlahragaToday(id) {
  let list = Store.getOlahraga();
  const item = list.find(w => String(w.id) === String(id));
  if (!item) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (!item.history) item.history = {};
  const isNowCompleted = !item.history[todayStr];
  item.history[todayStr] = isNowCompleted;

  Store.setOlahraga(list);
  if (typeof playPopSound === 'function') playPopSound(isNowCompleted ? 'pop' : 'error');

  if (isNowCompleted) {
    showToast(`🔥 Selesai latihan: ${item.nama}! Pertahankan!`, 'success');
  } else {
    showToast(`Status latihan ${item.nama} dibatalkan`, 'info');
  }

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  renderWorkoutHub();
}

function openAddOlahragaModal() {
  editingSportId = null;
  document.getElementById('modalOlahragaTitle').textContent = 'Tambah Rutin Olahraga';
  document.getElementById('sportNama').value = '';
  document.getElementById('sportKategori').value = 'gym';
  document.getElementById('sportJam').value = '06:30';
  document.getElementById('sportDurasi').value = '';
  document.getElementById('sportLokasi').value = '';
  document.getElementById('sportCatatan').value = '';
  document.getElementById('sportEditId').value = '';

  selectedSportColor = '#2563eb';
  updateColorPicker('sportColorPicker', selectedSportColor);

  const todayDay = INDO_DAYS[new Date().getDay()];
  document.querySelectorAll('#sportDayPicker .sport-day-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === todayDay);
  });

  openModal('modalOlahraga');
}

function editOlahraga(id) {
  const list = Store.getOlahraga();
  const item = list.find(w => String(w.id) === String(id));
  if (!item) return;

  editingSportId = id;
  document.getElementById('modalOlahragaTitle').textContent = 'Edit Rutin Olahraga';
  document.getElementById('sportNama').value = item.nama || '';
  document.getElementById('sportKategori').value = item.kategori || 'gym';
  document.getElementById('sportJam').value = item.jam || '06:30';
  document.getElementById('sportDurasi').value = item.durasi || '';
  document.getElementById('sportLokasi').value = item.lokasi || '';
  document.getElementById('sportCatatan').value = item.catatan || '';
  document.getElementById('sportEditId').value = id;

  selectedSportColor = item.color || '#2563eb';
  updateColorPicker('sportColorPicker', selectedSportColor);

  const selectedDays = Array.isArray(item.hari) ? item.hari : [];
  document.querySelectorAll('#sportDayPicker .sport-day-opt').forEach(btn => {
    btn.classList.toggle('active', selectedDays.includes(btn.dataset.day));
  });

  openModal('modalOlahraga');
}

function deleteOlahraga(id, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!id) return;
  if (!window.confirm('Apakah kamu yakin ingin menghapus jadwal olahraga ini?')) return;

  let list = Store.getOlahraga().filter(w => String(w.id) !== String(id));
  Store.setOlahraga(list);

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  showToast('🗑️ Rutin olahraga dihapus', 'error');
  renderWorkoutHub();
}

function saveOlahraga() {
  const nama = document.getElementById('sportNama').value.trim();
  if (!nama) {
    showToast('Nama olahraga wajib diisi!', 'error');
    return;
  }

  const selectedDays = [];
  document.querySelectorAll('#sportDayPicker .sport-day-opt.active').forEach(btn => {
    selectedDays.push(btn.dataset.day);
  });

  if (selectedDays.length === 0) {
    showToast('Pilih minimal 1 hari rutin latihan!', 'error');
    return;
  }

  const kategori = document.getElementById('sportKategori').value;
  const jam = document.getElementById('sportJam').value || '06:30';
  const durasi = document.getElementById('sportDurasi').value.trim();
  const lokasi = document.getElementById('sportLokasi').value.trim();
  const catatan = document.getElementById('sportCatatan').value.trim();

  let list = Store.getOlahraga();
  if (editingSportId) {
    list = list.map(item => {
      if (String(item.id) === String(editingSportId)) {
        return {
          ...item,
          nama,
          kategori,
          hari: selectedDays,
          jam,
          durasi,
          lokasi,
          catatan,
          color: selectedSportColor
        };
      }
      return item;
    });
  } else {
    const newItem = {
      id: 'sport-' + uid(),
      nama,
      kategori,
      hari: selectedDays,
      jam,
      durasi,
      lokasi,
      catatan,
      color: selectedSportColor,
      history: {},
      createdAt: new Date().toISOString()
    };
    list.push(newItem);
  }

  Store.setOlahraga(list);
  closeModal('modalOlahraga');

  if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
    FirebaseService.syncUploadAll(false);
  }

  showToast(editingSportId ? '✅ Jadwal olahraga diperbarui!' : '✅ Rutin olahraga ditambahkan!', 'success');
  editingSportId = null;

  renderWorkoutHub();
}

// Window exposures
window.setJadwalTab = setJadwalTab;
window.setAgendaFilter = setAgendaFilter;
window.filterAgendaList = filterAgendaList;
window.openAddEventFromJadwal = openAddEventFromJadwal;
window.setWorkoutDayFilter = setWorkoutDayFilter;
window.openAddOlahragaModal = openAddOlahragaModal;
window.editOlahraga = editOlahraga;
window.deleteOlahraga = deleteOlahraga;
window.saveOlahraga = saveOlahraga;
window.toggleOlahragaToday = toggleOlahragaToday;
window.renderAgendaHub = renderAgendaHub;
window.renderWorkoutHub = renderWorkoutHub;

// ---- Init Jadwal ----
document.addEventListener('DOMContentLoaded', () => {
  // Day tabs for Jadwal Kuliah
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDay = tab.dataset.day;
      renderJadwalList();
    });
  });

  // Add button for Kuliah
  const addJadwalBtn = document.getElementById('addJadwalBtn');
  if (addJadwalBtn) {
    addJadwalBtn.addEventListener('click', () => {
      editingJadwalId = null;
      resetJadwalForm();
      openModal('modalJadwal');
    });
  }

  // Save button for Kuliah
  const saveJadwalBtn = document.getElementById('saveJadwalBtn');
  if (saveJadwalBtn) {
    saveJadwalBtn.addEventListener('click', saveJadwal);
  }

  // Color picker for Kuliah
  document.querySelectorAll('#jadwalColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedJadwalColor = btn.dataset.color;
      updateColorPicker('jadwalColorPicker', selectedJadwalColor);
    });
  });

  // Sport Day Picker in modal
  document.querySelectorAll('#sportDayPicker .sport-day-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Sport Color Picker in modal
  document.querySelectorAll('#sportColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSportColor = btn.dataset.color;
      updateColorPicker('sportColorPicker', selectedSportColor);
    });
  });

  // Subnav tabs click delegation
  document.querySelectorAll('#jadwalSubnavTabs .jadwal-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setJadwalTab(btn.dataset.tab);
    });
  });
});
