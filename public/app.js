// Simple Business Dashboard App
console.log('App.js loaded');

const app = {
    user: null,
    vouchers: [],
    currentPage: 'dashboard',
    currentVoucher: null,

    init() {
        console.log('Initializing app');
        this.loadFromStorage();
        this.attachEventListeners();

        if (this.user) {
            this.showDashboard();
        } else {
            this.showLogin();
        }
    },

    loadFromStorage() {
        const data = localStorage.getItem('app_data');
        if (data) {
            const parsed = JSON.parse(data);
            this.user = parsed.user;
            this.vouchers = parsed.vouchers || [];
        }
    },

    save() {
        localStorage.setItem('app_data', JSON.stringify({
            user: this.user,
            vouchers: this.vouchers
        }));
    },

    attachEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                this.handleLogin(email, password);
            });
        }

        // Nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.goToPage(page);
            });
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Voucher buttons
        document.getElementById('createVoucherBtn')?.addEventListener('click', () => this.openCreateModal());
        document.getElementById('createVoucherBtn2')?.addEventListener('click', () => this.openCreateModal());
        document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.closeModal('voucherModal'));
        document.getElementById('modalCancelBtn')?.addEventListener('click', () => this.closeModal('voucherModal'));
        document.getElementById('qrModalCloseBtn')?.addEventListener('click', () => this.closeModal('qrModal'));

        // Save voucher
        document.getElementById('modalSaveBtn')?.addEventListener('click', () => this.saveVoucher());

        // QR actions
        document.getElementById('downloadQrBtn')?.addEventListener('click', () => this.downloadQR());
        document.getElementById('printQrBtn')?.addEventListener('click', () => this.printQR());

        // Settings
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
    },

    handleLogin(email, password) {
        console.log('Login:', email, password);

        if (!email || !password) {
            document.getElementById('loginError').textContent = 'Email and password required';
            return;
        }

        this.user = {
            id: 'user_' + Date.now(),
            name: 'Demo Business',
            email: email
        };

        this.save();
        console.log('User logged in:', this.user);

        // Hide login, show app
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appPage').style.display = 'flex';

        this.showDashboard();
    },

    logout() {
        this.user = null;
        this.vouchers = [];
        this.save();
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appPage').style.display = 'none';
        document.getElementById('loginForm').reset();
    },

    showLogin() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appPage').style.display = 'none';
    },

    showDashboard() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appPage').style.display = 'flex';
        this.updateUserInfo();
        this.goToPage('dashboard');
    },

    updateUserInfo() {
        if (this.user) {
            document.getElementById('userName').textContent = this.user.name;
            document.getElementById('userEmail').textContent = this.user.email;
        }
    },

    goToPage(page) {
        console.log('Going to:', page);
        this.currentPage = page;

        // Hide all content pages
        document.querySelectorAll('.content > .page').forEach(p => {
            p.style.display = 'none';
        });

        // Show selected page
        const pageEl = document.getElementById(page + 'Page');
        if (pageEl) {
            pageEl.style.display = 'block';
        }

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            vouchers: 'All Vouchers',
            analytics: 'Analytics',
            settings: 'Settings'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Render content
        if (page === 'dashboard') {
            this.renderDashboard();
        } else if (page === 'vouchers') {
            this.renderVouchers();
        } else if (page === 'analytics') {
            this.renderAnalytics();
        } else if (page === 'settings') {
            this.renderSettings();
        }
    },

    renderDashboard() {
        const today = new Date().toISOString().split('T')[0];
        const active = this.vouchers.filter(v => v.validFrom <= today && v.validUntil >= today).length;
        const redeemed = this.vouchers.reduce((sum, v) => sum + v.redeemedCount, 0);

        document.getElementById('totalVouchers').textContent = this.vouchers.length;
        document.getElementById('activeToday').textContent = active;
        document.getElementById('totalRedeemed').textContent = redeemed;
        document.getElementById('conversionRate').textContent = this.vouchers.length > 0 ? Math.round(redeemed / this.vouchers.length * 100) + '%' : '0%';

        this.renderRecentVouchers();
    },

    renderRecentVouchers() {
        const tbody = document.getElementById('recentVouchersTable');
        const recent = this.vouchers.slice(-5).reverse();

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No vouchers yet</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(v => `
            <tr>
                <td><span class="voucher-code">${v.code}</span></td>
                <td>${v.offer}</td>
                <td><span class="voucher-status status-${this.getStatus(v)}">${this.getStatus(v)}</span></td>
                <td>${v.redeemedCount}/${v.maxUses || '∞'}</td>
                <td>${new Date(v.validUntil).toLocaleDateString('de-DE')}</td>
                <td><button onclick="app.showQR('${v.id}')" class="btn-icon btn-sm">📱</button></td>
            </tr>
        `).join('');
    },

    renderVouchers() {
        const tbody = document.getElementById('allVouchersTable');

        if (this.vouchers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No vouchers yet</td></tr>';
            return;
        }

        tbody.innerHTML = this.vouchers.map(v => `
            <tr>
                <td><span class="voucher-code">${v.code}</span></td>
                <td>${v.offer}</td>
                <td><span class="voucher-status status-${this.getStatus(v)}">${this.getStatus(v)}</span></td>
                <td>${v.redeemedCount}</td>
                <td>${v.maxUses || '∞'}</td>
                <td>${new Date(v.validUntil).toLocaleDateString('de-DE')}</td>
                <td>
                    <button onclick="app.showQR('${v.id}')" class="btn-icon btn-sm">📱</button>
                    <button onclick="app.editVoucher('${v.id}')" class="btn-icon btn-sm">✏️</button>
                    <button onclick="app.deleteVoucher('${v.id}')" class="btn-icon btn-sm">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    renderAnalytics() {
        if (this.vouchers.length === 0) {
            document.getElementById('topVouchersAnalytics').innerHTML = '<div class="empty-state">No data yet</div>';
            return;
        }

        const top = this.vouchers.sort((a, b) => b.redeemedCount - a.redeemedCount).slice(0, 5);
        const total = this.vouchers.reduce((s, v) => s + v.redeemedCount, 0);

        document.getElementById('topVouchersAnalytics').innerHTML = top.map(v => `
            <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between;">
                <span>${v.code}</span>
                <span style="color: var(--color-primary);">${v.redeemedCount}</span>
            </div>
        `).join('');

        document.getElementById('performanceMetrics').innerHTML = `
            <div style="padding: var(--space-md);">
                <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-md);">
                    <span>Total Redeemed</span>
                    <span style="color: var(--color-success); font-weight: 600;">${total}</span>
                </div>
            </div>
        `;
    },

    renderSettings() {
        document.getElementById('businessName').value = this.user.name;
        document.getElementById('businessEmail').value = this.user.email;
    },

    getStatus(v) {
        const today = new Date().toISOString().split('T')[0];
        if (v.validUntil < today) return 'expired';
        if (v.validFrom > today) return 'inactive';
        return 'active';
    },

    openCreateModal() {
        this.currentVoucher = null;
        document.getElementById('modalTitle').textContent = 'Create Voucher';
        document.getElementById('voucherCode').value = '';
        document.getElementById('voucherOffer').value = '';
        document.getElementById('voucherFrom').value = new Date().toISOString().split('T')[0];
        document.getElementById('voucherUntil').value = '';
        document.getElementById('voucherMaxUses').value = '0';
        this.openModal('voucherModal');
    },

    editVoucher(id) {
        this.currentVoucher = this.vouchers.find(v => v.id === id);
        if (!this.currentVoucher) return;

        document.getElementById('modalTitle').textContent = 'Edit Voucher';
        document.getElementById('voucherCode').value = this.currentVoucher.code;
        document.getElementById('voucherOffer').value = this.currentVoucher.offer;
        document.getElementById('voucherFrom').value = this.currentVoucher.validFrom;
        document.getElementById('voucherUntil').value = this.currentVoucher.validUntil;
        document.getElementById('voucherMaxUses').value = this.currentVoucher.maxUses;
        this.openModal('voucherModal');
    },

    deleteVoucher(id) {
        if (!confirm('Delete this voucher?')) return;
        this.vouchers = this.vouchers.filter(v => v.id !== id);
        this.save();
        this.goToPage(this.currentPage);
    },

    saveVoucher() {
        const code = document.getElementById('voucherCode').value;
        const offer = document.getElementById('voucherOffer').value;
        const from = document.getElementById('voucherFrom').value;
        const until = document.getElementById('voucherUntil').value;
        const max = parseInt(document.getElementById('voucherMaxUses').value) || 0;

        if (!code || !offer || !from || !until) {
            alert('Fill all fields');
            return;
        }

        if (this.currentVoucher) {
            this.currentVoucher.code = code;
            this.currentVoucher.offer = offer;
            this.currentVoucher.validFrom = from;
            this.currentVoucher.validUntil = until;
            this.currentVoucher.maxUses = max;
        } else {
            this.vouchers.push({
                id: 'v_' + Date.now(),
                code, offer, validFrom: from, validUntil: until,
                maxUses: max,
                redeemedCount: 0,
                createdAt: new Date().toISOString()
            });
        }

        this.save();
        this.closeModal('voucherModal');
        this.goToPage(this.currentPage);
    },

    showQR(id) {
        this.currentVoucher = this.vouchers.find(v => v.id === id);
        if (!this.currentVoucher) return;

        const qrValue = this.currentVoucher.code;
        document.getElementById('qrCodeValue').textContent = qrValue;

        const container = document.getElementById('qrCodePlaceholder');
        container.innerHTML = '';

        try {
            new QRCode(container, {
                text: qrValue,
                width: 250,
                height: 250,
                colorDark: '#fff',
                colorLight: '#000'
            });
        } catch (e) {
            container.textContent = 'QR: ' + qrValue;
        }

        this.openModal('qrModal');
    },

    downloadQR() {
        const canvas = document.querySelector('#qrCodePlaceholder canvas');
        if (canvas) {
            const a = document.createElement('a');
            a.href = canvas.toDataURL();
            a.download = this.currentVoucher.code + '.png';
            a.click();
        }
    },

    printQR() {
        const w = window.open();
        w.document.write(`<h1>${this.currentVoucher.code}</h1><p>${this.currentVoucher.offer}</p>`);
        const canvas = document.querySelector('#qrCodePlaceholder canvas');
        if (canvas) {
            const img = document.createElement('img');
            img.src = canvas.toDataURL();
            img.style.width = '300px';
            w.document.body.appendChild(img);
        }
        w.print();
    },

    saveSettings() {
        this.user.name = document.getElementById('businessName').value;
        this.user.email = document.getElementById('businessEmail').value;
        this.save();
        alert('Saved!');
    },

    openModal(id) {
        document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
};

// Start app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    app.init();
});
