// ===========================
// KEUANGAN.JS - FINANCE
// ===========================

let transFilter = 'all';
let editingTransId = null;
let selectedTransType = 'expense';

const CATEGORY_ICONS = {
  'Makan': '🍜', 'Transport': '🚌', 'Belanja': '🛍️',
  'Hiburan': '🎮', 'Pendidikan': '📚', 'Kesehatan': '❤️',
  'Uang Saku': '💰', 'Kerja': '💼', 'Lainnya': '📦'
};

function renderKeuangan() {
  renderBalanceSummary();
  renderFinanceChart();
  renderCategoryBreakdown();
  renderTransactionList();
}

function renderBalanceSummary() {
  const now = new Date();
  const transaksi = Store.getTransaksi().filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = transaksi.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0);
  const expense = transaksi.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0);
  const saldo = income - expense;

  document.getElementById('totalBalance').textContent = formatRupiahFull(saldo);
  document.getElementById('totalIncome').textContent = formatRupiahFull(income);
  document.getElementById('totalExpense').textContent = formatRupiahFull(expense);
  document.getElementById('homeIncome').textContent = formatRupiah(income);
  document.getElementById('homeExpense').textContent = formatRupiah(expense);
}

function renderFinanceChart() {
  const period = document.getElementById('chartPeriod').value;
  const transaksi = Store.getTransaksi();
  const now = new Date();

  let labels = [], incomeData = [], expenseData = [];

  if (period === 'month') {
    // Daily for current month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTransaksi = transaksi.filter(t => {
        const td = new Date(t.tanggal);
        return td.getDate() === d && td.getMonth() === now.getMonth() && td.getFullYear() === now.getFullYear();
      });
      labels.push(d.toString());
      incomeData.push(dayTransaksi.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0));
      expenseData.push(dayTransaksi.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0));
    }
  } else {
    // Weekly - last 7 days
    const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayTransaksi = transaksi.filter(t => {
        const td = new Date(t.tanggal);
        return td.toDateString() === d.toDateString();
      });
      labels.push(dayNames[d.getDay()]);
      incomeData.push(dayTransaksi.filter(t => t.type === 'income').reduce((s, t) => s + t.jumlah, 0));
      expenseData.push(dayTransaksi.filter(t => t.type === 'expense').reduce((s, t) => s + t.jumlah, 0));
    }
  }

  const ctx = document.getElementById('financeChart').getContext('2d');
  if (financeChart) financeChart.destroy();
  financeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#8899bb', font: { size: 12, family: 'Plus Jakarta Sans' } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#4a5a7a', font: { size: 10 }, maxTicksLimit: 10 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: {
            color: '#4a5a7a', font: { size: 10 },
            callback: v => v >= 1000000 ? (v/1000000).toFixed(0)+'jt' : v >= 1000 ? (v/1000).toFixed(0)+'rb' : v
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

