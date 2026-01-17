/**
 * Email Module - Check Tracking System
 * Handles EmailJS integration for notifications
 */

const Email = {
    isInitialized: false,

    /**
     * Initialize EmailJS
     */
    async init() {
        // Load settings from storage
        var settings = Utils.storage.get(CONFIG.SETTINGS_KEY, { emailjs: CONFIG.EMAILJS });
        if (settings && settings.emailjs) {
            CONFIG.EMAILJS.SERVICE_ID = settings.emailjs.SERVICE_ID || '';
            CONFIG.EMAILJS.TEMPLATE_ID = settings.emailjs.TEMPLATE_ID || '';
            CONFIG.EMAILJS.PUBLIC_KEY = settings.emailjs.PUBLIC_KEY || '';
            CONFIG.EMAILJS.TO_EMAIL = settings.emailjs.TO_EMAIL || '';
        }

        // Check if configured
        if (!CONFIG.EMAILJS.PUBLIC_KEY) {
            console.log('EmailJS not configured - no public key');
            return false;
        }

        // Load EmailJS SDK
        return this.loadEmailJS();
    },

    /**
     * Reload settings and reinitialize (called after saving settings)
     */
    async reinitialize() {
        this.isInitialized = false;
        return this.init();
    },

    /**
     * Load EmailJS SDK from CDN
     */
    loadEmailJS: function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (window.emailjs) {
                self.initializeSDK();
                resolve(true);
                return;
            }

            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = function () {
                self.initializeSDK();
                resolve(true);
            };
            script.onerror = function () {
                console.error('Failed to load EmailJS');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    },

    /**
     * Initialize EmailJS SDK with public key
     */
    initializeSDK: function () {
        if (window.emailjs && CONFIG.EMAILJS.PUBLIC_KEY) {
            emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
            this.isInitialized = true;
            console.log('EmailJS initialized with key:', CONFIG.EMAILJS.PUBLIC_KEY.substring(0, 5) + '...');
        }
    },

    /**
     * Send notification email
     */
    async sendNotification(checks, type) {
        type = type || 'reminder';

        // Reload settings before sending
        var settings = Utils.storage.get(CONFIG.SETTINGS_KEY, { emailjs: {} });
        if (settings && settings.emailjs) {
            CONFIG.EMAILJS.SERVICE_ID = settings.emailjs.SERVICE_ID || CONFIG.EMAILJS.SERVICE_ID;
            CONFIG.EMAILJS.TEMPLATE_ID = settings.emailjs.TEMPLATE_ID || CONFIG.EMAILJS.TEMPLATE_ID;
            CONFIG.EMAILJS.PUBLIC_KEY = settings.emailjs.PUBLIC_KEY || CONFIG.EMAILJS.PUBLIC_KEY;
            CONFIG.EMAILJS.TO_EMAIL = settings.emailjs.TO_EMAIL || CONFIG.EMAILJS.TO_EMAIL;
        }

        // Initialize if not already done
        if (!this.isInitialized && CONFIG.EMAILJS.PUBLIC_KEY) {
            await this.loadEmailJS();
        }

        if (!this.isInitialized) {
            console.warn('EmailJS not initialized');
            return { success: false, error: 'EmailJS yapilandirilmamis. Lutfen ayarlardan yapilandirin.' };
        }

        if (!CONFIG.EMAILJS.SERVICE_ID || !CONFIG.EMAILJS.TEMPLATE_ID) {
            return { success: false, error: 'Service ID veya Template ID eksik' };
        }

        if (!CONFIG.EMAILJS.TO_EMAIL) {
            return { success: false, error: 'Bildirim email adresi eksik' };
        }

        // Build check list HTML
        var checkList = checks.map(function (check) {
            var amount = Utils.getCheckAmount(check);
            var days = Utils.daysUntil(check.vade_tarihi);
            var daysText = days + ' gun';
            if (days === 0) daysText = 'BUGUN';
            if (days === 1) daysText = 'YARIN';

            return '• ' + check.firma_adi + ' - ' + amount.symbol + Utils.formatNumber(amount.amount) + ' - Vade: ' + Utils.formatDate(check.vade_tarihi) + ' (' + daysText + ')';
        }).join('\n');

        // Calculate totals
        var totalUSD = 0, totalEUR = 0, totalTL = 0;
        checks.forEach(function (check) {
            if (check.dolar) totalUSD += check.dolar;
            if (check.euro) totalEUR += check.euro;
            if (check.tl) totalTL += check.tl;
        });

        var totalAmount = [];
        if (totalUSD > 0) totalAmount.push('$' + Utils.formatNumber(totalUSD));
        if (totalEUR > 0) totalAmount.push('€' + Utils.formatNumber(totalEUR));
        if (totalTL > 0) totalAmount.push('₺' + Utils.formatNumber(totalTL));

        var templateParams = {
            to_email: CONFIG.EMAILJS.TO_EMAIL,
            subject: type === 'test'
                ? 'Test: Cek Takip Sistemi Bildirimi'
                : 'Yaklasan Cek Vadesi: ' + checks.length + ' cek',
            check_count: checks.length,
            check_list: checkList,
            total_amount: totalAmount.join(' + '),
            notification_date: Utils.formatDate(new Date().toISOString(), 'long')
        };

        try {
            console.log('Sending email with params:', templateParams);
            var response = await emailjs.send(
                CONFIG.EMAILJS.SERVICE_ID,
                CONFIG.EMAILJS.TEMPLATE_ID,
                templateParams
            );

            console.log('Email sent successfully:', response);
            return { success: true, response: response };
        } catch (error) {
            console.error('Email send failed:', error);
            return { success: false, error: error.text || error.message || 'Email gonderilemedi' };
        }
    },

    /**
     * Send test email
     */
    async sendTestEmail() {
        // Reload settings first
        var settings = Utils.storage.get(CONFIG.SETTINGS_KEY, { emailjs: {} });
        if (settings && settings.emailjs) {
            CONFIG.EMAILJS.SERVICE_ID = settings.emailjs.SERVICE_ID || '';
            CONFIG.EMAILJS.TEMPLATE_ID = settings.emailjs.TEMPLATE_ID || '';
            CONFIG.EMAILJS.PUBLIC_KEY = settings.emailjs.PUBLIC_KEY || '';
            CONFIG.EMAILJS.TO_EMAIL = settings.emailjs.TO_EMAIL || '';
        }

        // Check if all required fields are present
        if (!CONFIG.EMAILJS.SERVICE_ID) {
            return { success: false, error: 'Service ID eksik' };
        }
        if (!CONFIG.EMAILJS.TEMPLATE_ID) {
            return { success: false, error: 'Template ID eksik' };
        }
        if (!CONFIG.EMAILJS.PUBLIC_KEY) {
            return { success: false, error: 'Public Key eksik' };
        }
        if (!CONFIG.EMAILJS.TO_EMAIL) {
            return { success: false, error: 'Email adresi eksik' };
        }

        // Initialize if not already done
        if (!this.isInitialized) {
            await this.loadEmailJS();
        }

        // Create fake check for test
        var testCheck = {
            id: 0,
            firma_adi: 'TEST FIRMASI',
            cek_no: 'TEST-001',
            euro: 10000,
            vade_tarihi: new Date().toISOString().split('T')[0],
            banka: 'TEST BANKASI'
        };

        return this.sendNotification([testCheck], 'test');
    },

    /**
     * Check for notifications and send if needed
     */
    async checkAndSendNotifications() {
        if (!this.isInitialized) return;

        var notifications = Data.getChecksForNotification();
        var allChecks = []
            .concat(notifications.today)
            .concat(notifications.in3Days)
            .concat(notifications.in7Days);

        if (allChecks.length === 0) {
            console.log('No checks requiring notification');
            return;
        }

        // Check if we already sent notification today
        var lastSent = Utils.storage.get('last_notification_date');
        var today = new Date().toISOString().split('T')[0];

        if (lastSent === today) {
            console.log('Notification already sent today');
            return;
        }

        // Send notification
        var result = await this.sendNotification(allChecks);

        if (result.success) {
            Utils.storage.set('last_notification_date', today);
            UI.showToast('success', 'Bildirim Gonderildi', allChecks.length + ' cek icin email bildirimi gonderildi.');
        }

        return result;
    },

    /**
     * Get configuration status
     */
    isConfigured: function () {
        var settings = Utils.storage.get(CONFIG.SETTINGS_KEY, { emailjs: {} });
        var emailjs = settings.emailjs || {};
        return !!(
            emailjs.SERVICE_ID &&
            emailjs.TEMPLATE_ID &&
            emailjs.PUBLIC_KEY &&
            emailjs.TO_EMAIL
        );
    }
};

// Export for use in other modules
window.Email = Email;
