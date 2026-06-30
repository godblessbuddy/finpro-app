// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
let balance = 0;
let currentCurrency = 'USD';
let history = [];
let goals = [];
let budgets = {};
let editingId = null;
let nextId = 0;

const CATEGORIES = {
    Food: { icon: 'fa-utensils' },
    Clothes: { icon: 'fa-tshirt' },
    Entertainment: { icon: 'fa-film' },
    Monthly: { icon: 'fa-calendar-alt' },
    Pocket: { icon: 'fa-wallet' },
    Savings: { icon: 'fa-piggy-bank' }
};
const CAT_KEYS = Object.keys(CATEGORIES);
const RATES = { USD: 1, EUR: 0.92, RUB: 92.5, UAH: 39.2 };
const SYMBOLS = { USD: '$', EUR: '€', RUB: '₽', UAH: '₴' };

let chartInstance = null;
let filterCategory = 'all';
let filterPeriod = 'all';

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────
function login() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const storedUser = localStorage.getItem('app_user') || 'admin';
    const storedPass = localStorage.getItem('app_pass') || 'admin';
    if (user === storedUser && pass === storedPass) {
        localStorage.setItem('isLoggedIn', 'true');
        showApp();
    } else {
        alert('Invalid username or password.');
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    closeMobileMenu();
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    loadData();
    applyTheme();
    renderBudgetInputs();
    updateUI();
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────────────────────
function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (tabName === 'dashboard' && chartInstance) {
        setTimeout(() => chartInstance.update(), 50);
    }
    closeMobileMenu();
}

function saveSettings() {
    const u = document.getElementById('new-username').value.trim();
    const p = document.getElementById('new-password').value.trim();
    if (u) localStorage.setItem('app_user', u);
    if (p) localStorage.setItem('app_pass', p);
    alert('Credentials updated.');
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
}

// ─────────────────────────────────────────────────────────────
//  MOBILE MENU
// ─────────────────────────────────────────────────────────────
function toggleMobileMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.hamburger').classList.toggle('active');
}
function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.hamburger').classList.remove('active');
}

// ─────────────────────────────────────────────────────────────
//  TRANSACTIONS
// ─────────────────────────────────────────────────────────────
function addTransaction(isIncome, category = 'Income') {
    const input = document.getElementById('amount-input');
    const noteInput = document.getElementById('note-input');
    const raw = parseFloat(input.value);
    if (isNaN(raw) || raw <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    const amountUSD = raw / RATES[currentCurrency];
    const note = noteInput.value.trim();

    if (isIncome) {
        balance += amountUSD;
        history.push({ id: nextId++, type: 'Income', cat: 'Income', amount: amountUSD, date: today(), note });
    } else {
        balance -= amountUSD;
        history.push({ id: nextId++, type: 'Expense', cat: category, amount: amountUSD, date: today(), note });
    }

    input.value = '';
    noteInput.value = '';
    save();
    updateUI();
}

function undo() {
    if (!history.length) return;
    const last = history.pop();
    if (last.type === 'Income') balance -= last.amount;
    else balance += last.amount;
    save();
    updateUI();
}

function resetAll() {
    if (!confirm('Delete all dashboard data?')) return;
    balance = 0;
    history = [];
    goals = [];
    budgets = {};
    save();
    updateUI();
    renderBudgetInputs();
}

// ─────────────────────────────────────────────────────────────
//  EDIT & DELETE
// ─────────────────────────────────────────────────────────────
function openEditModal(id) {
    const tx = history.find(t => t.id === id);
    if (!tx) return;
    editingId = id;
    document.getElementById('edit-amount').value = (tx.amount * RATES[currentCurrency]).toFixed(2);
    document.getElementById('edit-category').value = tx.cat;
    document.getElementById('edit-note').value = tx.note || '';
    document.getElementById('edit-date').value = formatDateInput(tx.date);
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    editingId = null;
}

function saveEdit() {
    if (editingId === null) return;
    const idx = history.findIndex(t => t.id === editingId);
    if (idx === -1) return;

    const newAmount = parseFloat(document.getElementById('edit-amount').value);
    if (isNaN(newAmount) || newAmount <= 0) { alert('Invalid amount.'); return; }

    const newCat = document.getElementById('edit-category').value;
    const newNote = document.getElementById('edit-note').value.trim();
    const newDateStr = document.getElementById('edit-date').value;

    const oldTx = history[idx];
    const newAmountUSD = newAmount / RATES[currentCurrency];

    if (oldTx.type === 'Income') balance -= oldTx.amount;
    else balance += oldTx.amount;

    const isIncome = newCat === 'Income';
    if (isIncome) balance += newAmountUSD;
    else balance -= newAmountUSD;

    history[idx] = {
        ...oldTx,
        cat: newCat,
        type: isIncome ? 'Income' : 'Expense',
        amount: newAmountUSD,
        note: newNote,
        date: newDateStr ? formatDateDisplay(newDateStr) : oldTx.date
    };

    closeModal();
    save();
    updateUI();
}

function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    const idx = history.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tx = history[idx];
    if (tx.type === 'Income') balance -= tx.amount;
    else balance += tx.amount;
    history.splice(idx, 1);
    save();
    updateUI();
}

