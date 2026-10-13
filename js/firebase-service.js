// ==========================================
// FIREBASE DIRECT SYNC SERVICE (js/firebase-service.js)
// Sinkronisasi Langsung Otomatis Tanpa Perlu Login
// ==========================================

const FirebaseService = {
  app: null,
  db: null,
  isInitialized: false,
  unsubscribeSnapshot: null,
  syncTimeout: null,
  isSyncingFromCloud: false,

  // Inisialisasi Firebase & Cloud Firestore langsung
  init() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK belum termuat.');
      return false;
    }

    const config = getActiveFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.log('Firebase config belum diisi. Berjalan lokal.');
      this.updateUIStatus('unconfigured');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      // Aktifkan offline persistence agar PWA tetap cepat dan bekerja tanpa internet
      this.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore multi-tab persistence active');
        }
      });

      this.isInitialized = true;
      console.log('⚡ Firebase Direct Sync aktif di project:', config.projectId);
      this.updateUIStatus('connected');

      // Mulai sinkronisasi otomatis langsung (2-way live sync)
      this.startDirectSync();
      return true;
    } catch (err) {
      console.error('Inisialisasi Firebase error:', err);
      this.updateUIStatus('error');
      return false;
    }
  },

  // Referensi dokumen Firestore per User ID unik
  getUserDocRef() {
    if (!this.db) return null;
    const user = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null;
    if (!user || !user.id) return null;
    const safeId = encodeURIComponent(user.id.toLowerCase().trim());
    return this.db.collection('piskaly_users').doc(safeId);
  },

  // Sinkronisasi dua arah instan khusus akun aktif
  async startDirectSync() {
    if (!this.db) return;

    const docRef = this.getUserDocRef();
    if (!docRef) {
      console.log('⚡ Firebase Sync: menunggu user masuk/login.');
      return;
    }

    try {
      // 1. Ambil data awal dari cloud akun jika ada
      const doc = await docRef.get();
      if (doc.exists) {
        const cloudDoc = doc.data() || {};
        const cloudData = cloudDoc.data || cloudDoc;
        this.applyCloudDataToLocal(cloudData);
        console.log('☁️ Data cloud akun berhasil dimuat otomatis');
      } else {
        // Jika di cloud akun masih kosong, simpan data lokal saat ini
        await this.syncUploadAll(false);
        console.log('☁️ Data awal akun berhasil disimpan ke cloud');
      }

      // 2. Pasang realtime listener khusus user ini
      if (this.unsubscribeSnapshot) this.unsubscribeSnapshot();

      this.unsubscribeSnapshot = docRef.onSnapshot((snapshot) => {
        // Abaikan jika perubahan berasal dari ketikan lokal sendiri yang sedang dikirim
        if (snapshot.metadata.hasPendingWrites) return;

        if (snapshot.exists) {
          const cloudDoc = snapshot.data() || {};
          const cloudData = cloudDoc.data || cloudDoc;
          this.applyCloudDataToLocal(cloudData);
          this.updateUIStatus('connected');
        }
      }, (err) => {
        console.warn('Realtime listener notice:', err.message);
      });

    } catch (err) {
      console.error('Error saat sinkronisasi langsung user:', err);
      if (err.code === 'permission-denied') {
        showToast('⚠️ Izin Firestore belum diizinkan. Pastikan Rules diatur: allow read, write: if true;', 'warning');
      }
    }
  },

  // Terapkan data dari cloud ke Store aplikasi lokal
  applyCloudDataToLocal(data) {
    if (!data) return;
    this.isSyncingFromCloud = true;

    try {
      if (Array.isArray(data.jadwal)) Store.setJadwal(data.jadwal);
      if (Array.isArray(data.tugas)) Store.setTugas(data.tugas);
      if (Array.isArray(data.catatan)) Store.setCatatan(data.catatan);

      // Filter ketat data dummy keuangan
      let trans = Array.isArray(data.transaksi) ? data.transaksi : [];
      if (trans.some(t => t.keterangan === 'Uang Saku' || t.jumlah === 2000000 || t.jumlah === 150000)) trans = [];
      Store.setTransaksi(trans);

      let debts = Array.isArray(data.debts) ? data.debts : [];
      if (debts.some(d => d.nama === 'Andi' || d.nama === 'Budi')) debts = [];
      Store.setDebts(debts);

      let budgets = Array.isArray(data.budgets) ? data.budgets : [];
      if (budgets.some(b => b.kategori === 'Makan' && b.limit === 500000)) budgets = [];
      Store.setBudgets(budgets);

      if (Array.isArray(data.goals)) Store.setGoals(data.goals);
      if (Array.isArray(data.events)) Store.setEvents(data.events);

      let projs = Array.isArray(data.projects) ? data.projects : [];
      if (projs.some(p => p.id === 'p1' || p.title === 'Mobile App')) projs = [];
      Store.setProjects(projs);

      if (data.profil && typeof data.profil === 'object') {
        const p = Store.getProfil();
        Store.setProfil({ ...p, ...data.profil });
      }

      if (Array.isArray(data.pisku_messages)) Store.setAiMessages(data.pisku_messages);
      if (data.pisku_last_time) Store.setAiLastTime(data.pisku_last_time);

      // Refresh seluruh tampilan yang sedang aktif
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderJadwal === 'function') renderJadwal();
      if (typeof renderTugas === 'function') renderTugas();
      if (typeof renderCatatan === 'function') renderCatatan();
      if (typeof renderKeuangan === 'function') renderKeuangan();
      if (typeof renderKalender === 'function') renderKalender();
      if (typeof updateStats === 'function') updateStats();
    } finally {
      setTimeout(() => {
        this.isSyncingFromCloud = false;
      }, 500);
    }
  },

  // Unggah semua data lokal ke Cloud Firestore
  async syncUploadAll(notify = true) {
    if (!this.isInitialized || this.isSyncingFromCloud) return;

    const docRef = this.getUserDocRef();
    if (!docRef) return;

    const user = Store.getCurrentUser();
    const payload = {
      jadwal: Store.getJadwal(),
      tugas: Store.getTugas(),
      catatan: Store.getCatatan(),
      transaksi: Store.getTransaksi(),
      goals: Store.getGoals(),
      budgets: Store.getBudgets(),
      debts: Store.getDebts(),
      events: Store.getEvents(),
      projects: Store.getProjects(),
      profil: Store.getProfil(),
      read_notifs: Store.getReadNotifs(),
      pisku_messages: Store.getAiMessages(),
      pisku_last_time: Store.getAiLastTime(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await docRef.set({
        id: user ? user.id : 'unknown',
        name: user ? (user.name || user.id) : 'User',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        data: payload
      }, { merge: true });
      console.log('⚡ Data akun berhasil disimpan di Cloud Firestore');
      if (notify && typeof showToast === 'function') {
        showToast('☁️ Data tersinkron ke Cloud!', 'success', 2200);
      }
    } catch (err) {
      console.error('Gagal upload ke Firestore:', err);
      if (typeof showToast === 'function') {
        showToast('⚠️ Gagal sinkron Cloud: ' + err.message, 'error', 3000);
      }
    }
  },

  // Auto-sync debounced (otomatis dipanggil saat ada penambahan/edit data)
  queueSync() {
    if (!this.isInitialized || this.isSyncingFromCloud) return;
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncUploadAll();
    }, 1000);
  },

  // Bersihkan semua data agar mulai kosong total
  async clearAllDummyData() {
    if (!confirm('Kosongkan semua data agar siap diisi data pribadi Anda sendiri?')) {
      return;
    }

    Store.setJadwal([]);
    Store.setTugas([]);
    Store.setCatatan([]);
    Store.setTransaksi([]);
    Store.setGoals([]);
    Store.setBudgets([]);
    Store.setDebts([]);
    Store.setProjects([]);

    if (typeof renderHome === 'function') renderHome();
    if (typeof renderJadwal === 'function') renderJadwal();
    if (typeof renderTugas === 'function') renderTugas();
    if (typeof renderCatatan === 'function') renderCatatan();
    if (typeof renderKeuangan === 'function') renderKeuangan();
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof updateStats === 'function') updateStats();

    await this.syncUploadAll();
    showToast('✨ Semua data telah bersih! Siap diisi data Anda.', 'success');
  },

  // Perbarui indikator status di halaman Profil
  updateUIStatus(status) {
    const cardStatus = document.getElementById('firebaseStatusBadge');
    const userLabel = document.getElementById('firebaseUserLabel');

    if (!cardStatus) return;

    if (status === 'connected' || this.isInitialized) {
      cardStatus.className = 'fb-badge-mini connected';
      cardStatus.innerHTML = '<span class="fb-dot green"></span> Live';
      if (userLabel) {
        userLabel.textContent = 'Otomatis sinkron antar perangkat';
      }
    } else {
      cardStatus.className = 'fb-badge-mini ready';
      cardStatus.innerHTML = '<span class="fb-dot yellow"></span> Lokal';
      if (userLabel) {
        userLabel.textContent = 'Mode penyimpanan lokal';
      }
    }
  }
};

