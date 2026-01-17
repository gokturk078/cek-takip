/**
 * Authentication Module - Check Tracking System
 * Handles login, session management, and security
 */

const Auth = {
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
