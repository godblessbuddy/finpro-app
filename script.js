// ── State ──
let balance = 0;
let history = [];
let goals = [];

// ── DOM refs ──
const balanceEl = document.getElementById('balance');
const statusList = document.getElementById('status-list');
const goalsList = document.getElementById('goals-list');
const txList = document.getElementById('tx-list');

// ── Init ──
function init() {
    loadData();
    render();
}
init();

// ── Render ──
function render() {
    balanceEl.textContent = `$${balance.toFixed(2)}`;
    renderStatus();
    renderGoals();
    renderTransactions();
}

function renderStatus() {
    const sums = {};
    history.forEach(t => {
        if (t.type === 'expense') sums[t.cat] = (sums[t.cat] || 0) + t.amount;
    });
    statusList.innerHTML = Object.keys(sums).length === 0
        ? '<li>No expenses yet</li>'
        : Object.entries(sums).map(([cat, amt]) =>
            `<li><span>${cat}</span><span>$${amt.toFixed(0)}</span></li>`
        ).join('');
}

function renderGoals() {
    goalsList.innerHTML = goals.length === 0
        ? '<li>No goals yet</li>'
        : goals.map(g => `<li><span>${g.name}</span><span>$${g.saved || 0}/$${g.target}</span></li>`).join('');
}

function renderTransactions() {
    txList.innerHTML = history.length === 0
        ? '<li>No transactions</li>'
        : history.slice(-5).reverse().map(t => {
            const sign = t.type === 'income' ? '+' : '-';
            const cls = t.type === 'income' ? 'positive' : 'negative';
            return `<li>
                <div class="tx-left">
                    <div class="tx-icon"><i class="fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                    <span>${t.cat}</span>
                </div>
                <span class="tx-amount ${cls}">${sign}$${t.amount.toFixed(0)}</span>
            </li>`;
        }).join('');
}

// ── Add transaction ──
function addTransaction(type, cat = 'General') {
    const amt = parseFloat(document.getElementById('amount').value);
    if (!amt || amt <= 0) return alert('Enter a valid amount');
    const note = document.getElementById('note').value.trim();
    history.push({ type, cat, amount: amt, note, date: new Date().toLocaleDateString() });
    if (type === 'income') balance += amt;
    else balance -= amt;
    document.getElementById('amount').value = '';
    document.getElementById('note').value = '';
    save();
    render();
}
window.addTransaction = addTransaction;

// ── Undo ──
function undo() {
    if (!history.length) return;
    const last = history.pop();
    if (last.type === 'income') balance -= last.amount;
    else balance += last.amount;
    save();
    render();
}
window.undo = undo;

// ── Reset ──
function resetAll() {
    if (!confirm('Delete all data?')) return;
    balance = 0;
    history = [];
    goals = [];
    save();
    render();
}
window.resetAll = resetAll;

// ── Goals ──
function addGoal() {
    const name = document.getElementById('goal-name').value.trim();
    const target = parseFloat(document.getElementById('goal-target').value);
    if (!name || !target || target <= 0) return alert('Enter valid goal');
    goals.push({ name, target, saved: 0 });
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    save();
    render();
}
window.addGoal = addGoal;

// ── Menu toggle ──
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
}
window.toggleMenu = toggleMenu;

// ── Storage ──
function save() {
    localStorage.setItem('fin_balance', balance);
    localStorage.setItem('fin_history', JSON.stringify(history));
    localStorage.setItem('fin_goals', JSON.stringify(goals));
}
function loadData() {
    balance = parseFloat(localStorage.getItem('fin_balance')) || 0;
    history = JSON.parse(localStorage.getItem('fin_history')) || [];
    goals = JSON.parse(localStorage.getItem('fin_goals')) || [];
}

// ── CSV Export ──
function exportCSV() {
    if (!history.length) return alert('No data');
    let csv = 'Type,Category,Amount,Date,Note\n';
    history.forEach(t => csv += `${t.type},${t.cat},${t.amount},${t.date},${t.note||''}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finpro.csv';
    a.click();
}
window.exportCSV = exportCSV;

// ── Connect buttons ──
document.querySelector('.income').onclick = () => addTransaction('income', 'Income');
document.querySelector('.undo').onclick = undo;
document.querySelector('.reset').onclick = resetAll;
document.querySelector('.export').onclick = exportCSV;
document.querySelector('#add-goal').onclick = addGoal;

// Category buttons
document.querySelectorAll('.categories button').forEach(btn => {
    btn.onclick = () => {
        const cat = btn.textContent.trim().replace(/[^a-zA-Z]/g, '');
        addTransaction('expense', cat);
    };
});

// ── Chart (placeholder) ──
new Chart(document.getElementById('myChart'), {
    type: 'doughnut',
    data: { labels: ['Food', 'Clothes', 'Entertainment', 'Monthly', 'Pocket', 'Savings'], datasets: [{ data: [0,0,0,0,0,0], backgroundColor: ['#6c5ce7','#00b894','#fdcb6e','#e17055','#0984e3','#fd79a8'] }] },
    options: { plugins: { legend: { display: false } }, cutout: '70%', responsive: true, maintainAspectRatio: false }
});