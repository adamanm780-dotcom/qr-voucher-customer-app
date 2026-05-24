// ===== STATE MANAGEMENT =====
const store = {
    user: null,
    vouchers: [],
    currentVoucher: null,
    currentPage: 'dashboard',

    // Initialize from localStorage
    init() {
        const saved = localStorage.getItem('voucher_store');
        if (saved) {
            const data = JSON.parse(saved);
            this.vouchers = data.vouchers || [];
            this.user = data.user;
        }
    },

    save() {
        localStorage.setItem('voucher_store', JSON.stringify({
            user: this.user,
            vouchers: this.vouchers
        }));
    }
};

// ===== AUTH =====
function login(email, password) {
    // Simple demo auth
    if (email && password) {
        store.user = {
            email,
            name: 'Demo Business',
            id: 'user_' + Date.now()
        };
        store.save();
        showPage('appPage');
        goToPage('dashboard');
        updateUI();
        return true;
    }
    return false;
}

function logout() {
    store.user = null;
    store.save();
    showPage('loginPage');
    clearForm('loginForm');
}

// ===== PAGE ROUTING =====
function showPage(pageId) {
    document.querySelectorAll('[id$="Page"]').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function goToPage(pageName) {
    store.currentPage = pageName;

    // Hide all content pages
    document.querySelectorAll('.content > .page').forEach(page => {
        page.classList.remove('active');
    });

    // Show the selected page
    const pageId = pageName + 'Page';
    if (document.getElementById(pageId)) {
        document.getElementById(pageId).classList.add('active');
    }

    // Update nav highlighting
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        vouchers: 'All Vouchers',
        analytics: 'Analytics',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[pageName] || pageName;

    updateUI();
}

// ===== VOUCHER MANAGEMENT =====
function createVoucher(data) {
    const voucher = {
        id: 'v_' + Date.now(),
        code: data.code,
        offer: data.offer,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        maxUses: parseInt(data.maxUses) || 0,
        redeemedCount: 0,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    store.vouchers.push(voucher);
    store.save();
    closeModal('voucherModal');
    updateUI();
}

function updateVoucher(id, data) {
    const voucher = store.vouchers.find(v => v.id === id);
    if (voucher) {
        voucher.code = data.code;
        voucher.offer = data.offer;
        voucher.validFrom = data.validFrom;
        voucher.validUntil = data.validUntil;
        voucher.maxUses = parseInt(data.maxUses) || 0;
        store.save();
        closeModal('voucherModal');
        updateUI();
    }
}

function deleteVoucher(id) {
    if (confirm('Are you sure you want to delete this voucher?')) {
        store.vouchers = store.vouchers.filter(v => v.id !== id);
        store.save();
        updateUI();
    }
}

function redeemVoucher(id) {
    const voucher = store.vouchers.find(v => v.id === id);
    if (voucher) {
        if (voucher.maxUses === 0 || voucher.redeemedCount < voucher.maxUses) {
            voucher.redeemedCount++;
            store.save();
            updateUI();
        } else {
            alert('This voucher has reached its maximum uses');
        }
    }
}

// ===== UI UPDATES =====
function updateUI() {
    if (!store.user) return;

    // Update user info
    document.getElementById('userName').textContent = store.user.name;
    document.getElementById('userEmail').textContent = store.user.email;

    // Update stats
    updateStats();

    // Update voucher tables
    if (store.currentPage === 'dashboard') {
        renderRecentVouchers();
    } else if (store.currentPage === 'vouchers') {
        renderAllVouchers();
    } else if (store.currentPage === 'analytics') {
        renderAnalytics();
    }

    // Update settings form
    document.getElementById('businessName').value = store.user.name;
    document.getElementById('businessEmail').value = store.user.email;
}

function updateStats() {
    const total = store.vouchers.length;
    const today = new Date().toISOString().split('T')[0];
    const activeToday = store.vouchers.filter(v => v.validFrom <= today && v.validUntil >= today).length;
    const redeemed = store.vouchers.reduce((sum, v) => sum + v.redeemedCount, 0);
    const conversionRate = total > 0 ? Math.round((redeemed / (total * Math.max(1, store.vouchers[0]?.maxUses || 1))) * 100) : 0;

    document.getElementById('totalVouchers').textContent = total;
    document.getElementById('activeToday').textContent = activeToday;
    document.getElementById('totalRedeemed').textContent = redeemed;
    document.getElementById('conversionRate').textContent = conversionRate + '%';
}

function renderRecentVouchers() {
    const tbody = document.getElementById('recentVouchersTable');
    const recent = store.vouchers.slice(-5).reverse();

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No vouchers yet. Create your first one!</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(v => `
        <tr>
            <td><span class="voucher-code">${v.code}</span></td>
            <td>${v.offer}</td>
            <td><span class="voucher-status status-${getStatus(v)}">${getStatus(v)}</span></td>
            <td>${v.redeemedCount} / ${v.maxUses || '∞'}</td>
            <td>${formatDate(v.validUntil)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon btn-sm" onclick="showQRCode('${v.id}')" title="View QR">📱</button>
                    <button class="btn-icon btn-sm" onclick="openEditVoucher('${v.id}')" title="Edit">✏️</button>
                    <button class="btn-icon btn-sm" onclick="deleteVoucher('${v.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderAllVouchers() {
    const tbody = document.getElementById('allVouchersTable');

    if (store.vouchers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No vouchers yet. Create your first one!</td></tr>';
        return;
    }

    tbody.innerHTML = store.vouchers.map(v => `
        <tr>
            <td><span class="voucher-code">${v.code}</span></td>
            <td>${v.offer}</td>
            <td><span class="voucher-status status-${getStatus(v)}">${getStatus(v)}</span></td>
            <td>${v.redeemedCount}</td>
            <td>${v.maxUses || '∞'}</td>
            <td>${formatDate(v.validUntil)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon btn-sm" onclick="showQRCode('${v.id}')" title="View QR">📱</button>
                    <button class="btn-icon btn-sm" onclick="openEditVoucher('${v.id}')" title="Edit">✏️</button>
                    <button class="btn-icon btn-sm" onclick="deleteVoucher('${v.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderAnalytics() {
    if (store.vouchers.length === 0) return;

    // Top vouchers
    const topVouchers = store.vouchers
        .sort((a, b) => b.redeemedCount - a.redeemedCount)
        .slice(0, 5);

    const topHtml = topVouchers.map(v => `
        <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between;">
            <span>${v.code}: ${v.offer}</span>
            <span style="color: var(--color-primary);">${v.redeemedCount} redeemed</span>
        </div>
    `).join('');
    document.getElementById('topVouchersAnalytics').innerHTML = topHtml || '<div class="empty-state">No data yet</div>';

    // Performance metrics
    const totalRedeemed = store.vouchers.reduce((s, v) => s + v.redeemedCount, 0);
    const avgRedeemed = store.vouchers.length > 0 ? (totalRedeemed / store.vouchers.length).toFixed(1) : 0;

    const metricsHtml = `
        <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-border);">
            <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-md);">
                <span>Total Redeemed</span>
                <span style="color: var(--color-success); font-weight: 600;">${totalRedeemed}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Avg per Voucher</span>
                <span style="color: var(--color-primary); font-weight: 600;">${avgRedeemed}</span>
            </div>
        </div>
    `;
    document.getElementById('performanceMetrics').innerHTML = metricsHtml;
}

// ===== UTILITY FUNCTIONS =====
function getStatus(voucher) {
    const today = new Date().toISOString().split('T')[0];
    if (voucher.validUntil < today) return 'expired';
    if (voucher.validFrom > today) return 'inactive';
    return 'active';
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('de-DE');
}

function clearForm(formId) {
    document.getElementById(formId).reset();
}

function openCreateVoucher() {
    store.currentVoucher = null;
    document.getElementById('modalTitle').textContent = 'Create Voucher';
    clearVoucherForm();
    openModal('voucherModal');
}

function openEditVoucher(id) {
    const voucher = store.vouchers.find(v => v.id === id);
    if (!voucher) return;

    store.currentVoucher = voucher;
    document.getElementById('modalTitle').textContent = 'Edit Voucher';
    document.getElementById('voucherCode').value = voucher.code;
    document.getElementById('voucherOffer').value = voucher.offer;
    document.getElementById('voucherFrom').value = voucher.validFrom;
    document.getElementById('voucherUntil').value = voucher.validUntil;
    document.getElementById('voucherMaxUses').value = voucher.maxUses;
    openModal('voucherModal');
}

function clearVoucherForm() {
    document.getElementById('voucherCode').value = '';
    document.getElementById('voucherOffer').value = '';
    document.getElementById('voucherFrom').value = new Date().toISOString().split('T')[0];
    document.getElementById('voucherUntil').value = '';
    document.getElementById('voucherMaxUses').value = '0';
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showQRCode(voucherId) {
    const voucher = store.vouchers.find(v => v.id === voucherId);
    if (!voucher) return;

    store.currentVoucher = voucher;
    const qrValue = `${window.location.origin}/?code=${voucher.code}`;
    document.getElementById('qrCodeValue').textContent = qrValue;

    // Generate QR Code
    const qrContainer = document.getElementById('qrCodePlaceholder');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: qrValue,
        width: 250,
        height: 250,
        colorDark: '#000',
        colorLight: '#fff'
    });

    openModal('qrModal');
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    store.init();

    if (store.user) {
        showPage('appPage');
        updateUI();
    }

    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (login(email, password)) {
            document.getElementById('loginError').textContent = '';
        } else {
            document.getElementById('loginError').textContent = 'Invalid credentials';
        }
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            goToPage(item.dataset.page);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Voucher modals
    document.getElementById('createVoucherBtn').addEventListener('click', openCreateVoucher);
    document.getElementById('createVoucherBtn2').addEventListener('click', openCreateVoucher);
    document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal('voucherModal'));
    document.getElementById('modalCancelBtn').addEventListener('click', () => closeModal('voucherModal'));
    document.getElementById('qrModalCloseBtn').addEventListener('click', () => closeModal('qrModal'));

    // Save voucher
    document.getElementById('modalSaveBtn').addEventListener('click', () => {
        const data = {
            code: document.getElementById('voucherCode').value,
            offer: document.getElementById('voucherOffer').value,
            validFrom: document.getElementById('voucherFrom').value,
            validUntil: document.getElementById('voucherUntil').value,
            maxUses: document.getElementById('voucherMaxUses').value
        };

        if (!data.code || !data.offer || !data.validFrom || !data.validUntil) {
            alert('Please fill all fields');
            return;
        }

        if (store.currentVoucher) {
            updateVoucher(store.currentVoucher.id, data);
        } else {
            createVoucher(data);
        }
    });

    // QR Code actions
    document.getElementById('downloadQrBtn').addEventListener('click', () => {
        const canvas = document.querySelector('#qrCodePlaceholder canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL();
            link.download = `${store.currentVoucher.code}-qr.png`;
            link.click();
        }
    });

    document.getElementById('printQrBtn').addEventListener('click', () => {
        const canvas = document.querySelector('#qrCodePlaceholder canvas');
        if (canvas) {
            const printWindow = window.open();
            printWindow.document.write(`
                <html>
                <head><title>Print QR Code</title></head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <div style="text-align: center;">
                        <h1>${store.currentVoucher.code}</h1>
                        <p>${store.currentVoucher.offer}</p>
                        <img src="${canvas.toDataURL()}" style="width: 300px; height: 300px;">
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    });

    // Settings
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        store.user.name = document.getElementById('businessName').value;
        store.user.email = document.getElementById('businessEmail').value;
        store.save();
        alert('Settings saved!');
    });
});
