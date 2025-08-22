// --------------------------------------------------------------------------------------------------
// --- File: public/main.js ---
// --------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const appContainer = document.getElementById('app-container');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const loginModal = document.getElementById('login-modal');
    const videoGallery = document.getElementById('video-gallery');
    const categoryFilter = document.getElementById('category-filter');
    const searchBar = document.getElementById('search-bar');
    const adminTools = document.getElementById('admin-tools');
    const addVideoBtn = document.getElementById('add-video-btn');
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    const videoModal = document.getElementById('video-modal');
    const manageCategoriesModal = document.getElementById('manage-categories-modal');
    const loginForm = document.getElementById('login-form');
    const videoForm = document.getElementById('video-form');
    const addCategoryForm = document.getElementById('add-category-form');
    const categoryListAdmin = document.getElementById('category-list-admin');
    const modalTitle = document.getElementById('modal-title');
    const videoIdInput = document.getElementById('video-id');
    const videoTitleInput = document.getElementById('video-title');
    const videoDescriptionInput = document.getElementById('video-description');
    const videoUrlInput = document.getElementById('video-url');
    const videoThumbnailInput = document.getElementById('video-thumbnail');
    const videoCategorySelect = document.getElementById('video-category');
    const videoPlayerModal = document.getElementById('video-player-modal');
    const videoPlayer = document.getElementById('video-player');
    const playerTitle = document.getElementById('player-title');
    const playerDescription = document.getElementById('player-description');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    const closeMessageBtn = document.getElementById('close-message-btn');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const langToggleButton = document.getElementById('lang-toggle-btn');
    const body = document.body;

    let allVideos = [];
    let allCategories = [];
    let currentFilteredVideos = [];

    // Language management
    let currentLang = localStorage.getItem('lang') || 'th';
    const translations = {
        'th': {
            'login': 'เข้าสู่ระบบ',
            'logout': 'ออกจากระบบ',
            'toggleTheme': 'เปลี่ยนธีม',
            'toggleLang': 'EN',
            'searchVideo': 'ค้นหาวิดีโอ...',
            'addVideo': 'เพิ่มวิดีโอ',
            'manageCategories': 'จัดการหมวดหมู่',
            'loginTitle': 'เข้าสู่ระบบ',
            'username': 'ชื่อผู้ใช้',
            'password': 'รหัสผ่าน',
            'cancel': 'ยกเลิก',
            'loginBtn': 'เข้าสู่ระบบ',
            'videoTitle': 'ชื่อวิดีโอ',
            'description': 'คำอธิบาย',
            'thumbnailUrl': 'URL รูปหน้าปก (Thumbnail)',
            'category': 'หมวดหมู่',
            'saveVideo': 'บันทึกวิดีโอ',
            'manageCategoriesTitle': 'จัดการหมวดหมู่',
            'addNewCategory': 'เพิ่มหมวดหมู่ใหม่',
            'categoryName': 'ชื่อหมวดหมู่',
            'add': 'เพิ่ม',
            'existingCategories': 'หมวดหมู่ที่มีอยู่',
            'close': 'ปิด',
            'confirmDelete': 'คุณแน่ใจหรือไม่ว่าต้องการลบ?',
            'delete': 'ลบ',
            'ok': 'ตกลง',
            'noVideos': 'ไม่มีวิดีโอในหมวดหมู่นี้',
            'noDescription': 'ไม่มีคำอธิบาย',
            'edit': 'แก้ไข',
            'deleteBtn': 'ลบ',
            'all': 'ทั้งหมด',
            'loginSuccess': 'เข้าสู่ระบบสำเร็จ!',
            'logoutSuccess': 'ออกจากระบบแล้ว',
            'videoSaved': 'วิดีโอบันทึกเรียบร้อย!',
            'videoAdded': 'เพิ่มวิดีโอสำเร็จ!',
            'videoUpdated': 'อัปเดตวิดีโอสำเร็จ!',
            'categoryAdded': 'เพิ่มหมวดหมู่สำเร็จ!',
            'categoryDeleted': 'ลบหมวดหมู่สำเร็จ!',
            'invalidUrl': 'URL วิดีโอไม่ถูกต้อง. โปรดใช้ลิงก์จาก YouTube',
            'failedFetch': 'การเชื่อมต่อล้มเหลว. โปรดตรวจสอบเซิร์ฟเวอร์',
        },
        'en': {
            'login': 'Login',
            'logout': 'Logout',
            'toggleTheme': 'Toggle Theme',
            'toggleLang': 'TH',
            'searchVideo': 'Search videos...',
            'addVideo': 'Add Video',
            'manageCategories': 'Manage Categories',
            'loginTitle': 'Login',
            'username': 'Username',
            'password': 'Password',
            'cancel': 'Cancel',
            'loginBtn': 'Login',
            'videoTitle': 'Video Title',
            'description': 'Description',
            'thumbnailUrl': 'Thumbnail URL',
            'category': 'Category',
            'saveVideo': 'Save Video',
            'manageCategoriesTitle': 'Manage Categories',
            'addNewCategory': 'Add New Category',
            'categoryName': 'Category Name',
            'add': 'Add',
            'existingCategories': 'Existing Categories',
            'close': 'Close',
            'confirmDelete': 'Are you sure you want to delete?',
            'delete': 'Delete',
            'ok': 'OK',
            'noVideos': 'No videos in this category',
            'noDescription': 'No description',
            'edit': 'Edit',
            'deleteBtn': 'Delete',
            'all': 'All',
            'loginSuccess': 'Login successful!',
            'logoutSuccess': 'Logged out successfully',
            'videoSaved': 'Video saved!',
            'videoAdded': 'Video added successfully!',
            'videoUpdated': 'Video updated successfully!',
            'categoryAdded': 'Category added!',
            'categoryDeleted': 'Category deleted!',
            'invalidUrl': 'Invalid video URL. Please use a YouTube link.',
            'failedFetch': 'Connection failed. Please check the server.',
        }
    };

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            el.textContent = translations[lang][key];
        });
        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            el.placeholder = translations[lang][key];
        });
        // Re-render videos and categories to update their text
        displayVideos(currentFilteredVideos);
        displayCategories(allCategories);
        // Special case for language button text
        langToggleButton.textContent = translations[lang]['toggleLang'];
        // Update modal titles
        document.getElementById('modal-title').textContent = translations[lang]['videoTitle'];
        document.querySelector('#login-modal h2').textContent = translations[lang]['loginTitle'];
        document.querySelector('#manage-categories-modal h2').textContent = translations[lang]['manageCategoriesTitle'];
    }

    // Helper function to show modals
    function showModal(modalElement) {
        modalElement.style.display = 'flex';
    }

    // Helper function to hide modals
    function hideModal(modalElement) {
        modalElement.style.display = 'none';
    }

    // Show a custom message box instead of `alert()`
    function showMessage(message) {
        messageText.textContent = message;
        showModal(messageBox);
    }

    // Function to show the custom confirmation modal
    function showConfirmModal(callback) {
        document.getElementById('confirm-text').textContent = translations[currentLang]['confirmDelete'];
        document.getElementById('cancel-delete-btn').textContent = translations[currentLang]['cancel'];
        document.getElementById('confirm-delete-btn').textContent = translations[currentLang]['delete'];
        showModal(confirmModal);
        confirmDeleteBtn.onclick = () => {
            hideModal(confirmModal);
            callback(true);
        };
        cancelDeleteBtn.onclick = () => {
            hideModal(confirmModal);
            callback(false);
        };
    }

    // Function to convert YouTube URL to embed URL
    function convertUrlToEmbed(url) {
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeRegex);
        if (match && match[1]) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
        return url; // Return original if no match
    }
    
    // Function to get YouTube video ID from a URL
    function getYouTubeVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return (match && match[1]) ? match[1] : null;
    }

    // Function to get YouTube thumbnail URL from a video ID
    function getYouTubeThumbnail(videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    // Check admin authentication status and show/hide controls
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();
            const isAdmin = data.isAuthenticated;

            // Toggle main admin buttons
            if (isAdmin) {
                adminLoginBtn.classList.add('hidden');
                adminLogoutBtn.classList.remove('hidden');
                adminTools.classList.remove('hidden');
            } else {
                adminLoginBtn.classList.remove('hidden');
                adminLogoutBtn.classList.add('hidden');
                adminTools.classList.add('hidden');
            }

            // Toggle individual video card admin controls
            document.querySelectorAll('.admin-controls').forEach(controls => {
                if (isAdmin) {
                    controls.classList.remove('hidden');
                } else {
                    controls.classList.add('hidden');
                }
            });
        } catch (err) {
            console.error('Failed to check auth status:', err);
        }
    }

    // Fetch and display videos
    async function fetchVideos() {
        try {
            const res = await fetch('/api/videos');
            if (res.ok) {
                allVideos = await res.json();
                displayVideos(allVideos);
            } else {
                const errorData = await res.json();
                showMessage(`Error fetching videos: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    }

    // Fetch and display categories
    async function fetchCategories() {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) {
                allCategories = await res.json();
                displayCategories(allCategories);
                populateCategoryDropdown(allCategories);
            } else {
                const errorData = await res.json();
                showMessage(`Error fetching categories: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
            showMessage(translations[currentLang]['failedFetch']);
        }
    }

    // Render video cards
    function displayVideos(videos) {
        videoGallery.innerHTML = ''; // Clear existing cards
        if (videos.length === 0) {
            videoGallery.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">${translations[currentLang]['noVideos']}</div>`;
            return;
        }

        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-transform duration-300 hover:scale-105 video-card';
            card.setAttribute('data-id', video.id);
            // Dynamic thumbnail URL generation
            let thumbnailUrl = 'https://placehold.co/400x225/1f2937/d1d5db?text=No+Thumbnail'; // Default placeholder
            if (video.thumbnail_url) {
                thumbnailUrl = video.thumbnail_url;
            } else if (video.url) {
                const videoId = getYouTubeVideoId(video.url);
                if (videoId) {
                    thumbnailUrl = getYouTubeThumbnail(videoId);
                }
            }

            card.innerHTML = `
                <div class="relative w-full aspect-video overflow-hidden">
                    <img src="${thumbnailUrl}" onerror="this.src='https://placehold.co/400x225/1f2937/d1d5db?text=No+Thumbnail';" alt="${video.title}" class="w-full h-full object-cover video-thumbnail transition-all duration-300">
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-lg text-white">${video.title}</h3>
                    <p class="text-sm text-gray-400 mt-1">${video.description || translations[currentLang]['noDescription']}</p>
                    <div class="mt-4 flex space-x-2 admin-controls hidden">
                        <button class="py-1 px-3 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 edit-btn" data-id="${video.id}" data-lang-key="edit">${translations[currentLang]['edit']}</button>
                        <button class="py-1 px-3 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 delete-btn" data-id="${video.id}" data-lang-key="deleteBtn">${translations[currentLang]['deleteBtn']}</button>
                    </div>
                </div>
            `;
            videoGallery.appendChild(card);
        });

        // After displaying, check auth status to show/hide admin controls
        checkAuthStatus();
    }

    // Render category buttons
    function displayCategories(categories) {
        categoryFilter.innerHTML = `<button data-category="All" class="category-btn active py-2 px-4 rounded-full text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700">${translations[currentLang]['all']}</button>`;
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-btn py-2 px-4 rounded-full text-sm font-medium transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600';
            button.setAttribute('data-category', category.name);
            button.textContent = category.name;
            categoryFilter.appendChild(button);
        });
    }

    // Populate category dropdown in video form
    function populateCategoryDropdown(categories) {
        videoCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }

    // Filter videos by category
    function filterByCategory(category) {
        if (category === 'All') {
            currentFilteredVideos = allVideos;
        } else {
            currentFilteredVideos = allVideos.filter(video => video.category === category);
        }
        displayVideos(currentFilteredVideos);
    }

    // Search videos by title AND description
    function searchVideos(query) {
        const lowerCaseQuery = query.toLowerCase();
        const filtered = allVideos.filter(video =>
            video.title.toLowerCase().includes(lowerCaseQuery) ||
            (video.description && video.description.toLowerCase().includes(lowerCaseQuery))
        );
        displayVideos(filtered);
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                hideModal(loginModal);
                showMessage(translations[currentLang]['loginSuccess']);
                checkAuthStatus();
            } else {
                const data = await res.json();
                showMessage(data.error);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle add/edit video form submission
    videoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = videoIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/api/videos/${id}` : '/api/videos';

        const rawUrl = videoUrlInput.value;
        const embedUrl = convertUrlToEmbed(rawUrl);

        if (!embedUrl.startsWith('https://www.youtube.com/embed/')) {
            showMessage(translations[currentLang]['invalidUrl']);
            return;
        }

        const videoData = {
            title: videoTitleInput.value,
            description: videoDescriptionInput.value,
            url: embedUrl,
            thumbnail_url: videoThumbnailInput.value,
            category: videoCategorySelect.value,
        };

        try {
            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(videoData),
            });

            if (res.ok) {
                hideModal(videoModal);
                showMessage(id ? translations[currentLang]['videoUpdated'] : translations[currentLang]['videoAdded']);
                fetchVideos();
            } else {
                const data = await res.json();
                showMessage(data.error);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle add category form submission
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-category-name').value;
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                showMessage(translations[currentLang]['categoryAdded']);
                fetchCategories();
                document.getElementById('new-category-name').value = '';
            } else {
                const data = await res.json();
                showMessage(data.error);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle category deletion
    async function deleteCategory(id) {
        showConfirmModal(async (isConfirmed) => {
            if (!isConfirmed) return;
            try {
                const res = await fetch(`/api/categories/${id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    showMessage(translations[currentLang]['categoryDeleted']);
                    fetchCategories();
                } else {
                    const data = await res.json();
                    showMessage(data.error);
                }
            } catch (err) {
                showMessage(translations[currentLang]['failedFetch']);
            }
        });
    }

    // Event Listeners for buttons and forms
    adminLoginBtn.addEventListener('click', () => showModal(loginModal));
    adminLogoutBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/logout', { method: 'POST' });
            if (res.ok) {
                showMessage(translations[currentLang]['logoutSuccess']);
                checkAuthStatus();
            } else {
                const data = await res.json();
                showMessage(data.error || translations[currentLang]['logoutSuccess']);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });
    addVideoBtn.addEventListener('click', () => {
        modalTitle.textContent = translations[currentLang]['videoTitle'];
        videoForm.reset();
        videoIdInput.value = '';
        showModal(videoModal);
    });
    manageCategoriesBtn.addEventListener('click', () => {
        showModal(manageCategoriesModal);
        // Refresh category list for admin panel
        categoryListAdmin.innerHTML = allCategories.map(cat => `
            <div class="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                <span>${cat.name}</span>
                <button class="delete-category-btn text-red-500 hover:text-red-400" data-id="${cat.id}">${translations[currentLang]['delete']}</button>
            </div>
        `).join('');
    });

    // Handle clicks on the category filter buttons
    categoryFilter.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-blue-600', 'text-white');
                btn.classList.add('bg-gray-700', 'text-gray-300');
            });
            e.target.classList.add('active', 'bg-blue-600', 'text-white');
            e.target.classList.remove('bg-gray-700', 'text-gray-300');
            const category = e.target.dataset.category;
            filterByCategory(category);
        }
    });

    // Handle clicks on video cards (for play) and admin controls
    videoGallery.addEventListener('click', (e) => {
        const card = e.target.closest('.video-card');
        if (!card) return;

        if (e.target.classList.contains('edit-btn')) {
            e.stopPropagation();
            const id = e.target.dataset.id;
            const video = allVideos.find(v => v.id == id);
            if (video) {
                videoIdInput.value = video.id;
                videoTitleInput.value = video.title;
                videoDescriptionInput.value = video.description;
                videoUrlInput.value = video.url;
                videoThumbnailInput.value = video.thumbnail_url;
                videoCategorySelect.value = video.category;
                modalTitle.textContent = translations[currentLang]['videoTitle']; // Assuming edit title
                showModal(videoModal);
            }
        } else if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            const id = e.target.dataset.id;
            showConfirmModal(async (isConfirmed) => {
                if (isConfirmed) {
                    try {
                        const res = await fetch(`/api/videos/${id}`, {
                            method: 'DELETE',
                        });
                        if (res.ok) {
                            showMessage(translations[currentLang]['videoDeleted']);
                            fetchVideos();
                        } else {
                            const data = await res.json();
                            showMessage(data.error);
                        }
                    } catch (err) {
                        showMessage(translations[currentLang]['failedFetch']);
                    }
                }
            });
        } else {
            // Play video on card click
            const id = card.dataset.id;
            const video = allVideos.find(v => v.id == id);
            if (video) {
                playerTitle.textContent = video.title;
                playerDescription.textContent = video.description || '';
                videoPlayer.innerHTML = `<iframe src="${video.url}" frameborder="0" allowfullscreen class="w-full h-full rounded-xl"></iframe>`;
                showModal(videoPlayerModal);
            }
        }
    });

    // Handle category deletion in admin modal
    manageCategoriesModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-category-btn')) {
            const id = e.target.dataset.id;
            deleteCategory(id);
        }
    });

    // Handle search bar input
    searchBar.addEventListener('input', (e) => {
        searchVideos(e.target.value);
    });

    // Close modals with the modal-close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            hideModal(e.target.closest('.modal'));
            // Stop video playback when player modal is closed
            if (e.target.closest('.modal') === videoPlayerModal) {
                videoPlayer.innerHTML = '';
            }
        });
    });

    // Close message box
    closeMessageBtn.addEventListener('click', () => hideModal(messageBox));

    // Theme toggle functionality
    themeToggleButton.addEventListener('click', () => {
        body.classList.toggle('light-theme');
        const isLightTheme = body.classList.contains('light-theme');
        localStorage.setItem('theme', isLightTheme ? 'light' : 'dark');
        if (isLightTheme) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    });

    // Language toggle functionality
    langToggleButton.addEventListener('click', () => {
        const newLang = currentLang === 'th' ? 'en' : 'th';
        setLanguage(newLang);
    });

    // Initial load
    // Check for saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        body.classList.remove('light-theme');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
    // Set initial language
    setLanguage(currentLang);
    fetchVideos();
    fetchCategories();
    checkAuthStatus();
});
