// VoucherFlow App - Complete State Management & Functionality

const app = {
  state: {
    loggedIn: false,
    user: {
      email: '',
      name: '',
      company: ''
    },
    vouchers: [],
    currentVoucherId: null,
    settings: {
      companyName: 'Café Mocha',
      email: 'contact@cafemocha.de',
      phone: '+49 30 12345678'
    }
  },

  init() {
    this.loadFromStorage();

    // Hide loading screen after 3 seconds
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }, 3000);

    // Show login if not logged in
    if (!this.state.loggedIn) {
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('app').style.display = 'none';
    } else {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      this.renderDashboard();
    }
  },

  saveToStorage() {
    localStorage.setItem('vf', JSON.stringify(this.state));
  },

  loadFromStorage() {
    const stored = localStorage.getItem('vf');
    if (stored) {
      this.state = JSON.parse(stored);
    }
  },

  showLoginPage() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('app').style.display = 'none';
  },

  showAppPages() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.querySelectorAll('.page').forEach(el => {
      el.style.display = 'none';
    });
    document.getElementById('dashboardPage').style.display = 'block';
  },

  handleLogin(event) {
    if (event) {
      event.preventDefault();
    }

    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
      alert('Bitte alle Felder ausfüllen');
      return;
    }

    this.state.loggedIn = true;
    this.state.user = {
      email: email,
      name: email.split('@')[0],
      company: 'Café Mocha'
    };

    this.saveToStorage();
    this.showAppPages();
    this.renderDashboard();
  },

  handleLogout() {
    this.state.loggedIn = false;
    this.saveToStorage();
    this.showLoginPage();

    // Clear form
    document.querySelector('input[type="email"]').value = '';
    document.querySelector('input[type="password"]').value = '';
  },

  switchPage(pageId, event) {
    if (event) {
      event.preventDefault();
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (event && event.target) {
      event.target.classList.add('active');
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });

    // Show selected page
    const page = document.getElementById(pageId);
    if (page) {
      page.style.display = 'block';
    }

    // Render page content
    if (pageId === 'dashboardPage') {
      this.renderDashboard();
    } else if (pageId === 'vouchersPage') {
      this.renderVouchers();
    } else if (pageId === 'analyticsPage') {
      this.renderAnalytics();
    } else if (pageId === 'settingsPage') {
      this.renderSettings();
    }
  },

  renderDashboard() {
    const statsContainer = document.querySelector('.stats-grid');
    if (!statsContainer) return;

    const totalVouchers = this.state.vouchers.length;
    const redeemed = this.state.vouchers.filter(v => v.redeemed).length;
    const pending = totalVouchers - redeemed;
    const redemptionRate = totalVouchers > 0 ? ((redeemed / totalVouchers) * 100).toFixed(1) : 0;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Vouchers</div>
        <div class="stat-value">${totalVouchers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Redeemed</div>
        <div class="stat-value">${redeemed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending</div>
        <div class="stat-value">${pending}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Redemption Rate</div>
        <div class="stat-value">${redemptionRate}%</div>
      </div>
    `;

    // Render recent vouchers
    this.renderRecentVouchers();
  },

  renderRecentVouchers() {
    const container = document.querySelector('.recent-vouchers-list');
    if (!container) return;

    const recent = this.state.vouchers.slice(-3).reverse();

    if (recent.length === 0) {
      container.innerHTML = '<p style="color: #a8a8b8; text-align: center; padding: 20px;">No vouchers yet. Create one!</p>';
      return;
    }

    container.innerHTML = recent.map((v, idx) => `
      <div class="voucher-card" style="animation-delay: ${idx * 0.1}s">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-weight: 700; margin-bottom: 4px;">${v.title}</div>
            <div style="font-size: 14px; color: #a8a8b8;">${v.description}</div>
            <div style="font-size: 12px; color: #e91e8c; margin-top: 8px; font-weight: 700;">${v.value}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-icon" onclick="app.showQR('${v.id}')">QR</button>
            <button class="btn-icon" onclick="app.editVoucher('${v.id}')">Edit</button>
            <button class="btn-icon" onclick="app.deleteVoucher('${v.id}')">Del</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderVouchers() {
    const container = document.querySelector('.vouchers-list');
    if (!container) return;

    if (this.state.vouchers.length === 0) {
      container.innerHTML = '<p style="color: #a8a8b8; text-align: center; padding: 40px;">No vouchers yet. Create your first one!</p>';
      return;
    }

    container.innerHTML = this.state.vouchers.map((v, idx) => `
      <div class="voucher-card" style="animation-delay: ${idx * 0.1}s">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-weight: 700; margin-bottom: 4px;">${v.title}</div>
            <div style="font-size: 13px; color: #a8a8b8; margin-bottom: 8px;">${v.description}</div>
            <div style="display: flex; gap: 12px; font-size: 12px;">
              <span style="color: #e91e8c;">${v.value}</span>
              <span style="color: #a8a8b8;">${new Date(v.created).toLocaleDateString('de-DE')}</span>
              ${v.redeemed ? '<span style="color: #4caf50;">✓ Redeemed</span>' : '<span style="color: #ff9800;">Pending</span>'}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button class="btn-icon" onclick="app.showQR('${v.id}')">QR</button>
            <button class="btn-icon" onclick="app.editVoucher('${v.id}')">Edit</button>
            <button class="btn-icon" onclick="app.toggleRedeem('${v.id}')">${v.redeemed ? 'Undo' : 'Mark Redeemed'}</button>
            <button class="btn-icon" onclick="app.deleteVoucher('${v.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderAnalytics() {
    const container = document.querySelector('.analytics-content');
    if (!container) return;

    const totalVouchers = this.state.vouchers.length;
    const redeemed = this.state.vouchers.filter(v => v.redeemed).length;
    const pending = totalVouchers - redeemed;
    const redemptionRate = totalVouchers > 0 ? ((redeemed / totalVouchers) * 100).toFixed(1) : 0;

    // Group by date
    const byDate = {};
    this.state.vouchers.forEach(v => {
      const date = new Date(v.created).toLocaleDateString('de-DE');
      if (!byDate[date]) byDate[date] = { total: 0, redeemed: 0 };
      byDate[date].total++;
      if (v.redeemed) byDate[date].redeemed++;
    });

    const dateChart = Object.entries(byDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, data]) => `
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span>${date}</span>
            <span>${data.redeemed}/${data.total} redeemed</span>
          </div>
          <div style="background: rgba(168, 168, 184, 0.1); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #e91e8c, #ff4ca6); height: 100%; width: ${data.total > 0 ? (data.redeemed / data.total) * 100 : 0}%;"></div>
          </div>
        </div>
      `).join('');

    container.innerHTML = `
      <div style="padding: 20px; background: rgba(233, 30, 140, 0.1); border-radius: 12px; margin-bottom: 28px;">
        <div style="font-weight: 700; margin-bottom: 12px;">Overall Statistics</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; font-size: 13px;">
          <div>
            <div style="color: #a8a8b8; margin-bottom: 4px;">Total</div>
            <div style="font-size: 20px; font-weight: 700; color: #e91e8c;">${totalVouchers}</div>
          </div>
          <div>
            <div style="color: #a8a8b8; margin-bottom: 4px;">Redeemed</div>
            <div style="font-size: 20px; font-weight: 700; color: #4caf50;">${redeemed}</div>
          </div>
          <div>
            <div style="color: #a8a8b8; margin-bottom: 4px;">Pending</div>
            <div style="font-size: 20px; font-weight: 700; color: #ff9800;">${pending}</div>
          </div>
          <div>
            <div style="color: #a8a8b8; margin-bottom: 4px;">Rate</div>
            <div style="font-size: 20px; font-weight: 700; color: #2196f3;">${redemptionRate}%</div>
          </div>
        </div>
      </div>
      <div style="padding: 20px; background: rgba(168, 168, 184, 0.05); border-radius: 12px; border: 1px solid rgba(168, 168, 184, 0.1);">
        <div style="font-weight: 700; margin-bottom: 20px;">Redemption Timeline</div>
        ${dateChart}
      </div>
    `;
  },

  renderSettings() {
    const nameInput = document.querySelector('input[name="companyName"]');
    const emailInput = document.querySelector('input[name="email"]');
    const phoneInput = document.querySelector('input[name="phone"]');

    if (nameInput) nameInput.value = this.state.settings.companyName;
    if (emailInput) emailInput.value = this.state.settings.email;
    if (phoneInput) phoneInput.value = this.state.settings.phone;
  },

  openCreateModal() {
    const modal = document.getElementById('voucherModal');
    if (modal) {
      modal.style.display = 'block';
      this.currentVoucherId = null;
      document.querySelector('input[name="voucherTitle"]').value = '';
      document.querySelector('input[name="voucherValue"]').value = '';
      document.querySelector('textarea[name="voucherDescription"]').value = '';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  },

  saveVoucher() {
    const title = document.querySelector('input[name="voucherTitle"]').value;
    const value = document.querySelector('input[name="voucherValue"]').value;
    const description = document.querySelector('textarea[name="voucherDescription"]').value;

    if (!title || !value) {
      alert('Bitte alle erforderlichen Felder ausfüllen');
      return;
    }

    if (this.currentVoucherId) {
      // Edit existing
      const voucher = this.state.vouchers.find(v => v.id === this.currentVoucherId);
      if (voucher) {
        voucher.title = title;
        voucher.value = value;
        voucher.description = description;
        voucher.updated = new Date().toISOString();
      }
    } else {
      // Create new
      this.state.vouchers.push({
        id: 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title,
        value,
        description,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        redeemed: false,
        qrData: null
      });
    }

    this.saveToStorage();
    this.closeModal('voucherModal');
    this.renderDashboard();
    this.renderVouchers();
  },

  editVoucher(id) {
    const voucher = this.state.vouchers.find(v => v.id === id);
    if (voucher) {
      this.currentVoucherId = id;
      document.querySelector('input[name="voucherTitle"]').value = voucher.title;
      document.querySelector('input[name="voucherValue"]').value = voucher.value;
      document.querySelector('textarea[name="voucherDescription"]').value = voucher.description;
      this.openCreateModal();
    }
  },

  deleteVoucher(id) {
    if (confirm('Voucher wirklich löschen?')) {
      this.state.vouchers = this.state.vouchers.filter(v => v.id !== id);
      this.saveToStorage();
      this.renderDashboard();
      this.renderVouchers();
    }
  },

  toggleRedeem(id) {
    const voucher = this.state.vouchers.find(v => v.id === id);
    if (voucher) {
      voucher.redeemed = !voucher.redeemed;
      this.saveToStorage();
      this.renderDashboard();
      this.renderVouchers();
      this.renderAnalytics();
    }
  },

  showQR(id) {
    const voucher = this.state.vouchers.find(v => v.id === id);
    if (!voucher) return;

    this.currentVoucherId = id;
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
      qrContainer.innerHTML = '';

      const qrData = JSON.stringify({
        id: voucher.id,
        title: voucher.title,
        value: voucher.value,
        timestamp: new Date().toISOString()
      });

      new QRCode(qrContainer, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#e91e8c',
        colorLight: '#0a0a12',
        correctLevel: QRCode.CorrectLevel.H
      });

      // Store for download
      voucher.qrData = qrData;
      this.saveToStorage();
    }

    const modal = document.getElementById('qrModal');
    if (modal) {
      modal.style.display = 'block';
    }
  },

  downloadQR() {
    const canvas = document.querySelector('#qrCodeContainer canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `voucher_${this.currentVoucherId}.png`;
    link.click();
  },

  saveSettings() {
    this.state.settings.companyName = document.querySelector('input[name="companyName"]').value || 'Café Mocha';
    this.state.settings.email = document.querySelector('input[name="email"]').value || 'contact@example.de';
    this.state.settings.phone = document.querySelector('input[name="phone"]').value || '+49 30 12345678';

    this.saveToStorage();
    alert('Einstellungen gespeichert!');
  },

  addTestData() {
    const testVouchers = [
      { title: 'Free Coffee', value: 'Free', description: 'Gratis Kaffee für dich' },
      { title: '20% Off', value: '20%', description: 'Rabatt auf die gesamte Bestellung' },
      { title: 'Free Cake Slice', value: 'Free', description: 'Ein Stück Kuchen kostenlos' },
      { title: '€5 Off', value: '€5', description: 'Rabatt von 5 Euro' },
      { title: 'Buy 1 Get 1', value: 'B1G1', description: 'Kaufe eins, bekomme eins kostenlos' }
    ];

    testVouchers.forEach(test => {
      this.state.vouchers.push({
        id: 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: test.title,
        value: test.value,
        description: test.description,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        redeemed: Math.random() > 0.5,
        qrData: null
      });
    });

    this.saveToStorage();
    this.renderDashboard();
    this.renderVouchers();
    this.renderAnalytics();
    alert('Sample vouchers added!');
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Make handlers globally available
function handleLogin(event) {
  app.handleLogin(event);
}

function handleLogout() {
  app.handleLogout();
}

function switchPage(pageId, event) {
  app.switchPage(pageId, event);
}

function openCreateModal() {
  app.openCreateModal();
}

function closeModal(modalId) {
  app.closeModal(modalId);
}

function saveVoucher() {
  app.saveVoucher();
}

function showQR(id) {
  app.showQR(id);
}

function downloadQR() {
  app.downloadQR();
}

function saveSettings() {
  app.saveSettings();
}

function addTestData() {
  app.addTestData();
}