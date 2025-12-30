// VisionHub - Video Content Management System
// Frontend Application Logic

// Global application state
const App = {
    // State management
    state: {
        currentUser: null,
        currentPage: 'home',
        currentVideoId: null,
        currentVideoPage: 1,
        isAdminPanelOpen: false,
        currentAdminTab: 'users',
        siteSettings: {
            siteName: 'VisionHub',
            primaryColor: '#2a9d8f'
        },
        allVideos: [],
        featuredVideos: [],
        currentFeaturedIndex: 0,
        featuredIntervalId: null,
        isLoading: false
    },

    // DOM elements
    elements: {
        root: null,
        toastContainer: null,
        modalContainer: null,
        loadingOverlay: null
    },

    // API configuration
    apiBase: '/api',

    // Initialize the application
    async init() {
        console.log('App initialization started');
        this.elements.root = document.getElementById('root');
        this.elements.toastContainer = document.getElementById('toast-container');
        this.elements.modalContainer = document.getElementById('modal-container');
        this.elements.loadingOverlay = document.getElementById('loading-overlay');

        console.log('DOM elements initialized');

        // Check for existing authentication
        const token = localStorage.getItem('authToken');
        console.log('Auth token found:', !!token);
        if (token) {
            try {
                const response = await this.api.get('/auth/verify');
                console.log('Auth verification response:', response);
                if (response.success) {
                    this.state.currentUser = response.user;
                    console.log('User authenticated:', this.state.currentUser);
                } else {
                    // Token verification failed, remove invalid token
                    localStorage.removeItem('authToken');
                    this.state.currentUser = null;
                    console.log('Token verification failed, removed invalid token');
                }
            } catch (error) {
                // Token is invalid, remove it
                localStorage.removeItem('authToken');
                this.state.currentUser = null;
                console.log('Invalid token, removed from localStorage');
            }
        } else {
            // No token found, ensure currentUser is null
            this.state.currentUser = null;
            console.log('No auth token found, setting currentUser to null');
        }

        // Load initial data
        console.log('Loading initial data');
        await this.loadInitialData();

        // Start the application
        console.log('Rendering app');
        this.render();
        console.log('App rendered');

        // Set up event listeners
        console.log('Setting up event listeners');
        this.setupEventListeners();
        console.log('Event listeners set up');
    },

    // API methods
    api: {
        async request(endpoint, options = {}) {
            const token = localStorage.getItem('authToken');
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                ...options
            };

            if (config.body && typeof config.body === 'object') {
                config.body = JSON.stringify(config.body);
            }

            const response = await fetch(`${App.apiBase}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        },

        async get(endpoint) {
            return this.request(endpoint);
        },

        async post(endpoint, body) {
            return this.request(endpoint, {
                method: 'POST',
                body
            });
        },

        async put(endpoint, body) {
            return this.request(endpoint, {
                method: 'PUT',
                body
            });
        },

        async patch(endpoint, body) {
            return this.request(endpoint, {
                method: 'PATCH',
                body
            });
        },

        async delete(endpoint) {
            return this.request(endpoint, {
                method: 'DELETE'
            });
        }
    },

    // Load initial data from the server
    async loadInitialData() {
        try {
            this.showLoading(true);

            const settingsResponse = await this.api.get('/settings');
            if (settingsResponse.success) {
                this.state.siteSettings = {
                    ...this.state.siteSettings,
                    ...settingsResponse.settings
                };
                this.applySettings();
                console.log('Site settings loaded:', this.state.siteSettings);
            }

            await this.loadAllVideos();
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            this.showLoading(false);
        }
    },

    // Load all videos from the server
    async loadAllVideos() {
        try {
            console.log('Loading all videos');
            const response = await this.api.get('/videos');
            console.log('Videos response:', response);

            if (response.success) {
                this.state.allVideos = response.videos;
                console.log('All videos loaded:', this.state.allVideos.length);

                this.state.allVideos.forEach((video, index) => {
                    if (index < 5) {

                    }
                });

                this.state.featuredVideos = this.state.allVideos.filter(v => {

                    const isFeatured = v.isFeatured === true || v.isFeatured === 1 || v.isFeatured === '1';
                    if (isFeatured && this.state.featuredVideos && this.state.featuredVideos.length < 5) {
                        console.log('Found featured video:', v.id, v.title);
                    }
                    return isFeatured;
                });

                console.log('Featured videos count:', this.state.featuredVideos.length);
                console.log('First few featured videos:', this.state.featuredVideos.slice(0, 3));
            } else {
                console.error('Failed to load videos, response:', response);
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.showToast('Failed to load videos', 'error');
        }
    },

    // Apply site settings to the UI
    applySettings() {
        document.getElementById('site-title').textContent = this.state.siteSettings.siteName;
        document.documentElement.style.setProperty('--primary-color', this.state.siteSettings.primaryColor);
    },

    // Navigate to a different page
    navigateTo(page, data = null) {
        console.log('Navigating to page:', page, 'with data:', data);
        console.log('Current featuredIntervalId before clearing:', this.state.featuredIntervalId);
        if (this.state.featuredIntervalId) {
            console.log('Clearing existing interval:', this.state.featuredIntervalId);
            clearInterval(this.state.featuredIntervalId);
            this.state.featuredIntervalId = null;
        }

        this.state.currentPage = page;

        if (page === 'video') {
            this.state.currentVideoId = data;
        } else if (page === 'admin') {
            this.state.isAdminPanelOpen = true;
            this.state.currentAdminTab = data || 'users';
        } else {
            this.state.isAdminPanelOpen = false;
        }

        this.render();

    },

    // Render the current page
    render() {
        console.log('Rendering app, current page:', this.state.currentPage, 'user:', this.state.currentUser);
        console.log('Featured interval ID during render:', this.state.featuredIntervalId);
        if (!this.state.currentUser) {
            console.log('No current user, rendering login page');
            this.renderLoginPage();
        } else {
            console.log('Rendering main app for user:', this.state.currentUser.username);
            switch (this.state.currentPage) {
                case 'home':
                    console.log('Rendering home page');
                    this.renderHomePage();
                    break;
                case 'video':
                    console.log('Rendering video page for video ID:', this.state.currentVideoId);
                    this.renderVideoPage(this.state.currentVideoId);
                    break;
                case 'admin':
                    console.log('Rendering admin page');
                    this.renderAdminPage();
                    break;
                case 'favorites':
                    console.log('Rendering favorites page');
                    this.renderFavoritesPage();
                    break;
                default:
                    console.log('Rendering default home page');
                    this.renderHomePage();
            }
        }
        this.applySettings();
    },

    // Render the login page
    renderLoginPage() {
        const loginHtml = `
            <div class="login-container">
                <div class="login-card">
                    <h2 class="login-title">Log In</h2>
                    <form id="login-form" class="space-y-4">
                        <div class="form-group">
                            <label for="username" class="form-label">Username</label>
                            <input type="text" id="username" name="username" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" id="password" name="password" class="form-input" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-full">
                            Log In
                        </button>
                        <div id="login-message" class="error-message hidden"></div>
                        <div class="login-help">
                            <p>Test accounts: admin / 123456</p>
                            <p>or: user / 123456</p>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.elements.root.innerHTML = loginHtml;
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    },

    // Render the main application layout
    renderMainApp() {

        const isAdmin = this.state.currentUser?.role === 'admin';
        const mainAppHtml = `
            <header class="header">
                <div class="flex items-center space-x-4">
                    <h1 id="site-title-link" class="header-title">
                        ${this.state.siteSettings.siteName}
                    </h1>
                    <div class="search-container">
                        <input type="text" id="search-input" placeholder="Search videos..." class="search-input">
                    </div>
                </div>
                <div class="header-actions">
                    <button id="favorites-button" class="btn btn-secondary">
                        Favorites
                    </button>
                    ${isAdmin ? `
                        <button id="admin-panel-toggle" class="btn-icon btn-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.942 3.313.841 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.942 1.543.841 3.313-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.942-3.313-.841-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.942-1.543.841-3.313 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    ` : ''}
                    <button id="logout-button" class="btn btn-secondary">
                        Log Out
                    </button>
                </div>
            </header>
            <div id="content"></div>
        `;

        this.elements.root.innerHTML = mainAppHtml;

        document.getElementById('site-title-link').addEventListener('click', () => this.navigateTo('home'));
        if (isAdmin) {
            document.getElementById('admin-panel-toggle').addEventListener('click', () => this.navigateTo('admin'));
        }
        document.getElementById('logout-button').addEventListener('click', () => this.handleLogout());
        document.getElementById('favorites-button').addEventListener('click', () => this.navigateTo('favorites'));
        document.getElementById('search-input').addEventListener('input', (e) => this.handleSearch(e));
    },

    // Start the featured video carousel
    startFeaturedCarousel() {
        console.log('startFeaturedCarousel called, featuredVideos length:', this.state.featuredVideos.length);
        console.log('Current featuredIntervalId:', this.state.featuredIntervalId);

        if (this.state.featuredIntervalId) {
            console.log('Clearing existing carousel interval:', this.state.featuredIntervalId);
            clearInterval(this.state.featuredIntervalId);
            this.state.featuredIntervalId = null;
        }

        if (this.state.featuredVideos && this.state.featuredVideos.length > 1) {
            console.log('Starting featured carousel with', this.state.featuredVideos.length, 'videos');
            this.updateFeaturedVideo();

            this.state.featuredIntervalId = setInterval(() => {
                console.log('Carousel interval triggered at:', new Date().toISOString());
                this.updateFeaturedVideo();
            }, 5000);
            console.log('New carousel interval ID:', this.state.featuredIntervalId);
        } else {
            console.log('Not enough featured videos to start carousel, count:',
                this.state.featuredVideos ? this.state.featuredVideos.length : 0);
        }
    },

    // Update the featured video in the carousel
    updateFeaturedVideo() {

        if (!this.state.featuredVideos || this.state.featuredVideos.length === 0) {

            return;
        }

        console.log('Updating featured video, current index:', this.state.currentFeaturedIndex);

        this.state.currentFeaturedIndex = (this.state.currentFeaturedIndex + 1) % this.state.featuredVideos.length;
        const featuredVideo = this.state.featuredVideos[this.state.currentFeaturedIndex];
        console.log('New index:', this.state.currentFeaturedIndex, 'Video:', featuredVideo);

        const featuredSection = document.getElementById('featured-section');
        console.log('Featured section element:', featuredSection);

        if (featuredSection && featuredVideo) {
            const newHtml = `
                <h2 class="text-2xl font-bold mb-4">Featured</h2>
                <div class="featured-video">
                    <div class="featured-content">
                        <div class="featured-image-container">
                            <img data-video-id="${featuredVideo.id}" src="${featuredVideo.thumbnailUrl}" alt="${featuredVideo.title}" class="video-card-img cursor-pointer">
                        </div>
                        <div class="featured-text-container">
                            <h3 class="featured-title">${featuredVideo.title}</h3>
                            <p class="featured-description">${featuredVideo.description}</p>
                            <button data-video-id="${featuredVideo.id}" class="btn btn-primary mt-4">
                                Watch Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
            console.log('Setting featured section HTML:', newHtml);
            featuredSection.innerHTML = newHtml;

        } else {

        }
    },

    // Render the home page
    async renderHomePage(filteredVideos = null) {
        console.log('renderHomePage called, filteredVideos:', !!filteredVideos);
        this.renderMainApp();
        const contentDiv = document.getElementById('content');

        const videosToRender = filteredVideos || this.state.allVideos;
        const hasFeatured = this.state.featuredVideos && this.state.featuredVideos.length > 0 && !filteredVideos;

        console.log('Rendering home page, featured videos count:',
            this.state.featuredVideos ? this.state.featuredVideos.length : 0,
            'hasFeatured:', hasFeatured);

        const trendingVideos = [...videosToRender]
            .sort((a, b) => b.views - a.views)
            .slice(0, 4);

        let categories = [];
        try {
            const response = await this.api.get('/categories');
            if (response.success) {
                categories = response.categories;
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }

        const categoriesHtml = categories.map(cat => `
            <div class="card cursor-pointer" data-category-id="${cat.id}">
                <h3 class="text-xl font-bold text-primary">${cat.name}</h3>
                <p class="text-sm text-secondary mt-2">
                    ${videosToRender.filter(v => v.categoryId === cat.id).length} videos
                </p>
            </div>
        `).join('');

        // Pagination variables
        const videosPerPage = 10; // 5 videos per row, 2 rows per page
        const totalPages = Math.ceil(videosToRender.length / videosPerPage);
        const currentPage = this.state.currentVideoPage || 1;
        const startIndex = (currentPage - 1) * videosPerPage;
        const paginatedVideos = videosToRender.slice(startIndex, startIndex + videosPerPage);

        const homepageHtml = `
            <div class="space-y-8">
                ${hasFeatured ? `
                    <section id="featured-section">
                        <!-- Featured video will be rendered here -->
                    </section>
                ` : ''}

                ${trendingVideos.length > 0 && !filteredVideos ? `
                    <section>
                        <h2 class="text-2xl font-bold mb-4">Trending Videos</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                            ${trendingVideos.map(video => `
                                <div class="video-card" data-video-id="${video.id}">
                                    <img src="${video.thumbnailUrl}" alt="${video.title}" class="video-card-img">
                                    <div class="video-card-content">
                                        <h3 class="video-card-title">${video.title}</h3>
                                        <p class="video-card-meta">${video.views} views</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                ${!filteredVideos ? `
                    <section>
                        <h2 class="text-2xl font-bold mb-4">Categories</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                            ${categoriesHtml}
                        </div>
                    </section>
                ` : ''}

                <section>
                    <h2 class="text-2xl font-bold mb-4">${filteredVideos ? 'Search Results' : 'All Videos'}</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                        ${paginatedVideos.length > 0 ? paginatedVideos.map(video => `
                            <div class="video-card" data-video-id="${video.id}">
                                <img src="${video.thumbnailUrl}" alt="${video.title}" class="video-card-img">
                                <div class="video-card-content">
                                    <h3 class="video-card-title">${video.title}</h3>
                                    <p class="video-card-meta">Category: ${video.categoryName}</p>
                                </div>
                            </div>
                        `).join('') : '<div class="text-center text-muted col-span-full">No videos found</div>'}
                    </div>
                    ${!filteredVideos && totalPages > 1 ? `
                        <div class="pagination">
                            <button class="pagination-button" id="prev-page-group" ${currentPage <= 10 ? 'disabled' : ''}>
                                &laquo; Prev 10
                            </button>
                            <button class="pagination-button" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
                                Previous
                            </button>
                            ${this.generatePageButtons(currentPage, totalPages)}
                            <button class="pagination-button" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
                                Next
                            </button>
                            <button class="pagination-button" id="next-page-group" ${currentPage > totalPages - 10 ? 'disabled' : ''}>
                                Next 10 &raquo;
                            </button>
                        </div>
                    ` : ''}
                </section>
            </div>
        `;

        contentDiv.innerHTML = homepageHtml;

        if (hasFeatured) {

            const featuredSection = document.getElementById('featured-section');
            if (featuredSection) {

                featuredSection.addEventListener('click', (e) => {

                    let target = e.target;
                    while (target && target !== featuredSection) {
                        if (target.dataset && target.dataset.videoId) {
                            const videoId = target.dataset.videoId;
                            console.log('Clicked featured video with ID (delegated):', videoId);
                            if (videoId) {
                                this.navigateTo('video', videoId);
                                break;
                            }
                        }
                        target = target.parentElement;
                    }
                });
            }

            setTimeout(() => {

                if (this.state.featuredVideos && this.state.featuredVideos.length > 1) {

                    this.startFeaturedCarousel();
                } else {
                    console.log('Still not enough featured videos to start carousel, count:',
                        this.state.featuredVideos ? this.state.featuredVideos.length : 0);
                }
            }, 100);
        }

        document.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const videoId = e.currentTarget.dataset.videoId;
                if (videoId) {
                    this.navigateTo('video', videoId);
                }
            });
        });

        document.querySelectorAll('[data-category-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.categoryId;
                const categoryVideos = this.state.allVideos.filter(v => v.categoryId == categoryId);
                this.renderHomePage(categoryVideos);
            });
        });

        // Add pagination event listeners
        if (!filteredVideos && totalPages > 1) {
            document.getElementById('prev-page')?.addEventListener('click', () => {
                if (currentPage > 1) {
                    this.state.currentVideoPage = currentPage - 1;
                    this.renderHomePage();
                }
            });

            document.getElementById('next-page')?.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    this.state.currentVideoPage = currentPage + 1;
                    this.renderHomePage();
                }
            });

            document.getElementById('prev-page-group')?.addEventListener('click', () => {
                const newPage = Math.max(1, currentPage - 10);
                this.state.currentVideoPage = newPage;
                this.renderHomePage();
            });

            document.getElementById('next-page-group')?.addEventListener('click', () => {
                const newPage = Math.min(totalPages, currentPage + 10);
                this.state.currentVideoPage = newPage;
                this.renderHomePage();
            });

            document.querySelectorAll('.pagination-button[data-page]').forEach(button => {
                button.addEventListener('click', (e) => {
                    const page = parseInt(e.target.dataset.page);
                    if (page !== currentPage) {
                        this.state.currentVideoPage = page;
                        this.renderHomePage();
                    }
                });
            });
        }
    },

    // Generate page buttons with limited display
    generatePageButtons(currentPage, totalPages) {
        const pagesToShow = 10;
        const startPage = Math.floor((currentPage - 1) / pagesToShow) * pagesToShow + 1;
        const endPage = Math.min(startPage + pagesToShow - 1, totalPages);

        let buttons = '';
        for (let i = startPage; i <= endPage; i++) {
            buttons += `
                <button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        return buttons;
    }
};

Object.assign(App, {

    async renderVideoPage(videoId) {
        this.renderMainApp();
        const contentDiv = document.getElementById('content');

        try {

            console.log('Fetching video with ID:', videoId);
            const videoResponse = await this.api.get(`/videos/${videoId}`);

            if (!videoResponse.success) {
                contentDiv.innerHTML = `<div class="text-center text-error">Video not found: ${videoResponse.error || 'Unknown error'}</div>`;
                return;
            }

            const video = videoResponse.video;

            try {
                await this.api.post(`/videos/${videoId}/view`);
            } catch (error) {
                console.error('Error recording view:', error);
            }

            const relatedVideos = this.state.allVideos
                .filter(v => v.categoryId === video.categoryId && v.id != videoId)
                .slice(0, 4);

            let isFavorited = false;
            try {
                const favResponse = await this.api.get(`/favorites/${videoId}`);
                isFavorited = favResponse.isFavorited;
            } catch (error) {
                console.error('Error checking favorite status:', error);
            }

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
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4v3a1 1 0 001.6.8L12 4v8l5.4-3.2A1 1 0 0019 9V4a1 1 0 00-1.6-.8L12 7.2l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="p-6">
                                <div class="flex items-start justify-between mb-4">
                                    <h1 class="text-3xl font-bold">${video.title}</h1>
                                    <div class="flex space-x-2">
                                        <button id="favorite-btn" class="btn-icon ${isFavorited ? 'btn-danger' : 'btn-secondary'}" data-id="${video.id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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

            document.getElementById('favorite-btn').addEventListener('click', (e) => this.handleFavorite(e));
            document.getElementById('report-btn').addEventListener('click', (e) => this.handleReport(e));
            document.getElementById('comment-form').addEventListener('submit', (e) => this.handlePostComment(e));
            document.getElementById('skip-back-btn').addEventListener('click', () => this.skipVideo(-10));
            document.getElementById('skip-forward-btn').addEventListener('click', () => this.skipVideo(10));

            document.querySelectorAll('[data-video-id]').forEach(element => {
                element.addEventListener('click', (e) => {
                    const videoId = e.currentTarget.dataset.videoId;
                    if (videoId) {
                        this.navigateTo('video', videoId);
                    }
                });
            });

            this.loadComments(videoId);

        } catch (error) {
            console.error('Error rendering video page:', error);

            let errorMessage = 'Error loading video';
            if (error.message) {
                errorMessage += ': ' + error.message;
            } else if (error.toString) {
                errorMessage += ': ' + error.toString();
            }
            contentDiv.innerHTML = `<div class="text-center text-error">${errorMessage}</div>`;
        }
    },

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

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.state.currentAdminTab = e.target.dataset.tab;
                this.renderAdminPage();
            });
        });

        const adminModules = new AdminModules(this);
        adminModules.renderModule(this.state.currentAdminTab);
    },

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

    getVideoEmbed(url) {
        console.log('getVideoEmbed called with URL:', url);
        // Handle empty or invalid URLs
        if (!url || typeof url !== 'string') {
            console.log('Invalid URL: empty or not a string');
            return '<div class="text-center text-error">No valid video URL provided</div>';
        }

        // Trim whitespace
        url = url.trim();
        console.log('URL after trimming:', url);

        // Check if URL is empty after trimming
        if (!url) {
            console.log('URL is empty after trimming');
            return '<div class="text-center text-error">No video URL provided</div>';
        }

        try {
            if (url.includes('youtube.com/watch')) {
                console.log('YouTube URL detected');
                const parsedUrl = new URL(url);
                const videoId = parsedUrl.searchParams.get("v");
                if (!videoId) {
                    throw new Error('Invalid YouTube URL - missing video ID');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (url.includes('youtu.be/')) {
                console.log('YouTube short URL detected');
                // Handle YouTube short URLs
                const videoId = url.split('/').pop().split('?')[0];
                if (!videoId) {
                    throw new Error('Invalid YouTube short URL');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (url.includes('drive.google.com/file/d/')) {
                console.log('Google Drive URL detected');
                // Handle Google Drive URLs
                const videoId = url.split('/d/')[1].split('/')[0];
                if (!videoId) {
                    throw new Error('Invalid Google Drive URL');
                }
                return `<iframe class="absolute top-0 left-0 w-full h-full" src="https://drive.google.com/file/d/${videoId}/preview" frameborder="0" allowfullscreen></iframe>`;
            } else if (url.includes('onedrive.live.com/') || url.includes('1drv.ms')) {
                console.log('OneDrive URL detected');
                // Handle OneDrive URLs
                try {
                    let embedUrl = url;

                    // Handle 1drv.ms short links
                    if (url.includes('1drv.ms')) {
                        // Convert 1drv.ms to onedrive.live.com format
                        // Extract the path part after the domain
                        const urlParts = url.split('/');
                        if (urlParts.length >= 4) {
                            const pathPart = urlParts[3];
                            // Convert to embed format
                            embedUrl = `https://onedrive.live.com/embed.aspx?cid=${pathPart}`;
                        } else {
                            // Fallback - try to use the URL as-is in embed mode
                            embedUrl = url.replace('1drv.ms', 'onedrive.live.com/embed');
                        }
                    }

                    // Handle standard OneDrive links
                    if (embedUrl.includes('onedrive.live.com/')) {
                        // Convert view URLs to embed URLs
                        if (embedUrl.includes('/view.aspx')) {
                            embedUrl = embedUrl.replace('/view.aspx', '/embed.aspx');
                        } else if (!embedUrl.includes('embed')) {
                            // If it's not already an embed URL, try to convert it
                            const urlObj = new URL(embedUrl);
                            const params = new URLSearchParams(urlObj.search);
                            // Try to maintain important parameters
                            embedUrl = `https://onedrive.live.com/embed${urlObj.pathname}${urlObj.search}`;
                        }
                    }

                    return `<iframe class="absolute top-0 left-0 w-full h-full" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
                } catch (onedriveError) {
                    console.error('OneDrive URL processing error:', onedriveError);
                    // Fallback to direct video embedding if URL conversion fails
                    return `<video class="absolute top-0 left-0 w-full h-full" controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
                }
            } else {
                console.log('Other URL type detected');
                // For other URLs, try to use them directly as video sources
                // Add additional validation for the URL
                try {
                    // Check if it's a relative path (uploaded file) or absolute URL
                    if (url.startsWith('/')) {
                        console.log('Relative path detected, returning video tag directly');
                        // This is a relative path to an uploaded file
                        return `<video class="absolute top-0 left-0 w-full h-full" controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
                    } else {
                        console.log('Absolute URL detected, validating with URL constructor');
                        // This should be a full URL, validate it
                        new URL(url); // This will throw if URL is invalid
                        return `<video class="absolute top-0 left-0 w-full h-full" controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
                    }
                } catch (urlError) {
                    console.error('URL validation error:', urlError);
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

        this.elements.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.elements.modalContainer) {
                this.hideModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    },

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

// Initialize the application when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        App.init();
    });
} else {
    App.init();
}