// VisionHub - AI Settings Management Module
// This file contains AI settings management functionality for the admin panel

class AISettingsManagement {
    constructor(app) {
        this.app = app;
    }

    // Render AI Settings Management
    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            // Get current AI settings
            const settingsResponse = await this.app.api.get('/settings');
            const currentSettings = settingsResponse.success ? settingsResponse.settings : {};

            // Get AI service status
            const statusResponse = await this.app.api.get('/ai/status');
            const aiStatus = statusResponse.success ? statusResponse.ai : {};

            // Determine current API key source and value
            let currentApiKey = '';
            let apiKeySource = 'environment'; // default to environment

            if (aiStatus.hasDbApiKey) {
                currentApiKey = currentSettings.geminiApiKey || '';
                apiKeySource = 'database';
            } else if (aiStatus.hasEnvApiKey) {
                currentApiKey = '********'; // Don't display actual env key in UI
                apiKeySource = 'environment';
            }

            // Determine status
            let apiKeyStatus = 'not_configured';
            let statusMessage = 'Not configured';
            let statusClass = 'badge-warning';

            if (aiStatus.initialized && aiStatus.hasApiKey) {
                apiKeyStatus = 'active';
                statusMessage = 'Active';
                statusClass = 'badge-success';
            } else if (currentApiKey || aiStatus.hasEnvApiKey) {
                apiKeyStatus = 'inactive';
                statusMessage = 'Inactive';
                statusClass = 'badge-warning';
            }

            const aiSettingsHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">AI Service Settings</h3>
                    </div>

                    <!-- API Key Status Card -->
                    <div class="card">
                        <div class="flex items-center mb-3">
                            <span class="badge ${statusClass} mr-2">
                                ${statusMessage.toUpperCase()}
                            </span>
                            <h4 class="text-lg font-semibold">Google Gemini API Key Status</h4>
                        </div>
                        <div class="mb-4">
                            <p class="text-sm text-secondary">
                                The Google Gemini API key is used for AI-powered features like auto-categorization,
                                tag generation, content analysis, and summary generation.
                            </p>
                        </div>

