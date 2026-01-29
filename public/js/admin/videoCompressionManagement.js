// VisionHub - Video Compression Management Module
// This file contains video compression and optimization functionality for the admin panel

class VideoCompressionManagement {
    constructor(app) {
        this.app = app;
    }

    // Render Video Compression Management
    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const statusResponse = await this.app.api.get('/video-compression/status');
            const compressionStatus = statusResponse.success ? statusResponse.compression : {};

            const compressionHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">Video Compression & Optimization</h3>
                        <div class="flex gap-2">
                            <button id="batch-compress-btn" class="btn btn-secondary">Batch Compress Videos</button>
                            <button id="refresh-status-btn" class="btn btn-info">Refresh Status</button>
                        </div>
                    </div>

                    <!-- Compression Status -->
                    <div class="card ${compressionStatus.enabled ? 'border-success' : 'border-warning'}">
                        <div class="flex items-center mb-3">
                            <span class="badge ${compressionStatus.enabled ? 'badge-success' : 'badge-warning'} mr-2">
                                ${compressionStatus.enabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                            <h4 class="text-lg font-semibold">Video Compression Service</h4>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div class="feature-status">
                                <label class="text-sm font-medium">Supported Formats</label>
                                <p>${compressionStatus.supportedFormats?.join(', ') || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Uploads Path</label>
                                <p>${compressionStatus.uploadsPath || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Max File Size</label>
                                <p>${compressionStatus.maxFileSize || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Service Status</label>
                                <p class="flex items-center">
                                    <span class="w-2 h-2 rounded-full mr-2 ${compressionStatus.enabled ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    ${compressionStatus.enabled ? 'Active' : 'Inactive'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Individual Video Compression -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Optimize Video for Web</h4>
                            <form id="compress-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="compress-video" class="form-label">Select Video</label>
                                    <select id="compress-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!compressionStatus.enabled ? 'disabled' : ''}>
                                    Optimize Video
                                </button>
                            </form>
                        </div>

                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Generate Thumbnail</h4>
                            <form id="thumbnail-form" class="space-y-3">
                                <div class="form-group">
                                    <label for="thumbnail-video" class="form-label">Select Video</label>
                                    <select id="thumbnail-video" class="form-select" required>
                                        <option value="">Choose a video...</option>
                                        ${this.app.state.allVideos.map(video =>
                                            `<option value="${video.id}">${video.title}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="timestamp" class="form-label">Timestamp (HH:MM:SS)</label>
                                    <input type="text" id="timestamp" class="form-input" value="00:00:01" placeholder="00:00:01">
                                </div>
                                <button type="submit" class="btn btn-primary w-full" ${!compressionStatus.enabled ? 'disabled' : ''}>
                                    Generate Thumbnail
                                </button>
                            </form>
                        </div>
                    </div>

                    <!-- Results Display -->
                    <div id="compression-results" class="hidden">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Compression Results</h4>
                            <div id="compression-results-content"></div>
                        </div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = compressionHtml;

            // Event listeners
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error rendering video compression:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading video compression features</div>';
        }
    }

    // Setup Compression Event Handlers
    setupEventHandlers() {
        // Compress form
        document.getElementById('compress-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('compress-video').value;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Optimizing video...');
                const response = await this.app.api.post(`/video-compression/optimize/${videoId}`);
                this.displayCompressionResults('Video Optimization', response);
                if (response.success) {
                    await this.app.loadAllVideos();
                    this.app.showToast('Video optimized successfully!', 'success');
                }
            } catch (error) {
                console.error('Video optimization error:', error);
                this.app.showToast('Error optimizing video', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Thumbnail form
        document.getElementById('thumbnail-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const videoId = document.getElementById('thumbnail-video').value;
            const timestamp = document.getElementById('timestamp').value;
            if (!videoId) return;

            try {
                this.app.showLoading(true, 'Generating thumbnail...');
                const response = await this.app.api.post(`/video-compression/thumbnail/${videoId}`, { timestamp });
                this.displayCompressionResults('Thumbnail Generation', response);
                if (response.success) {
                    await this.app.loadAllVideos();
                    this.app.showToast('Thumbnail generated successfully!', 'success');
                }
            } catch (error) {
                console.error('Thumbnail generation error:', error);
                this.app.showToast('Error generating thumbnail', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Batch compress button
        document.getElementById('batch-compress-btn').addEventListener('click', () => {
            this.showBatchCompressModal();
        });

        // Refresh status button
        document.getElementById('refresh-status-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Refreshing status...');
                await this.render();
                this.app.showToast('Status refreshed', 'success');
            } catch (error) {
                this.app.showToast('Failed to refresh status', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });
    }

    // Display Compression Results
    displayCompressionResults(title, response) {
        const resultsDiv = document.getElementById('compression-results');
        const contentDiv = document.getElementById('compression-results-content');

        let resultHtml = `<h5 class="font-semibold mb-2">${title} Results</h5>`;

        if (response.success) {
            resultHtml += '<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3">';
            resultHtml += '<p class="font-bold">Success!</p>';

            if (response.optimization) {
                const opt = response.optimization;
                resultHtml += `<p>Original Size: <span class="font-semibold">${Math.round(opt.originalSize / 1024 / 1024 * 100) / 100} MB</span></p>`;
                resultHtml += `<p>Optimized Size: <span class="font-semibold">${Math.round(opt.optimizedSize / 1024 / 1024 * 100) / 100} MB</span></p>`;
                resultHtml += `<p>Space Saved: <span class="font-semibold">${Math.round(opt.savings / 1024 / 1024 * 100) / 100} MB (${Math.round(opt.compressionRatio)}%)</span></p>`;
                if (opt.optimizedUrl) {
                    resultHtml += `<p>Optimized URL: <span class="font-mono text-sm">${opt.optimizedUrl}</span></p>`;
                }
            }

            if (response.thumbnail) {
                resultHtml += `<p>Thumbnail generated at: <span class="font-mono text-sm">${response.thumbnail.thumbnailUrl}</span></p>`;
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

    // Show Batch Compress Modal
    showBatchCompressModal() {
        const modalHtml = `
            <div class="modal-overlay" id="batch-compress-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Batch Compress Videos</h3>
                        <button class="modal-close" id="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-4">Select videos to compress in batch:</p>
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
                            <button id="start-batch-btn" class="btn btn-primary">Compress Selected</button>
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
                this.app.showLoading(true, `Compressing ${selectedVideos.length} videos...`);
                const response = await this.app.api.post('/video-compression/batch-optimize', { videoIds: selectedVideos });

                if (response.success) {
                    this.app.hideModal();
                    await this.app.loadAllVideos();
                    this.displayCompressionResults('Batch Compression', response);
                    this.app.showToast(`${response.batchOptimization.successCount} videos compressed successfully!`, 'success');
                }
            } catch (error) {
                console.error('Batch compression error:', error);
                this.app.showToast('Error during batch compression', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoCompressionManagement;
} else {
    // For browser usage
    window.VideoCompressionManagement = VideoCompressionManagement;
}