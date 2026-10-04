// ===========================
// APP.JS - MAIN APP CONTROLLER
// ===========================

// ---- Global State ----
let currentPage = 'home';
let financeChart = null;

// ---- Utils ----
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ==========================================
// HAPTIC & AUDIO POP SYNTHESIZER (Web Audio API)
// ==========================================
function playPopSound(type = 'pop') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window._appAudioCtx) {
      window._appAudioCtx = new AudioCtx();
    }
    const ctx = window._appAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    if (type === 'error') {
      // Tactile error dual-tone drop
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(170, now + 0.16);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      // Satisfying iOS-style crisp pop chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(890, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(430, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    // Autoplay policy or unsupported audio
  }
}

let toastTimeout = null;
function showToast(msg, type = '', duration = 2600) {
  const t = document.getElementById('toast');
  if (!t) return;

  // Bunyikan pop feedback & getaran haptic fisik
  playPopSound(type === 'error' ? 'error' : 'pop');
  if ('vibrate' in navigator) {
    try { navigator.vibrate(type === 'error' ? [35, 45, 35] : 18); } catch (e) {}
  }

  t.innerHTML = msg;
  t.className = `toast ${type} show`;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.classList.remove('show');
  }, duration);
}

function formatRupiah(num) {
  if (Math.abs(num) >= 1000000) return 'Rp ' + (num/1000000).toFixed(1) + 'jt';
  if (Math.abs(num) >= 1000) return 'Rp ' + (num/1000).toFixed(0) + 'rb';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatRupiahFull(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getDeadlineBadge(deadline) {
  const now = new Date();
  const dl = new Date(deadline);
  const diff = (dl - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { cls: 'urgent', label: 'Terlambat' };
  if (diff < 1) return { cls: 'urgent', label: 'Hari ini!' };
  if (diff < 3) return { cls: 'urgent', label: Math.ceil(diff) + ' hari lagi' };
  if (diff < 7) return { cls: 'soon', label: Math.ceil(diff) + ' hari' };
  return { cls: 'ok', label: Math.ceil(diff) + ' hari' };
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('modalBackdrop').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- Side Drawer ----
function openDrawer() {
  const drawer = document.getElementById('sideDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  const drawer = document.getElementById('sideDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- Navigation ----
function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  // Show target
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    target.classList.remove('hidden');
  }

  // Header behavior: Header is always visible on all pages (including Home) to show Grid icon, Home title, and Bell
  const appHeader = document.getElementById('app-header');
  const pagesContainer = document.getElementById('pages-container');
  if (appHeader && pagesContainer) {
    appHeader.classList.remove('home-hidden');
    pagesContainer.classList.remove('is-home');
  }

  // Update nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Update title
  const titles = {
    home: 'Home', jadwal: 'Jadwal Kuliah', tugas: 'Tugas & Deadline',
    catatan: 'Catatan', keuangan: 'Manajemen Uang', kalender: 'Kalender',
    ai: 'Aiden AI', profil: 'Profil'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;
  currentPage = page;

  // Load page-specific data
  if (page === 'home') renderHome();
  if (page === 'jadwal') renderJadwal();
  if (page === 'tugas') renderTugas();
  if (page === 'catatan') renderCatatan();
  if (page === 'keuangan') renderKeuangan();
  if (page === 'kalender') renderKalender();

  // Scroll to top of page container
  if (pagesContainer) pagesContainer.scrollTop = 0;
}

// ---- Home Ongoing Projects ----
let selectedProjectStyle = 'navy';
let selectedProjectIcon = 'smartphone';
let editingProjectId = null;

function renderOngoingProjects() {
  const container = document.getElementById('ongoingProjectsGrid');
  if (!container) return;

  const projects = Store.getProjects();
  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-compact" style="grid-column: 1 / -1; justify-content: center; cursor: pointer;" onclick="openAddProjectModal()">
        <i data-lucide="folder-plus"></i>
        <span>Belum ada ongoing project. Klik di sini untuk tambah proyek baru!</span>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = projects.map((p, idx) => {
    const isNavy = p.type === 'navy' || (idx === 0 && p.type !== 'light');
    const cardClass = isNavy ? 'proj-card proj-card-navy' : 'proj-card proj-card-light';
    const iconBoxClass = isNavy ? 'navy-box' : (p.iconClass || 'blue-box');

    return `
      <div class="${cardClass}" onclick="navigateTo('tugas')">
        <div class="proj-card-top">
          <span class="proj-date">${p.date || 'Ongoing'}</span>
          <button class="proj-more-btn" aria-label="Menu Proyek" title="Edit atau Kelola Proyek" onclick="event.stopPropagation(); openEditProject('${p.id}');">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
        <div class="proj-card-main">
          <div class="proj-icon-box ${iconBoxClass}">
            <i data-lucide="${p.icon || 'folder'}"></i>
          </div>
          <div class="proj-info">
            <h4 class="proj-title">${p.title}</h4>
            <p class="proj-sub">${p.sub}</p>
          </div>
        </div>
        <div class="proj-card-bottom">
          <div class="proj-progress-header">
            <span>Progress</span>
            <span class="proj-pct">${p.progress}%</span>
          </div>
          <div class="proj-prog-track">
            <div class="proj-prog-fill" style="width: ${p.progress}%;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

function openAddProjectModal() {
  editingProjectId = null;
  const titleEl = document.getElementById('modalProjectTitle');
  if (titleEl) titleEl.textContent = 'Tambah Proyek Baru';
  document.getElementById('projInputTitle').value = '';
  document.getElementById('projInputSub').value = '';
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('projInputDate').value = dateFormatted;
  document.getElementById('projInputProgress').value = 50;
  document.getElementById('projProgressVal').textContent = '50%';
  const delBtn = document.getElementById('deleteProjectBtn');
  if (delBtn) delBtn.classList.add('hidden');

  setProjectStyleSelection('navy');
  setProjectIconSelection('smartphone');
  openModal('modalProject');
}
window.openAddProjectModal = openAddProjectModal;

function openEditProject(id) {
  const projects = Store.getProjects();
  const proj = projects.find(p => p.id === id);
  if (!proj) return;

  editingProjectId = id;
  const titleEl = document.getElementById('modalProjectTitle');
  if (titleEl) titleEl.textContent = 'Edit Ongoing Proyek';
  document.getElementById('projInputTitle').value = proj.title || '';
  document.getElementById('projInputSub').value = proj.sub || '';
  document.getElementById('projInputDate').value = proj.date || '';
  document.getElementById('projInputProgress').value = proj.progress || 0;
  document.getElementById('projProgressVal').textContent = (proj.progress || 0) + '%';
  const delBtn = document.getElementById('deleteProjectBtn');
  if (delBtn) delBtn.classList.remove('hidden');

  let styleKey = 'navy';
  if (proj.type === 'light') {
    if (proj.iconClass?.includes('blue')) styleKey = 'blue';
    else if (proj.iconClass?.includes('red')) styleKey = 'red';
    else if (proj.iconClass?.includes('purple')) styleKey = 'purple';
    else if (proj.iconClass?.includes('green') || proj.iconClass?.includes('emerald')) styleKey = 'green';
    else styleKey = 'blue';
  }
  setProjectStyleSelection(styleKey);
  setProjectIconSelection(proj.icon || 'folder');
  openModal('modalProject');
}
window.openEditProject = openEditProject;

function setProjectStyleSelection(styleKey) {
  selectedProjectStyle = styleKey;
  document.querySelectorAll('#projStylePicker .style-opt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === styleKey);
  });
}

function setProjectIconSelection(iconName) {
  selectedProjectIcon = iconName;
  document.querySelectorAll('#projIconPicker .icon-pick-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.icon === iconName);
  });
}

function handleSaveProject() {
  const title = document.getElementById('projInputTitle').value.trim();
  const sub = document.getElementById('projInputSub').value.trim();
  const date = document.getElementById('projInputDate').value.trim();
  const progress = parseInt(document.getElementById('projInputProgress').value, 10) || 0;

  if (!title) {
    showToast('Harap masukkan nama proyek!', 'error');
    return;
  }

  let projects = Store.getProjects();
  const isNavy = selectedProjectStyle === 'navy';
  let iconClass = 'navy-box';
  if (!isNavy) {
    if (selectedProjectStyle === 'blue') iconClass = 'blue-box';
    else if (selectedProjectStyle === 'red') iconClass = 'red-box';
    else if (selectedProjectStyle === 'purple') iconClass = 'purple-box';
    else if (selectedProjectStyle === 'green') iconClass = 'green-box';
  }

  if (editingProjectId) {
    projects = projects.map(p => {
      if (p.id === editingProjectId) {
        return {
          ...p,
          title,
          sub: sub || 'Proyek',
          date: date || 'Ongoing',
          progress,
          type: isNavy ? 'navy' : 'light',
          iconClass,
          icon: selectedProjectIcon
        };
      }
      return p;
    });
    showToast('✅ Proyek berhasil diperbarui!', 'success');
  } else {
    const newProj = {
      id: 'p_' + Date.now().toString(36),
      title,
      sub: sub || 'Proyek',
      date: date || 'Ongoing',
      progress,
      type: isNavy ? 'navy' : 'light',
      iconClass,
      icon: selectedProjectIcon
    };
    projects.push(newProj);
    showToast('✅ Proyek baru berhasil ditambahkan!', 'success');
  }

  Store.setProjects(projects);
  closeModal('modalProject');
  renderOngoingProjects();
}
window.handleSaveProject = handleSaveProject;

function handleDeleteCurrentProject() {
  if (!editingProjectId) return;
  if (!confirm('Yakin ingin menghapus proyek ini dari Ongoing Projects?')) return;

  let projects = Store.getProjects();
  projects = projects.filter(p => p.id !== editingProjectId);
  Store.setProjects(projects);
  closeModal('modalProject');
  renderOngoingProjects();
  showToast('Proyek berhasil dihapus', 'info');
}
window.handleDeleteCurrentProject = handleDeleteCurrentProject;

// ---- Home Search Filter ----
function filterHomeContent(q) {
  const query = (q || '').toLowerCase().trim();
  // Filter ongoing projects
  document.querySelectorAll('#ongoingProjectsGrid .proj-card').forEach(card => {
    if (!query) {
      card.style.display = '';
      return;
    }
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? '' : 'none';
  });

  // Filter today's schedule items
  document.querySelectorAll('#todayScheduleList .fintech-trans-item').forEach(item => {
    if (!query) {
      item.style.display = '';
      return;
    }
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? '' : 'none';
  });

  // Filter upcoming agenda items
  document.querySelectorAll('#upcomingAgendaList .agenda-home-item').forEach(item => {
    if (!query) {
      item.style.display = '';
      return;
    }
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? '' : 'none';
  });
}

// ---- Greeting ----
function updateGreeting() {
  const now = new Date();
  const profil = Store.getProfil();
  const name = profil.name || 'Jenifer';
  const initial = (name[0] || 'J').toUpperCase();

  // Reference UI: "Hi Jenifer!" and "Good morning"
  const greetingName = document.getElementById('greetingName');
  if (greetingName) greetingName.textContent = `Hi ${name}!`;

  const hour = now.getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening';
  else if (hour >= 21 || hour < 5) timeGreeting = 'Good night';

  const greetingTimeSub = document.getElementById('greetingTimeSub');
  if (greetingTimeSub) greetingTimeSub.textContent = timeGreeting;

  const avatarInitial = document.getElementById('avatarInitial');
  if (avatarInitial) avatarInitial.textContent = initial;

  const headerAvatar = document.getElementById('headerAvatar');
  if (headerAvatar) headerAvatar.textContent = initial;

  const atmCardHolder = document.getElementById('atmCardHolder');
  if (atmCardHolder) atmCardHolder.textContent = (name || 'Jenifer').toUpperCase();

  const drawerAvatar = document.getElementById('drawerAvatar');
  if (drawerAvatar) drawerAvatar.textContent = initial;
  const drawerUserName = document.getElementById('drawerUserName');
  if (drawerUserName) drawerUserName.textContent = name;
  const drawerUserUniv = document.getElementById('drawerUserUniv');
  if (drawerUserUniv) drawerUserUniv.textContent = [profil.univ, profil.jurusan].filter(Boolean).join(' · ') || 'Universitas / Jurusan';
}

// ---- Home Page ----
function renderHome() {
  updateGreeting();
  renderOngoingProjects();
  renderHomeTodaySchedule();
  renderHomeUpcomingAgenda();
  renderHomeDeadlines();
  renderHomeFinance();
  renderHomeNotes();
  updateStats();
}

function updateStats() {
  const profil = Store.getProfil();
  const tugas = Store.getTugas().filter(t => !t.done);
  const now = new Date();
  const deadlines = tugas.filter(t => {
    const dl = new Date(t.deadline);
    return (dl - now) / (1000*60*60*24) <= 3 && dl >= now;
  });
  const catatan = Store.getCatatan();
  const transaksi = Store.getTransaksi();
  const thisMonth = transaksi.filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const saldo = thisMonth.reduce((s, t) => t.type === 'income' ? s + t.jumlah : s - t.jumlah, 0);

  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const today = days[now.getDay()];
  const jadwalToday = Store.getJadwal().filter(j => j.hari === today);

  const statSaldo = document.getElementById('statSaldoNum');
  if (statSaldo) statSaldo.textContent = formatRupiahFull(saldo > 0 ? saldo : 2589500);

  const cardAtmHolder = document.getElementById('cardAtmHolder');
  if (cardAtmHolder) cardAtmHolder.textContent = profil.name || 'Ahmad Fawaid';

  const homeJadwalCountBadge = document.getElementById('homeJadwalCountBadge');
  if (homeJadwalCountBadge) homeJadwalCountBadge.textContent = jadwalToday.length;

  const statTugas = document.getElementById('statTugasNum');
  if (statTugas) statTugas.textContent = tugas.length;
  const statDeadline = document.getElementById('statDeadlineNum');
  if (statDeadline) statDeadline.textContent = deadlines.length;
  const statCatatan = document.getElementById('statCatatanNum');
  if (statCatatan) statCatatan.textContent = catatan.length;

  // Profil stats
  const jadwal = Store.getJadwal();
  const pstatJadwal = document.getElementById('pstatJadwal');
  if (pstatJadwal) pstatJadwal.textContent = jadwal.length;
  const pstatTugas = document.getElementById('pstatTugas');
  if (pstatTugas) pstatTugas.textContent = Store.getTugas().length;
  const pstatCatatan = document.getElementById('pstatCatatan');
  if (pstatCatatan) pstatCatatan.textContent = catatan.length;
}

function renderHomeTodaySchedule() {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const today = days[new Date().getDay()];
  const jadwal = Store.getJadwal().filter(j => j.hari === today)
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
  const container = document.getElementById('todayScheduleList');
  if (!container) return;

  if (!jadwal.length) {
    container.innerHTML = `<div class="empty-compact"><i data-lucide="calendar-x"></i><span>Tidak ada jadwal perkuliahan hari ini</span></div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }
  container.innerHTML = jadwal.map(j => `
    <div class="fintech-trans-item" onclick="navigateTo('jadwal')">
      <div class="trans-icon-box" style="background:${j.color ? j.color + '18' : 'rgba(37,99,235,0.12)'}; color:${j.color || '#2563eb'};">
        <i data-lucide="book-open"></i>
      </div>
      <div class="trans-main-info">
        <div class="trans-item-title">${j.matkul}</div>
        <div class="trans-item-sub">${j.ruangan || 'Ruangan -'} • ${j.dosen || 'Dosen -'}</div>
      </div>
      <div class="trans-right-col">
        <span class="trans-badge blue">${j.jamMulai}</span>
        <span class="trans-date-sub">s/d ${j.jamSelesai}</span>
      </div>
    </div>
  `).join('');
  lucide.createIcons({ nodes: [container] });
}

function renderHomeUpcomingAgenda() {
  const container = document.getElementById('upcomingAgendaList');
  const countBadge = document.getElementById('upcomingAgendaCount');
  if (!container) return;

  const events = Store.getEvents();
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Hitung H- untuk setiap event dari Kalender
  const computedEvents = events.map(e => {
    if (!e.tanggal) return null;
    const parts = e.tanggal.split('-');
    if (parts.length < 3) return null;
    const evDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
    const diffDays = Math.round((evDate - todayMidnight) / (1000 * 60 * 60 * 24));
    return { ...e, diffDays, evDate };
  }).filter(Boolean);

  // Filter agenda hari ini & mendatang (diffDays >= 0), urutkan dari yang paling dekat
  const upcoming = computedEvents
    .filter(e => e.diffDays >= 0)
    .sort((a, b) => a.diffDays - b.diffDays || (a.jamMulai || '').localeCompare(b.jamMulai || ''));

  if (countBadge) countBadge.textContent = upcoming.length;

  if (!upcoming.length) {
    container.innerHTML = `
      <div class="agenda-empty-card" onclick="openAddEventModal()">
        <div class="agenda-empty-icon"><i data-lucide="calendar-plus"></i></div>
        <div class="agenda-empty-info">
          <div class="agenda-empty-title">Belum Ada Agenda Mendatang</div>
          <div class="agenda-empty-sub">Tap untuk menambah jadwal kegiatan / ujian ke Kalender</div>
        </div>
        <button class="agenda-empty-btn"><i data-lucide="plus"></i> Tambah</button>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  // Tampilkan maksimal 4 agenda terdekat di Home screen
  const displayItems = upcoming.slice(0, 4);

  container.innerHTML = displayItems.map(e => {
    let badgeLabel = '';
    let badgeClass = '';
    let isToday = false;

    if (e.diffDays === 0) {
      badgeLabel = 'Hari Ini!';
      badgeClass = 'badge-h-today';
      isToday = true;
    } else if (e.diffDays === 1) {
      badgeLabel = 'H-1 Besok';
      badgeClass = 'badge-h-tomorrow';
    } else if (e.diffDays <= 3) {
      badgeLabel = `H-${e.diffDays}`;
      badgeClass = 'badge-h-urgent';
    } else {
      badgeLabel = `H-${e.diffDays}`;
      badgeClass = 'badge-h-normal';
    }

    const d = new Date(e.tanggal + 'T12:00:00');
    const dateFormatted = d.toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short'
    });

    const timeStr = e.jamMulai ? `${e.jamMulai}${e.jamSelesai ? ' - ' + e.jamSelesai : ''}` : '';

    return `
      <div class="agenda-home-item" onclick="openEventFromHome('${e.id}', '${e.tanggal}')">
        <div class="agenda-color-bar" style="background:${e.color || '#2563eb'};"></div>
        <div class="agenda-main-content">
          <div class="agenda-header-line">
            <h4 class="agenda-title">${e.nama}</h4>
            <div class="agenda-countdown-pill ${badgeClass}">
              ${isToday ? '<span class="agenda-pulse-dot"></span>' : ''}
              ${badgeLabel}
            </div>
          </div>
          <div class="agenda-details-row">
            <span class="agenda-meta-item">
              <i data-lucide="calendar"></i> ${dateFormatted}
            </span>
            ${timeStr ? `
              <span class="agenda-meta-item">
                <i data-lucide="clock"></i> ${timeStr}
              </span>
            ` : ''}
            ${e.lokasi ? `
              <span class="agenda-meta-item">
                <i data-lucide="map-pin"></i> ${e.lokasi}
              </span>
            ` : ''}
          </div>
          ${e.deskripsi ? `<p class="agenda-desc-snippet">${e.deskripsi}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

function openAddEventModal() {
  if (typeof resetEventForm === 'function') resetEventForm();
  const dInput = document.getElementById('eventTanggal');
  if (dInput) dInput.value = new Date().toISOString().slice(0, 10);
  openModal('modalEvent');
}

function openEventFromHome(eventId, eventDate) {
  navigateTo('kalender');
  if (typeof selectCalDay === 'function' && eventDate) {
    selectCalDay(eventDate);
  }
}

function renderHomeDeadlines() {
  const now = new Date();
  const tugas = Store.getTugas()
    .filter(t => !t.done && t.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);
  const container = document.getElementById('upcomingDeadlineList');
  if (!container) return;

  if (!tugas.length) {
    container.innerHTML = `<div class="empty-compact"><i data-lucide="check-circle-2"></i><span>Semua tugas sudah selesai!</span></div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }
  container.innerHTML = tugas.map(t => {
    const badge = getDeadlineBadge(t.deadline);
    const d = new Date(t.deadline);
    const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `
      <div class="fintech-trans-item" onclick="navigateTo('tugas')">
        <div class="trans-icon-box" style="background:rgba(239,68,68,0.1); color:#ef4444;">
          <i data-lucide="clock"></i>
        </div>
        <div class="trans-main-info">
          <div class="trans-item-title">${t.nama}</div>
          <div class="trans-item-sub">${t.matkul || 'Tugas Kuliah'}</div>
        </div>
        <div class="trans-right-col">
          <span class="trans-badge ${badge.cls}">${badge.label}</span>
          <span class="trans-date-sub">${dateFormatted}</span>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons({ nodes: [container] });
}

function renderHomeFinance() {
  const now = new Date();
  const transaksi = Store.getTransaksi().filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = transaksi.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0);
  const expense = transaksi.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0);
  const incEl = document.getElementById('homeIncome');
  if (incEl) incEl.textContent = formatRupiah(income);
  const expEl = document.getElementById('homeExpense');
  if (expEl) expEl.textContent = formatRupiah(expense);
}

function renderHomeNotes() {
  const catatan = Store.getCatatan().slice(0, 3);
  const container = document.getElementById('homeNotesList');
  if (!container) return;
  if (!catatan.length) {
    container.innerHTML = `<p class="empty-mini-note">Belum ada catatan baru</p>`;
    return;
  }
  container.innerHTML = catatan.map(c => `
    <div style="margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:4px;">
      <strong style="color:var(--text-primary);font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.judul || 'Tanpa Judul'}</strong>
      <span style="color:var(--text-secondary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${c.isi?.slice(0, 32) || ''}...</span>
    </div>
  `).join('');
}

// ---- App Init ----
// ---- Theme Management (Mode Terang & Mode Malam) ----
function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);

  const bannerIcon = document.getElementById('bannerThemeIcon');
  if (bannerIcon) bannerIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');

  const headerIcon = document.getElementById('headerThemeIcon');
  if (headerIcon) headerIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');

  const drawerIcon = document.getElementById('drawerThemeIcon');
  if (drawerIcon) drawerIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');

  const drawerLabel = document.getElementById('drawerThemeLabel');
  if (drawerLabel) drawerLabel.textContent = isDark ? 'Mode Terang' : 'Mode Malam';

  const toggleSwitch = document.getElementById('darkModeToggle');
  if (toggleSwitch) toggleSwitch.checked = isDark;

  // Refresh lucide icons on theme toggle buttons
  const themeNodes = document.querySelectorAll('.theme-toggle-btn, #drawerThemeBtn');
  themeNodes.forEach(node => lucide.createIcons({ nodes: [node] }));

  // Update meta theme-color for browser status bar (iOS / Android)
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#071330' : '#0a2265');
  }
}

function toggleTheme() {
  const profil = Store.getProfil();
  const nextIsDark = !document.body.classList.contains('dark-mode');
  profil.darkMode = nextIsDark;
  Store.setProfil(profil);
  applyTheme(nextIsDark);
  showToast(nextIsDark ? '🌙 Mode Malam diaktifkan' : '☀️ Mode Terang diaktifkan', 'info', 2000);
}
window.toggleTheme = toggleTheme;

// ---- App Init ----
function initApp() {
  const profil = Store.getProfil();
  // Apply saved theme (default is light mode / false)
  applyTheme(profil.darkMode === true);

  // Update profil form
  document.getElementById('profileNameInput').value = profil.name || '';
  document.getElementById('profileUnivInput').value = profil.univ || '';
  document.getElementById('profileJurusanInput').value = profil.jurusan || '';
  document.getElementById('profileSemesterInput').value = profil.semester || '';
  document.getElementById('profileApiKey').value = profil.apiKey || '';
  document.getElementById('darkModeToggle').checked = profil.darkMode === true;
  document.getElementById('notifToggle').checked = profil.notif !== false;
  document.getElementById('profilName').textContent = profil.name || 'Nama Kamu';
  
  // Set avatar initial safely
  const profilAvatarEl = document.getElementById('profilAvatar');
  if (profilAvatarEl) {
    profilAvatarEl.innerHTML = `<span id="profilAvatarInitial">${(profil.name?.[0] || 'A').toUpperCase()}</span>`;
  }
  const profilSubEl = document.getElementById('profilUniv');
  if (profilSubEl) {
    const sub = [profil.univ, profil.jurusan].filter(Boolean).join(' · ') || 'Universitas / Jurusan';
    profilSubEl.textContent = sub;
  }

  // AI: check API key
  checkApiKeyStatus();

  // Render home
  renderHome();

  // Nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Center FAB button (+) -> Open Quick Action Sheet
  const centerBtn = document.getElementById('centerActionBtn');
  if (centerBtn) {
    centerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('modalQuickAction');
    });
  }

  // Quick theme toggles (Banner, Header, Drawer, Setting switch)
  const bannerThemeBtn = document.getElementById('bannerThemeBtn');
  if (bannerThemeBtn) bannerThemeBtn.addEventListener('click', toggleTheme);

  const headerThemeBtn = document.getElementById('headerThemeBtn');
  if (headerThemeBtn) headerThemeBtn.addEventListener('click', toggleTheme);

  const drawerThemeBtn = document.getElementById('drawerThemeBtn');
  if (drawerThemeBtn) {
    drawerThemeBtn.addEventListener('click', () => {
      toggleTheme();
      closeDrawer();
    });
  }

  // Setting switch in Profil
  document.getElementById('darkModeToggle').addEventListener('change', (e) => {
    const p = Store.getProfil();
    p.darkMode = e.target.checked;
    Store.setProfil(p);
    applyTheme(p.darkMode);
    showToast(p.darkMode ? '🌙 Mode Malam diaktifkan' : '☀️ Mode Terang diaktifkan', 'info', 2000);
  });

  // Search Input in Home Canvas
  const homeSearchInput = document.getElementById('homeSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  if (homeSearchInput) {
    homeSearchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('hidden', !q);
      }
      filterHomeContent(q);
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (homeSearchInput) {
        homeSearchInput.value = '';
        searchClearBtn.classList.add('hidden');
        filterHomeContent('');
        homeSearchInput.focus();
      }
    });
  }

  // Menu button & Drawer controls
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', openDrawer);

  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);

  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  // Header Avatar -> Profil
  const headerAvatar = document.getElementById('headerAvatar');
  if (headerAvatar) headerAvatar.addEventListener('click', () => navigateTo('profil'));

  // Project Style & Icon Picker
  document.querySelectorAll('#projStylePicker .style-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => setProjectStyleSelection(btn.dataset.style));
  });
  document.querySelectorAll('#projIconPicker .icon-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => setProjectIconSelection(btn.dataset.icon));
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close, .btn-secondary[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal || btn.closest('.modal').id));
  });
  document.getElementById('modalBackdrop').addEventListener('click', () => {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
  });

  // Save Profil
  document.getElementById('saveProfilBtn').addEventListener('click', saveProfil);

  // Toggle API Key visibility
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('profileApiKey');
    const icon = document.getElementById('toggleApiKey').querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons({ nodes: [document.getElementById('toggleApiKey')] });
  });

  // Clear Data
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('Yakin ingin menghapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
      Store.clearAll();
      showToast('Semua data berhasil dihapus', 'success');
      location.reload();
    }
  });

  // Init Lucide Icons
  lucide.createIcons();
}

function saveProfil() {
  const profil = {
    name: document.getElementById('profileNameInput').value.trim(),
    univ: document.getElementById('profileUnivInput').value.trim(),
    jurusan: document.getElementById('profileJurusanInput').value.trim(),
    semester: document.getElementById('profileSemesterInput').value.trim(),
    apiKey: document.getElementById('profileApiKey').value.trim(),
    darkMode: document.getElementById('darkModeToggle').checked,
    notif: document.getElementById('notifToggle').checked
  };
  Store.setProfil(profil);
  document.getElementById('profilName').textContent = profil.name || 'Nama Kamu';
  document.getElementById('profilAvatarInitial').textContent = (profil.name?.[0] || 'A').toUpperCase();
  document.getElementById('avatarInitial').textContent = (profil.name?.[0] || 'M').toUpperCase();
  const sub = [profil.univ, profil.jurusan].filter(Boolean).join(' · ') || 'Universitas / Jurusan';
  const profilUnivEl = document.getElementById('profilUniv');
  if (profilUnivEl) profilUnivEl.textContent = sub;
  document.getElementById('headerAvatar').textContent = (profil.name?.[0] || 'M').toUpperCase();

  const drawerAvatar = document.getElementById('drawerAvatar');
  if (drawerAvatar) drawerAvatar.textContent = (profil.name?.[0] || 'M').toUpperCase();
  const drawerUserName = document.getElementById('drawerUserName');
  if (drawerUserName) drawerUserName.textContent = profil.name || 'Nama Kamu';
  const drawerUserUniv = document.getElementById('drawerUserUniv');
  if (drawerUserUniv) drawerUserUniv.textContent = sub;

  document.body.classList.toggle('light-mode', !profil.darkMode);
  checkApiKeyStatus();
  showToast('✅ Profil berhasil disimpan!', 'success');
}

// ---- Splash -> App ----
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splash-screen').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash-screen').style.display = 'none';
      document.getElementById('main-app').classList.remove('hidden');
      initApp();
      lucide.createIcons();
    }, 600);
  }, 1800);
});
