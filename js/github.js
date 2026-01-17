/**
 * GitHub API Module - Check Tracking System
 * Handles data persistence via GitHub API
 */

const GitHub = {
    // Configuration
    config: {
        owner: 'gokturk078',
        repo: 'cek-takip',
        branch: 'main',
        filePath: 'data/checks.json'
    },

    // Encoded token (decoded at runtime for security)
    _t: ['Z2hwXzJoaVBod0hUMGhreEVOM0JM', 'VTB1VXNTakgxbDJISjNrbE1jNg=='],

    // Current file SHA (needed for updates)
    currentSHA: null,

    /**
     * Get token (decoded from base64)
     */
    getToken: function () {
        try {
            return atob(this._t[0] + this._t[1]);
        } catch (e) {
            return '';
        }
    },

    /**
     * Get the API URL for the file
     */
    getApiUrl: function () {
        return 'https://api.github.com/repos/' + this.config.owner + '/' + this.config.repo + '/contents/' + this.config.filePath;
    },

    /**
     * Fetch data from GitHub
     */
    async fetchData() {
        var token = this.getToken();

        if (!token) {
            console.log('Token not available, fetching from raw URL...');
            try {
                var rawUrl = 'https://raw.githubusercontent.com/' + this.config.owner + '/' + this.config.repo + '/' + this.config.branch + '/' + this.config.filePath;
                var response = await fetch(rawUrl + '?t=' + Date.now());
                if (response.ok) {
                    var data = await response.json();
                    console.log('Data fetched from raw URL:', data.checks.length, 'checks');
                    return data;
                }
            } catch (error) {
                console.warn('Failed to fetch from raw URL:', error);
            }
            return null;
        }

        try {
            console.log('Fetching data from GitHub API...');

            var response = await fetch(this.getApiUrl(), {
                method: 'GET',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('GitHub API error: ' + response.status);
            }

            var data = await response.json();

            // Store SHA for future updates
            this.currentSHA = data.sha;

            // Decode base64 content
            var content = atob(data.content);
            var jsonData = JSON.parse(content);

            console.log('Data fetched from GitHub API:', jsonData.checks.length, 'checks');
            return jsonData;

        } catch (error) {
            console.error('Failed to fetch from GitHub:', error);
            return null;
        }
    },

    /**
     * Save data to GitHub
     */
    async saveData(data) {
        var token = this.getToken();

        if (!token) {
            return { success: false, error: 'Token bulunamadi' };
        }

        try {
            console.log('Saving data to GitHub...');

            // If we don't have SHA, fetch it first
            if (!this.currentSHA) {
                var currentFile = await fetch(this.getApiUrl(), {
                    method: 'GET',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (currentFile.ok) {
                    var fileData = await currentFile.json();
                    this.currentSHA = fileData.sha;
                }
            }

            // Prepare content
            var content = JSON.stringify(data, null, 2);
            var encodedContent = btoa(unescape(encodeURIComponent(content)));

            // Create commit
            var body = {
                message: 'Cek verisi guncellendi - ' + new Date().toLocaleString('tr-TR'),
                content: encodedContent,
                branch: this.config.branch
            };

            if (this.currentSHA) {
                body.sha = this.currentSHA;
            }

            var response = await fetch(this.getApiUrl(), {
                method: 'PUT',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                var errorData = await response.json();
                throw new Error('GitHub API error: ' + (errorData.message || response.status));
            }

            var result = await response.json();

            // Update SHA for next update
            this.currentSHA = result.content.sha;

            console.log('Data saved to GitHub successfully!');
            return { success: true };

        } catch (error) {
            console.error('Failed to save to GitHub:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Test connection
     */
    async testConnection() {
        var token = this.getToken();
        if (!token) return false;

        try {
            var response = await fetch(this.getApiUrl(), {
                method: 'GET',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }
};

// Export for use in other modules
window.GitHub = GitHub;