// ─────────────────────────────────────────────────────────────
//  CURRENCY
// ─────────────────────────────────────────────────────────────
function setCurrency(curr) {
    currentCurrency = curr;
    document.querySelectorAll('.currency-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.curr === curr);
    });
    updateUI();
}

// ─────────────────────────────────────────────────────────────
//  GOALS
// ─────────────────────────────────────────────────────────────
function addGoal() {
    const nameInput = document.getElementById('goal-name');
    const targetInput = document.getElementById('goal-target');
    const name = nameInput.value.trim();
    const target = parseFloat(targetInput.value);
    if (!name || isNaN(target) || target <= 0) {
        alert('Enter a valid goal name and target.');
        return;
    }
    goals.push({ name, target: target / RATES[currentCurrency], saved: 0 });
    nameInput.value = '';
    targetInput.value = '';
    save();
    updateUI();
}

// ─────────────────────────────────────────────────────────────
//  FILTERS
// ─────────────────────────────────────────────────────────────
function applyFilters() {
    filterCategory = document.getElementById('filter-category').value;
    filterPeriod = document.getElementById('filter-period').value;
    updateUI();
}

function getFilteredHistory() {
    let filtered = [...history];
    if (filterCategory !== 'all') {
        filtered = filtered.filter(t => t.cat === filterCategory);
    }
    const now = new Date();
    if (filterPeriod === 'today') {
        const d = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        filtered = filtered.filter(t => t.date === d);
    } else if (filterPeriod === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        filtered = filtered.filter(t => new Date(t.date) >= weekAgo);
    } else if (filterPeriod === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        filtered = filtered.filter(t => new Date(t.date) >= monthAgo);
    }
    return filtered;
}

// ─────────────────────────────────────────────────────────────
//  BUDGETS
// ─────────────────────────────────────────────────────────────
function renderBudgetInputs() {
    const container = document.getElementById('budget-inputs');
    container.innerHTML = CAT_KEYS.map(cat => {
        const val = budgets[cat] ? (budgets[cat] * RATES[currentCurrency]).toFixed(0) : '';
        return `
            <div class="budget-row">
                <label><i class="fas ${CATEGORIES[cat].icon}"></i> ${cat}</label>
                <input type="number" id="budget-${cat}" placeholder="Limit (${SYMBOLS[currentCurrency]})" value="${val}" step="1" min="0" />
            </div>
        `;
    }).join('');
}

function saveBudgets() {
    CAT_KEYS.forEach(cat => {
        const el = document.getElementById(`budget-${cat}`);
        const val = parseFloat(el.value);
        if (!isNaN(val) && val > 0) {
            budgets[cat] = val / RATES[currentCurrency];
        } else {
            delete budgets[cat];
        }
    });
    save();
    updateUI();
    alert('Budgets saved!');
}

// ─────────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────────
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('fin_dark_theme', isDark ? 'true' : 'false');
}

function applyTheme() {
    const isDark = localStorage.getItem('fin_dark_theme') === 'true';
    if (isDark) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
}

