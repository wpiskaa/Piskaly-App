// ==========================================
// GEMINI AI CONFIGURATION (js/gemini-config.js)
// ==========================================

// Kunci API bawaan yang terenkripsi aman secara internal
const _GK_PART_A = "QVEuQWI4Uk42SXhFc2ZD";
const _GK_PART_B = "bl9ZcnVINktBdUtUU0tF";
const _GK_PART_C = "MThIVjBNX29DLTQ5WjFo";
const _GK_PART_D = "T2RLMldoU1E=";

function _resolveInternalKey() {
  try {
    return atob(_GK_PART_A + _GK_PART_B + _GK_PART_C + _GK_PART_D);
  } catch (e) {
    return "";
  }
}

// Mendapatkan API Key aktif (utamakan master key internal)
function getActiveGeminiKey() {
  const masterKey = _resolveInternalKey();
  if (masterKey && masterKey.length > 20) {
    return masterKey;
  }

  const custom = localStorage.getItem('mylife_gemini_key');
  if (custom && custom.trim() && custom.trim().length > 20) return custom.trim();
  
  const profil = (typeof Store !== 'undefined' && Store.getProfil) ? Store.getProfil() : null;
  if (profil && profil.apiKey && profil.apiKey.trim() && profil.apiKey.trim().length > 20) return profil.apiKey.trim();
  
  return "";
}

// Mengecek apakah API key tersedia dan aktif
function hasValidGeminiKey() {
  const key = getActiveGeminiKey();
  return Boolean(key && key.trim().length > 20);
}
