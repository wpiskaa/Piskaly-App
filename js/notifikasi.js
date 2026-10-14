// ==========================================
// NOTIFIKASI.JS - NOTIFICATION SYSTEM & PAGE
// ==========================================

let notifActiveFilter = 'all';

// Ambil ID notifikasi yang sudah dibaca oleh user
function getReadNotifIds() {
  return Store.get('mylife_read_notifs', []);
}

function saveReadNotifIds(ids) {
  Store.set('mylife_read_notifs', ids);
  updateNotifBadge();
}

// Kompilasi notifikasi pintar berbasis data terkini (Tugas, Jadwal, Kalender, Cloud)
function generateAllNotifications() {
  const notifications = [];
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const readIds = getReadNotifIds();

  // 1. Notifikasi Deadline Tugas
  const tugasList = Store.getTugas().filter(t => !t.done && t.deadline);
  tugasList.forEach(t => {
    const parts = t.deadline.split('-');
    if (parts.length < 3) return;
    const dlDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
    const diffDays = Math.round((dlDate - todayMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      notifications.push({
        id: `tugas-today-${t.id}`,
        category: 'tasks',
        type: 'urgent',
        icon: 'alert-circle',
        title: 'Deadline Tugas Hari Ini!',
        message: `Tugas "${t.nama}" (${t.matkul || 'Kuliah'}) batas pengumpulannya hari ini. Segera selesaikan!`,
        timeStr: 'Hari Ini',
        badge: 'H-0 Urgent',
        targetPage: 'tugas',
        read: readIds.includes(`tugas-today-${t.id}`)
      });
    } else if (diffDays === 1) {
      notifications.push({
        id: `tugas-tmrw-${t.id}`,
        category: 'tasks',
        type: 'warning',
        icon: 'clock',
        title: 'Deadline Tugas Besok!',
        message: `Tugas "${t.nama}" (${t.matkul || 'Kuliah'}) harus dikumpulkan besok.`,
        timeStr: 'Besok',
        badge: 'H-1 Besok',
        targetPage: 'tugas',
        read: readIds.includes(`tugas-tmrw-${t.id}`)
      });
    } else if (diffDays > 1 && diffDays <= 3) {
      notifications.push({
        id: `tugas-soon-${t.id}`,
        category: 'tasks',
        type: 'warning',
        icon: 'clock',
        title: 'Deadline Mendekat',
        message: `Tugas "${t.nama}" deadline dalam ${diffDays} hari lagi.`,
        timeStr: `${diffDays} hari lagi`,
        badge: `H-${diffDays}`,
        targetPage: 'tugas',
        read: readIds.includes(`tugas-soon-${t.id}`)
      });
    }
  });

  // 2. Notifikasi Jadwal Kuliah Hari Ini
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = days[now.getDay()];
  const todayJadwal = Store.getJadwal().filter(j => j.hari === todayName);
  if (todayJadwal.length > 0) {
    todayJadwal.forEach(j => {
      notifications.push({
        id: `jadwal-today-${j.id}-${todayName}`,
        category: 'academic',
        type: 'info',
        icon: 'book-open',
        title: `Kuliah Hari Ini: ${j.matkul}`,
        message: `Mata kuliah dimulai pukul ${j.jamMulai} s/d ${j.jamSelesai}${j.ruangan ? ` di ${j.ruangan}` : ''}${j.dosen ? ` bersama ${j.dosen}` : ''}.`,
        timeStr: `${j.jamMulai} WIB`,
        badge: 'Jadwal Hari Ini',
        targetPage: 'jadwal',
        read: readIds.includes(`jadwal-today-${j.id}-${todayName}`)
      });
    });
  }

  // 3. Notifikasi Agenda & Kegiatan Mendatang (Kalender)
  const events = Store.getEvents();
  events.forEach(e => {
    if (!e.tanggal) return;
    const parts = e.tanggal.split('-');
    if (parts.length < 3) return;
    const evDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
    const diffDays = Math.round((evDate - todayMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      notifications.push({
        id: `event-today-${e.id}`,
        category: 'academic',
        type: 'urgent',
        icon: 'calendar-check',
        title: `Kegiatan Hari Ini: ${e.nama}`,
        message: `Agenda "${e.nama}" dijadwalkan berlangsung hari ini${e.lokasi ? ` di ${e.lokasi}` : ''}.`,
        timeStr: 'Hari Ini',
        badge: 'Hari Ini!',
        targetPage: 'kalender',
        targetDate: e.tanggal,
        read: readIds.includes(`event-today-${e.id}`)
      });
    } else if (diffDays > 0 && diffDays <= 5) {
      notifications.push({
        id: `event-soon-${e.id}`,
        category: 'academic',
        type: 'info',
        icon: 'calendar',
        title: `Agenda Mendatang: ${e.nama}`,
        message: `Kegiatan "${e.nama}" akan berlangsung ${diffDays === 1 ? 'besok' : `dalam ${diffDays} hari`} (${e.tanggal})${e.lokasi ? ` di ${e.lokasi}` : ''}.`,
        timeStr: diffDays === 1 ? 'Besok' : `H-${diffDays}`,
        badge: `H-${diffDays}`,
        targetPage: 'kalender',
        targetDate: e.tanggal,
        read: readIds.includes(`event-soon-${e.id}`)
      });
    }
  });

  // 3b. Notifikasi Keuangan: tenggat target tabungan, jatuh tempo hutang, anggaran
  try {
    const goals = (typeof Store !== 'undefined' && Store.getGoals) ? Store.getGoals() : [];
    goals.forEach(g => {
      if (!g.deadline) return;
      const saved = (g.history || []).reduce((s, h) => s + (h.type === 'in' ? h.jumlah : -h.jumlah), 0);
      if (saved >= g.target) return;
      const d = typeof finDaysUntil === 'function' ? finDaysUntil(g.deadline) : null;
      if (d === null || d > 7) return;
      const sisa = g.target - saved;
      const nid = `goal-${g.id}-${d < 0 ? 'late' : d}`;
      notifications.push({
        id: nid,
        category: 'finance',
        type: d <= 1 ? 'urgent' : 'warning',
        icon: 'piggy-bank',
        title: d < 0 ? `Tenggat Tabungan Lewat: ${g.nama}` : `Target Tabungan Mendekat: ${g.nama}`,
        message: `Masih kurang ${formatRupiahFull(sisa)} untuk target "${g.nama}"${d >= 0 ? ` (${d === 0 ? 'tenggat hari ini' : `${d} hari lagi`})` : ''}.`,
        timeStr: d < 0 ? 'Terlewat' : d === 0 ? 'Hari Ini' : `H-${d}`,
        badge: 'Tabungan',
        targetPage: 'keuangan',
        targetSubTab: 'tabungan',
        read: readIds.includes(nid)
      });
    });

    const debts = (typeof Store !== 'undefined' && Store.getDebts) ? Store.getDebts() : [];
    debts.forEach(db => {
      if (!db.jatuhTempo) return;
      const paid = (db.payments || []).reduce((s, p) => s + p.jumlah, 0);
      const sisa = Math.max(db.jumlah - paid, 0);
      if (sisa <= 0) return;
      const d = typeof finDaysUntil === 'function' ? finDaysUntil(db.jatuhTempo) : null;
      if (d === null || d > 7) return;
      const owe = db.tipe === 'hutang';
      const nid = `debt-${db.id}-${d < 0 ? 'late' : d}`;
      notifications.push({
        id: nid,
        category: 'finance',
        type: d <= 0 ? 'urgent' : 'warning',
        icon: 'handshake',
        title: owe ? `Jatuh Tempo Hutang: ${db.nama}` : `Tagih Piutang: ${db.nama}`,
        message: `${owe ? 'Bayar' : 'Tagih'} ${formatRupiahFull(sisa)} ${d < 0 ? `(terlambat ${-d} hari)` : d === 0 ? 'hari ini' : `dalam ${d} hari`}.`,
        timeStr: d < 0 ? 'Terlambat' : d === 0 ? 'Hari Ini' : `H-${d}`,
        badge: owe ? 'Hutang' : 'Piutang',
        targetPage: 'keuangan',
        targetSubTab: 'hutang',
        read: readIds.includes(nid)
      });
    });

    if (typeof getMonthExpenseByCategory === 'function') {
      const spentMap = getMonthExpenseByCategory();
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const budgets = (typeof Store !== 'undefined' && Store.getBudgets) ? Store.getBudgets() : [];
      budgets.forEach(b => {
        const pct = b.limit > 0 ? ((spentMap[b.kategori] || 0) / b.limit) * 100 : 0;
        if (pct < 90) return;
        const over = pct >= 100;
        const nid = `budget-${b.id}-${monthKey}-${over ? 'over' : 'near'}`;
        notifications.push({
          id: nid,
          category: 'finance',
          type: over ? 'urgent' : 'warning',
          icon: 'gauge',
          title: over ? `Anggaran ${b.kategori} Terlampaui` : `Anggaran ${b.kategori} Hampir Habis`,
          message: `Pengeluaran ${b.kategori} bulan ini sudah ${pct.toFixed(0)}% dari batas ${formatRupiahFull(b.limit)}.`,
          timeStr: 'Bulan Ini',
          badge: over ? 'Melebihi' : `${pct.toFixed(0)}%`,
          targetPage: 'keuangan',
          targetSubTab: 'anggaran',
          read: readIds.includes(nid)
        });
      });
    }
  } catch (err) {
    console.error('Error generating finance notifications:', err);
  }

  // 4. Notifikasi Status Cloud Sync
  notifications.push({
    id: 'system-cloud-sync-status',
    category: 'system',
    type: 'success',
    icon: 'cloud-check',
    title: 'Cloud Database Terhubung',
    message: 'Data Anda otomatis disinkronkan ke Cloud Firestore dan siap diakses dari iPhone, iPad, dan Laptop.',
    timeStr: 'Sistem',
    badge: 'Live',
    targetPage: 'profil',
    read: readIds.includes('system-cloud-sync-status')
  });

  // 5. Dynamic In-App Notifications: Briefing, Mood, Weekly Recap, Piskaly Wrapped
  try {
    const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : now.toISOString().split('T')[0];

    // a. Ringkasan Harimu (Akses cepat kapan saja tanpa simpan static di home/drawer)
    notifications.push({
      id: `briefing-${todayStr}`,
      category: 'academic',
      type: 'info',
      icon: 'sun',
      title: '☀️ Ringkasan Harimu',
      message: 'Lihat jadwal kuliah, agenda kegiatan, dan tugas penting yang harus diselesaikan hari ini.',
      timeStr: 'Hari Ini',
      badge: 'Briefing',
      targetPage: 'action:morning-briefing',
      read: readIds.includes(`briefing-${todayStr}`)
    });

    // b. Mood & Energy Check-in (Hanya muncul jika belum dicatat hari ini)
    if (typeof Store !== 'undefined' && Store.getTodayMood && !Store.getTodayMood()) {
      notifications.push({
        id: `mood-${todayStr}`,
        category: 'academic',
        type: 'info',
        icon: 'sparkles',
        title: 'Bagaimana Mood & Energimu Hari Ini?',
        message: 'Catat energimu hari ini dalam 1-ketukan untuk mengisi jurnal mingguan.',
        timeStr: 'Pagi Ini',
        badge: 'Check-in',
        targetPage: 'action:mood-check',
        read: readIds.includes(`mood-${todayStr}`)
      });
    }

    // c. Weekend Recap (Muncul otomatis di akhir pekan: Sabtu & Minggu)
    if (now.getDay() === 0 || now.getDay() === 6) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dNum);
      const yStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const wNum = Math.ceil((((d - yStart) / 86400000) + 1) / 7);
      const weekKey = `${now.getFullYear()}-W${wNum}`;

      notifications.push({
        id: `recap-${weekKey}`,
        category: 'academic',
        type: 'success',
        icon: 'flame',
        title: '📊 Rangkuman Mingguanmu Sudah Siap!',
        message: 'Waktunya refleksi & flexing! Lihat pencapaian tugas, mood dominan, dan salin teks story.',
        timeStr: 'Akhir Pekan',
        badge: 'Recap',
        targetPage: 'action:weekly-recap',
        read: readIds.includes(`recap-${weekKey}`)
      });
    }

    // d. Piskaly Wrapped (Muncul otomatis saat akhir bulan tanggal >= 25)
    if (now.getDate() >= 25) {
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      notifications.push({
        id: `wrapped-${monthKey}`,
        category: 'academic',
        type: 'urgent',
        icon: 'sparkles',
        title: '✨ Piskaly Wrapped Bulan Ini Siap!',
        message: 'Putar story interaktif ala Spotify dan temukan archetype kepribadianmu bulan ini!',
        timeStr: 'Spesial',
        badge: 'Wrapped',
        targetPage: 'action:wrapped',
        read: readIds.includes(`wrapped-${monthKey}`)
      });
    }
  } catch (err) {
    console.error('Error adding dynamic periodic notifications:', err);
  }

  return notifications;
}

