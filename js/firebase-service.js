// ==========================================
// FIREBASE SERVICE (js/firebase-service.js)
// ==========================================

const FirebaseService = {
  app: null,
  auth: null,
  db: null,
  currentUser: null,
  isInitialized: false,
  unsubscribeSnapshot: null,
  syncTimeout: null,

  // Inisialisasi Firebase App, Auth, dan Firestore
  init() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK belum termuat.');
      return false;
    }

    const config = getActiveFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.log('Firebase config belum diisi. Aplikasi berjalan dalam mode lokal.');
      this.updateUIStatus();
      return false;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.auth = firebase.auth();
      this.db = firebase.firestore();

      // Aktifkan offline persistence untuk performa PWA & offline support
      this.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence gagal: multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('Browser tidak mendukung offline persistence');
        }
      });

      this.isInitialized = true;
      console.log('✅ Firebase terhubung ke project:', config.projectId);

      // Listener perubahan status login pengguna
      this.auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        this.updateUIStatus();
        if (user) {
          console.log('👤 Pengguna login:', user.email);
          this.onUserLoggedIn(user);
        } else {
          console.log('👤 Pengguna belum login atau telah logout');
          if (this.unsubscribeSnapshot) {
            this.unsubscribeSnapshot();
            this.unsubscribeSnapshot = null;
          }
        }
      });

      return true;
    } catch (err) {
      console.error('Gagal inisialisasi Firebase:', err);
      showToast('Konfigurasi Firebase tidak valid: ' + err.message, 'error');
      return false;
    }
  },

  // Periksa apakah konfigurasi Firebase sudah disetel
  isConfigured() {
    const c = getActiveFirebaseConfig();
    return !!(c && c.apiKey && c.projectId);
  },

  // Ketika pengguna login, lakukan sinkronisasi data cloud
  async onUserLoggedIn(user) {
    showToast(`Selamat datang, ${user.displayName || user.email}!`, 'success');

    // Periksa apakah cloud memiliki data untuk user ini
    try {
      const userDocRef = this.db.collection('users').doc(user.uid);
      const doc = await userDocRef.get();

      if (doc.exists) {
        // Data sudah ada di cloud, muat ke aplikasi
        const cloudData = doc.data();
        this.applyCloudDataToLocal(cloudData);
        showToast('Data akun berhasil dimuat dari Cloud!', 'success');
      } else {
        // Pengguna baru pertama kali login
        // Tanyakan apakah ingin mengunggah data lokal saat ini atau mulai kosong
        await this.syncUploadAll();
        showToast('Data awal berhasil disinkronkan ke Cloud!', 'success');
      }

      // Mulai realtime listener untuk sinkronisasi antar-perangkat
      this.listenToRealtimeUpdates(user.uid);
    } catch (err) {
      console.error('Error onUserLoggedIn:', err);
    }
  },

  // Menerapkan data cloud ke penyimpanan lokal Store
  applyCloudDataToLocal(data) {
    if (!data) return;

    if (Array.isArray(data.jadwal)) Store.setJadwal(data.jadwal);
    if (Array.isArray(data.tugas)) Store.setTugas(data.tugas);
    if (Array.isArray(data.catatan)) Store.setCatatan(data.catatan);
    if (Array.isArray(data.transaksi)) Store.setTransaksi(data.transaksi);
    if (Array.isArray(data.projects)) Store.setProjects(data.projects);
    if (data.profil && typeof data.profil === 'object') {
      const p = Store.getProfil();
      Store.setProfil({ ...p, ...data.profil });
    }

    // Segarkan semua tampilan
    if (typeof renderHome === 'function') renderHome();
    if (typeof renderJadwal === 'function') renderJadwal();
    if (typeof renderTugas === 'function') renderTugas();
    if (typeof renderCatatan === 'function') renderCatatan();
    if (typeof renderKeuangan === 'function') renderKeuangan();
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof updateStats === 'function') updateStats();
  },

  // Mendengarkan perubahan data di Firestore secara real-time
  listenToRealtimeUpdates(uid) {
    if (!this.db) return;
    if (this.unsubscribeSnapshot) this.unsubscribeSnapshot();

    const userDocRef = this.db.collection('users').doc(uid);
    this.unsubscribeSnapshot = userDocRef.onSnapshot((doc) => {
      // Abaikan jika perubahan berasal dari penulisan lokal sendiri yang masih pending
      if (doc.metadata.hasPendingWrites) return;

      if (doc.exists) {
        const data = doc.data();
        this.applyCloudDataToLocal(data);
      }
    }, (error) => {
      console.error('Realtime listener error:', error);
    });
  },

  // Unggah semua data lokal ke Cloud Firestore
  async syncUploadAll() {
    if (!this.isInitialized || !this.currentUser) return;

    const payload = {
      jadwal: Store.getJadwal(),
      tugas: Store.getTugas(),
      catatan: Store.getCatatan(),
      transaksi: Store.getTransaksi(),
      projects: Store.getProjects(),
      profil: Store.getProfil(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      userEmail: this.currentUser.email
    };

    try {
      await this.db.collection('users').doc(this.currentUser.uid).set(payload, { merge: true });
      console.log('☁️ Sinkronisasi berhasil diunggah ke Firebase Firestore');
    } catch (err) {
      console.error('Gagal mengunggah data ke Firestore:', err);
      showToast('Gagal sinkronisasi cloud: ' + err.message, 'error');
    }
  },

  // Debounced auto-sync (dipanggil setiap ada perubahan data lokal)
  queueSync() {
    if (!this.isInitialized || !this.currentUser) return;
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncUploadAll();
    }, 1200);
  },

  // Login dengan Google
  async loginWithGoogle() {
    if (!this.isInitialized) {
      if (!this.init()) {
        openFirebaseConfigModal();
        return;
      }
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (err) {
      console.error('Google Sign-in error:', err);
      showToast('Gagal masuk dengan Google: ' + err.message, 'error');
    }
  },

  // Login dengan Email & Password
  async loginWithEmail(email, password) {
    if (!this.isInitialized) {
      if (!this.init()) {
        openFirebaseConfigModal();
        return;
      }
    }

    try {
      const res = await this.auth.signInWithEmailAndPassword(email, password);
      return res.user;
    } catch (err) {
      console.error('Email Sign-in error:', err);
      showToast('Gagal masuk: ' + err.message, 'error');
      throw err;
    }
  },

  // Registrasi Akun Baru dengan Email & Password
  async registerWithEmail(email, password, displayName = '') {
    if (!this.isInitialized) {
      if (!this.init()) {
        openFirebaseConfigModal();
        return;
      }
    }

    try {
      const res = await this.auth.createUserWithEmailAndPassword(email, password);
      if (displayName && res.user) {
        await res.user.updateProfile({ displayName });
      }
      return res.user;
    } catch (err) {
      console.error('Register error:', err);
      showToast('Gagal mendaftar: ' + err.message, 'error');
      throw err;
    }
  },

  // Logout
  async logout() {
    if (!this.auth) return;
    try {
      await this.auth.signOut();
      showToast('Berhasil keluar dari akun Firebase', 'success');
      this.updateUIStatus();
    } catch (err) {
      console.error('Logout error:', err);
    }
  },

  // Bersihkan semua data dummy agar pengguna bisa mulai mengisi data miliknya sendiri
  async clearAllDummyData() {
    if (!confirm('Apakah Anda yakin ingin menghapus semua data dummy bawaan aplikasi?\nData Jadwal, Tugas, Catatan, dan Transaksi akan dikosongkan agar Anda dapat mengisi data pribadi Anda sendiri.')) {
      return;
    }

    Store.setJadwal([]);
    Store.setTugas([]);
    Store.setCatatan([]);
    Store.setTransaksi([]);
    Store.setProjects([]);

    // Refresh tampilan
    if (typeof renderHome === 'function') renderHome();
    if (typeof renderJadwal === 'function') renderJadwal();
    if (typeof renderTugas === 'function') renderTugas();
    if (typeof renderCatatan === 'function') renderCatatan();
    if (typeof renderKeuangan === 'function') renderKeuangan();
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof updateStats === 'function') updateStats();

    // Jika sedang login, sinkronkan keadaan kosong ini ke Cloud
    if (this.currentUser) {
      await this.syncUploadAll();
    }

    showToast('✨ Data berhasil dikosongkan! Sekarang Anda siap mengisi data Anda sendiri.', 'success');
  },

  // Perbarui UI status koneksi Firebase di halaman Profil
  updateUIStatus() {
    const cardStatus = document.getElementById('firebaseStatusBadge');
    const userLabel = document.getElementById('firebaseUserLabel');
    const authActions = document.getElementById('firebaseAuthActions');
    const logoutBtn = document.getElementById('firebaseLogoutBtn');

    if (!cardStatus) return;

    if (!this.isConfigured()) {
      cardStatus.className = 'fb-badge unconfigured';
      cardStatus.innerHTML = '<span class="fb-dot red"></span> Belum Dikonfigurasi';
      if (userLabel) userLabel.textContent = 'Silakan pasang Firebase Config Anda untuk mengaktifkan cloud database.';
      if (authActions) authActions.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      return;
    }

    if (this.currentUser) {
      cardStatus.className = 'fb-badge connected';
      cardStatus.innerHTML = '<span class="fb-dot green"></span> Tersambung & Sinkron';
      if (userLabel) {
        userLabel.innerHTML = `<strong>${this.currentUser.displayName || 'Akun Terhubung'}</strong><br><span style="font-size:12px;opacity:0.8;">${this.currentUser.email}</span>`;
      }
      if (authActions) authActions.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
      cardStatus.className = 'fb-badge ready';
      cardStatus.innerHTML = '<span class="fb-dot yellow"></span> Siap (Belum Login)';
      if (userLabel) userLabel.textContent = 'Firebase aktif! Masuk dengan Google atau Email untuk menyinkronkan data Anda ke Cloud.';
      if (authActions) authActions.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
    }
  }
};

