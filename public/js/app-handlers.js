// VisionHub - Event Handlers and Additional Methods
// This file extends the main App object with event handlers and utility methods

// Extend App object with additional methods
Object.assign(App, {
    // Render video page
    async renderVideoPage(videoId) {
        this.renderMainApp();
        const contentDiv = document.getElementById('content');

        try {
            // Get video details

            const videoResponse = await this.api.get(`/videos/${videoId}`);

            if (!videoResponse.success) {
                contentDiv.innerHTML = `<div class="text-center text-error">Video not found: ${videoResponse.error || 'Unknown error'}</div>`;
                return;
            }

            const video = videoResponse.video;

            // Record view
            try {
                await this.api.post(`/videos/${videoId}/view`);
            } catch (error) {
                console.error('Error recording view:', error);
            }

            // Get related videos
            const relatedVideos = this.state.allVideos
                .filter(v => v.categoryId === video.categoryId && v.id != videoId)
                .slice(0, 4);

            // Check if favorited
            let isFavorited = false;
            try {
                const favResponse = await this.api.get(`/favorites/${videoId}`);
                isFavorited = favResponse.isFavorited;
            } catch (error) {
                console.error('Error checking favorite status:', error);
            }

            // Generate video embed HTML
            let videoEmbedHtml;
            try {
                videoEmbedHtml = this.getVideoEmbed(video.videoUrl);
            } catch (error) {
                console.error('Error generating video embed:', error);
                videoEmbedHtml = `<div class="text-center text-error">Error loading video player: ${error.message}</div>`;
            }

            const videoPageHtml = `
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-2">
                        <div class="card">
                            <div class="video-player-container">
                                ${videoEmbedHtml}
                            </div>
                            <div class="video-controls">
                                <button id="skip-back-btn" class="btn-icon btn-secondary" title="Skip back 10s">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
                                    </svg>
                                </button>
                                <button id="skip-forward-btn" class="btn-icon btn-secondary" title="Skip forward 10s">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4v3a1 1 0 001.6.8L12 4v8l5.4-3.2A1 1 0 0019 9V4a1 1 0 00-1.6-.8L12 7.2l-5.4-3.2A1 1 0 005 4z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="p-6">
                                <div class="flex items-start justify-between mb-4">
                                    <h1 class="text-3xl font-bold">${video.title}</h1>
                                    <div class="flex space-x-2">
                                        <button id="favorite-btn" class="btn-icon ${isFavorited ? 'btn-danger' : 'btn-secondary'}" data-id="${video.id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.48 5.48 0 017.5 3C9.07 3 10.64 3.94 12 5.34c1.36-1.4 2.93-2.34 4.5-2.34A5.48 5.48 0 0122 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                            </svg>
                                        </button>
                                        <button id="report-btn" class="btn-icon btn-danger" data-id="${video.id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <p class="text-secondary mb-2">${video.description}</p>
                                <p class="text-sm text-muted">Category: ${video.categoryName} | Views: ${video.views}</p>
                            </div>
                        </div>

                        <div id="comments-section" class="comments-section mt-8">
                            <h2 class="text-2xl font-bold mb-4">Comments</h2>
                            <form id="comment-form" class="comment-form">
                                <div class="form-group">
                                    <textarea id="comment-text" class="form-textarea" rows="3" placeholder="Write your comment here..." required></textarea>
                                </div>
                                <div class="flex justify-end">
                                    <button type="submit" class="btn btn-primary">Post Comment</button>
                                </div>
                            </form>
                            <div id="comments-list"></div>
                        </div>
                    </div>

                    <div class="lg:col-span-1">
                        <div class="card">
                            <h2 class="text-xl font-bold mb-4">Related Videos</h2>
                            <div class="space-y-4">
                                ${relatedVideos.length > 0 ? relatedVideos.map(video => `
                                    <div class="flex items-center space-x-4 p-2 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors" data-video-id="${video.id}">
                                        <img class="w-24 h-auto rounded-lg" src="${video.thumbnailUrl}" alt="${video.title}">
                                        <div class="flex-1">
                                            <h4 class="font-semibold text-sm">${video.title}</h4>
                                            <p class="text-xs text-secondary">${video.categoryName}</p>
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-muted">No related videos found</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            contentDiv.innerHTML = videoPageHtml;

            // Attach event listeners
            document.getElementById('favorite-btn').addEventListener('click', (e) => this.handleFavorite(e));
            document.getElementById('report-btn').addEventListener('click', (e) => this.handleReport(e));
            document.getElementById('comment-form').addEventListener('submit', (e) => this.handlePostComment(e));
            document.getElementById('skip-back-btn').addEventListener('click', () => this.skipVideo(-10));
            document.getElementById('skip-forward-btn').addEventListener('click', () => this.skipVideo(10));

            // Related videos
            document.querySelectorAll('[data-video-id]').forEach(element => {
                element.addEventListener('click', (e) => {
                    const videoId = e.currentTarget.dataset.videoId;
                    if (videoId) {
                        this.navigateTo('video', videoId);
                    }
                });
            });

            // Load comments
            this.loadComments(videoId);

        } catch (error) {
            console.error('Error rendering video page:', error);
            // Provide more specific error message
            let errorMessage = 'Error loading video';
            if (error.message) {
                errorMessage += ': ' + error.message;
            } else if (error.toString) {
                errorMessage += ': ' + error.toString();
            }
            contentDiv.innerHTML = `<div class="text-center text-error">${errorMessage}</div>`;
        }
    },

    // Render favorites page
    async renderFavoritesPage() {
        this.renderMainApp();
        const contentDiv = document.getElementById('content');

        try {
            const response = await this.api.get('/favorites');
            const favorites = response.success ? response.favorites : [];

            const favoritesHtml = `
                <div class="space-y-8">
                    <section>
                        <h2 class="text-2xl font-bold mb-4">My Favorites</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                            ${favorites.length > 0 ? favorites.map(video => `
                                <div class="video-card" data-video-id="${video.id}">
                                    <img src="${video.thumbnailUrl}" alt="${video.title}" class="video-card-img">
                                    <div class="video-card-content">
                                        <h3 class="video-card-title">${video.title}</h3>
                                        <p class="video-card-meta">Category: ${video.categoryName}</p>
                                    </div>
                                </div>
                            `).join('') : '<div class="text-center text-muted col-span-full">You don\'t have any videos in your favorites yet</div>'}
                        </div>
                    </section>
                </div>
            `;

            contentDiv.innerHTML = favoritesHtml;

            document.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    this.navigateTo('video', e.currentTarget.dataset.videoId);
                });
            });
        } catch (error) {
            console.error('Error loading favorites:', error);
            contentDiv.innerHTML = '<div class="text-center text-error">Error loading favorites</div>';
        }
    },

    // Render admin page
    async renderAdminPage() {
        this.renderMainApp();
        const contentDiv = document.getElementById('content');
        const isAdmin = this.state.currentUser?.role === 'admin';

        if (!isAdmin) {
            contentDiv.innerHTML = '<div class="text-center text-error">You do not have permission to access this page</div>';
            return;
        }

        const adminPanelHtml = `
            <div class="admin-panel">
                <h2 class="admin-title">Admin Panel</h2>
                <div class="nav-tabs">
                    <button class="nav-tab ${this.state.currentAdminTab === 'users' ? 'active' : ''}" data-tab="users">
                        Manage Users
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'videos' ? 'active' : ''}" data-tab="videos">
                        Manage Videos
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'categories' ? 'active' : ''}" data-tab="categories">
                        Manage Categories
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'groups' ? 'active' : ''}" data-tab="groups">
                        Groups & Teams
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'permissions' ? 'active' : ''}" data-tab="permissions">
                        Permissions
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'password-policy' ? 'active' : ''}" data-tab="password-policy">
                        Password Policy
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'reports' ? 'active' : ''}" data-tab="reports">
                        Reports & Logs
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'report-reasons' ? 'active' : ''}" data-tab="report-reasons">
                        Report Reasons
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'ai-features' ? 'active' : ''}" data-tab="ai-features">
                        AI Features
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'ai-settings' ? 'active' : ''}" data-tab="ai-settings">
                        AI Settings
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'video-compression' ? 'active' : ''}" data-tab="video-compression">
                        Video Compression
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'system-health' ? 'active' : ''}" data-tab="system-health">
                        System Health
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'backup-system' ? 'active' : ''}" data-tab="backup-system">
                        Backup System
                    </button>
                    <button class="nav-tab ${this.state.currentAdminTab === 'settings' ? 'active' : ''}" data-tab="settings">
                        Site Settings
                    </button>
                </div>
                <div id="admin-content"></div>
            </div>
        `;

        contentDiv.innerHTML = adminPanelHtml;

        // Add tab event listeners
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.state.currentAdminTab = e.target.dataset.tab;
                this.renderAdminPage();
            });
        });

        // Render the appropriate admin tab content using the new modular system
        const adminModules = new AdminModules(this);
        adminModules.renderModule(this.state.currentAdminTab);
    },

    // Event Handlers
    async handleLogin(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');

        const loginMessage = document.getElementById('login-message');
        loginMessage.classList.add('hidden');

        try {
            this.showLoading(true);
            const response = await this.api.post('/auth/login', { username, password });

            if (response.success) {
                localStorage.setItem('authToken', response.token);
                this.state.currentUser = response.user;
                await this.loadAllVideos();
                this.render();
                this.showToast('Login successful!', 'success');
            }
        } catch (error) {
            loginMessage.textContent = error.message;
            loginMessage.classList.remove('hidden');
        } finally {
            this.showLoading(false);
        }
    },

    async handleLogout() {
        try {
            await this.api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }

        localStorage.removeItem('authToken');
        this.state.currentUser = null;
        this.state.currentPage = 'home';
        this.render();
        this.showToast('Logged out successfully', 'info');
    },

    async handleSearch(event) {
        const query = event.target.value.toLowerCase().trim();
        if (query.length > 2) {
            try {
                const response = await this.api.get(`/videos/search?q=${encodeURIComponent(query)}`);
                if (response.success) {
                    this.renderHomePage(response.videos);
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        } else if (query.length === 0) {
            this.renderHomePage(null);
        }
    },

    async handleFavorite(event) {
        const videoId = event.currentTarget.dataset.id;
        const button = event.currentTarget;

        try {
            const isFavorited = button.classList.contains('btn-danger');

            if (isFavorited) {
                await this.api.delete(`/favorites/${videoId}`);
                button.classList.remove('btn-danger');
                button.classList.add('btn-secondary');
                this.showToast('Removed from favorites', 'info');
            } else {
                await this.api.post(`/favorites/${videoId}`);
                button.classList.remove('btn-secondary');
                button.classList.add('btn-danger');
                this.showToast('Added to favorites', 'success');
            }
        } catch (error) {
            console.error('Favorite error:', error);
            this.showToast('Error updating favorites', 'error');
        }
    },

    async handleReport(event) {
        const videoId = event.currentTarget.dataset.id;
        this.showReportModal(videoId);
    },

    async handlePostComment(event) {
        event.preventDefault();
        const text = document.getElementById('comment-text').value.trim();

        if (!text) return;

        try {
            await this.api.post('/comments', {
                videoId: this.state.currentVideoId,
                text
            });

            document.getElementById('comment-text').value = '';
            this.loadComments(this.state.currentVideoId);
            this.showToast('Comment posted successfully', 'success');
        } catch (error) {
            console.error('Comment error:', error);
            this.showToast('Error posting comment', 'error');
        }
    },

    // Utility methods
    getVideoEmbed(url) {
        // Handle empty or invalid URLs
        if (!url || typeof url !== 'string') {
            return '<div class="text-center text-error">No valid video URL provided</div>';
        }

        // Trim whitespace
        url = url.trim();

        // Check if URL is empty after trimming
        if (!url) {
            return '<div class="text-center text-error">No video URL provided</div>';
        }

        try {
            if (url.includes('youtube.com/watch')) {
                const parsedUrl = new URL(url);
                const videoId = parsedUrl.searchParams.get("v");
                if (!videoId) {
                    throw new Error('Invalid YouTube URL - missing video ID');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (url.includes('youtu.be/')) {
                // Handle YouTube short URLs
                const videoId = url.split('/').pop().split('?')[0];
                if (!videoId) {
                    throw new Error('Invalid YouTube short URL');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (url.includes('drive.google.com/file/d/')) {
                // Handle Google Drive URLs
                const videoId = url.split('/d/')[1].split('/')[0];
                if (!videoId) {
                    throw new Error('Invalid Google Drive URL');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://drive.google.com/file/d/${videoId}/preview" frameborder="0" allowfullscreen></iframe>`;
            } else {
                // For other URLs, try to use them directly as video sources
                // Add additional validation for the URL
                try {
                    new URL(url); // This will throw if URL is invalid
                    return `<video class="absolute top-0 left-0 w-full h-full" controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
                } catch (urlError) {
                    throw new Error('Invalid video URL format');
                }
            }
        } catch (error) {
            console.error('Error processing video URL:', error);
            return `<div class="text-center text-error">Error processing video: ${error.message}</div>`;
        }
    },

    skipVideo(seconds) {
        const video = document.querySelector('video');
        if (video) {
            video.currentTime += seconds;
            this.showToast(`Skipped ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)} seconds`, 'info');
        } else {
            this.showToast('Video controls not available for embedded content', 'warning');
        }
    },

    // UI Helper methods
    showLoading(show) {
        const overlay = this.elements.loadingOverlay;
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showModal(content) {
        this.elements.modalContainer.innerHTML = content;
        this.elements.modalContainer.classList.remove('hidden');
    },

    hideModal() {
        this.elements.modalContainer.classList.add('hidden');
        this.elements.modalContainer.innerHTML = '';
    },

    showConfirmationModal(message, onConfirm) {
        const modalHtml = `
            <div class="modal-content">
                <p class="text-center mb-6">${message}</p>
                <div class="modal-footer">
                    <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
                    <button id="modal-confirm-btn" class="btn btn-danger">Confirm</button>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        document.getElementById('modal-confirm-btn').onclick = () => {
            onConfirm();
            this.hideModal();
        };
        document.getElementById('modal-cancel-btn').onclick = () => this.hideModal();
    },

    async showReportModal(videoId) {
        try {
            // Load available report reasons
            const response = await this.api.get('/report-reasons');
            const reasons = response.success ? response.reasons : [];

            const modalHtml = `
                <div class="modal-content">
                    <h3 class="modal-title">Report Video</h3>
                    <form id="report-form">
                        <div class="form-group">
                            <label for="report-reason" class="form-label">Reason for reporting:</label>
                            <select id="report-reason" class="form-select" required>
                                <option value="">Select a reason</option>
                                ${reasons.map(reason => `
                                    <option value="${reason.reason}">${reason.reason}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group hidden" id="custom-reason-group">
                            <label for="custom-reason-text" class="form-label">Please specify:</label>
                            <textarea id="custom-reason-text" class="form-textarea" rows="3" placeholder="Please describe the issue..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
                            <button type="submit" class="btn btn-danger">Submit Report</button>
                        </div>
                    </form>
                </div>
            `;

            this.showModal(modalHtml);

            // Add event listener for reason selection
            document.getElementById('report-reason').addEventListener('change', (e) => {
                const customGroup = document.getElementById('custom-reason-group');
                if (e.target.value === 'Other') {
                    customGroup.classList.remove('hidden');
                    document.getElementById('custom-reason-text').required = true;
                } else {
                    customGroup.classList.add('hidden');
                    document.getElementById('custom-reason-text').required = false;
                }
            });

            document.getElementById('report-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const reason = document.getElementById('report-reason').value;
                const customReason = document.getElementById('custom-reason-text').value;

                try {
                    await this.api.post('/reports', {
                        videoId,
                        reason,
                        customReason: reason === 'Other' ? customReason : null
                    });
                    this.hideModal();
                    this.showToast('Report submitted successfully', 'success');
                } catch (error) {
                    console.error('Report error:', error);
                    this.showToast('Error submitting report', 'error');
                }
            });

            document.getElementById('modal-cancel-btn').onclick = () => this.hideModal();
        } catch (error) {
            console.error('Error loading report reasons:', error);
            this.showToast('Error loading report form', 'error');
        }
    },

    setupEventListeners() {
        // Close modal when clicking outside
        this.elements.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.elements.modalContainer) {
                this.hideModal();
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    },

    // Load comments for a video
    async loadComments(videoId) {
        try {
            const response = await this.api.get(`/comments/video/${videoId}`);
            const comments = response.success ? response.comments : [];
            const commentsList = document.getElementById('comments-list');

            if (comments.length === 0) {
                commentsList.innerHTML = '<p class="text-center text-muted">No comments yet</p>';
                return;
            }

            const commentsHtml = comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${comment.userId}</span>
                        <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p class="comment-text">${comment.text}</p>
                </div>
            `).join('');

            commentsList.innerHTML = commentsHtml;
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }
});

// Note: App initialization is handled in app.js, so we don't need to initialize here

// Initialize the application when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