// Perbarui angka badge merah di ikon lonceng header
function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const notifs = generateAllNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;

  badge.textContent = unreadCount;
  if (unreadCount > 0) {
    badge.classList.remove('hidden');
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  const unreadPill = document.getElementById('notifUnreadPill');
  if (unreadPill) {
    unreadPill.textContent = `${unreadCount} Belum Dibaca`;
    unreadPill.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
  }

  const drawerBadge = document.getElementById('drawerNotifBadge');
  if (drawerBadge) {
    drawerBadge.textContent = unreadCount;
    drawerBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }
}

// Render Halaman Notifikasi Lengkap
function renderNotifikasi() {
  const container = document.getElementById('notifikasiList');
  if (!container) return;

  const allNotifs = generateAllNotifications();
  updateNotifBadge();

  // Filter berdasarkan tab yang dipilih
  let filtered = allNotifs;
  if (notifActiveFilter === 'unread') {
    filtered = allNotifs.filter(n => !n.read);
  } else if (notifActiveFilter === 'academic') {
    filtered = allNotifs.filter(n => n.category === 'academic');
  } else if (notifActiveFilter === 'tasks') {
    filtered = allNotifs.filter(n => n.category === 'tasks');
  } else if (notifActiveFilter === 'finance') {
    filtered = allNotifs.filter(n => n.category === 'finance');
  }

  if (!filtered.length) {
    let emptyMsg = 'Belum ada agenda atau tugas yang mendesak saat ini.';
    if (notifActiveFilter === 'unread') emptyMsg = 'Semua pemberitahuan sudah Anda baca.';
    else if (notifActiveFilter === 'finance') emptyMsg = 'Target tabungan, anggaran, dan hutang piutang masih dalam batas aman.';
    else if (notifActiveFilter === 'academic') emptyMsg = 'Tidak ada jadwal kuliah atau kegiatan mendesak.';
    else if (notifActiveFilter === 'tasks') emptyMsg = 'Tidak ada tugas yang mendekati tenggat waktu.';

    container.innerHTML = `
      <div class="empty-state notif-empty-state">
        <div class="notif-empty-icon-wrap">
          <i data-lucide="bell-off"></i>
        </div>
        <h4>Tidak Ada Pemberitahuan</h4>
        <p>${emptyMsg}</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = filtered.map(n => {
    const unreadDot = !n.read ? '<span class="notif-card-unread-dot"></span>' : '';
    const readClass = n.read ? 'is-read' : 'is-unread';

    return `
      <div class="notif-card ${readClass} notif-${n.type}" onclick="handleNotifClick('${n.id}', '${n.targetPage}', '${n.targetDate || ''}', '${n.targetSubTab || ''}')">
        <div class="notif-icon-col">
          <div class="notif-icon-box ${n.type}">
            <i data-lucide="${n.icon}"></i>
          </div>
        </div>
        <div class="notif-content-col">
          <div class="notif-top-row">
            <h4 class="notif-card-title">${n.title}</h4>
            <div class="notif-meta-wrap">
              <span class="notif-time-badge ${n.type}">${n.badge}</span>
              ${unreadDot}
            </div>
          </div>
          <p class="notif-card-desc">${n.message}</p>
          <div class="notif-bottom-row">
            <span class="notif-action-hint">${
              n.targetPage === 'action:morning-briefing' ? 'Ketuk untuk lihat ringkasan hari ini →' :
              n.targetPage === 'action:mood-check' ? 'Ketuk untuk isi mood hari ini →' :
              n.targetPage === 'action:weekly-recap' ? 'Ketuk untuk tonton recap & flexing →' :
              n.targetPage === 'action:wrapped' ? 'Ketuk untuk putar Piskaly Wrapped →' :
              `Ketuk untuk membuka ${n.targetPage} →`
            }</span>
            <span class="notif-time-sub">${n.timeStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

// Handler saat notifikasi di-klik
function handleNotifClick(notifId, targetPage, targetDate, targetSubTab) {
  // Tandai sebagai dibaca
  const readIds = getReadNotifIds();
  if (!readIds.includes(notifId)) {
    readIds.push(notifId);
    saveReadNotifIds(readIds);
  }

  // Bunyikan pop feedback
  if (typeof playPopSound === 'function') playPopSound('pop');

  // Navigasi ke halaman tujuan atau buka aksi modal dinamis
  if (targetPage) {
    if (targetPage.startsWith('action:')) {
      if (targetPage === 'action:morning-briefing' && typeof openMorningBriefing === 'function') {
        openMorningBriefing(true);
      } else if (targetPage === 'action:mood-check' && typeof openMoodModal === 'function') {
        openMoodModal();
      } else if (targetPage === 'action:weekly-recap' && typeof openWeeklyRecap === 'function') {
        openWeeklyRecap();
      } else if (targetPage === 'action:wrapped' && typeof openPiskalyWrapped === 'function') {
        openPiskalyWrapped();
      }
      renderNotifikasi();
      return;
    }

    navigateTo(targetPage);
    if (targetPage === 'kalender' && targetDate && typeof selectCalDay === 'function') {
      selectCalDay(targetDate);
    }
    if (targetPage === 'keuangan' && targetSubTab && typeof setFinTab === 'function') {
      setFinTab(targetSubTab);
    }
  } else {
    renderNotifikasi();
  }
}

// Tandai semua notifikasi sudah dibaca
function markAllNotificationsAsRead() {
  const allNotifs = generateAllNotifications();
  const allIds = allNotifs.map(n => n.id);
  saveReadNotifIds(allIds);
  renderNotifikasi();
  if (typeof showToast === 'function') {
    showToast('✅ Semua notifikasi ditandai sudah dibaca', 'success');
  }
}

// Bersihkan notifikasi
function clearAllNotifications() {
  markAllNotificationsAsRead();
  if (typeof showToast === 'function') {
    showToast('🗑️ Daftar notifikasi telah dibersihkan', 'info');
  }
}

// Filter tab handler
function setNotifFilter(filter) {
  notifActiveFilter = filter;
  document.querySelectorAll('.notif-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  renderNotifikasi();
}

// Inisialisasi event listener saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  updateNotifBadge();

  // Filter tabs di halaman notifikasi
  document.querySelectorAll('.notif-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setNotifFilter(tab.dataset.filter);
    });
  });
});