// ─────────────────────────────────────────────────────────────
//  EXPORT / IMPORT (JSON)
// ─────────────────────────────────────────────────────────────
function exportJSON() {
    const data = { balance, history, goals, budgets, nextId };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finpro_backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.balance !== undefined && data.history && data.goals !== undefined) {
                balance = data.balance;
                history = data.history;
                goals = data.goals;
                budgets = data.budgets || {};
                nextId = data.nextId || 0;
                save();
                renderBudgetInputs();
                updateUI();
                alert('Backup imported successfully!');
            } else {
                alert('Invalid backup file.');
            }
        } catch (err) {
            alert('Error reading file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ─────────────────────────────────────────────────────────────
//  EXPORT CSV
// ─────────────────────────────────────────────────────────────
function exportCSV() {
    if (!history.length) { alert('No transactions to export.'); return; }
    let csv = 'Type,Category,Amount(USD),Date,Note\n';
    history.forEach(h => {
        csv += `${h.type},${h.cat},${h.amount.toFixed(2)},${h.date},${h.note || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finpro_transactions.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ─────────────────────────────────────────────────────────────
//  UI RENDER
// ─────────────────────────────────────────────────────────────
function updateUI() {
    const mod = RATES[currentCurrency];
    const sym = SYMBOLS[currentCurrency];

    document.getElementById('balance-display').textContent = `${sym}${(balance * mod).toFixed(2)}`;

    const sums = { Food: 0, Clothes: 0, Entertainment: 0, Monthly: 0, Pocket: 0, Savings: 0 };
    history.forEach(h => {
        if (h.type === 'Expense' && h.cat in sums) sums[h.cat] += h.amount;
    });

    // Status
    const statusEl = document.getElementById('status-sums');
    const catKeys = Object.keys(CATEGORIES);
    if (catKeys.every(k => sums[k] === 0)) {
        statusEl.innerHTML = `<li class="empty-msg">No expenses yet</li>`;
    } else {
        statusEl.innerHTML = catKeys.map(k => {
            const spent = sums[k] * mod;
            const limit = budgets[k] ? budgets[k] * mod : 0;
            let pct = limit > 0 ? (spent / limit) * 100 : 0;
            let cls = '';
            if (limit > 0 && pct > 100) cls = 'danger';
            else if (limit > 0 && pct > 80) cls = 'warning';
            return `
                <li>
                    <div class="row">
                        <span class="cat-label"><i class="fas ${CATEGORIES[k].icon}"></i> ${k}</span>
                        <span class="cat-amount">${sym}${spent.toFixed(0)}${limit > 0 ? ` / ${sym}${limit.toFixed(0)}` : ''}</span>
                    </div>
                    ${limit > 0 ? `<div class="budget-bar"><div class="fill ${cls}" style="width:${Math.min(pct, 100)}%;"></div></div>` : ''}
                </li>
            `;
        }).join('');
    }

    // Transactions
    const filtered = getFilteredHistory();
    const txEl = document.getElementById('transactions-list');
    if (!filtered.length) {
        txEl.innerHTML = `<li class="empty-msg">No transactions match</li>`;
    } else {
        txEl.innerHTML = filtered.slice(-8).reverse().map(h => {
            const isInc = h.cat === 'Income';
            const icon = isInc ? 'fa-arrow-up' : (CATEGORIES[h.cat]?.icon || 'fa-circle');
            const cls = isInc ? 'positive' : 'negative';
            const prefix = isInc ? '+' : '-';
            const label = isInc ? 'Income' : h.cat;
            const noteHtml = h.note ? `<span class="tx-note"><i class="fas fa-pencil-alt"></i> ${h.note}</span>` : '';
            return `
                <li>
                    <div class="tx-left">
                        <div class="tx-icon"><i class="fas ${icon}"></i></div>
                        <div class="tx-meta">
                            <span class="tx-title">${label}</span>
                            ${noteHtml}
                            <span class="tx-date">${h.date}</span>
                        </div>
                    </div>
                    <div class="tx-right">
                        <span class="tx-amount ${cls}">${prefix}${sym}${(h.amount * mod).toFixed(0)}</span>
                        <div class="tx-actions">
                            <button onclick="openEditModal(${h.id})" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="del-btn" onclick="deleteTransaction(${h.id})" title="Delete"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    }

    // Goals
    const goalsEl = document.getElementById('goals-list');
    if (!goals.length) {
        goalsEl.innerHTML = `<li class="empty-msg">No goals yet</li>`;
    } else {
        let remainingSavings = sums.Savings;
        goalsEl.innerHTML = goals.map(g => {
            const allocated = Math.min(g.target, remainingSavings);
            remainingSavings -= allocated;
            return `
                <li>
                    <span><i class="fas fa-bullseye" style="color:var(--primary);margin-right:8px;"></i>${g.name}</span>
                    <span class="goal-progress">${sym}${(allocated * mod).toFixed(0)} / ${sym}${(g.target * mod).toFixed(0)}</span>
                </li>
            `;
        }).join('');
    }

    // Chart
    updateChart(Object.values(sums).map(v => v * mod));
    renderBudgetInputs();
}

// ─────────────────────────────────────────────────────────────
//  CHART
// ─────────────────────────────────────────────────────────────
function updateChart(data) {
    const ctx = document.getElementById('myChart').getContext('2d');
    const labels = Object.keys(CATEGORIES);
    if (chartInstance) {
        chartInstance.data.datasets[0].data = data;
        chartInstance.update();
        return;
    }
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#fd79a8'],
                borderWidth: 0,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            cutout: '68%',
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────────────────────
function save() {
    localStorage.setItem('fin_balance', balance);
    localStorage.setItem('fin_history', JSON.stringify(history));
    localStorage.setItem('fin_goals', JSON.stringify(goals));
    localStorage.setItem('fin_budgets', JSON.stringify(budgets));
    localStorage.setItem('fin_nextId', nextId);
}

function loadData() {
    balance = parseFloat(localStorage.getItem('fin_balance')) || 0;
    history = JSON.parse(localStorage.getItem('fin_history')) || [];
    goals = JSON.parse(localStorage.getItem('fin_goals')) || [];
    budgets = JSON.parse(localStorage.getItem('fin_budgets')) || {};
    nextId = parseInt(localStorage.getItem('fin_nextId')) || 0;
    let maxId = nextId;
    history.forEach(t => {
        if (t.id === undefined) t.id = maxId++;
    });
    if (maxId > nextId) nextId = maxId;
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function today() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateInput(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
}
function formatDateDisplay(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return today();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('edit-modal').classList.contains('hidden')) {
        saveEdit();
        e.preventDefault();
    } else if (e.key === 'Enter' && document.activeElement?.id === 'amount-input') {
        addTransaction(false, 'Food');
        e.preventDefault();
    } else if (e.key === 'Escape') {
        if (!document.getElementById('edit-modal').classList.contains('hidden')) {
            closeModal();
        }
        if (document.getElementById('sidebar').classList.contains('open')) {
            closeMobileMenu();
        }
    }
});

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
window.onload = function() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        showApp();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
};