// Hook otomatis ke Store: setiap ada penambahan atau pengubahan data, langsung simpan ke Cloud!
document.addEventListener('DOMContentLoaded', () => {
  const originalSetJadwal = Store.setJadwal.bind(Store);
  Store.setJadwal = function(d) { originalSetJadwal(d); FirebaseService.queueSync(); };

  const originalSetTugas = Store.setTugas.bind(Store);
  Store.setTugas = function(d) { originalSetTugas(d); FirebaseService.queueSync(); };

  const originalSetCatatan = Store.setCatatan.bind(Store);
  Store.setCatatan = function(d) { originalSetCatatan(d); FirebaseService.queueSync(); };

  const originalSetTransaksi = Store.setTransaksi.bind(Store);
  Store.setTransaksi = function(d) { originalSetTransaksi(d); FirebaseService.queueSync(); };

  const originalSetGoals = Store.setGoals.bind(Store);
  Store.setGoals = function(d) { originalSetGoals(d); FirebaseService.queueSync(); };

  const originalSetBudgets = Store.setBudgets.bind(Store);
  Store.setBudgets = function(d) { originalSetBudgets(d); FirebaseService.queueSync(); };

  const originalSetDebts = Store.setDebts.bind(Store);
  Store.setDebts = function(d) { originalSetDebts(d); FirebaseService.queueSync(); };

  const originalSetEvents = Store.setEvents.bind(Store);
  Store.setEvents = function(d) { originalSetEvents(d); FirebaseService.queueSync(); };

  const originalSetProjects = Store.setProjects.bind(Store);
  Store.setProjects = function(d) { originalSetProjects(d); FirebaseService.queueSync(); };

  const originalSetProfil = Store.setProfil.bind(Store);
  Store.setProfil = function(d) { originalSetProfil(d); FirebaseService.queueSync(); };

  // Mulai sinkronisasi langsung seketika
  setTimeout(() => {
    FirebaseService.init();
  }, 100);
});

