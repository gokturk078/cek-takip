/**
 * Data Module - Check Tracking System
 * Handles all data operations with GitHub persistence
 */

const Data = {
    checks: [],
    isLoaded: false,
    hasChanges: false,
    isSaving: false,

    /**
     * Initialize data module
     */
    async init() {
        await this.loadData();
        return this.checks;
    },

    /**
     * Load data from GitHub
     */
    async loadData() {
        try {
            // Try to load from GitHub first
            var githubData = await GitHub.fetchData();

            if (githubData && githubData.checks) {
                this.checks = githubData.checks;
                this.isLoaded = true;
                console.log('Loaded from GitHub:', this.checks.length, 'checks');
                return;
            }

            // Fallback to local JSON file
            console.log('Falling back to local JSON file...');
            var response = await fetch(CONFIG.DATA_URL);
            if (!response.ok) throw new Error('Failed to fetch local data');

            var data = await response.json();
            this.checks = data.checks || [];
            this.isLoaded = true;
            console.log('Loaded from local file:', this.checks.length, 'checks');

        } catch (error) {
            console.error('Error loading data:', error);
            this.checks = [];
            this.isLoaded = true;
        }
    },

    /**
     * Save data to GitHub
     */
    async saveToGitHub() {
        if (this.isSaving) {
            console.log('Already saving, skipping...');
            return { success: false, error: 'Zaten kaydediliyor' };
        }

        this.isSaving = true;

        try {
            var data = {
                checks: this.checks,
                lastUpdated: new Date().toISOString(),
                totalChecks: this.checks.length
            };

            var result = await GitHub.saveData(data);

            if (result.success) {
                this.hasChanges = false;
                console.log('Data saved to GitHub successfully');
            }

            return result;

        } catch (error) {
            console.error('Error saving to GitHub:', error);
            return { success: false, error: error.message };

        } finally {
            this.isSaving = false;
        }
    },

    /**
     * Get all checks
     */
    getAll: function () {
        return this.checks.slice();
    },

    /**
     * Get check by ID
     */
    getById: function (id) {
        return this.checks.find(function (check) {
            return check.id === id;
        });
    },

    /**
     * Add new check
     */
    async add(checkData) {
        var newCheck = {
            id: this.getNextId(),
            firma_adi: checkData.firma_adi,
            cek_no: checkData.cek_no,
            banka: checkData.banka,
            cek_tanzim_tarihi: checkData.cek_tanzim_tarihi,
            vade_tarihi: checkData.vade_tarihi,
            dolar: checkData.dolar,
            euro: checkData.euro,
            tl: checkData.tl,
            odeme_durumu: checkData.odeme_durumu || 'BEKLEMEDE',
            createdAt: new Date().toISOString()
        };

        this.checks.push(newCheck);
        this.hasChanges = true;

        // Save to GitHub
        var result = await this.saveToGitHub();

        if (!result.success) {
            // Rollback on failure
            this.checks.pop();
            throw new Error(result.error || 'Kaydetme hatasi');
        }

        return newCheck;
    },

    /**
     * Update existing check
     */
    async update(id, checkData) {
        var index = -1;
        for (var i = 0; i < this.checks.length; i++) {
            if (this.checks[i].id === id) {
                index = i;
                break;
            }
        }

        if (index === -1) return null;

        var oldCheck = Object.assign({}, this.checks[index]);

        this.checks[index] = Object.assign({}, this.checks[index], checkData, {
            updatedAt: new Date().toISOString()
        });

        this.hasChanges = true;

        // Save to GitHub
        var result = await this.saveToGitHub();

        if (!result.success) {
            // Rollback on failure
            this.checks[index] = oldCheck;
            throw new Error(result.error || 'Guncelleme hatasi');
        }

        return this.checks[index];
    },

    /**
     * Delete check
     */
    async delete(id) {
        var index = -1;
        for (var i = 0; i < this.checks.length; i++) {
            if (this.checks[i].id === id) {
                index = i;
                break;
            }
        }

        if (index === -1) return false;

        var deletedCheck = this.checks.splice(index, 1)[0];
        this.hasChanges = true;

        // Save to GitHub
        var result = await this.saveToGitHub();

        if (!result.success) {
            // Rollback on failure
            this.checks.splice(index, 0, deletedCheck);
            throw new Error(result.error || 'Silme hatasi');
        }

        return true;
    },

    /**
     * Get next available ID
     */
    getNextId: function () {
        if (this.checks.length === 0) return 1;
        var maxId = 0;
        for (var i = 0; i < this.checks.length; i++) {
            if (this.checks[i].id && this.checks[i].id > maxId) {
                maxId = this.checks[i].id;
            }
        }
        return maxId + 1;
    },

    /**
     * Get statistics
     */
    getStats: function () {
        var total = this.checks.length;
        var paid = 0, cancelled = 0;
        var totalUSD = 0, totalEUR = 0, totalTL = 0;
        var pendingUSD = 0, pendingEUR = 0, pendingTL = 0;
        var todayStr = new Date().toISOString().split('T')[0];
        var todayChecks = 0, weekChecks = 0;

        for (var i = 0; i < this.checks.length; i++) {
            var c = this.checks[i];

            if (c.odeme_durumu === 'ÖDENDİ') paid++;
            if (c.odeme_durumu === 'İPTAL EDİLDİ') cancelled++;

            if (c.dolar) totalUSD += c.dolar;
            if (c.euro) totalEUR += c.euro;
            if (c.tl) totalTL += c.tl;

            var isPending = c.odeme_durumu !== 'ÖDENDİ' && c.odeme_durumu !== 'İPTAL EDİLDİ';

            if (isPending) {
                if (c.dolar) pendingUSD += c.dolar;
                if (c.euro) pendingEUR += c.euro;
                if (c.tl) pendingTL += c.tl;

                if (c.vade_tarihi === todayStr) todayChecks++;
                if (Utils.isDateInRange(c.vade_tarihi, 7)) weekChecks++;
            }
        }

        return {
            total: total,
            paid: paid,
            pending: total - paid - cancelled,
            cancelled: cancelled,
            todayChecks: todayChecks,
            weekChecks: weekChecks,
            totalUSD: totalUSD,
            totalEUR: totalEUR,
            totalTL: totalTL,
            pendingUSD: pendingUSD,
            pendingEUR: pendingEUR,
            pendingTL: pendingTL
        };
    },

    /**
     * Get upcoming checks (within specified days)
     */
    getUpcoming: function (days) {
        days = days || 7;
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var upcoming = [];

        for (var i = 0; i < this.checks.length; i++) {
            var check = this.checks[i];

            if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                continue;
            }

            if (!check.vade_tarihi) continue;

            var dueDate = new Date(check.vade_tarihi);
            dueDate.setHours(0, 0, 0, 0);

            var diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= days) {
                upcoming.push(check);
            }
        }

        upcoming.sort(function (a, b) {
            return new Date(a.vade_tarihi) - new Date(b.vade_tarihi);
        });

        return upcoming;
    },

    /**
     * Get overdue checks
     */
    getOverdue: function () {
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var overdue = [];

        for (var i = 0; i < this.checks.length; i++) {
            var check = this.checks[i];

            if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                continue;
            }

            if (!check.vade_tarihi) continue;

            var dueDate = new Date(check.vade_tarihi);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) {
                overdue.push(check);
            }
        }

        return overdue;
    },

    /**
     * Search and filter checks
     */
    search: function (query, filters) {
        filters = filters || {};
        var results = this.checks.slice();

        // Text search
        if (query) {
            var q = query.toLowerCase().trim();
            results = results.filter(function (check) {
                return (check.firma_adi && check.firma_adi.toLowerCase().indexOf(q) !== -1) ||
                    (check.cek_no && check.cek_no.toLowerCase().indexOf(q) !== -1) ||
                    (check.banka && check.banka.toLowerCase().indexOf(q) !== -1);
            });
        }

        // Status filter
        if (filters.status) {
            if (filters.status === 'BEKLEMEDE') {
                results = results.filter(function (c) {
                    return c.odeme_durumu !== 'ÖDENDİ' && c.odeme_durumu !== 'İPTAL EDİLDİ';
                });
            } else {
                var statusFilter = filters.status;
                results = results.filter(function (c) {
                    return c.odeme_durumu === statusFilter;
                });
            }
        }

        // Currency filter
        if (filters.currency) {
            if (filters.currency === 'USD') {
                results = results.filter(function (c) { return c.dolar && c.dolar > 0; });
            } else if (filters.currency === 'EUR') {
                results = results.filter(function (c) { return c.euro && c.euro > 0; });
            } else if (filters.currency === 'TL') {
                results = results.filter(function (c) { return c.tl && c.tl > 0; });
            }
        }

        // Bank filter
        if (filters.bank) {
            var bankFilter = filters.bank;
            results = results.filter(function (c) { return c.banka === bankFilter; });
        }

        return results;
    },

    /**
     * Sort checks
     */
    sort: function (checks, column, direction) {
        direction = direction || 'asc';

        return checks.slice().sort(function (a, b) {
            var valA = a[column];
            var valB = b[column];

            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            // Handle date columns
            if (column.indexOf('tarihi') !== -1) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }

            // Handle numeric columns
            if (column === 'dolar' || column === 'euro' || column === 'tl' || column === 'id') {
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
    exportJSON: function () {
        var data = {
            checks: this.checks,
            exportedAt: new Date().toISOString(),
            totalChecks: this.checks.length
        };

        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = 'cek-takip-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * Import data from JSON file
     */
    importJSON: function (file) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();

            reader.onload = async function (e) {
                try {
                    var data = JSON.parse(e.target.result);

                    if (!data.checks || !Array.isArray(data.checks)) {
                        reject(new Error('Gecersiz dosya formati'));
                        return;
                    }

                    self.checks = data.checks;

                    // Save to GitHub
                    var result = await self.saveToGitHub();

                    if (result.success) {
                        resolve({ count: self.checks.length });
                    } else {
                        reject(new Error(result.error || 'GitHub kayit hatasi'));
                    }

                } catch (error) {
                    reject(new Error('JSON dosyasi okunamadi'));
                }
            };

            reader.onerror = function () {
                reject(new Error('Dosya okunamadi'));
            };

            reader.readAsText(file);
        });
    },

    /**
     * Get checks that need notification
     */
    getChecksForNotification: function () {
        var result = {
            today: [],
            in3Days: [],
            in7Days: []
        };

        for (var i = 0; i < this.checks.length; i++) {
            var check = this.checks[i];

            if (check.odeme_durumu === 'ÖDENDİ' || check.odeme_durumu === 'İPTAL EDİLDİ') {
                continue;
            }

            var days = Utils.daysUntil(check.vade_tarihi);
            if (days === null) continue;

            if (days === 0 || days === 1) {
                result.today.push(check);
            } else if (days === 3) {
                result.in3Days.push(check);
            } else if (days === 7) {
                result.in7Days.push(check);
            }
        }

        return result;
    }
};

// Export for use in other modules
window.Data = Data;
