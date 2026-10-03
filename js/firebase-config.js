// ==========================================
// FIREBASE CONFIGURATION (js/firebase-config.js)
// ==========================================
// Petunjuk Penggunaan:
// 1. Buat project baru di Firebase Console: https://console.firebase.google.com/
// 2. Aktifkan Authentication di menu: Build -> Authentication -> Sign-in method (Aktifkan Google & Email/Password).
// 3. Aktifkan Cloud Firestore di menu: Build -> Firestore Database -> Create database (Pilih 'Start in test mode' untuk kemudahan awal).
// 4. Di Project Settings -> General -> Your apps -> Tambahkan Web app (</>) dan salin konfigurasi.
// 5. Tempelkan nilainya pada DEFAULT_FIREBASE_CONFIG di bawah ini, ATAU paste langsung di aplikasi via menu Profil -> Pengaturan Firebase.

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC9rV9gbPO_C6Pzx1_qRnjBrgcpR6d5qXk",
  authDomain: "hemo-scan-760be.firebaseapp.com",
  projectId: "hemo-scan-760be",
  storageBucket: "hemo-scan-760be.firebasestorage.app",
  messagingSenderId: "919173663586",
  appId: "1:919173663586:web:2cf9e6f803765288d07a3b",
  measurementId: "G-3LQPYSTGD3"
};

// Mendapatkan konfigurasi Firebase aktif (LocalStorage atau file konfigurasi)
function getActiveFirebaseConfig() {
  const custom = localStorage.getItem('mylife_firebase_config');
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      if (parsed.apiKey && parsed.projectId) return parsed;
    } catch (e) {
      console.error('Error parsing custom firebase config:', e);
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// Simpan konfigurasi ke LocalStorage dari form pengaturan
function saveFirebaseConfigToStorage(configObj) {
  localStorage.setItem('mylife_firebase_config', JSON.stringify(configObj));
}
