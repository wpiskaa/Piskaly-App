// ===========================
// TUGAS.JS - ASSIGNMENTS
// ===========================

let tugasFilter = 'all';
let editingTugasId = null;

function getPriorityBadgeHtml(prioritas) {
  const p = (prioritas || 'medium').toLowerCase();
  if (p === 'high') {
    return `
      <span class="priority-badge high" title="Prioritas Tinggi">
        <span class="p-pulse-dot"></span>
        <svg class="p-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
        <span class="p-text">Tinggi</span>
      </span>
    `;
  }
  if (p === 'low') {
    return `
      <span class="priority-badge low" title="Prioritas Rendah">
        <svg class="p-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
        <span class="p-text">Rendah</span>
      </span>
    `;
  }
  return `
    <span class="priority-badge medium" title="Prioritas Sedang">
      <svg class="p-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span class="p-text">Sedang</span>
    </span>
  `;
}

function renderTugas() {
  const allTugas = Store.getTugas();
  let filtered = allTugas;
  if (tugasFilter === 'pending') filtered = allTugas.filter(t => !t.done);
  if (tugasFilter === 'done') filtered = allTugas.filter(t => t.done);

  // Sort: pending first, then by deadline
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.deadline || !b.deadline) return 0;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  const container = document.getElementById('tugasList');
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="book-check"></i>
        <h4>${tugasFilter === 'done' ? 'Belum ada tugas selesai' : 'Tidak ada tugas'}</h4>
        <p>Klik tombol + untuk menambah tugas baru</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = filtered.map(t => {
    const badge = t.deadline ? getDeadlineBadge(t.deadline) : null;
    return `
      <div class="tugas-card ${t.done ? 'done' : ''}">
        <div class="tugas-card-top">
          <button class="tugas-check ${t.done ? 'checked' : ''}" onclick="toggleTugasDone('${t.id}')"></button>
          <div class="tugas-card-info">
            <div class="tugas-nama" style="${t.done ? 'text-decoration:line-through;opacity:0.6' : ''}">${t.nama}</div>
            ${t.matkul ? `<div class="tugas-matkul">${t.matkul}</div>` : ''}
          </div>
        </div>
        <div class="tugas-card-mid">
          ${t.deadline ? `
            <div class="tugas-deadline">
              <i data-lucide="clock"></i>
              ${formatDateTime(t.deadline)}
            </div>
          ` : ''}
          ${badge && !t.done ? `<span class="dl-badge ${badge.cls}">${badge.label}</span>` : ''}
          ${getPriorityBadgeHtml(t.prioritas)}
        </div>
        ${t.deskripsi ? `<div class="tugas-deskripsi">${t.deskripsi}</div>` : ''}
        <div class="tugas-card-actions">
          <button class="action-btn edit" onclick="editTugas('${t.id}')">Edit</button>
          <button class="action-btn delete" onclick="deleteTugas('${t.id}')">Hapus</button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

function toggleTugasDone(id) {
  let tugas = Store.getTugas();
  tugas = tugas.map(t => t.id === id ? { ...t, done: !t.done } : t);
  Store.setTugas(tugas);
  renderTugas();
  if (currentPage === 'home') renderHome();
  updateStats();
  const t = tugas.find(t => t.id === id);
  showToast(t.done ? '✅ Tugas selesai!' : 'Tugas diaktifkan kembali', t.done ? 'success' : '');
}

function editTugas(id) {
  const tugas = Store.getTugas().find(t => t.id === id);
  if (!tugas) return;
  editingTugasId = id;
  document.getElementById('modalTugasTitle').textContent = 'Edit Tugas';
  document.getElementById('tugasNama').value = tugas.nama;
  document.getElementById('tugasMatkul').value = tugas.matkul || '';
  document.getElementById('tugasDeadline').value = tugas.deadline ? tugas.deadline.slice(0, 16) : '';
  document.getElementById('tugasPrioritas').value = tugas.prioritas || 'medium';
  document.getElementById('tugasDeskripsi').value = tugas.deskripsi || '';
  openModal('modalTugas');
}

function deleteTugas(id) {
  if (!confirm('Hapus tugas ini?')) return;
  Store.setTugas(Store.getTugas().filter(t => t.id !== id));
  renderTugas();
  if (currentPage === 'home') renderHome();
  updateStats();
  showToast('🗑️ Tugas dihapus', 'error');
}

function saveTugas() {
  const nama = document.getElementById('tugasNama').value.trim();
  if (!nama) { showToast('Nama tugas tidak boleh kosong!', 'error'); return; }

  const data = {
    id: editingTugasId || uid(),
    nama,
    matkul: document.getElementById('tugasMatkul').value.trim(),
    deadline: document.getElementById('tugasDeadline').value || null,
    prioritas: document.getElementById('tugasPrioritas').value,
    deskripsi: document.getElementById('tugasDeskripsi').value.trim(),
    done: false,
    createdAt: editingTugasId ? undefined : new Date().toISOString()
  };

  let tugas = Store.getTugas();
  if (editingTugasId) {
    tugas = tugas.map(t => t.id === editingTugasId ? { ...t, ...data } : t);
  } else {
    tugas.push(data);
  }
  Store.setTugas(tugas);
  closeModal('modalTugas');
  resetTugasForm();
  renderTugas();
  if (currentPage === 'home') renderHome();
  updateStats();
  showToast(editingTugasId ? '✅ Tugas diperbarui!' : '✅ Tugas ditambahkan!', 'success');
  editingTugasId = null;
}

function resetTugasForm() {
  ['tugasNama','tugasMatkul','tugasDeadline','tugasDeskripsi'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('tugasPrioritas').value = 'medium';
  document.getElementById('modalTugasTitle').textContent = 'Tambah Tugas';
  editingTugasId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tugasFilter = btn.dataset.filter;
      renderTugas();
    });
  });

  // Add button
  document.getElementById('addTugasBtn').addEventListener('click', () => {
    editingTugasId = null;
    resetTugasForm();
    // Set default deadline to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    document.getElementById('tugasDeadline').value = tomorrow.toISOString().slice(0, 16);
    openModal('modalTugas');
  });

  document.getElementById('saveTugasBtn').addEventListener('click', saveTugas);
});
