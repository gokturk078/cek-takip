/**
 * Configuration - Check Tracking System
 * Contains all app configuration, constants and settings
 */

const CONFIG = {
  // App Info
  APP_NAME: 'AS Çek Takip Sistemi',
  APP_VERSION: '1.0.0',

  // Security - Password hash (SHA-256 of 'cektakip2026')
  // To generate: echo -n 'cektakip2026' | sha256sum
  PASSWORD_HASH: '8b1a9953c4611296a827abf8c47804d7e6c49c6b8154936c0f2c0fb9b686f4e6',
  PASSWORD_PLAIN: 'cektakip2026', // For demo, remove in production

  // Session
  SESSION_KEY: 'cek_takip_session',
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in ms

  // Data Keys
  DATA_KEY: 'cek_takip_data',
  SETTINGS_KEY: 'cek_takip_settings',

  // API Endpoints
  DATA_URL: 'data/checks.json',

  // Notification Settings (days before due date)
  NOTIFICATION_DAYS: [1, 3, 7],

  // EmailJS Configuration
  EMAILJS: {
    SERVICE_ID: 'service_zdaq63r',
    TEMPLATE_ID: 'template_lax6rje',
    PUBLIC_KEY: 'GAJf2bvJK9_BidpcQ',
    TO_EMAIL: 'repsammuhasebe392@gmail.com'
  },

  // Table Settings
  TABLE: {
    PAGE_SIZE: 20,
    SORT_COLUMN: 'vade_tarihi',
    SORT_DIRECTION: 'asc'
  },

  // Currency Symbols
  CURRENCY: {
    TL: '₺',
    USD: '$',
    EUR: '€'
  },

  // Status Types
  STATUS: {
    PAID: 'ÖDENDİ',
    PENDING: 'BEKLEMEDE',
    CANCELLED: 'İPTAL EDİLDİ'
  },

  // Banks
  BANKS: [
    'GARANTİ BANKASI',
    'NEARESTBANK',
    'NEAR EAST BANK'
  ],

  // Turkish month names
  MONTHS_TR: [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ],

  // Turkish day names
  DAYS_TR: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
};

// Helper Functions
const Utils = {
  /**
   * Format number with thousand separators
   */
  formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  },

  /**
   * Format currency with symbol
   */
  formatCurrency(amount, currency) {
    if (amount === null || amount === undefined) return '-';
    const symbol = CONFIG.CURRENCY[currency] || '';
    return `${symbol}${Utils.formatNumber(amount)}`;
  },

  /**
   * Format date to Turkish locale
   */
  formatDate(dateStr, format = 'short') {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date)) return '-';

    if (format === 'short') {
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } else if (format === 'long') {
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } else if (format === 'relative') {
      return Utils.getRelativeDate(date);
    }
    return dateStr;
  },

  /**
   * Get relative date (e.g., "2 gün sonra")
   */
  getRelativeDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    if (diffDays === -1) return 'Dün';
    if (diffDays > 0) return `${diffDays} gün sonra`;
    return `${Math.abs(diffDays)} gün önce`;
  },

  /**
   * Calculate days until date
   */
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if date is within range
   */
  isDateInRange(dateStr, daysAhead) {
    const days = Utils.daysUntil(dateStr);
    return days !== null && days >= 0 && days <= daysAhead;
  },

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Simple hash function (for demo, not cryptographically secure)
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Get status badge class
   */
  getStatusClass(status) {
    if (!status) return 'badge-warning';
    const normalized = status.toUpperCase().trim();
    if (normalized === 'ÖDENDİ') return 'badge-success';
    if (normalized === 'İPTAL EDİLDİ') return 'badge-default';
    return 'badge-warning';
  },

  /**
   * Get status display text
   */
  getStatusText(status) {
    if (!status || status === 'BEKLEMEDE') return 'Beklemede';
    if (status === 'ÖDENDİ') return 'Ödendi';
    if (status === 'İPTAL EDİLDİ') return 'İptal';
    return status;
  },

  /**
   * Get check amount and currency
   */
  getCheckAmount(check) {
    if (check.dolar) return { amount: check.dolar, currency: 'USD', symbol: '$' };
    if (check.euro) return { amount: check.euro, currency: 'EUR', symbol: '€' };
    if (check.tl) return { amount: check.tl, currency: 'TL', symbol: '₺' };
    return { amount: 0, currency: 'TL', symbol: '₺' };
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Parse date string to Date object
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date) ? null : date;
  },

  /**
   * Local storage wrapper with JSON parsing
   */
  storage: {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      localStorage.removeItem(key);
    }
  }
};

// Export for use in other modules
window.CONFIG = CONFIG;
window.Utils = Utils;