function renderCategoryBreakdown() {
  const now = new Date();
  const expenses = Store.getTransaksi().filter(t => {
    const d = new Date(t.tanggal);
    return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const total = expenses.reduce((s, t) => s + t.jumlah, 0);

  const byCategory = {};
  expenses.forEach(t => {
    byCategory[t.kategori] = (byCategory[t.kategori] || 0) + t.jumlah;
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const container = document.getElementById('categoryBreakdown');

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state-small"><i data-lucide="pie-chart"></i><p>Belum ada data pengeluaran</p></div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = sorted.map(([cat, amount]) => {
    const pct = total > 0 ? (amount / total) * 100 : 0;
    return `
      <div class="cat-item">
        <div class="cat-icon-box">
          <span>${CATEGORY_ICONS[cat] || '📦'}</span>
        </div>
        <div class="cat-info">
          <div class="cat-top-row">
            <span class="cat-name">${cat}</span>
            <span class="cat-amount">${formatRupiah(amount)}</span>
          </div>
          <div class="cat-bar-wrap">
            <div class="cat-bar" style="width:${pct.toFixed(0)}%"></div>
          </div>
          <div class="cat-bottom-row">
            <span class="cat-pct-sub">${pct.toFixed(1)}% dari total pengeluaran</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons({ nodes: [container] });
}

function renderTransactionList() {
  let transaksi = Store.getTransaksi();
  if (transFilter !== 'all') transaksi = transaksi.filter(t => t.type === transFilter);
  transaksi = transaksi.slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  const container = document.getElementById('transactionList');
  if (!transaksi.length) {
    container.innerHTML = `<div class="empty-state-small"><i data-lucide="receipt"></i><p>Belum ada transaksi</p></div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = transaksi.map(t => `
    <div class="trans-item" onclick="editTransaksi('${t.id}')">
      <div class="trans-cat-icon ${t.type}">
        ${CATEGORY_ICONS[t.kategori] || '📦'}
      </div>
      <div class="trans-info">
        <div class="trans-keterangan">${t.keterangan}</div>
        <div class="trans-meta">${t.kategori} • ${formatDate(t.tanggal)}</div>
      </div>
      <div class="trans-amount ${t.type}">
        ${t.type === 'income' ? '+' : '-'}${formatRupiah(t.jumlah)}
      </div>
    </div>
  `).join('');
}

function editTransaksi(id) {
  const t = Store.getTransaksi().find(t => t.id === id);
  if (!t) return;
  editingTransId = id;
  setTransType(t.type);
  document.getElementById('transJumlah').value = t.jumlah;
  document.getElementById('transKeterangan').value = t.keterangan;
  document.getElementById('transKategori').value = t.kategori;
  document.getElementById('transTanggal').value = t.tanggal;
  document.getElementById('modalTransaksiTitle').textContent = 'Edit Transaksi';
  openModal('modalTransaksi');
}

function setTransType(type) {
  selectedTransType = type;
  document.getElementById('transType').value = type;
  document.querySelectorAll('.type-sw-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  // Update category options
  const expenseCategories = ['Makan','Transport','Belanja','Hiburan','Pendidikan','Kesehatan','Lainnya'];
  const incomeCategories = ['Uang Saku','Kerja','Lainnya'];
  const select = document.getElementById('transKategori');
  const cats = type === 'income' ? incomeCategories : expenseCategories;
  select.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_ICONS[c] || ''} ${c}</option>`).join('');
}

function saveTransaksi() {
  const jumlah = parseFloat(document.getElementById('transJumlah').value);
  const keterangan = document.getElementById('transKeterangan').value.trim();
  if (!jumlah || jumlah <= 0) { showToast('Jumlah tidak valid!', 'error'); return; }
  if (!keterangan) { showToast('Keterangan tidak boleh kosong!', 'error'); return; }

  const data = {
    id: editingTransId || uid(),
    type: document.getElementById('transType').value,
    jumlah,
    keterangan,
    kategori: document.getElementById('transKategori').value,
    tanggal: document.getElementById('transTanggal').value || new Date().toISOString().slice(0, 10),
    createdAt: editingTransId ? undefined : new Date().toISOString()
  };

  let transaksi = Store.getTransaksi();
  if (editingTransId) {
    transaksi = transaksi.map(t => t.id === editingTransId ? { ...t, ...data } : t);
  } else {
    transaksi.push(data);
  }
  Store.setTransaksi(transaksi);
  closeModal('modalTransaksi');
  resetTransaksiForm();
  renderKeuangan();
  if (currentPage === 'home') renderHomeFinance();
  updateStats();
  showToast(editingTransId ? '✅ Transaksi diperbarui!' : '✅ Transaksi ditambahkan!', 'success');
  editingTransId = null;
}

function resetTransaksiForm() {
  document.getElementById('transJumlah').value = '';
  document.getElementById('transKeterangan').value = '';
  document.getElementById('modalTransaksiTitle').textContent = 'Tambah Transaksi';
  setTransType('expense');
  document.getElementById('transTanggal').value = new Date().toISOString().slice(0, 10);
  editingTransId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addTransaksiBtn').addEventListener('click', () => {
    editingTransId = null;
    resetTransaksiForm();
    openModal('modalTransaksi');
  });

  document.getElementById('saveTransaksiBtn').addEventListener('click', saveTransaksi);

  document.querySelectorAll('.type-sw-btn').forEach(btn => {
    btn.addEventListener('click', () => setTransType(btn.dataset.type));
  });

  document.querySelectorAll('.trans-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.trans-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      transFilter = btn.dataset.type;
      renderTransactionList();
    });
  });

  document.getElementById('chartPeriod').addEventListener('change', renderFinanceChart);

  // Set today's date as default
  document.getElementById('transTanggal').value = new Date().toISOString().slice(0, 10);
});
