// ===========================
// ANGGARAN.JS - BUDGET BULANAN
// ===========================

const BUDGET_CATEGORIES = ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Pendidikan', 'Kesehatan', 'Lainnya'];
let editingBudgetId = null;

// Pengeluaran bulan ini per kategori
function getMonthExpenseByCategory() {
  const now = new Date();
  const map = {};
  Store.getTransaksi().forEach(t => {
    const d = new Date(t.tanggal);
    if (t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      map[t.kategori] = (map[t.kategori] || 0) + t.jumlah;
    }
  });
  return map;
}

function renderBudgets() {
  const list = document.getElementById('budgetList');
  const summary = document.getElementById('budgetSummary');
  if (!list || !summary) return;

  const budgets = Store.getBudgets();
  const spentMap = getMonthExpenseByCategory();

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentMap[b.kategori] || 0), 0);
  const remaining = totalLimit - totalSpent;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const pct = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;
  const state = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';

  if (!budgets.length) {
    summary.innerHTML = `
      <div class="budget-sum-title">Belum ada anggaran</div>
      <p class="budget-sum-hint">Tentukan batas pengeluaran tiap kategori supaya uang bulanan tidak bocor.</p>`;
    list.innerHTML = `
      <div class="fin-empty">
        <div class="fin-empty-icon">📊</div>
        <h4>Atur anggaran pertamamu</h4>
        <p>Contoh: Makan Rp 800rb, Transport Rp 200rb per bulan. Kamu akan diingatkan saat hampir melewati batas.</p>
        <button class="btn-primary" onclick="openBudgetModal()">Atur Anggaran</button>
      </div>`;
    return;
  }

  summary.innerHTML = `
    <div class="budget-sum-top">
      <div>
        <span class="budget-sum-lbl">${remaining >= 0 ? 'Sisa Anggaran' : 'Melebihi Anggaran'}</span>
        <div class="budget-sum-val ${state}">${finRp(Math.abs(remaining))}</div>
      </div>
      <div class="budget-sum-right">
        <span class="budget-sum-lbl">Terpakai</span>
        <b>${finRp(totalSpent)}</b> <small>/ ${finRp(totalLimit)}</small>
      </div>
    </div>
    <div class="budget-bar big"><div class="budget-bar-fill ${state}" style="width:${pct.toFixed(1)}%"></div></div>
    <p class="budget-sum-hint">${remaining > 0
      ? `Sisa ${daysLeft} hari bulan ini, batas aman <b>${finRp(remaining / daysLeft)}/hari</b>.`
      : 'Anggaran bulan ini sudah habis. Tahan dulu pengeluaran ya!'}</p>`;

  list.innerHTML = budgets.map(b => {
    const spent = spentMap[b.kategori] || 0;
    const p = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    const st = p >= 100 ? 'over' : p >= 75 ? 'warn' : 'ok';
    const left = b.limit - spent;
    return `
      <div class="budget-item">
        <div class="budget-item-top">
          <div class="budget-cat-icon">${CATEGORY_ICONS[b.kategori] || '📦'}</div>
          <div class="budget-item-info">
            <div class="budget-item-name">${finEsc(b.kategori)}</div>
            <div class="budget-item-sub">${finRp(spent)} dari ${finRp(b.limit)}</div>
          </div>
          <div class="budget-item-pct ${st}">${p.toFixed(0)}%</div>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill ${st}" style="width:${Math.min(100, p).toFixed(1)}%"></div></div>
        <div class="budget-item-bottom">
          <span class="budget-left ${st}">${left >= 0 ? `Sisa ${finRp(left)}` : `Lebih ${finRp(-left)}`}</span>
          <span class="budget-item-actions">
            <button onclick="openBudgetModal('${b.id}')" aria-label="Edit"><i data-lucide="pencil"></i></button>
            <button class="danger" onclick="deleteBudget('${b.id}')" aria-label="Hapus"><i data-lucide="trash-2"></i></button>
          </span>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons({ nodes: [list] });
}

function openBudgetModal(id) {
  editingBudgetId = id || null;
  const budgets = Store.getBudgets();
  const b = id ? budgets.find(x => x.id === id) : null;

  // Kategori yang sudah punya anggaran tidak ditampilkan lagi (kecuali saat edit)
  const used = budgets.filter(x => x.id !== id).map(x => x.kategori);
  const options = BUDGET_CATEGORIES.filter(c => !used.includes(c));
  if (!options.length) { showToast('Semua kategori sudah punya anggaran', 'info'); return; }

  const select = document.getElementById('budgetKategori');
  select.innerHTML = options.map(c => `<option value="${c}">${CATEGORY_ICONS[c] || ''} ${c}</option>`).join('');
  if (b) select.value = b.kategori;
  document.getElementById('budgetLimit').value = b ? formatRupiahDisplay(b.limit) : '';
  document.getElementById('modalBudgetTitle').textContent = b ? 'Edit Anggaran' : 'Atur Anggaran';
  openModal('modalBudget');
}

function saveBudget() {
  const kategori = document.getElementById('budgetKategori').value;
  const limit = parseRupiahInput(document.getElementById('budgetLimit').value);
  if (!limit || limit <= 0) { showToast('Batas anggaran tidak valid!', 'error'); return; }

  let budgets = Store.getBudgets();
  if (editingBudgetId) {
    budgets = budgets.map(b => b.id === editingBudgetId ? { ...b, kategori, limit } : b);
  } else {
    budgets.push({ id: uid(), kategori, limit });
  }
  Store.setBudgets(budgets);
  closeModal('modalBudget');
  showToast('✅ Anggaran disimpan!', 'success');
  editingBudgetId = null;
  renderKeuangan();
}

function deleteBudget(id) {
  if (!confirm('Hapus anggaran ini?')) return;
  Store.setBudgets(Store.getBudgets().filter(b => b.id !== id));
  showToast('🗑️ Anggaran dihapus', 'info');
  renderKeuangan();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveBudgetBtn').addEventListener('click', saveBudget);
  attachRupiahFormatter(document.getElementById('budgetLimit'));
});
