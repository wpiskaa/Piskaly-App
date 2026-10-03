// ===========================
// JADWAL.JS - CLASS SCHEDULE
// ===========================

let selectedDay = 'Senin';
let selectedJadwalColor = '#2563eb';
let editingJadwalId = null;

function renderJadwal() {
  // Set active day to today if available
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const today = days[new Date().getDay()];
  if (['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].includes(today)) {
    selectedDay = today;
    document.querySelectorAll('.day-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.day === selectedDay);
    });
  }
  renderJadwalList();
}

function renderJadwalList() {
  const jadwal = Store.getJadwal()
    .filter(j => j.hari === selectedDay)
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
  const container = document.getElementById('jadwalList');

  if (!jadwal.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-x"></i>
        <h4>Tidak ada jadwal</h4>
        <p>Belum ada jadwal untuk hari ${selectedDay}.<br>Klik tombol + untuk menambahkan.</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = jadwal.map(j => `
    <div class="jadwal-card" id="jadwal-${j.id}">
      <div class="jadwal-card-inner" style="border-left-color:${j.color||'#2563eb'}">
        <div class="jadwal-time">
          <div class="jt-start">${j.jamMulai}</div>
          <div class="jt-end">${j.jamSelesai}</div>
        </div>
        <div class="jadwal-info">
          <div class="jadwal-matkul">${j.matkul}</div>
          <div class="jadwal-meta">
            ${j.ruangan ? `<div class="jadwal-meta-item"><i data-lucide="map-pin"></i>${j.ruangan}</div>` : ''}
            ${j.dosen ? `<div class="jadwal-meta-item"><i data-lucide="user"></i>${j.dosen}</div>` : ''}
            ${j.sks ? `<div class="jadwal-meta-item"><i data-lucide="layers"></i>${j.sks} SKS</div>` : ''}
          </div>
        </div>
      </div>
      <div class="jadwal-actions">
        <button class="action-btn edit" onclick="editJadwal('${j.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteJadwal('${j.id}')">Hapus</button>
      </div>
    </div>
  `).join('');

  lucide.createIcons({ nodes: [container] });
}

function editJadwal(id) {
  const jadwal = Store.getJadwal().find(j => j.id === id);
  if (!jadwal) return;
  editingJadwalId = id;
  document.getElementById('modalJadwalTitle').textContent = 'Edit Jadwal';
  document.getElementById('jadwalMatkul').value = jadwal.matkul;
  document.getElementById('jadwalHari').value = jadwal.hari;
  document.getElementById('jadwalSks').value = jadwal.sks || '';
  document.getElementById('jadwalJamMulai').value = jadwal.jamMulai;
  document.getElementById('jadwalJamSelesai').value = jadwal.jamSelesai;
  document.getElementById('jadwalRuangan').value = jadwal.ruangan || '';
  document.getElementById('jadwalDosen').value = jadwal.dosen || '';
  selectedJadwalColor = jadwal.color || '#2563eb';
  updateColorPicker('jadwalColorPicker', selectedJadwalColor);
  openModal('modalJadwal');
}

function deleteJadwal(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  const jadwal = Store.getJadwal().filter(j => j.id !== id);
  Store.setJadwal(jadwal);
  renderJadwalList();
  if (currentPage === 'home') renderHome();
  updateStats();
  showToast('🗑️ Jadwal dihapus', 'error');
}

function saveJadwal() {
  const matkul = document.getElementById('jadwalMatkul').value.trim();
  const jamMulai = document.getElementById('jadwalJamMulai').value;
  const jamSelesai = document.getElementById('jadwalJamSelesai').value;

  if (!matkul || !jamMulai || !jamSelesai) {
    showToast('Lengkapi field yang diperlukan!', 'error'); return;
  }

  const data = {
    id: editingJadwalId || uid(),
    matkul,
    hari: document.getElementById('jadwalHari').value,
    sks: document.getElementById('jadwalSks').value,
    jamMulai,
    jamSelesai,
    ruangan: document.getElementById('jadwalRuangan').value.trim(),
    dosen: document.getElementById('jadwalDosen').value.trim(),
    color: selectedJadwalColor,
    createdAt: editingJadwalId ? undefined : new Date().toISOString()
  };

  let jadwal = Store.getJadwal();
  if (editingJadwalId) {
    jadwal = jadwal.map(j => j.id === editingJadwalId ? { ...j, ...data } : j);
  } else {
    jadwal.push(data);
  }
  Store.setJadwal(jadwal);

  selectedDay = data.hari;
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === selectedDay);
  });

  closeModal('modalJadwal');
  resetJadwalForm();
  renderJadwalList();
  if (currentPage === 'home') renderHome();
  updateStats();
  showToast(editingJadwalId ? '✅ Jadwal diperbarui!' : '✅ Jadwal ditambahkan!', 'success');
  editingJadwalId = null;
}

function resetJadwalForm() {
  ['jadwalMatkul','jadwalSks','jadwalJamMulai','jadwalJamSelesai','jadwalRuangan','jadwalDosen'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modalJadwalTitle').textContent = 'Tambah Jadwal Kuliah';
  selectedJadwalColor = '#2563eb';
  updateColorPicker('jadwalColorPicker', selectedJadwalColor);
  editingJadwalId = null;
}

function updateColorPicker(pickerId, selectedColor) {
  document.querySelectorAll(`#${pickerId} .color-opt`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === selectedColor);
  });
}

// ---- Init Jadwal ----
document.addEventListener('DOMContentLoaded', () => {
  // Day tabs
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDay = tab.dataset.day;
      renderJadwalList();
    });
  });

  // Add button
  document.getElementById('addJadwalBtn').addEventListener('click', () => {
    editingJadwalId = null;
    resetJadwalForm();
    openModal('modalJadwal');
  });

  // Save button
  document.getElementById('saveJadwalBtn').addEventListener('click', saveJadwal);

  // Color picker
  document.querySelectorAll('#jadwalColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedJadwalColor = btn.dataset.color;
      updateColorPicker('jadwalColorPicker', selectedJadwalColor);
    });
  });
});
