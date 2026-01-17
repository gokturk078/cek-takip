/**
 * Data Module - Check Tracking System
 * Handles all data operations: CRUD, import/export, sync
 */

const Data = {
    checks: [],
    isLoaded: false,
    hasChanges: false,

    /**
     * Initialize data module
     */
    async init() {
        await this.loadData();
        return this.checks;
    },

    /**
     * Load data from localStorage or JSON file
     */
    async loadData() {
        // First try localStorage
        const localData = Utils.storage.get(CONFIG.DATA_KEY);

        if (localData && localData.checks && localData.checks.length > 0) {
            this.checks = localData.checks;
            this.isLoaded = true;
            console.log('Loaded from localStorage:', this.checks.length, 'checks');
            return;
        }

        // Otherwise load from JSON file
        try {
            const response = await fetch(CONFIG.DATA_URL);
            if (!response.ok) throw new Error('Failed to fetch data: ' + response.status);

            const data = await response.json();
            this.checks = data.checks || [];
            this.saveToLocal();
            this.isLoaded = true;
            console.log('Loaded from JSON file:', this.checks.length, 'checks');
        } catch (error) {
            console.error('Error loading data:', error);
            // Initialize with empty array instead of failing
            this.checks = [];
            this.isLoaded = true;
        }
    },

    /**
     * Save data to localStorage
     */
    saveToLocal() {
        const data = {
            checks: this.checks,
            lastUpdated: new Date().toISOString()
        };
        Utils.storage.set(CONFIG.DATA_KEY, data);
        this.hasChanges = true;
    },

    /**
     * Get all checks
     */
    getAll() {
        return [...this.checks];
    },

    /**
     * Get check by ID
     */
    getById(id) {
        return this.checks.find(check => check.id === id);
    },

    /**
     * Add new check
     */
    add(checkData) {
        const newCheck = {
            id: this.getNextId(),
            ...checkData,
            createdAt: new Date().toISOString()
        };

        this.checks.push(newCheck);
        this.saveToLocal();

        return newCheck;
    },

    /**
     * Update existing check
     */
    update(id, checkData) {
        const index = this.checks.findIndex(check => check.id === id);
        if (index === -1) return null;

        this.checks[index] = {
            ...this.checks[index],
            ...checkData,
            updatedAt: new Date().toISOString()
        };

        this.saveToLocal();
        return this.checks[index];
    },

    /**
     * Delete check
     */
    delete(id) {
        const index = this.checks.findIndex(check => check.id === id);
        if (index === -1) return false;

        this.checks.splice(index, 1);
        this.saveToLocal();
        return true;
    },

    /**
     * Get next available ID
     */
    getNextId() {
        if (this.checks.length === 0) return 1;
        const maxId = Math.max(...this.checks.map(c => c.id || 0));
        return maxId + 1;
    },

    /**
     * Get statistics
     */
    getStats() {
        const total = this.checks.length;
        const paid = this.checks.filter(c => c.odeme_durumu === 'ÖDENDİ').length;
        const cancelled = this.checks.filter(c => c.odeme_durumu === 'İPTAL EDİLDİ').length;
        const pending = total - paid - cancelled;

        // Calculate totals by currency
        let totalUSD = 0, totalEUR = 0, totalTL = 0;
        let pendingUSD = 0, pendingEUR = 0, pendingTL = 0;

        this.checks.forEach(check => {
            if (check.dolar) totalUSD += check.dolar;
            if (check.euro) totalEUR += check.euro;
            if (check.tl) totalTL += check.tl;

            if (check.odeme_durumu !== 'ÖDENDİ' && check.odeme_durumu !== 'İPTAL EDİLDİ') {
                if (check.dolar) pendingUSD += check.dolar;
                if (check.euro) pendingEUR += check.euro;
                if (check.tl) pendingTL += check.tl;
            }
        });

        // Today's checks
        const today = new Date().toISOString().split('T')[0];
        const todayChecks = this.checks.filter(c =>
            c.vade_tarihi === today &&
            c.odeme_durumu !== 'ÖDENDİ' &&
            c.odeme_durumu !== 'İPTAL EDİLDİ'
        ).length;

        // This week's checks
        const weekChecks = this.checks.filter(c =>
            Utils.isDateInRange(c.vade_tarihi, 7) &&
            c.odeme_durumu !== 'ÖDENDİ' &&
            c.odeme_durumu !== 'İPTAL EDİLDİ'
        ).length;

        return {
            total,
            paid,
            pending,
            cancelled,
            todayChecks,
            weekChecks,
            totalUSD,
            totalEUR,
            totalTL,
            pendingUSD,
            pendingEUR,
            pendingTL
        };
    },

    /**
     * Get upcoming checks (within specified days)
     */
    getUpcoming(days = 7) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.checks
            .filter(check => {
                if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                    return false;
                }

                if (!check.vade_tarihi) return false;

                const dueDate = new Date(check.vade_tarihi);
                dueDate.setHours(0, 0, 0, 0);

                const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= days;
            })
            .sort((a, b) => new Date(a.vade_tarihi) - new Date(b.vade_tarihi));
    },

    /**
     * Get overdue checks
     */
    getOverdue() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.checks.filter(check => {
            if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                return false;
            }

            if (!check.vade_tarihi) return false;

            const dueDate = new Date(check.vade_tarihi);
            dueDate.setHours(0, 0, 0, 0);

            return dueDate < today;
        });
    },

    /**
     * Search and filter checks
     */
    search(query, filters = {}) {
        let results = [...this.checks];

        // Text search
        if (query) {
            const q = query.toLowerCase().trim();
            results = results.filter(check =>
                (check.firma_adi && check.firma_adi.toLowerCase().includes(q)) ||
                (check.cek_no && check.cek_no.toLowerCase().includes(q)) ||
                (check.banka && check.banka.toLowerCase().includes(q))
            );
        }

        // Status filter
        if (filters.status) {
            if (filters.status === 'BEKLEMEDE') {
                results = results.filter(c =>
                    c.odeme_durumu !== 'ÖDENDİ' && c.odeme_durumu !== 'İPTAL EDİLDİ'
                );
            } else {
                results = results.filter(c => c.odeme_durumu === filters.status);
            }
        }

        // Currency filter
        if (filters.currency) {
            if (filters.currency === 'USD') {
                results = results.filter(c => c.dolar && c.dolar > 0);
            } else if (filters.currency === 'EUR') {
                results = results.filter(c => c.euro && c.euro > 0);
            } else if (filters.currency === 'TL') {
                results = results.filter(c => c.tl && c.tl > 0);
            }
        }

        // Bank filter
        if (filters.bank) {
            results = results.filter(c => c.banka === filters.bank);
        }

        // Date range filter
        if (filters.dateFrom) {
            results = results.filter(c => c.vade_tarihi >= filters.dateFrom);
        }
        if (filters.dateTo) {
            results = results.filter(c => c.vade_tarihi <= filters.dateTo);
        }

        return results;
    },

    /**
     * Sort checks
     */
    sort(checks, column, direction = 'asc') {
        return [...checks].sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            // Handle null values
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            // Handle date columns
            if (column.includes('tarihi')) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }

            // Handle numeric columns
            if (['dolar', 'euro', 'tl', 'id'].includes(column)) {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            }

            // Handle string columns
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    /**
     * Export data as JSON
     */
    exportJSON() {
        const data = {
            checks: this.checks,
            exportedAt: new Date().toISOString(),
            totalChecks: this.checks.length
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `cek-takip-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * Import data from JSON file
     */
    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.checks || !Array.isArray(data.checks)) {
                        reject(new Error('Geçersiz dosya formatı'));
                        return;
                    }

                    this.checks = data.checks;
                    this.saveToLocal();
                    resolve({ count: this.checks.length });
                } catch (error) {
                    reject(new Error('JSON dosyası okunamadı'));
                }
            };

            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsText(file);
        });
    },

    /**
     * Reset to original data from JSON file
     */
    async resetToOriginal() {
        Utils.storage.remove(CONFIG.DATA_KEY);
        await this.loadData();
        return this.checks;
    },

    /**
     * Get unique companies
     */
    getCompanies() {
        const companies = new Set(this.checks.map(c => c.firma_adi).filter(Boolean));
        return Array.from(companies).sort();
    },

    /**
     * Get checks by company
     */
    getByCompany(companyName) {
        return this.checks.filter(c => c.firma_adi === companyName);
    },

    /**
     * Get checks that need notification
     */
    getChecksForNotification() {
        const result = {
            today: [],
            in3Days: [],
            in7Days: []
        };

        this.checks.forEach(check => {
            if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                return;
            }

            const days = Utils.daysUntil(check.vade_tarihi);
            if (days === null) return;

            if (days === 0 || days === 1) {
                result.today.push(check);
            } else if (days === 3) {
                result.in3Days.push(check);
            } else if (days === 7) {
                result.in7Days.push(check);
            }
        });

        return result;
    }
};

// Export for use in other modules
window.Data = Data;
