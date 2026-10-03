// ===========================
// CATATAN.JS - NOTES
// ===========================

const NOTE_COLOR_MAP = {
  '#1e293b': '#2563eb',
  '#1e3a5f': '#2563eb',
  '#102d7c': '#2563eb',
  '#1a3a2a': '#059669',
  '#3a1a2a': '#e11d48',
  '#2d1f00': '#d97706'
};

function getNoteAccent(c) {
  const raw = c.color || c.warna || '#2563eb';
  return NOTE_COLOR_MAP[raw] || raw;
}

let editingCatatanId = null;
let selectedCatatanColor = '#2563eb';
let notesSearchQuery = '';

function renderCatatan() {
  let catatan = Store.getCatatan();
  if (notesSearchQuery) {
    const q = notesSearchQuery.toLowerCase();
    catatan = catatan.filter(c =>
      c.judul?.toLowerCase().includes(q) ||
      c.isi?.toLowerCase().includes(q) ||
      c.tag?.toLowerCase().includes(q)
    );
  }
  catatan = catatan.slice().reverse(); // newest first

  const container = document.getElementById('catatanGrid');
  if (!catatan.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i data-lucide="sticky-note"></i>
        <h4>${notesSearchQuery ? 'Tidak ditemukan' : 'Belum ada catatan'}</h4>
        <p>${notesSearchQuery ? 'Coba kata kunci lain' : 'Klik tombol + untuk membuat catatan baru'}</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = catatan.map(c => {
    const accent = getNoteAccent(c);
    const dateVal = formatDate(c.createdAt || c.tanggal || c.updatedAt);
    const tagText = c.tag ? c.tag.split(',')[0].trim() : '';

    return `
      <div class="catatan-card" onclick="editCatatan('${c.id}')">
        <div class="catatan-card-stripe" style="background:${accent};"></div>
        <div class="catatan-card-glow" style="background:${accent};"></div>

        <div class="catatan-card-body">
          ${c.judul ? `<h4 class="catatan-card-title">${c.judul}</h4>` : ''}
          <div class="catatan-card-preview">${c.isi || ''}</div>
        </div>

        <div class="catatan-card-meta">
          <span class="catatan-card-date">${dateVal}</span>
          ${tagText ? `<span class="catatan-card-tag" style="border-color:${accent}40; color:${accent}; background:${accent}12;">${tagText}</span>` : ''}
        </div>

        <div class="catatan-actions" onclick="event.stopPropagation()">
          <button class="action-btn edit" onclick="editCatatan('${c.id}')">Edit</button>
          <button class="action-btn delete" onclick="deleteCatatan('${c.id}')">Hapus</button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

function editCatatan(id) {
  const c = Store.getCatatan().find(c => c.id === id);
  if (!c) return;
  editingCatatanId = id;
  document.getElementById('modalCatatanTitle').textContent = 'Edit Catatan';
  document.getElementById('catatanJudul').value = c.judul || '';
  document.getElementById('catatanIsi').value = c.isi || '';
  document.getElementById('catatanTag').value = c.tag || '';
  selectedCatatanColor = getNoteAccent(c);
  updateColorPicker('catatanColorPicker', selectedCatatanColor);
  openModal('modalCatatan');
}

function deleteCatatan(id) {
  if (!confirm('Hapus catatan ini?')) return;
  Store.setCatatan(Store.getCatatan().filter(c => c.id !== id));
  renderCatatan();
  if (currentPage === 'home') renderHomeNotes();
  updateStats();
  showToast('🗑️ Catatan dihapus', 'error');
}

function saveCatatan() {
  const isi = document.getElementById('catatanIsi').value.trim();
  if (!isi) { showToast('Isi catatan tidak boleh kosong!', 'error'); return; }

  const data = {
    id: editingCatatanId || uid(),
    judul: document.getElementById('catatanJudul').value.trim(),
    isi,
    tag: document.getElementById('catatanTag').value.trim(),
    color: selectedCatatanColor,
    createdAt: editingCatatanId ? (Store.getCatatan().find(c => c.id === editingCatatanId)?.createdAt || Store.getCatatan().find(c => c.id === editingCatatanId)?.tanggal) : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let catatan = Store.getCatatan();
  if (editingCatatanId) {
    catatan = catatan.map(c => c.id === editingCatatanId ? { ...c, ...data } : c);
  } else {
    catatan.push(data);
  }
  Store.setCatatan(catatan);
  closeModal('modalCatatan');
  resetCatatanForm();
  renderCatatan();
  if (currentPage === 'home') renderHomeNotes();
  updateStats();
  showToast(editingCatatanId ? '✅ Catatan diperbarui!' : '✅ Catatan disimpan!', 'success');
  editingCatatanId = null;
}

function resetCatatanForm() {
  ['catatanJudul','catatanIsi','catatanTag'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('modalCatatanTitle').textContent = 'Tambah Catatan';
  selectedCatatanColor = '#2563eb';
  updateColorPicker('catatanColorPicker', selectedCatatanColor);
  editingCatatanId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addCatatanBtn').addEventListener('click', () => {
    editingCatatanId = null;
    resetCatatanForm();
    openModal('modalCatatan');
  });

  document.getElementById('saveCatatanBtn').addEventListener('click', saveCatatan);

  document.querySelectorAll('#catatanColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCatatanColor = btn.dataset.color;
      updateColorPicker('catatanColorPicker', selectedCatatanColor);
    });
  });

  let searchTimeout;
  document.getElementById('notesSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      notesSearchQuery = e.target.value.trim();
      renderCatatan();
    }, 300);
  });
});
