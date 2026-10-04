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
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state notif-empty-state">
        <div class="notif-empty-icon-wrap">
          <i data-lucide="bell-off"></i>
        </div>
        <h4>Tidak Ada Pemberitahuan</h4>
        <p>${notifActiveFilter === 'unread' ? 'Semua pemberitahuan sudah Anda baca.' : 'Belum ada agenda atau tugas yang mendesak saat ini.'}</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = filtered.map(n => {
    const unreadDot = !n.read ? '<span class="notif-card-unread-dot"></span>' : '';
    const readClass = n.read ? 'is-read' : 'is-unread';

    return `
      <div class="notif-card ${readClass} notif-${n.type}" onclick="handleNotifClick('${n.id}', '${n.targetPage}', '${n.targetDate || ''}')">
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
            <span class="notif-action-hint">Ketuk untuk membuka halaman ${n.targetPage} →</span>
            <span class="notif-time-sub">${n.timeStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

// Handler saat notifikasi di-klik
function handleNotifClick(notifId, targetPage, targetDate) {
  // Tandai sebagai dibaca
  const readIds = getReadNotifIds();
  if (!readIds.includes(notifId)) {
    readIds.push(notifId);
    saveReadNotifIds(readIds);
  }

  // Bunyikan pop feedback
  if (typeof playPopSound === 'function') playPopSound('pop');

  // Navigasi ke halaman tujuan
  if (targetPage) {
    navigateTo(targetPage);
    if (targetPage === 'kalender' && targetDate && typeof selectCalDay === 'function') {
      selectCalDay(targetDate);
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
