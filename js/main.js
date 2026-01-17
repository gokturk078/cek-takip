/**
 * Main Application - Check Tracking System
 * Entry point and global event handling
 */

const App = {
    /**
     * Initialize application
     */
    async init() {
        console.log('Initializing Check Tracking System...');

        // Always hide loading first in case of any error
        const hideLoadingGuarantee = function () {
            const loader = document.getElementById('loading-overlay');
            if (loader) loader.style.display = 'none';
        };

        // Safety timeout - hide loading after 10 seconds no matter what
        setTimeout(hideLoadingGuarantee, 10000);

        // Check authentication first
        if (!Auth.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login...');
            hideLoadingGuarantee();
            window.location.href = 'login.html';
            return;
        }

        // Show loading
        this.showLoading();

        try {
            // Load data
            await Data.init();
            console.log('Data loaded:', Data.checks.length, 'checks');

            // Initialize UI
            UI.init();
            console.log('UI initialized');

            // Render dashboard
            UI.render();
            console.log('Dashboard rendered');

            // Hide loading IMMEDIATELY after UI renders
            hideLoadingGuarantee();

            // Initialize charts (completely non-blocking)
            try {
                Charts.init();
                console.log('Charts initializing (background)');
            } catch (chartError) {
                console.warn('Charts initialization failed:', chartError);
            }

            // Initialize email (non-blocking)
            Email.init().catch(function (e) {
                console.warn('Email init failed:', e);
            });

            // Bind global events
            this.bindEvents();

            // Check for notifications (non-blocking)
            setTimeout(function () {
                Email.checkAndSendNotifications().catch(function (e) {
                    console.warn('Notification check failed:', e);
                });
            }, 2000);

            console.log('Application ready!');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            hideLoadingGuarantee();

            // Still try to show some UI
            try {
                UI.init();
                UI.showToast('danger', 'Hata', 'Uygulama baslatilirken bir hata olustu.');
            } catch (e) {
                console.error('UI init also failed:', e);
            }
        }
    },

    /**
     * Bind global events
     */
    bindEvents: function () {
        var self = this;

        // Sidebar navigation
        document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
            item.addEventListener('click', function () {
                self.handleNavigation(item.dataset.page);
            });
        });

        // Add check button
        var addCheckBtn = document.getElementById('add-check-btn');
        if (addCheckBtn) {
            addCheckBtn.addEventListener('click', function () {
                UI.openAddModal();
            });
        }

        // Settings button
        var settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function () {
                UI.openSettingsModal();
            });
        }

        // Save settings button
        var saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', function () {
                UI.saveSettings();
            });
        }

        // Test email button
        var testEmailBtn = document.getElementById('test-email-btn');
        if (testEmailBtn) {
            testEmailBtn.addEventListener('click', async function () {
                var btn = document.getElementById('test-email-btn');
                btn.disabled = true;
                btn.textContent = 'Gonderiliyor...';

                var result = await Email.sendTestEmail();

                btn.disabled = false;
                btn.textContent = 'Test Email Gonder';

                if (result.success) {
                    UI.showToast('success', 'Email Gonderildi', 'Test emaili basariyla gonderildi.');
                } else {
                    UI.showToast('danger', 'Hata', result.error || 'Email gonderilemedi.');
                }
            });
        }

        // Export button
        var exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                Data.exportJSON();
                UI.showToast('success', 'Indirildi', 'JSON dosyasi indirildi.');
            });
        }

        // Import button
        var importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', function () {
                document.getElementById('import-file').click();
            });
        }

        // Import file input
        var importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.addEventListener('change', async function (e) {
                var file = e.target.files[0];
                if (!file) return;

                try {
                    var result = await Data.importJSON(file);
                    UI.render();
                    Charts.refresh();
                    UI.showToast('success', 'Ice Aktarildi', result.count + ' cek basariyla ice aktarildi.');
                } catch (error) {
                    UI.showToast('danger', 'Hata', error.message);
                }

                e.target.value = '';
            });
        }

        // Logout button
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                Auth.logout();
            });
        }

        // Mobile menu toggle
        var mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', function () {
                document.querySelector('.sidebar').classList.toggle('active');
                var overlay = document.querySelector('.sidebar-overlay');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        // Sidebar overlay click
        var sidebarOverlay = document.querySelector('.sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function () {
                document.querySelector('.sidebar').classList.remove('active');
                document.querySelector('.sidebar-overlay').classList.remove('active');
            });
        }

        // Session timeout warning
        this.startSessionMonitor();
    },

    /**
     * Handle navigation
     */
    handleNavigation: function (page) {
        // Update active state in sidebar
        document.querySelectorAll('.nav-item').forEach(function (item) {
            item.classList.remove('active');
        });
        var activeItem = document.querySelector('.nav-item[data-page="' + page + '"]');
        if (activeItem) activeItem.classList.add('active');

        // Handle settings modal
        if (page === 'settings') {
            UI.openSettingsModal();
            return;
        }

        // Update quick filter buttons and table based on navigation
        var quickFilters = document.querySelectorAll('.quick-filter');

        if (page === 'dashboard') {
            // Show all checks
            quickFilters.forEach(function (f) { f.classList.remove('active'); });
            var allBtn = document.querySelector('.quick-filter[data-filter="all"]');
            if (allBtn) allBtn.classList.add('active');
            UI.currentFilter = 'all';
            UI.currentPage = 1;
            UI.renderTable();
            UI.renderStats();
            UI.renderUpcoming();
            UI.renderSummary();
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } else if (page === 'checks') {
            // Show all checks, scroll to table
            quickFilters.forEach(function (f) { f.classList.remove('active'); });
            var allBtn2 = document.querySelector('.quick-filter[data-filter="all"]');
            if (allBtn2) allBtn2.classList.add('active');
            UI.currentFilter = 'all';
            UI.currentPage = 1;
            UI.renderTable();
            var tableWrapper = document.querySelector('.table-wrapper');
            if (tableWrapper) {
                tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

        } else if (page === 'pending') {
            // Show only pending checks
            quickFilters.forEach(function (f) { f.classList.remove('active'); });
            var pendingBtn = document.querySelector('.quick-filter[data-filter="BEKLEMEDE"]');
            if (pendingBtn) pendingBtn.classList.add('active');
            UI.currentFilter = 'BEKLEMEDE';
            UI.currentPage = 1;
            UI.renderTable();
            var tableWrapper2 = document.querySelector('.table-wrapper');
            if (tableWrapper2) {
                tableWrapper2.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // Update page title
        var pageTitle = document.querySelector('.page-title');
        var pageSubtitle = document.querySelector('.page-subtitle');
        if (pageTitle) {
            if (page === 'dashboard') {
                pageTitle.textContent = 'Çek Takip Paneli';
                if (pageSubtitle) pageSubtitle.textContent = 'Hoş geldiniz! Tüm çek işlemlerinizi buradan yönetebilirsiniz.';
            } else if (page === 'checks') {
                pageTitle.textContent = 'Tüm Çekler';
                if (pageSubtitle) pageSubtitle.textContent = 'Sistemdeki tüm çekleri görüntüleyin ve yönetin.';
            } else if (page === 'pending') {
                pageTitle.textContent = 'Bekleyen Çekler';
                if (pageSubtitle) pageSubtitle.textContent = 'Henüz ödenmemiş çekleri görüntüleyin.';
            }
        }

        // Close mobile menu if open
        var sidebar = document.querySelector('.sidebar');
        var overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    },

    /**
     * Show loading overlay
     */
    showLoading: function () {
        var loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'flex';
    },

    /**
     * Hide loading overlay
     */
    hideLoading: function () {
        var loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'none';
    },

    /**
     * Start session timeout monitor
     */
    startSessionMonitor: function () {
        setInterval(function () {
            var remaining = Auth.getSessionTimeRemaining();

            // Warn 5 minutes before session expires
            if (remaining > 0 && remaining < 5 * 60 * 1000) {
                var timer = document.getElementById('session-timer');
                if (timer) timer.textContent = 'Oturum: ' + Auth.formatSessionTime();
            }

            // Logout when session expires
            if (remaining <= 0) {
                UI.showToast('warning', 'Oturum Suresi Doldu', 'Yeniden giris yapmaniz gerekiyor.');
                setTimeout(function () {
                    Auth.logout();
                }, 2000);
            }
        }, 1000);
    },

    /**
     * Refresh all data
     */
    refresh: async function () {
        await Data.loadData();
        UI.render();
        Charts.refresh();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    App.init();
});

// Extend session on user activity (debounced)
var activityTimeout = null;
['click', 'keypress', 'touchstart'].forEach(function (event) {
    document.addEventListener(event, function () {
        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(function () {
            if (Auth.isAuthenticated()) {
                Auth.extendSession();
            }
        }, 1000);
    }, { passive: true });
});

// Export for global access
window.App = App;
