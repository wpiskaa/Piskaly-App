// ===========================
// TABUNGAN.JS - TARGET MENABUNG
// ===========================

const GOAL_ICONS = ['🎯', '💻', '📱', '🏍️', '✈️', '🎓', '🏠', '🎮', '👟', '🎁', '💍', '🚗'];

let editingGoalId = null;
let selectedGoalIcon = GOAL_ICONS[0];
let depositGoalId = null;
let depositType = 'in';
let expandedGoalId = null;

// ---- Shared finance helpers (dipakai juga oleh anggaran.js, hutang.js, kalkulator.js) ----
function finEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function finToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function finRp(n) { return formatRupiahFull(Math.round(n)); }

// Selisih hari dari hari ini ke tanggal (YYYY-MM-DD). Negatif = sudah lewat.
function finDaysUntil(dateStr) {
  const p = (dateStr || '').split('-');
  if (p.length < 3) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  return Math.round((target - today) / 86400000);
}

// ---- Goal helpers ----
function goalSaved(g) {
  return (g.history || []).reduce((s, h) => s + (h.type === 'in' ? h.jumlah : -h.jumlah), 0);
}

function renderGoals() {
  const list = document.getElementById('goalList');
  if (!list) return;
  const goals = Store.getGoals();

  const totalSaved = goals.reduce((s, g) => s + Math.max(goalSaved(g), 0), 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const doneCount = goals.filter(g => goalSaved(g) >= g.target).length;
  document.getElementById('goalStatSaved').textContent = formatRupiah(totalSaved);
  document.getElementById('goalStatTarget').textContent = formatRupiah(totalTarget);
  document.getElementById('goalStatDone').textContent = `${doneCount}/${goals.length}`;

  if (!goals.length) {
    list.innerHTML = `
      <div class="fin-empty">
        <div class="fin-empty-icon">🐷</div>
        <h4>Belum ada target menabung</h4>
        <p>Buat target seperti laptop baru, liburan, atau dana darurat, lalu pantau progres dan saran nabung per hari.</p>
        <button class="btn-primary" onclick="openGoalModal()">Buat Target Pertama</button>
      </div>`;
    return;
  }

  list.innerHTML = goals.map(goalCardHTML).join('');
  lucide.createIcons({ nodes: [list] });
}

function goalCardHTML(g) {
  const saved = Math.max(goalSaved(g), 0);
  const pct = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
  const sisa = Math.max(g.target - saved, 0);
  const done = sisa <= 0;
  const days = g.deadline ? finDaysUntil(g.deadline) : null;

  let deadlineBadge = '';
  if (days !== null && !done) {
    const label = days < 0 ? 'Lewat tenggat' : days === 0 ? 'Hari ini' : `H-${days}`;
    const cls = days < 0 ? 'late' : days <= 7 ? 'soon' : 'ok';
    deadlineBadge = `<span class="goal-deadline ${cls}">${label}</span>`;
  }

  let plan;
  if (done) {
    plan = '🎉 Target tercapai! Selamat!';
  } else if (days !== null && days > 0) {
    const perDay = sisa / days;
    const perWeek = sisa / Math.max(1, Math.ceil(days / 7));
    const perMonth = sisa / Math.max(1, Math.ceil(days / 30));
    plan = `<b>Saran nabung:</b> ${finRp(perDay)}/hari • ${finRp(perWeek)}/minggu • ${finRp(perMonth)}/bulan`;
  } else if (days !== null) {
    plan = `Tenggat sudah lewat. Sisa ${finRp(sisa)} lagi.`;
  } else {
    plan = `Sisa ${finRp(sisa)} lagi untuk mencapai target.`;
  }

  const expanded = expandedGoalId === g.id;
  const history = (g.history || []).slice().sort((a, b) => (b.tanggal + b.id).localeCompare(a.tanggal + a.id));
  const historyHTML = expanded ? `
    <div class="goal-history">
      ${history.length ? history.slice(0, 12).map(h => `
        <div class="goal-hist-row">
          <span class="goal-hist-date">${formatDate(h.tanggal)}</span>
          <span class="goal-hist-note">${finEsc(h.catatan) || (h.type === 'in' ? 'Setoran' : 'Penarikan')}</span>
          <span class="goal-hist-amt ${h.type}">${h.type === 'in' ? '+' : '-'}${finRp(h.jumlah)}</span>
          <button class="goal-hist-del" onclick="removeGoalEntry('${g.id}','${h.id}')" aria-label="Hapus"><i data-lucide="x"></i></button>
        </div>`).join('') : '<p class="goal-hist-empty">Belum ada riwayat setoran.</p>'}
    </div>` : '';

  return `
    <div class="goal-card ${done ? 'done' : ''}">
      <div class="goal-top" onclick="toggleGoalHistory('${g.id}')">
        <div class="goal-icon">${finEsc(g.icon || '🎯')}</div>
        <div class="goal-info">
          <div class="goal-name">${finEsc(g.nama)} ${deadlineBadge}</div>
          <div class="goal-amounts"><b>${finRp(saved)}</b> / ${finRp(g.target)}</div>
        </div>
        <div class="goal-pct">${pct.toFixed(0)}%</div>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="goal-plan">${plan}</div>
      <div class="goal-actions">
        <button class="goal-btn primary" onclick="openDeposit('${g.id}','in')"><i data-lucide="plus"></i> Nabung</button>
        <button class="goal-btn" onclick="openDeposit('${g.id}','out')"><i data-lucide="minus"></i> Tarik</button>
        <button class="goal-btn icon" onclick="openGoalModal('${g.id}')" aria-label="Edit"><i data-lucide="pencil"></i></button>
        <button class="goal-btn icon danger" onclick="deleteGoal('${g.id}')" aria-label="Hapus"><i data-lucide="trash-2"></i></button>
      </div>
      ${historyHTML}
    </div>`;
}

function toggleGoalHistory(id) {
  expandedGoalId = expandedGoalId === id ? null : id;
  renderGoals();
}

// ---- Goal modal ----
function setGoalIcon(icon) {
  selectedGoalIcon = icon;
  document.querySelectorAll('#goalIconPicker .emoji-btn').forEach(b => b.classList.toggle('active', b.dataset.icon === icon));
}

function openGoalModal(id) {
  editingGoalId = id || null;
  const g = id ? Store.getGoals().find(x => x.id === id) : null;
  document.getElementById('modalGoalTitle').textContent = g ? 'Edit Target' : 'Target Baru';
  document.getElementById('goalNama').value = g ? g.nama : '';
  document.getElementById('goalTarget').value = g ? g.target : '';
  document.getElementById('goalDeadline').value = g ? (g.deadline || '') : '';
  setGoalIcon(g ? (g.icon || GOAL_ICONS[0]) : GOAL_ICONS[0]);
  openModal('modalGoal');
}

function saveGoal() {
  const nama = document.getElementById('goalNama').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const deadline = document.getElementById('goalDeadline').value;
  if (!nama) { showToast('Nama target tidak boleh kosong!', 'error'); return; }
  if (!target || target <= 0) { showToast('Target dana tidak valid!', 'error'); return; }

  let goals = Store.getGoals();
  if (editingGoalId) {
    goals = goals.map(g => g.id === editingGoalId ? { ...g, nama, target, deadline, icon: selectedGoalIcon } : g);
  } else {
    goals.push({ id: uid(), nama, target, deadline, icon: selectedGoalIcon, history: [], createdAt: new Date().toISOString() });
  }
  Store.setGoals(goals);
  closeModal('modalGoal');
  showToast(editingGoalId ? '✅ Target diperbarui!' : '🎯 Target menabung dibuat!', 'success');
  editingGoalId = null;
  renderKeuangan();
}

function deleteGoal(id) {
  const g = Store.getGoals().find(x => x.id === id);
  if (!g) return;
  const saved = goalSaved(g);
  const msg = saved > 0
    ? `Hapus target "${g.nama}"? Tabungan ${finRp(saved)} akan kembali ke saldo tersedia.`
    : `Hapus target "${g.nama}"?`;
  if (!confirm(msg)) return;
  Store.setGoals(Store.getGoals().filter(x => x.id !== id));
  showToast('🗑️ Target dihapus', 'info');
  renderKeuangan();
}

// ---- Nabung / Tarik ----
function openDeposit(id, type) {
  const g = Store.getGoals().find(x => x.id === id);
  if (!g) return;
  depositGoalId = id;
  depositType = type;
  const saved = Math.max(goalSaved(g), 0);
  document.getElementById('modalDepositTitle').textContent = type === 'in' ? 'Nabung' : 'Tarik Tabungan';
  document.getElementById('depositGoalName').innerHTML =
    `${finEsc(g.icon || '🎯')} <b>${finEsc(g.nama)}</b><span>Terkumpul ${finRp(saved)} dari ${finRp(g.target)}</span>`;
  document.getElementById('depositJumlah').value = '';
  document.getElementById('depositCatatan').value = '';
  document.getElementById('depositTanggal').value = finToday();
  document.getElementById('depositQuick').style.display = type === 'in' ? '' : 'none';
  openModal('modalGoalDeposit');
}

function saveDeposit() {
  const jumlah = parseFloat(document.getElementById('depositJumlah').value);
  if (!jumlah || jumlah <= 0) { showToast('Jumlah tidak valid!', 'error'); return; }

  const goals = Store.getGoals();
  const g = goals.find(x => x.id === depositGoalId);
  if (!g) return;

  const beforeSaved = goalSaved(g);
  if (depositType === 'out' && jumlah > beforeSaved) {
    showToast('Melebihi jumlah tabungan target ini!', 'error');
    return;
  }
  if (depositType === 'in' && jumlah > getFinanceTotals().available) {
    showToast('⚠️ Melebihi saldo tersedia, saldo akan minus', 'warning');
  }

  g.history = g.history || [];
  g.history.push({
    id: uid(),
    type: depositType,
    jumlah,
    catatan: document.getElementById('depositCatatan').value.trim(),
    tanggal: document.getElementById('depositTanggal').value || finToday()
  });
  Store.setGoals(goals);
  closeModal('modalGoalDeposit');

  if (depositType === 'in' && beforeSaved < g.target && goalSaved(g) >= g.target) {
    showToast(`🎉 Target "${g.nama}" tercapai!`, 'success', 3600);
  } else {
    showToast(depositType === 'in' ? `🐷 ${finRp(jumlah)} masuk ke tabungan!` : `💸 ${finRp(jumlah)} ditarik`, 'success');
  }
  renderKeuangan();
}

function removeGoalEntry(goalId, entryId) {
  const goals = Store.getGoals();
  const g = goals.find(x => x.id === goalId);
  if (!g) return;
  g.history = (g.history || []).filter(h => h.id !== entryId);
  Store.setGoals(goals);
  renderKeuangan();
}

document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('goalIconPicker');
  if (picker) {
    picker.innerHTML = GOAL_ICONS.map(i => `<button type="button" class="emoji-btn" data-icon="${i}">${i}</button>`).join('');
    picker.querySelectorAll('.emoji-btn').forEach(b => b.addEventListener('click', () => setGoalIcon(b.dataset.icon)));
  }
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
  document.getElementById('saveDepositBtn').addEventListener('click', saveDeposit);
  document.querySelectorAll('#depositQuick button').forEach(b => {
    b.addEventListener('click', () => {
      const input = document.getElementById('depositJumlah');
      input.value = (parseFloat(input.value) || 0) + parseFloat(b.dataset.amt);
    });
  });
});
