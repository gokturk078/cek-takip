/**
 * Charts Module - Check Tracking System
 * Creates interactive charts using Chart.js
 */

const Charts = {
    currencyChart: null,
    monthlyChart: null,
    chartJSLoaded: false,

    /**
     * Initialize charts
     */
    init() {
        // Use setTimeout to make non-blocking
        setTimeout(() => {
            this.loadChartJS()
                .then(() => {
                    this.chartJSLoaded = true;
                    this.renderCurrencyChart();
                    this.renderMonthlyChart();
                })
                .catch(err => {
                    console.warn('Chart.js yüklenemedi:', err);
                });
        }, 100);
    },

    /**
     * Load Chart.js from CDN with timeout
     */
    loadChartJS() {
        return new Promise((resolve, reject) => {
            if (window.Chart) {
                resolve();
                return;
            }

            // Timeout after 5 seconds
            const timeout = setTimeout(() => {
                reject(new Error('Chart.js load timeout'));
            }, 5000);

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

            script.onload = () => {
                clearTimeout(timeout);
                resolve();
            };

            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Chart.js load failed'));
            };

            document.head.appendChild(script);
        });
    },

    /**
     * Render currency distribution pie chart
     */
    renderCurrencyChart() {
        const canvas = document.getElementById('currency-chart');
        if (!canvas || !window.Chart) return;

        try {
            const stats = Data.getStats();

            // Destroy existing chart
            if (this.currencyChart) {
                this.currencyChart.destroy();
            }

            const ctx = canvas.getContext('2d');

            this.currencyChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['USD', 'EUR', 'TL'],
                    datasets: [{
                        data: [
                            stats.pendingUSD,
                            stats.pendingEUR,
                            stats.pendingTL / 100 // Scale TL for better visualization
                        ],
                        backgroundColor: [
                            '#10b981',
                            '#3b82f6',
                            '#c41e3a'
                        ],
                        borderColor: '#1e293b',
                        borderWidth: 3,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#cbd5e1',
                                padding: 20,
                                font: {
                                    family: "'Inter', sans-serif",
                                    size: 12
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function (context) {
                                    const label = context.label;
                                    let value = context.raw;

                                    // Undo TL scaling
                                    if (label === 'TL') value = value * 100;

                                    const symbol = label === 'USD' ? '$' : label === 'EUR' ? '€' : '₺';
                                    return ` ${symbol}${Utils.formatNumber(value)}`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.warn('Currency chart render error:', err);
        }
    },

    /**
     * Render monthly bar chart
     */
    renderMonthlyChart() {
        const canvas = document.getElementById('monthly-chart');
        if (!canvas || !window.Chart) return;

        try {
            // Destroy existing chart
            if (this.monthlyChart) {
                this.monthlyChart.destroy();
            }

            // Group checks by month
            const monthlyData = this.getMonthlyData();

            const ctx = canvas.getContext('2d');

            this.monthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: monthlyData.labels,
                    datasets: [{
                        label: 'Bekleyen Çek Sayısı',
                        data: monthlyData.counts,
                        backgroundColor: 'rgba(196, 30, 58, 0.6)',
                        borderColor: '#c41e3a',
                        borderWidth: 1,
                        borderRadius: 8,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#94a3b8',
                                font: {
                                    family: "'Inter', sans-serif"
                                },
                                stepSize: 5
                            },
                            grid: {
                                color: '#334155',
                                drawBorder: false
                            }
                        },
                        x: {
                            ticks: {
                                color: '#94a3b8',
                                font: {
                                    family: "'Inter', sans-serif"
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 12
                        }
                    }
                }
            });
        } catch (err) {
            console.warn('Monthly chart render error:', err);
        }
    },

    /**
     * Get monthly grouped data
     */
    getMonthlyData() {
        const checks = Data.getAll().filter(c =>
            c.odeme_durumu !== 'ÖDENDİ' && c.odeme_durumu !== 'İPTAL EDİLDİ'
        );

        const monthCounts = {};
        const now = new Date();

        // Initialize next 6 months
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = { count: 0, label: CONFIG.MONTHS_TR[date.getMonth()] };
        }

        // Count checks per month
        checks.forEach(check => {
            if (!check.vade_tarihi) return;
            const date = new Date(check.vade_tarihi);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthCounts[key]) {
                monthCounts[key].count++;
            }
        });

        const sorted = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0]));

        return {
            labels: sorted.map(([_, v]) => v.label),
            counts: sorted.map(([_, v]) => v.count)
        };
    },

    /**
     * Refresh all charts
     */
    refresh() {
        if (this.chartJSLoaded) {
            this.renderCurrencyChart();
            this.renderMonthlyChart();
        }
    }
};

// Export for use in other modules
window.Charts = Charts;