// UI Modal Helper untuk pengaturan jika ingin ganti project ID
function openFirebaseConfigModal() {
  const current = getActiveFirebaseConfig();
  document.getElementById('fbApiKey').value = current.apiKey || '';
  document.getElementById('fbAuthDomain').value = current.authDomain || '';
  document.getElementById('fbProjectId').value = current.projectId || '';
  document.getElementById('fbStorageBucket').value = current.storageBucket || '';
  document.getElementById('fbMessagingSenderId').value = current.messagingSenderId || '';
  document.getElementById('fbAppId').value = current.appId || '';
  document.getElementById('fbPasteRaw').value = '';
  openModal('modalFirebaseConfig');
}

function parseFirebaseConfigPaste() {
  const raw = document.getElementById('fbPasteRaw').value.trim();
  if (!raw) {
    showToast('Teks paste masih kosong!', 'error');
    return;
  }

  try {
    const extract = (prop) => {
      const match = raw.match(new RegExp(`${prop}\\s*:\\s*["']([^"']+)["']`, 'i'));
      return match ? match[1] : '';
    };

    const apiKey = extract('apiKey');
    const authDomain = extract('authDomain');
    const projectId = extract('projectId');
    const storageBucket = extract('storageBucket');
    const messagingSenderId = extract('messagingSenderId');
    const appId = extract('appId');

    if (apiKey) document.getElementById('fbApiKey').value = apiKey;
    if (authDomain) document.getElementById('fbAuthDomain').value = authDomain;
    if (projectId) document.getElementById('fbProjectId').value = projectId;
    if (storageBucket) document.getElementById('fbStorageBucket').value = storageBucket;
    if (messagingSenderId) document.getElementById('fbMessagingSenderId').value = messagingSenderId;
    if (appId) document.getElementById('fbAppId').value = appId;

    if (apiKey && projectId) {
      showToast('✅ Berhasil membaca konfigurasi Firebase!', 'success');
    }
  } catch (err) {
    showToast('Gagal memproses teks paste: ' + err.message, 'error');
  }
}

function saveFirebaseConfigFromModal() {
  const apiKey = document.getElementById('fbApiKey').value.trim();
  const projectId = document.getElementById('fbProjectId').value.trim();

  if (!apiKey || !projectId) {
    showToast('API Key dan Project ID wajib diisi!', 'error');
    return;
  }

  const configObj = {
    apiKey,
    authDomain: document.getElementById('fbAuthDomain').value.trim(),
    projectId,
    storageBucket: document.getElementById('fbStorageBucket').value.trim(),
    messagingSenderId: document.getElementById('fbMessagingSenderId').value.trim(),
    appId: document.getElementById('fbAppId').value.trim()
  };

  saveFirebaseConfigToStorage(configObj);
  closeModal('modalFirebaseConfig');
  showToast('✅ Konfigurasi tersimpan! Mengaktifkan sinkronisasi...', 'success');

  setTimeout(() => {
    FirebaseService.init();
  }, 300);
}
