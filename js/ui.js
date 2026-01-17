/**
 * UI Module - Check Tracking System
 * Handles all DOM rendering and UI updates
 */

const UI = {
    elements: {},
    currentPage: 1,
    pageSize: CONFIG.TABLE.PAGE_SIZE,
    sortColumn: CONFIG.TABLE.SORT_COLUMN,
    sortDirection: CONFIG.TABLE.SORT_DIRECTION,
    currentFilter: 'all',
    searchQuery: '',

    /**
     * Initialize UI module
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Stats
            statTotal: document.getElementById('stat-total'),
            statToday: document.getElementById('stat-today'),
            statWeek: document.getElementById('stat-week'),
            statPending: document.getElementById('stat-pending'),
            statPaid: document.getElementById('stat-paid'),

            // Summary
            summaryUSD: document.getElementById('summary-usd'),
            summaryEUR: document.getElementById('summary-eur'),
            summaryTL: document.getElementById('summary-tl'),

            // Table
            tableBody: document.getElementById('checks-table-body'),
            searchInput: document.getElementById('search-input'),

            // Upcoming
            upcomingList: document.getElementById('upcoming-list'),
            upcomingCount: document.getElementById('upcoming-count'),

            // Modals
            checkModal: document.getElementById('check-modal'),
            checkForm: document.getElementById('check-form'),
            deleteModal: document.getElementById('delete-modal'),
            settingsModal: document.getElementById('settings-modal'),

            // Toast container
            toastContainer: document.getElementById('toast-container'),

            // Filters
            quickFilters: document.querySelectorAll('.quick-filter'),

            // Pagination
            pagination: document.getElementById('pagination'),
            paginationInfo: document.getElementById('pagination-info')
        };
    },

    /**
     * Bind events
     */
    bindEvents() {
        // Search
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input',
                Utils.debounce((e) => this.handleSearch(e.target.value), 300)
            );
        }

        // Quick filters
        this.elements.quickFilters?.forEach(btn => {
            btn.addEventListener('click', () => this.handleFilterClick(btn));
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Modal backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) this.closeAllModals();
            });
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });

        // Check form submit
        this.elements.checkForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });
    },

    /**
     * Render all dashboard components
     */
    render() {
        this.renderStats();
        this.renderTable();
        this.renderUpcoming();
        this.renderSummary();
    },

    /**
     * Render statistics cards
     */
    renderStats() {
        const stats = Data.getStats();

        if (this.elements.statTotal) {
            this.elements.statTotal.textContent = stats.total;
        }
        if (this.elements.statToday) {
            this.elements.statToday.textContent = stats.todayChecks;
        }
        if (this.elements.statWeek) {
            this.elements.statWeek.textContent = stats.weekChecks;
        }
        if (this.elements.statPending) {
            this.elements.statPending.textContent = stats.pending;
        }
        if (this.elements.statPaid) {
            this.elements.statPaid.textContent = stats.paid;
        }
    },

    /**
     * Render summary totals
     */
    renderSummary() {
        const stats = Data.getStats();

        if (this.elements.summaryUSD) {
            this.elements.summaryUSD.textContent = Utils.formatCurrency(stats.pendingUSD, 'USD');
        }
        if (this.elements.summaryEUR) {
            this.elements.summaryEUR.textContent = Utils.formatCurrency(stats.pendingEUR, 'EUR');
        }
        if (this.elements.summaryTL) {
            this.elements.summaryTL.textContent = Utils.formatCurrency(stats.pendingTL, 'TL');
        }
    },

    /**
     * Render checks table
     */
    renderTable() {
        if (!this.elements.tableBody) return;

        // Get filtered and sorted data
        let checks = this.getFilteredChecks();
        checks = Data.sort(checks, this.sortColumn, this.sortDirection);

        // Pagination
        const totalPages = Math.ceil(checks.length / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const paginatedChecks = checks.slice(start, start + this.pageSize);

        // Render rows
        if (paginatedChecks.length === 0) {
            this.elements.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 60px;">
            <div class="empty-state">
              <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 class="empty-state-title">Çek Bulunamadı</h3>
              <p class="empty-state-text">Arama kriterlerinize uygun çek bulunmuyor.</p>
            </div>
          </td>
        </tr>
      `;
        } else {
            this.elements.tableBody.innerHTML = paginatedChecks.map(check => this.renderTableRow(check)).join('');
        }

        // Render pagination
        this.renderPagination(checks.length, totalPages);

        // Bind row actions
        this.bindRowActions();
    },

    /**
     * Render single table row
     */
    renderTableRow(check) {
        const amount = Utils.getCheckAmount(check);
        const daysUntil = Utils.daysUntil(check.vade_tarihi);
        const statusClass = Utils.getStatusClass(check.odeme_durumu);
        const statusText = Utils.getStatusText(check.odeme_durumu);

        // Determine row urgency class
        let rowClass = '';
        if (check.odeme_durumu !== 'ÖDENDİ' && check.odeme_durumu !== 'İPTAL EDİLDİ') {
            if (daysUntil !== null) {
                if (daysUntil < 0) rowClass = 'overdue';
                else if (daysUntil === 0) rowClass = 'today';
                else if (daysUntil <= 3) rowClass = 'urgent';
            }
        }

        return `
      <tr data-id="${check.id}" class="${rowClass}">
        <td class="font-mono">${check.id}</td>
        <td class="company-cell" title="${Utils.escapeHtml(check.firma_adi)}">${Utils.escapeHtml(check.firma_adi)}</td>
        <td class="hide-mobile">${Utils.escapeHtml(check.cek_no) || '-'}</td>
        <td class="amount-cell">
          <span class="currency-icon ${amount.currency.toLowerCase()}">${amount.symbol}</span>
          ${Utils.formatNumber(amount.amount)}
        </td>
        <td class="hide-mobile">${Utils.escapeHtml(check.banka) || '-'}</td>
        <td class="date-cell">${Utils.formatDate(check.vade_tarihi)}</td>
        <td>
          <span class="badge ${statusClass}">${statusText}</span>
        </td>
        <td class="actions-cell">
          <button class="action-btn edit" data-action="edit" data-id="${check.id}" title="Düzenle">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="action-btn delete" data-action="delete" data-id="${check.id}" title="Sil">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
    },

    /**
     * Render pagination
     */
    renderPagination(totalItems, totalPages) {
        if (!this.elements.pagination) return;

        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, totalItems);

        if (this.elements.paginationInfo) {
            this.elements.paginationInfo.textContent =
                `${start}-${end} / ${totalItems} kayıt gösteriliyor`;
        }

        let html = `
      <button class="pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
    `;

        // Page numbers
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `
        <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
      `;
        }

        if (totalPages > 5) {
            html += `<span style="padding: 0 8px;">...</span>`;
            html += `
        <button class="pagination-btn ${totalPages === this.currentPage ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>
      `;
        }

        html += `
      <button class="pagination-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    `;

        this.elements.pagination.innerHTML = html;

        // Bind pagination events
        this.elements.pagination.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handlePaginationClick(btn.dataset.page, totalPages));
        });
    },

    /**
     * Handle pagination click
     */
    handlePaginationClick(page, totalPages) {
        if (page === 'prev') {
            this.currentPage = Math.max(1, this.currentPage - 1);
        } else if (page === 'next') {
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
        } else {
            this.currentPage = parseInt(page);
        }
        this.renderTable();
    },

    /**
     * Render upcoming checks
     */
    renderUpcoming() {
        if (!this.elements.upcomingList) return;

        const upcoming = Data.getUpcoming(14); // Next 14 days

        if (this.elements.upcomingCount) {
            this.elements.upcomingCount.textContent = upcoming.length;
        }

        if (upcoming.length === 0) {
            this.elements.upcomingList.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--success);">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p style="margin-top: 12px; color: var(--text-muted);">Yaklaşan vade yok</p>
        </div>
      `;
            return;
        }

        this.elements.upcomingList.innerHTML = upcoming.slice(0, 10).map(check => {
            const daysUntil = Utils.daysUntil(check.vade_tarihi);
            const amount = Utils.getCheckAmount(check);
            const date = new Date(check.vade_tarihi);

            let urgencyClass = 'week';
            let daysText = `${daysUntil} gün`;

            if (daysUntil === 0) {
                urgencyClass = 'today';
                daysText = 'Bugün';
            } else if (daysUntil === 1) {
                urgencyClass = 'today';
                daysText = 'Yarın';
            } else if (daysUntil <= 3) {
                urgencyClass = 'soon';
            }

            return `
        <div class="upcoming-item" data-id="${check.id}">
          <div class="upcoming-date-badge ${urgencyClass}">
            <span class="date-day">${date.getDate()}</span>
            <span class="date-month">${CONFIG.MONTHS_TR[date.getMonth()].substring(0, 3)}</span>
          </div>
          <div class="upcoming-info">
            <div class="upcoming-company">${Utils.escapeHtml(check.firma_adi)}</div>
            <div class="upcoming-details">${Utils.escapeHtml(check.banka) || 'Banka belirtilmedi'}</div>
          </div>
          <div class="upcoming-amount">
            <div class="upcoming-amount-value">${amount.symbol}${Utils.formatNumber(amount.amount)}</div>
            <span class="upcoming-days ${urgencyClass}">${daysText}</span>
          </div>
        </div>
      `;
        }).join('');

        // Bind click events
        this.elements.upcomingList.querySelectorAll('.upcoming-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                this.openEditModal(id);
            });
        });
    },

    /**
     * Get filtered checks based on current filter and search
     */
    getFilteredChecks() {
        const filters = {};

        if (this.currentFilter !== 'all') {
            filters.status = this.currentFilter;
        }

        return Data.search(this.searchQuery, filters);
    },

    /**
     * Handle search input
     */
    handleSearch(query) {
        this.searchQuery = query;
        this.currentPage = 1;
        this.renderTable();
    },

    /**
     * Handle filter click
     */
    handleFilterClick(btn) {
        this.elements.quickFilters.forEach(f => f.classList.remove('active'));
        btn.classList.add('active');

        this.currentFilter = btn.dataset.filter;
        this.currentPage = 1;
        this.renderTable();
    },

    /**
     * Bind row action buttons
     */
    bindRowActions() {
        document.querySelectorAll('.action-btn[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.openEditModal(id);
            });
        });

        document.querySelectorAll('.action-btn[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.openDeleteModal(id);
            });
        });
    },

    /**
     * Open add modal
     */
    openAddModal() {
        if (!this.elements.checkModal) return;

        document.getElementById('modal-title').textContent = 'Yeni Çek Ekle';
        this.elements.checkForm.reset();
        document.getElementById('check-id').value = '';

        this.elements.checkModal.classList.add('active');
    },

    /**
     * Open edit modal
     */
    openEditModal(id) {
        if (!this.elements.checkModal) return;

        const check = Data.getById(id);
        if (!check) return;

        document.getElementById('modal-title').textContent = 'Çek Düzenle';
        document.getElementById('check-id').value = check.id;
        document.getElementById('check-firma').value = check.firma_adi || '';
        document.getElementById('check-no').value = check.cek_no || '';
        document.getElementById('check-banka').value = check.banka || '';
        document.getElementById('check-tanzim').value = check.cek_tanzim_tarihi || '';
        document.getElementById('check-vade').value = check.vade_tarihi || '';
        document.getElementById('check-dolar').value = check.dolar || '';
        document.getElementById('check-euro').value = check.euro || '';
        document.getElementById('check-tl').value = check.tl || '';
        document.getElementById('check-durum').value = check.odeme_durumu || 'BEKLEMEDE';

        this.elements.checkModal.classList.add('active');
    },

    /**
     * Open delete confirmation modal
     */
    openDeleteModal(id) {
        if (!this.elements.deleteModal) return;

        const check = Data.getById(id);
        if (!check) return;

        const self = this;

        document.getElementById('delete-check-info').innerHTML = `
      <strong>${Utils.escapeHtml(check.firma_adi)}</strong><br>
      Çek No: ${Utils.escapeHtml(check.cek_no) || '-'}<br>
      Vade: ${Utils.formatDate(check.vade_tarihi)}
    `;

        document.getElementById('confirm-delete-btn').onclick = async function () {
            const btn = document.getElementById('confirm-delete-btn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Siliniyor...';

            try {
                await Data.delete(id);
                self.closeAllModals();
                self.render();
                self.showToast('success', 'Silindi', 'Çek GitHub\'dan silindi.');
            } catch (error) {
                self.showToast('danger', 'Hata', error.message || 'Silme hatası oluştu.');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        };

        this.elements.deleteModal.classList.add('active');
    },

    /**
     * Handle form submit
     */
    async handleFormSubmit() {
        const id = document.getElementById('check-id').value;

        const checkData = {
            firma_adi: document.getElementById('check-firma').value.trim(),
            cek_no: document.getElementById('check-no').value.trim(),
            banka: document.getElementById('check-banka').value,
            cek_tanzim_tarihi: document.getElementById('check-tanzim').value || null,
            vade_tarihi: document.getElementById('check-vade').value,
            dolar: parseFloat(document.getElementById('check-dolar').value) || null,
            euro: parseFloat(document.getElementById('check-euro').value) || null,
            tl: parseFloat(document.getElementById('check-tl').value) || null,
            odeme_durumu: document.getElementById('check-durum').value
        };

        // Validate
        if (!checkData.firma_adi) {
            this.showToast('danger', 'Hata', 'Firma adı gereklidir.');
            return;
        }

        if (!checkData.vade_tarihi) {
            this.showToast('danger', 'Hata', 'Vade tarihi gereklidir.');
            return;
        }

        if (!checkData.dolar && !checkData.euro && !checkData.tl) {
            this.showToast('danger', 'Hata', 'En az bir tutar girilmelidir.');
            return;
        }

        // Show saving indicator
        const saveBtn = document.querySelector('#check-form button[type="submit"], button[form="check-form"]');
        const originalText = saveBtn ? saveBtn.textContent : 'Kaydet';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Kaydediliyor...';
        }

        try {
            if (id) {
                // Update
                await Data.update(parseInt(id), checkData);
                this.showToast('success', 'Güncellendi', 'Çek bilgileri GitHub\'a kaydedildi.');
            } else {
                // Add new
                await Data.add(checkData);
                this.showToast('success', 'Eklendi', 'Yeni çek GitHub\'a kaydedildi.');
            }

            this.closeAllModals();
            this.render();

        } catch (error) {
            this.showToast('danger', 'Hata', error.message || 'Kaydetme hatası oluştu.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        }
    },

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.classList.remove('active');
        });
    },

    /**
     * Open settings modal
     */
    openSettingsModal() {
        if (!this.elements.settingsModal) return;

        // Load current settings
        const settings = Utils.storage.get(CONFIG.SETTINGS_KEY, {
            emailjs: CONFIG.EMAILJS,
            notifications: CONFIG.NOTIFICATION_DAYS,
            github_token: ''
        });

        document.getElementById('emailjs-service').value = settings.emailjs?.SERVICE_ID || '';
        document.getElementById('emailjs-template').value = settings.emailjs?.TEMPLATE_ID || '';
        document.getElementById('emailjs-key').value = settings.emailjs?.PUBLIC_KEY || '';
        document.getElementById('emailjs-to').value = settings.emailjs?.TO_EMAIL || '';

        // GitHub token
        var githubTokenInput = document.getElementById('github-token');
        if (githubTokenInput) {
            githubTokenInput.value = settings.github_token || '';
        }

        this.elements.settingsModal.classList.add('active');
    },

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            emailjs: {
                SERVICE_ID: document.getElementById('emailjs-service').value.trim(),
                TEMPLATE_ID: document.getElementById('emailjs-template').value.trim(),
                PUBLIC_KEY: document.getElementById('emailjs-key').value.trim(),
                TO_EMAIL: document.getElementById('emailjs-to').value.trim()
            },
            notifications: CONFIG.NOTIFICATION_DAYS,
            github_token: document.getElementById('github-token')?.value.trim() || ''
        };

        Utils.storage.set(CONFIG.SETTINGS_KEY, settings);

        // Update CONFIG
        CONFIG.EMAILJS = settings.emailjs;

        this.closeAllModals();
        this.showToast('success', 'Kaydedildi', 'Ayarlar başarıyla kaydedildi. Sayfa yenileniyor...');

        // Reload page to apply GitHub token
        setTimeout(function () {
            window.location.reload();
        }, 1500);
    },

    /**
     * Show toast notification
     */
    showToast(type, title, message) {
        const container = this.elements.toastContainer || document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
            danger: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
            warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
            info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type]}</svg>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;

        container.appendChild(toast);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
};

// Export for use in other modules
window.UI = UI;