// Hook ke Store agar setiap aksi penulisan otomatis tersinkronisasi ke Firebase
document.addEventListener('DOMContentLoaded', () => {
  // Hubungkan auto-sync debounced ke Store setter
  const originalSetJadwal = Store.setJadwal.bind(Store);
  Store.setJadwal = function(d) { originalSetJadwal(d); FirebaseService.queueSync(); };

  const originalSetTugas = Store.setTugas.bind(Store);
  Store.setTugas = function(d) { originalSetTugas(d); FirebaseService.queueSync(); };

  const originalSetCatatan = Store.setCatatan.bind(Store);
  Store.setCatatan = function(d) { originalSetCatatan(d); FirebaseService.queueSync(); };

  const originalSetTransaksi = Store.setTransaksi.bind(Store);
  Store.setTransaksi = function(d) { originalSetTransaksi(d); FirebaseService.queueSync(); };

  const originalSetProjects = Store.setProjects.bind(Store);
  Store.setProjects = function(d) { originalSetProjects(d); FirebaseService.queueSync(); };

  const originalSetProfil = Store.setProfil.bind(Store);
  Store.setProfil = function(d) { originalSetProfil(d); FirebaseService.queueSync(); };

  // Inisialisasi Firebase Service
  setTimeout(() => {
    FirebaseService.init();
  }, 100);
});

