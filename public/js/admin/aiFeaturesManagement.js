// VisionHub - AI Features Management Module
// This file contains AI features management functionality for the admin panel

class AIFeaturesManagement {
    constructor(app) {
        this.app = app;
    }

    // Render AI Features Management
    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const statusResponse = await this.app.api.get('/ai/status');
            const aiStatus = statusResponse.success ? statusResponse.ai : {};

            // Map backend status to frontend expected structure
            const geminiApiConfigured = aiStatus.initialized && aiStatus.hasApiKey;
            const availableFeatures = {
                categorization: aiStatus.initialized,
                tagGeneration: aiStatus.initialized,
                contentAnalysis: aiStatus.initialized,
                summaryGeneration: aiStatus.initialized,
                metadataGeneration: aiStatus.initialized,
                transcription: false // Not implemented yet
            };

            const aiHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">AI Features Management</h3>
                        <div class="flex gap-2">
                            <button id="batch-process-btn" class="btn btn-secondary">Batch Process Videos</button>
                            <button id="test-ai-btn" class="btn btn-info">Test AI Connection</button>
                        </div>
                    </div>

                    <!-- AI Status Card -->
                    <div class="card ${geminiApiConfigured ? 'border-success' : 'border-warning'}">
                        <div class="flex items-center mb-3">
                            <span class="badge ${geminiApiConfigured ? 'badge-success' : 'badge-warning'} mr-2">
                                ${geminiApiConfigured ? 'CONNECTED' : 'NOT CONFIGURED'}
                            </span>
                            <h4 class="text-lg font-semibold">Google Gemini AI Status</h4>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="feature-status">
                                <label class="text-sm font-medium">Auto-Categorization</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.categorization ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.categorization ? 'Available' : 'Unavailable'}
                                </p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Tag Generation</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.tagGeneration ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.tagGeneration ? 'Available' : 'Unavailable'}
                                </p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Content Analysis</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.contentAnalysis ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.contentAnalysis ? 'Available' : 'Unavailable'}
                                </p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Summary Generation</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.summaryGeneration ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.summaryGeneration ? 'Available' : 'Unavailable'}
                                </p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Metadata Generation</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.metadataGeneration ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.metadataGeneration ? 'Available' : 'Unavailable'}
                                </p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Transcription</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${availableFeatures.transcription ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${availableFeatures.transcription ? 'Available' : 'Requires Google Cloud'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Individual AI Tools -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Auto-Categorize Video</h4>
                            <form id="categorize-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="categorize-video" class="form-label">Select Video</label>
                                    <select id="categorize-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!availableFeatures.categorization ? 'disabled' : ''}>
                                    Categorize Video
                                </button>
                            </form>
                        </div>

                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Generate Tags</h4>
                            <form id="generate-tags-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="tags-video" class="form-label">Select Video</label>
                                    <select id="tags-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!availableFeatures.tagGeneration ? 'disabled' : ''}>
                                    Generate Tags
                                </button>
                            </form>
                        </div>

                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Analyze Content</h4>
                            <form id="analyze-content-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="analyze-video" class="form-label">Select Video</label>
                                    <select id="analyze-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!availableFeatures.contentAnalysis ? 'disabled' : ''}>
                                    Analyze Content
                                </button>
                            </form>
                        </div>

                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Generate Summary</h4>
                            <form id="generate-summary-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="summary-video" class="form-label">Select Video</label>
                                    <select id="summary-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="flex items-center">
                                        <input type="checkbox" id="update-description" class="form-checkbox">
                                        <span class="ml-2">Update video description with generated summary</span>
                                    </label>
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!availableFeatures.summaryGeneration ? 'disabled' : ''}>
                                    Generate Summary
                                </button>
                            </form>
                        </div>
                    </div>

                    <!-- Results Display -->
                    <div id="ai-results" class="hidden">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">AI Results</h4>
                            <div id="ai-results-content"></div>
                        </div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = aiHtml;

            // Event listeners
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error rendering AI features:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading AI features</div>';
        }
    }

    // Setup AI Event Handlers
    setupEventHandlers() {
        // Categorize form
        document.getElementById('categorize-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('categorize-video').value;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Categorizing video...');
                const response = await this.app.api.post('/ai/categorize', { videoId });
                this.displayAIResults('Auto-Categorization', response);
                if (response.success && response.categorization && response.categorization.success) {
                    await this.app.loadAllVideos();
                    this.app.showToast('Video categorized successfully!', 'success');
                }
            } catch (error) {
                console.error('Categorization error:', error);
                this.app.showToast('Error categorizing video', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Generate tags form
        document.getElementById('generate-tags-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('tags-video').value;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Generating tags...');
                const response = await this.app.api.post('/ai/tags', { videoId });
                this.displayAIResults('Tag Generation', response);
                if (response.success && response.tags && response.tags.success) {
                    this.app.showToast('Tags generated successfully!', 'success');
                }
            } catch (error) {
                console.error('Tag generation error:', error);
                this.app.showToast('Error generating tags', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Analyze content form
        document.getElementById('analyze-content-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('analyze-video').value;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Analyzing content...');
                const response = await this.app.api.post('/ai/analyze', { videoId });
                this.displayAIResults('Content Analysis', response);
                if (response.success && response.analysis && response.analysis.success) {
                    this.app.showToast('Content analyzed successfully!', 'success');
                }
            } catch (error) {
                console.error('Content analysis error:', error);
                this.app.showToast('Error analyzing content', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Generate summary form
        document.getElementById('generate-summary-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('summary-video').value;
            const updateDescription = document.getElementById('update-description').checked;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Generating summary...');
                const response = await this.app.api.post('/ai/summary', {
                    videoId,
                    updateDescription
                });
                this.displayAIResults('Summary Generation', response);
                if (response.success && response.summary && response.summary.success) {
                    await this.app.loadAllVideos();
                    this.app.showToast('Summary generated successfully!', 'success');
                }
            } catch (error) {
                console.error('Summary generation error:', error);
                this.app.showToast('Error generating summary', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Batch process button
        document.getElementById('batch-process-btn').addEventListener('click', () => {
            this.showBatchProcessModal();
        });

        // Test AI button
        document.getElementById('test-ai-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Testing AI connection...');
                // Get a sample video for testing
                const sampleVideo = this.app.state.allVideos.length > 0 ? this.app.state.allVideos[0] : null;
                const requestData = sampleVideo ?
                    { videoId: sampleVideo.id } :
                    { title: 'Test Video', description: 'This is a test for AI connectivity' };

                const response = await this.app.api.post('/ai/categorize', requestData);

                if (response.success && response.categorization && response.categorization.success) {
                    this.app.showToast('AI connection successful!', 'success');
                    this.displayAIResults('AI Connection Test', {
                        success: true,
                        category: response.categorization.category,
                        message: 'Google Gemini AI is working correctly'
                    });
                } else {
                    // Check if this is a quota error
                    const errorMessage = response.error || 'Unknown error occurred';
                    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                        this.app.showToast('AI quota exceeded. Please try again later.', 'warning');
                        this.displayAIResults('AI Connection Test', {
                            success: false,
                            error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                            message: 'Quota Limit Reached'
                        });
                    } else {
                        this.app.showToast('AI connection failed: ' + errorMessage, 'error');
                        this.displayAIResults('AI Connection Test', {
                            success: false,
                            error: errorMessage
                        });
                    }
                }
            } catch (error) {
                console.error('AI test error:', error);
                // Check if this is a quota error
                if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                    this.app.showToast('AI quota exceeded. Please try again later.', 'warning');
                    this.displayAIResults('AI Connection Test', {
                        success: false,
                        error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                        message: 'Quota Limit Reached'
                    });
                } else {
                    this.app.showToast('AI connection test failed: ' + error.message, 'error');
                    this.displayAIResults('AI Connection Test', {
                        success: false,
                        error: error.message
                    });
                }
            } finally {
                this.app.showLoading(false);
            }
        });
    }

    // Display AI Results
    displayAIResults(title, response) {
        const resultsDiv = document.getElementById('ai-results');
        const contentDiv = document.getElementById('ai-results-content');

        let resultHtml = `<h5 class="font-semibold mb-2">${title} Results</h5>`;

        if (response.success) {
            resultHtml += '<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3">';
            resultHtml += '<p class="font-bold">Success!</p>';

            if (response.categorization && response.categorization.category) {
                resultHtml += `<p>Category: <span class="font-semibold">${response.categorization.category}</span></p>`;
            }

            if (response.tags && response.tags.tags && response.tags.tags.length > 0) {
                resultHtml += '<p>Generated Tags:</p>';
                resultHtml += '<div class="flex flex-wrap gap-1 mt-2">';
                response.tags.tags.forEach(tag => {
                    resultHtml += `<span class="badge badge-success">${tag}</span>`;
                });
                resultHtml += '</div>';
            }

            if (response.summary && response.summary.summary) {
                resultHtml += `<p>Summary: <span class="italic">${response.summary.summary}</span></p>`;
            }

            if (response.analysis && response.analysis.analysis) {
                const analysis = response.analysis.analysis;
                if (analysis.qualityScore) {
                    const statusColor = analysis.qualityScore >= 8 ? 'text-green-600' :
                                      analysis.qualityScore >= 5 ? 'text-yellow-600' : 'text-red-600';
                    resultHtml += `<p>Content Quality: <span class="font-semibold ${statusColor}">${analysis.qualityScore}/10</span></p>`;
                }
                if (analysis.difficultyLevel) {
                    resultHtml += `<p>Difficulty Level: <span class="font-semibold">${analysis.difficultyLevel}</span></p>`;
                }
            }

            if (response.metadata && response.metadata.metadata) {
                const metadata = response.metadata.metadata;
                if (metadata.seoTitle) {
                    resultHtml += `<p>SEO Title: <span class="font-semibold">${metadata.seoTitle}</span></p>`;
                }
                if (metadata.metaDescription) {
                    resultHtml += `<p>Meta Description: ${metadata.metaDescription}</p>`;
                }
                if (metadata.keywords && metadata.keywords.length > 0) {
                    resultHtml += '<p>Keywords: ' + metadata.keywords.join(', ') + '</p>';
                }
            }

            if (response.message) {
                resultHtml += `<p>${response.message}</p>`;
            }

            resultHtml += '</div>';
        } else {
            resultHtml += '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-3">';
            resultHtml += '<p class="font-bold">Error!</p>';
            resultHtml += `<p>${response.error || 'Unknown error occurred'}</p>`;
            resultHtml += '</div>';
        }

        contentDiv.innerHTML = resultHtml;
        resultsDiv.classList.remove('hidden');

        // Scroll to results
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Show Batch Process Modal
    showBatchProcessModal() {
        const modalHtml = `
            <div class="modal-overlay" id="batch-process-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Batch Process Videos with AI</h3>
                        <button class="modal-close" id="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-4">Select videos to process in batch:</p>
                        <div class="max-h-60 overflow-y-auto">
                            ${this.app.state.allVideos.map(video => `
                                <div class="flex items-center mb-2">
                                    <input type="checkbox" id="video-${video.id}" value="${video.id}" class="mr-2 batch-video-checkbox">
                                    <label for="video-${video.id}">${video.title}</label>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-4 flex justify-end gap-2">
                            <button id="cancel-batch-btn" class="btn btn-secondary">Cancel</button>
                            <button id="start-batch-btn" class="btn btn-primary">Process Selected</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.app.showModal(modalHtml);

        // Event listeners
        document.getElementById('close-modal').addEventListener('click', () => this.app.hideModal());
        document.getElementById('cancel-batch-btn').addEventListener('click', () => this.app.hideModal());

        document.getElementById('start-batch-btn').addEventListener('click', async () => {
            const selectedVideos = Array.from(document.querySelectorAll('.batch-video-checkbox:checked'))
                .map(checkbox => checkbox.value);

            if (selectedVideos.length === 0) {
                this.app.showToast('Please select at least one video', 'warning');
                return;
            }

            try {
                this.app.showLoading(true, `Processing ${selectedVideos.length} videos with AI...`);
                const response = await this.app.api.post('/ai/batch', { videoIds: selectedVideos });

                if (response.success) {
                    this.app.hideModal();
                    await this.app.loadAllVideos();
                    this.displayAIResults('Batch Processing', response);
                    this.app.showToast(`${response.processedCount} videos processed successfully!`, 'success');
                }
            } catch (error) {
                console.error('Batch processing error:', error);
                this.app.showToast('Error during batch processing', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIFeaturesManagement;
} else {
    // For browser usage
    window.AIFeaturesManagement = AIFeaturesManagement;
}