                        <!-- Status Details -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div class="bg-gray-800 p-3 rounded">
                                <div class="text-xs text-muted">Environment Key</div>
                                <div class="font-medium ${aiStatus.hasEnvApiKey ? 'text-success' : 'text-warning'}">
                                    ${aiStatus.hasEnvApiKey ? 'CONFIGURED' : 'NOT SET'}
                                </div>
                            </div>
                            <div class="bg-gray-800 p-3 rounded">
                                <div class="text-xs text-muted">Database Key</div>
                                <div class="font-medium ${aiStatus.hasDbApiKey ? 'text-success' : 'text-warning'}">
                                    ${aiStatus.hasDbApiKey ? 'CONFIGURED' : 'NOT SET'}
                                </div>
                            </div>
                            <div class="bg-gray-800 p-3 rounded">
                                <div class="text-xs text-muted">Service Status</div>
                                <div class="font-medium ${aiStatus.initialized ? 'text-success' : 'text-warning'}">
                                    ${aiStatus.initialized ? 'INITIALIZED' : 'NOT READY'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- API Key Configuration -->
                    <div class="card">
                        <h4 class="text-lg font-semibold mb-4">API Key Configuration</h4>
                        <form id="ai-settings-form" class="space-y-4">
                            <div class="form-group">
                                <label class="form-label">API Key Source</label>
                                <div class="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:space-x-6">
                                    <label class="flex items-center">
                                        <input type="radio" name="api-key-source" value="environment"
                                            ${apiKeySource === 'environment' ? 'checked' : ''}
                                            class="form-radio" ${aiStatus.hasEnvApiKey ? '' : 'disabled'}>
                                        <span class="ml-2">Environment Variable (.env file)</span>
                                        ${aiStatus.hasEnvApiKey ?
                                            '<span class="ml-2 badge badge-success">CONFIGURED</span>' :
                                            '<span class="ml-2 badge badge-warning">NOT SET</span>'}
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="api-key-source" value="database"
                                            ${apiKeySource === 'database' ? 'checked' : ''}
                                            class="form-radio">
                                        <span class="ml-2">Database Storage</span>
                                    </label>
                                </div>
                            </div>

                            <div id="api-key-input-section" class="form-group ${apiKeySource === 'database' ? '' : 'hidden'}">
                                <label for="gemini-api-key" class="form-label">Google Gemini API Key</label>
                                <input type="password" id="gemini-api-key"
                                    value="${currentApiKey !== '********' ? currentApiKey : ''}"
                                    placeholder="Enter your Google Gemini API key"
                                    class="form-input">
                                <p class="text-xs text-muted mt-1">
                                    Get your API key from <a href="https://makersuite.google.com/app/apikey"
                                    target="_blank" class="text-primary">Google AI Studio</a>
                                </p>
                                <div class="mt-2 text-sm text-info">
                                    <strong>Note:</strong> Storing API keys in the database is less secure than using environment variables.
                                </div>
                            </div>

                            <div class="flex justify-end space-x-3">
                                <button type="button" id="test-connection-btn" class="btn btn-secondary">Test Connection</button>
                                <button type="submit" class="btn btn-primary">Save Settings</button>
                            </div>
                        </form>
                    </div>

                    <!-- Test Connection Result -->
                    <div id="test-result-container" class="card hidden">
                        <h4 class="text-lg font-semibold mb-3">Connection Test Result</h4>
                        <div id="test-result"></div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = aiSettingsHtml;

            // Event listeners
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error rendering AI settings:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading AI settings: ' + error.message + '</div>';
        }
    }

    // Setup Event Handlers
    setupEventHandlers() {
        // API key source radio buttons
        document.querySelectorAll('input[name="api-key-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const apiKeyInputSection = document.getElementById('api-key-input-section');
                if (e.target.value === 'database') {
                    apiKeyInputSection.classList.remove('hidden');
                } else {
                    apiKeyInputSection.classList.add('hidden');
                }
            });
        });

        // Save settings form
        document.getElementById('ai-settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSaveSettings();
        });

        // Test connection button
        document.getElementById('test-connection-btn').addEventListener('click', async () => {
            await this.testConnection();
        });
    }

    // Handle Save Settings
    async handleSaveSettings() {
        try {
            const source = document.querySelector('input[name="api-key-source"]:checked').value;
            let settingsToUpdate = {};

            if (source === 'database') {
                const apiKey = document.getElementById('gemini-api-key').value.trim();
                if (apiKey) {
                    settingsToUpdate.geminiApiKey = apiKey;
                } else {
                    this.app.showToast('Please enter a valid API key', 'warning');
                    return;
                }
            } else {
                // If using environment variable, we should clear the database setting
                settingsToUpdate.geminiApiKey = '';
            }

            this.app.showLoading(true, 'Saving settings...');

            // Update settings
            const response = await this.app.api.post('/settings', settingsToUpdate);

            if (response.success) {
                this.app.showToast('AI settings saved successfully', 'success');
                // Re-render to show updated status
                await this.render();
            } else {
                this.app.showToast('Error saving AI settings', 'error');
            }
        } catch (error) {
            console.error('Error saving AI settings:', error);
            this.app.showToast('Error saving AI settings: ' + error.message, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }

    // Test Connection
    async testConnection() {
        const testButton = document.getElementById('test-connection-btn');
        const testResultContainer = document.getElementById('test-result-container');
        const testResult = document.getElementById('test-result');

        try {
            testButton.disabled = true;
            testButton.textContent = 'Testing...';
            testResultContainer.classList.add('hidden');
            testResult.innerHTML = '';

            // Get a sample video for testing
            const allVideos = this.app.state.allVideos;
            const sampleVideo = allVideos.length > 0 ? allVideos[0] : null;
            const requestData = sampleVideo ?
                { videoId: sampleVideo.id } :
                { title: 'Test Video', description: 'This is a test for AI connectivity' };

            const response = await this.app.api.post('/ai/categorize', requestData);

            if (response.success && response.categorization && response.categorization.success) {
                testResult.innerHTML = `
                    <div class="flex items-center">
                        <span class="badge badge-success">SUCCESS</span>
                        <span class="ml-2 text-success">Connected to Google Gemini API successfully!</span>
                    </div>
                    <div class="mt-2 text-sm">
                        <strong>Test Result:</strong> ${response.categorization.category}
                    </div>
                `;
            } else {
                // Check if this is a quota error
                const errorMessage = response.error || 'Unknown error occurred';
                if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                    testResult.innerHTML = `
                        <div class="flex items-center">
                            <span class="badge badge-warning">QUOTA EXCEEDED</span>
                            <span class="ml-2 text-warning">API quota limit reached. Please try again later or upgrade your plan.</span>
                        </div>
                        <div class="mt-2 text-sm text-warning">
                            <strong>Error:</strong> ${errorMessage}
                        </div>
                    `;
                } else {
                    testResult.innerHTML = `
                        <div class="flex items-center">
                            <span class="badge badge-error">FAILED</span>
                            <span class="ml-2 text-error">Failed to connect to Google Gemini API</span>
                        </div>
                        <div class="mt-2 text-sm text-error">
                            <strong>Error:</strong> ${errorMessage}
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Connection test error:', error);
            testResult.innerHTML = `
                <div class="flex items-center">
                    <span class="badge badge-error">ERROR</span>
                    <span class="ml-2 text-error">Connection test failed</span>
                </div>
                <div class="mt-2 text-sm text-error">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        } finally {
            testResultContainer.classList.remove('hidden');
            testButton.disabled = false;
            testButton.textContent = 'Test Connection';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AISettingsManagement;
} else {
    // For browser usage
    window.AISettingsManagement = AISettingsManagement;
}