// ==========================================
// UI MODAL HELPERS (Pengaturan & Auth)
// ==========================================

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
    // Ekstrak properti menggunakan regex atau JSON parser
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
    } else {
      showToast('⚠️ Sebagian nilai tidak terdeteksi, mohon lengkapi manual.', 'warning');
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
  showToast('✅ Konfigurasi tersimpan! Menghubungkan ke Firebase...', 'success');

  // Re-inisialisasi Firebase Service
  setTimeout(() => {
    FirebaseService.init();
  }, 300);
}

let activeAuthTab = 'login';

function openFirebaseAuthModal() {
  switchAuthTab('login');
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authDisplayName').value = '';
  openModal('modalFirebaseAuth');
}

function switchAuthTab(tab) {
  activeAuthTab = tab;
  const isLogin = tab === 'login';
  document.getElementById('authTabLogin').classList.toggle('active', isLogin);
  document.getElementById('authTabRegister').classList.toggle('active', !isLogin);
  document.getElementById('modalAuthTitle').textContent = isLogin ? 'Masuk dengan Email' : 'Daftar Akun Baru';
  document.getElementById('authNameGroup').classList.toggle('hidden', isLogin);
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Masuk' : 'Daftar & Hubungkan';
}

async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authDisplayName').value.trim();

  if (!email || !password) {
    showToast('Email dan password wajib diisi!', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password minimal 6 karakter!', 'error');
    return;
  }

  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    if (activeAuthTab === 'login') {
      await FirebaseService.loginWithEmail(email, password);
    } else {
      await FirebaseService.registerWithEmail(email, password, name);
    }
    closeModal('modalFirebaseAuth');
  } catch (err) {
    // Error ditangani di dalam service
  } finally {
    btn.disabled = false;
    btn.textContent = activeAuthTab === 'login' ? 'Masuk' : 'Daftar & Hubungkan';
  }
}

