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
     * Attempt admin login with password
     */
    async attemptAdminLogin(password) {
        // Default admin password - ALWAYS check this first
        const DEFAULT_ADMIN_PASSWORD = 'admin123';

        // Always allow default password
        if (password === DEFAULT_ADMIN_PASSWORD) {
            this.loginAdmin();
            return { success: true };
        }

        // Then check custom password if set
        const storedHash = Utils.storage.get('admin_password_hash');
        if (storedHash) {
            try {
                const inputHash = await Utils.hashPassword(password);
                if (inputHash === storedHash) {
                    this.loginAdmin();
                    return { success: true };
                }
            } catch (e) {
                console.error('Hash error:', e);
            }
        }

        return { success: false, error: 'Hatalı yönetici şifresi' };
    },

    /**
     * Enable admin mode
     */
    loginAdmin() {
        this.isAdmin = true;
        document.body.classList.add('admin-mode');
        console.log('Admin mode enabled');

        // Refresh UI if available
        if (window.UI) UI.render();
    },

    /**
     * Disable admin mode
     */
    logoutAdmin() {
        this.isAdmin = false;
        document.body.classList.remove('admin-mode');
        console.log('Admin mode disabled');

        // Refresh UI if available
        if (window.UI) UI.render();
    },

    /**
     * Change admin password
     */
    async changeAdminPassword(currentPassword, newPassword) {
        // Default admin password
        const DEFAULT_ADMIN_PASSWORD = 'admin123';

        // Check if custom password is set
        const storedHash = Utils.storage.get('admin_password_hash');

        let isCurrentValid = false;

        if (storedHash) {
            // Custom password set - use hash comparison
            const currentHash = await Utils.hashPassword(currentPassword);
            isCurrentValid = (currentHash === storedHash);
        } else {
            // Default password - direct comparison
            isCurrentValid = (currentPassword === DEFAULT_ADMIN_PASSWORD);
        }

        if (!isCurrentValid) {
            return { success: false, error: 'Mevcut şifre hatalı' };
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
        Utils.storage.remove(CONFIG.SESSION_KEY);
        window.location.href = 'login.html';
    },

    /**
   * Check session and redirect if needed
   * Only called explicitly, not automatically
   */
    checkSession() {
        const isLoginPage = window.location.pathname.includes('login.html');
        const isAuthenticated = this.isAuthenticated();

        if (isLoginPage && isAuthenticated) {
            // Already logged in, redirect to dashboard
            window.location.href = 'index.html';
        }
        // Don't auto-redirect from index to login - let App.init handle it
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
