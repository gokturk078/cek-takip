/**
 * Authentication Module - Check Tracking System
 * Handles login, session management, and security
 */

const Auth = {
    isAdmin: false,

    /**
     * Initialize auth module
     */
    init() {
        this.checkSession();
        // Force admin logout on init to prevent persistence
        this.logoutAdmin();
    },

    /**
   * Check if user has valid session
   */
    isAuthenticated() {
        const session = Utils.storage.get(CONFIG.SESSION_KEY);
        if (!session) return false;

        // Check if session is expired
        if (Date.now() > session.expiresAt) {
            Utils.storage.remove(CONFIG.SESSION_KEY);
            return false;
        }

        return true;
    },

    /**
     * Validate password and create session
     */
    async login(password) {
        // Direct comparison for demo (in production, use proper hashing)
        if (password === CONFIG.PASSWORD_PLAIN) {
            this.createSession();
            return { success: true };
        }

        return {
            success: false,
            error: 'Hatalı şifre. Lütfen tekrar deneyin.'
        };
    },

    /**
     * Create new session
     */
    createSession() {
        const session = {
            createdAt: Date.now(),
            expiresAt: Date.now() + CONFIG.SESSION_TIMEOUT,
            token: Utils.generateId()
        };
        Utils.storage.set(CONFIG.SESSION_KEY, session);
    },

    /**
     * Verify Admin Password (Hash comparison)
     */
    async attemptAdminLogin(password) {
        const storedHash = Utils.storage.get('admin_password_hash');
        // Default: admin123 (SHA-256)
        const defaultHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
        const targetHash = storedHash || defaultHash;

        const inputHash = await Utils.hashPassword(password);

        if (inputHash === targetHash) {
            this.loginAdmin();
            return { success: true };
        }

        return { success: false, error: 'Hatalı yönetici şifresi' };
    },

    /**
     * Enable Admin Mode
     */
    loginAdmin(password, skipCheck = false) {
        this.isAdmin = true;
        document.body.classList.add('admin-mode');
        // Do not persist admin mode
        // Utils.storage.set('admin_mode', true);
        console.log('Admin mode enabled');

        // Trigger UI refresh if needed
        if (window.UI) UI.render();
    },

    /**
     * Disable Admin Mode
     */
    logoutAdmin() {
        this.isAdmin = false;
        document.body.classList.remove('admin-mode');
        Utils.storage.remove('admin_mode');
        console.log('Admin mode disabled');

        // Trigger UI refresh
        if (window.UI) UI.render();
    },

    /**
     * Change Admin Password
     */
    async changeAdminPassword(currentPassword, newPassword) {
        // Verify current first
        const verify = await this.attemptAdminLogin(currentPassword);
        if (!verify.success) {
            return verify;
        }

        if (!newPassword || newPassword.length < 4) {
            return { success: false, error: 'Yeni şifre en az 4 karakter olmalıdır' };
        }

        const newHash = await Utils.hashPassword(newPassword);
        Utils.storage.set('admin_password_hash', newHash);

        return { success: true };
    },

    /**
     * Extend session timeout
     */
    extendSession() {
        const session = Utils.storage.get(CONFIG.SESSION_KEY);
        if (session) {
            session.expiresAt = Date.now() + CONFIG.SESSION_TIMEOUT;
            Utils.storage.set(CONFIG.SESSION_KEY, session);
        }
    },

    /**
     * Logout and clear session
     */
    logout() {
        this.logoutAdmin();
        Utils.storage.remove(CONFIG.SESSION_KEY);
        window.location.href = 'login.html';
    },

    /**
   * Check session and redirect if needed
   * Only called explicitly, not automatically
   */
    checkSession() {
        // Handle file protocol or local server paths
        const path = window.location.pathname;
        const isLoginPage = path.includes('login.html');
        const isAuthenticated = this.isAuthenticated();

        if (isLoginPage && isAuthenticated) {
            // Already logged in, redirect to dashboard
            window.location.href = 'index.html';
        } else if (!isLoginPage && !isAuthenticated) {
            // Not logged in and trying to access protected page
            console.log('No session, redirecting to login...');
            window.location.href = 'login.html';
        }
    },

    /**
     * Get remaining session time
     */
    getSessionTimeRemaining() {
        const session = Utils.storage.get(CONFIG.SESSION_KEY);
        if (!session) return 0;

        const remaining = session.expiresAt - Date.now();
        return remaining > 0 ? remaining : 0;
    },

    /**
     * Format remaining time as MM:SS
     */
    formatSessionTime() {
        const remaining = this.getSessionTimeRemaining();
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
};

// Export for use in other modules
window.Auth = Auth;
