// ===========================
// STORAGE MODULE
// ===========================
const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem(key); },

  // Specific getters/setters
  getJadwal() { return this.get('mylife_jadwal', []); },
  setJadwal(d) { this.set('mylife_jadwal', d); },

  getTugas() { return this.get('mylife_tugas', []); },
  setTugas(d) { this.set('mylife_tugas', d); },

  getCatatan() { return this.get('mylife_catatan', []); },
  setCatatan(d) { this.set('mylife_catatan', d); },

  getTransaksi() { return this.get('mylife_transaksi', []); },
  setTransaksi(d) { this.set('mylife_transaksi', d); },

  getEvents() { return this.get('mylife_events', []); },
  setEvents(d) { this.set('mylife_events', d); },

  getProjects() {
    return this.get('mylife_projects', [
      { id: 'p1', title: 'Mobile App', sub: 'E-commerce', date: 'May 30, 2022', progress: 56, icon: 'smartphone', type: 'navy' },
      { id: 'p2', title: 'Dashboard', sub: 'Home', date: 'May 30, 2022', progress: 46, icon: 'layout', type: 'light', iconClass: 'blue-box' },
      { id: 'p3', title: 'Banner', sub: 'Marketing', date: 'May 30, 2022', progress: 87, icon: 'megaphone', type: 'light', iconClass: 'red-box' },
      { id: 'p4', title: 'UI/UX', sub: 'Design', date: 'May 30, 2022', progress: 24, icon: 'box', type: 'light', iconClass: 'purple-box' }
    ]);
  },
  setProjects(d) { this.set('mylife_projects', d); },

  getProfil() {
    return this.get('mylife_profil', {
      name: 'Hafiz', univ: '', jurusan: '', semester: '',
      apiKey: '', darkMode: false, notif: true
    });
  },
  setProfil(d) { this.set('mylife_profil', d); },

  getApiKey() {
    const p = this.getProfil();
    return p.apiKey || '';
  },

  clearAll() {
    const keys = ['mylife_jadwal','mylife_tugas','mylife_catatan','mylife_transaksi','mylife_events','mylife_profil','mylife_seeded'];
    keys.forEach(k => localStorage.removeItem(k));
  },

  initSeedData() {
    // Clear dummy data for user so they can input their own real data
    if (!localStorage.getItem('mylife_user_clean_v1')) {
      this.setJadwal([]);
      this.setTugas([]);
      this.setCatatan([]);
      this.setTransaksi([]);
      this.setProjects([]);
      this.set('mylife_user_clean_v1', true);
    }
  }
};

// Initialize clean state
Store.initSeedData();
